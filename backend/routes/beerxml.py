import re
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from rapidfuzz import fuzz, process

from models.mongo_models import BeerStyleGuide, Ingredient, Recipe, User
from services.mongodb_service import MongoDBService
from utils.unit_conversions import UnitConverter

beerxml_bp = Blueprint("beerxml", __name__)


@beerxml_bp.route("/export/<recipe_id>", methods=["GET"])
@jwt_required()
def export_recipe_beerxml(recipe_id):
    """Export a recipe to BeerXML format"""
    user_id = get_jwt_identity()

    try:
        # Get recipe
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        # Check permissions
        if str(recipe.user_id) != user_id and not recipe.is_public:
            return jsonify({"error": "Access denied"}), 403

        # Generate BeerXML
        xml_content = generate_beerxml(recipe)

        return (
            jsonify(
                {
                    "xml": xml_content,
                    "filename": f"{sanitize_filename(recipe.name)}_recipe.xml",
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error exporting BeerXML: {e}")
        return jsonify({"error": "Failed to export recipe"}), 500


@beerxml_bp.route("/parse", methods=["POST"])
@jwt_required()
def parse_beerxml():
    """Parse BeerXML content and return structured data"""
    user_id = get_jwt_identity()

    try:
        data = request.get_json()
        xml_content = data.get("xml_content")

        if not xml_content:
            return jsonify({"error": "XML content is required"}), 400

        # Parse XML
        parsed_recipes = parse_beerxml_content(xml_content)

        if not parsed_recipes:
            return jsonify({"error": "No valid recipes found in XML"}), 400

        return jsonify({"recipes": parsed_recipes}), 200

    except Exception as e:
        print(f"Error parsing BeerXML: {e}")
        return jsonify({"error": f"Failed to parse BeerXML: {str(e)}"}), 400


@beerxml_bp.route("/match-ingredients", methods=["POST"])
@jwt_required()
def match_ingredients():
    """Match imported ingredients to existing database ingredients"""
    user_id = get_jwt_identity()

    try:
        data = request.get_json()
        imported_ingredients = data.get("ingredients", [])

        if not imported_ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        # Get available ingredients
        available_ingredients = get_available_ingredients_grouped()

        # Match ingredients
        matching_results = []
        for imported_ing in imported_ingredients:
            matches = find_ingredient_matches(imported_ing, available_ingredients)
            matching_results.append(
                {
                    "imported": imported_ing,
                    "matches": matches,
                    "best_match": matches[0] if matches else None,
                    "confidence": matches[0]["confidence"] if matches else 0,
                    "requires_new": len(matches) == 0 or matches[0]["confidence"] < 0.7,
                    "suggestedIngredientData": generate_new_ingredient_data(
                        imported_ing
                    ),
                }
            )

        return jsonify({"matching_results": matching_results}), 200

    except Exception as e:
        print(f"Error matching ingredients: {e}")
        return jsonify({"error": "Failed to match ingredients"}), 500


@beerxml_bp.route("/create-ingredients", methods=["POST"])
@jwt_required()
def create_missing_ingredients():
    """Create new ingredients that don't exist in the database"""
    user_id = get_jwt_identity()

    try:
        data = request.get_json()
        ingredients_to_create = data.get("ingredients", [])

        if not ingredients_to_create:
            return jsonify({"error": "No ingredients to create"}), 400

        created_ingredients = []

        for ing_data in ingredients_to_create:
            # Validate ingredient data
            validation_result = validate_ingredient_data(ing_data)
            if not validation_result["valid"]:
                return (
                    jsonify(
                        {
                            "error": f"Invalid ingredient data for {ing_data.get('name', 'unknown')}: {validation_result['errors']}"
                        }
                    ),
                    400,
                )

            # Create ingredient
            ingredient = Ingredient(**ing_data)
            ingredient.save()

            created_ingredients.append(ingredient.to_dict())

        return jsonify({"created_ingredients": created_ingredients}), 201

    except Exception as e:
        print(f"Error creating ingredients: {e}")
        return jsonify({"error": "Failed to create ingredients"}), 500


def generate_beerxml(recipe):
    """Generate BeerXML content from recipe"""
    # Create root element
    recipes = ET.Element("RECIPES")
    recipe_elem = ET.SubElement(recipes, "RECIPE")

    # Basic recipe info
    add_text_element(recipe_elem, "NAME", recipe.name)
    add_text_element(recipe_elem, "VERSION", "1")
    add_text_element(recipe_elem, "TYPE", "All Grain")

    if recipe.style:
        add_text_element(recipe_elem, "STYLE", recipe.style)

    # Convert batch size to liters (BeerXML standard)
    batch_size_unit = getattr(recipe, "batch_size_unit", "gal")
    if batch_size_unit == "l":
        batch_size_l = recipe.batch_size
        # For metric recipes, display in liters
        add_text_element(
            recipe_elem, "DISPLAY_BATCH_SIZE", f"{recipe.batch_size:.1f} L"
        )
    else:
        batch_size_l = UnitConverter.convert_volume(recipe.batch_size, "gal", "l")
        # For imperial recipes, display in gallons
        add_text_element(
            recipe_elem, "DISPLAY_BATCH_SIZE", f"{recipe.batch_size:.1f} gal"
        )

    add_text_element(recipe_elem, "BATCH_SIZE", f"{batch_size_l:.2f}")

    # Calculate boil size with appropriate display format
    boil_size_l = batch_size_l * 1.2  # 20% larger
    if batch_size_unit == "l":
        boil_size_display = boil_size_l
        add_text_element(recipe_elem, "DISPLAY_BOIL_SIZE", f"{boil_size_display:.1f} L")
    else:
        boil_size_display = UnitConverter.convert_volume(boil_size_l, "l", "gal")
        add_text_element(
            recipe_elem, "DISPLAY_BOIL_SIZE", f"{boil_size_display:.1f} gal"
        )

    add_text_element(recipe_elem, "BOIL_SIZE", f"{boil_size_l:.2f}")
    add_text_element(recipe_elem, "BOIL_TIME", str(recipe.boil_time or 60))
    add_text_element(recipe_elem, "EFFICIENCY", str(recipe.efficiency or 75))

    if recipe.description:
        add_text_element(recipe_elem, "NOTES", recipe.description)
    if recipe.notes:
        add_text_element(recipe_elem, "TASTE_NOTES", recipe.notes)

    # Add ingredients
    add_ingredients_to_xml(recipe_elem, recipe.ingredients)

    # Format XML with proper indentation
    _indent_xml(recipes)
    xml_string = ET.tostring(recipes, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_string}'


def add_ingredients_to_xml(recipe_elem, ingredients):
    """Add ingredients to BeerXML recipe element"""
    grains = [ing for ing in ingredients if ing.type == "grain"]
    hops = [ing for ing in ingredients if ing.type == "hop"]
    yeasts = [ing for ing in ingredients if ing.type == "yeast"]
    misc = [ing for ing in ingredients if ing.type == "other"]

    # Add fermentables
    if grains:
        fermentables_elem = ET.SubElement(recipe_elem, "FERMENTABLES")
        for grain in grains:
            fermentable_elem = ET.SubElement(fermentables_elem, "FERMENTABLE")
            add_text_element(fermentable_elem, "NAME", grain.name)
            add_text_element(fermentable_elem, "VERSION", "1")

            # Convert amount to kg
            amount_kg = UnitConverter.convert_weight(grain.amount, grain.unit, "kg")
            add_text_element(fermentable_elem, "AMOUNT", f"{amount_kg:.3f}")

            add_text_element(
                fermentable_elem, "TYPE", map_grain_type_to_xml(grain.grain_type)
            )

            # Calculate yield from potential
            if grain.potential:
                yield_pct = (grain.potential / 46) * 100
                add_text_element(fermentable_elem, "YIELD", f"{yield_pct:.1f}")
            else:
                add_text_element(fermentable_elem, "YIELD", "80.0")

            add_text_element(fermentable_elem, "COLOR", f"{grain.color or 0:.1f}")

    # Add hops
    if hops:
        hops_elem = ET.SubElement(recipe_elem, "HOPS")
        for hop in hops:
            hop_elem = ET.SubElement(hops_elem, "HOP")
            add_text_element(hop_elem, "NAME", hop.name)
            add_text_element(hop_elem, "VERSION", "1")

            # Convert amount to kg
            amount_kg = UnitConverter.convert_weight(hop.amount, hop.unit, "kg")
            add_text_element(hop_elem, "AMOUNT", f"{amount_kg:.3f}")

            add_text_element(hop_elem, "ALPHA", f"{hop.alpha_acid or 0:.1f}")
            add_text_element(hop_elem, "USE", map_hop_use_to_xml(hop.use))
            add_text_element(hop_elem, "TIME", str(hop.time or 0))
            add_text_element(hop_elem, "FORM", "Pellet")

    # Add yeasts
    if yeasts:
        yeasts_elem = ET.SubElement(recipe_elem, "YEASTS")
        for yeast in yeasts:
            yeast_elem = ET.SubElement(yeasts_elem, "YEAST")
            add_text_element(yeast_elem, "NAME", yeast.name)
            add_text_element(yeast_elem, "VERSION", "1")
            add_text_element(yeast_elem, "TYPE", "Ale")
            add_text_element(yeast_elem, "FORM", "Liquid")
            add_text_element(yeast_elem, "AMOUNT", str(yeast.amount or 1))
            add_text_element(
                yeast_elem,
                "AMOUNT_IS_WEIGHT",
                "FALSE" if yeast.unit == "pkg" else "TRUE",
            )
            add_text_element(yeast_elem, "ATTENUATION", str(yeast.attenuation or 75))

    # Add misc ingredients
    if misc:
        miscs_elem = ET.SubElement(recipe_elem, "MISCS")
        for misc_ing in misc:
            misc_elem = ET.SubElement(miscs_elem, "MISC")
            add_text_element(misc_elem, "NAME", misc_ing.name)
            add_text_element(misc_elem, "VERSION", "1")
            add_text_element(misc_elem, "TYPE", "Other")

            # Determine if weight or volume
            is_weight = misc_ing.unit in ["g", "kg", "oz", "lb", "tsp", "tbsp"]
            add_text_element(
                misc_elem, "AMOUNT_IS_WEIGHT", "TRUE" if is_weight else "FALSE"
            )

            if is_weight:
                amount = UnitConverter.convert_weight(
                    misc_ing.amount, misc_ing.unit, "kg"
                )
            else:
                amount = UnitConverter.convert_volume(
                    misc_ing.amount, misc_ing.unit, "l"
                )

            add_text_element(misc_elem, "AMOUNT", f"{amount:.3f}")
            add_text_element(misc_elem, "USE", map_misc_use_to_xml(misc_ing.use))
            add_text_element(misc_elem, "TIME", str(misc_ing.time or 0))


def parse_beerxml_content(xml_content):
    """Parse BeerXML content and return recipe data"""
    try:
        root = ET.fromstring(xml_content)
        recipes = []

        # Find all recipe elements
        recipe_elements = root.findall(".//RECIPE")

        for recipe_elem in recipe_elements:
            recipe_data = parse_recipe_element(recipe_elem)
            if recipe_data:
                recipes.append(recipe_data)

        return recipes

    except ET.ParseError as e:
        raise ValueError(f"Invalid XML format: {e}")
    except Exception as e:
        raise ValueError(f"Error parsing BeerXML: {e}")


def parse_recipe_element(recipe_elem):
    """Parse a single recipe element"""
    try:
        # Parse style information if present
        style_elem = recipe_elem.find("STYLE")
        style_name = ""
        if style_elem is not None:  # Fixed: use 'is not None' instead of truthiness
            style_name = get_text_content(style_elem, "NAME")
            if not style_name:
                # Fallback to basic style field
                style_name = get_text_content(recipe_elem, "STYLE") or ""
        else:
            # Check for basic style field
            style_name = get_text_content(recipe_elem, "STYLE") or ""

        recipe = {
            "name": get_text_content(recipe_elem, "NAME") or "Unnamed Recipe",
            "style": style_name,
            "description": get_text_content(recipe_elem, "NOTES") or "",
            "notes": get_text_content(recipe_elem, "TASTE_NOTES") or "",
            "boil_time": int(get_text_content(recipe_elem, "BOIL_TIME") or 60),
            "efficiency": float(get_text_content(recipe_elem, "EFFICIENCY") or 75),
            "is_public": False,
        }

        # Detect original unit system from DISPLAY_BATCH_SIZE
        display_batch_size = get_text_content(recipe_elem, "DISPLAY_BATCH_SIZE")
        detected_unit_system = UnitConverter.detect_unit_system_from_display_batch_size(
            display_batch_size
        )

        # Get batch size in liters (BeerXML standard)
        batch_size_l = float(get_text_content(recipe_elem, "BATCH_SIZE") or 19)

        # Convert batch size based on detected original unit system
        if detected_unit_system == "metric":
            # Recipe was originally in metric - keep as liters
            recipe["batch_size"] = batch_size_l
            recipe["batch_size_unit"] = "l"
        else:
            # Recipe was originally imperial or detection failed - convert to gallons (default behavior)
            recipe["batch_size"] = UnitConverter.convert_volume(
                batch_size_l, "l", "gal"
            )
            recipe["batch_size_unit"] = "gal"

        # Parse ingredients with detected unit system
        ingredients = []
        ingredients.extend(parse_fermentables(recipe_elem, detected_unit_system))
        ingredients.extend(parse_hops(recipe_elem, detected_unit_system))
        ingredients.extend(parse_yeasts(recipe_elem, detected_unit_system))
        ingredients.extend(parse_misc(recipe_elem, detected_unit_system))

        # Prepare recipe data for validation
        recipe_data_with_ingredients = {**recipe, "ingredients": ingredients}

        # Validate ingredient amounts and flag suspicious values
        validation_warnings = validate_ingredient_amounts(recipe_data_with_ingredients)

        return {
            "recipe": recipe,
            "ingredients": ingredients,
            "metadata": {
                "source": "BeerXML Import",
                "imported_at": datetime.now(UTC).isoformat(),
                "style_info": {
                    "declared_style": style_name,
                    "style_guide": (
                        get_text_content(style_elem, "STYLE_GUIDE")
                        if style_elem
                        is not None  # Fixed: use 'is not None' instead of truthiness
                        else None
                    ),
                    "category": (
                        get_text_content(style_elem, "CATEGORY")
                        if style_elem
                        is not None  # Fixed: use 'is not None' instead of truthiness
                        else None
                    ),
                },
                "validation_warnings": validation_warnings,  # Add validation warnings
            },
        }

    except Exception as e:
        print(f"Error parsing recipe element: {e}")
        return None


def parse_fermentables(recipe_elem, detected_unit_system=None):
    """Parse fermentable ingredients from recipe"""
    fermentables = []
    fermentable_elements = recipe_elem.findall(".//FERMENTABLES/FERMENTABLE")

    for elem in fermentable_elements:
        try:
            # Amount in kg (BeerXML standard)
            amount_kg = float(get_text_content(elem, "AMOUNT") or 0)

            # Convert to appropriate unit based on detected system
            if detected_unit_system == "metric":
                # Convert to grams for metric system
                amount = UnitConverter.round_to_brewing_precision(
                    amount_kg * 1000, "grain", "metric"
                )
                unit = "g"
            else:
                # Convert to ounces for imperial system (base unit consistency)
                amount = UnitConverter.round_to_brewing_precision(
                    UnitConverter.convert_weight(amount_kg, "kg", "oz"),
                    "grain",
                    "imperial",
                )
                unit = "oz"

            # Calculate potential from yield
            yield_pct = float(get_text_content(elem, "YIELD") or 80)
            potential = (yield_pct / 100) * 46

            fermentable_name = get_text_content(elem, "NAME") or "Unknown Fermentable"

            # Generate unique compound ID for recipe ingredient
            # Format: fermentablename_type_uniqueid
            fermentable_type = get_text_content(elem, "TYPE") or "grain"
            compound_id = f"{fermentable_name.replace(' ', '_')}_{fermentable_type}_{str(ObjectId())}"

            fermentable = {
                "ingredient_id": compound_id,  # Generate unique compound ID
                "name": fermentable_name,
                "type": "grain",
                "amount": amount,
                "unit": unit,
                "use": "mash",
                "time": 0,
                "potential": potential,
                "color": float(get_text_content(elem, "COLOR") or 0),
                "grain_type": map_xml_type_to_grain(get_text_content(elem, "TYPE")),
                "beerxml_data": {
                    "origin": get_text_content(elem, "ORIGIN"),
                    "supplier": get_text_content(elem, "SUPPLIER"),
                    "type": get_text_content(elem, "TYPE"),
                    "yield": get_text_content(elem, "YIELD"),
                },
            }

            fermentables.append(fermentable)

        except Exception as e:
            print(f"Error parsing fermentable: {e}")
            continue

    return fermentables


def parse_hops(recipe_elem, detected_unit_system=None):
    """Parse hop ingredients from recipe"""
    hops = []
    hop_elements = recipe_elem.findall(".//HOPS/HOP")

    for elem in hop_elements:
        try:
            # Amount in kg (BeerXML standard)
            amount_kg = float(get_text_content(elem, "AMOUNT") or 0)

            # Convert to appropriate unit based on detected system
            if detected_unit_system == "metric":
                # Convert to grams for metric system
                amount = UnitConverter.round_to_brewing_precision(
                    amount_kg * 1000, "hop", "metric"
                )
                unit = "g"
            else:
                # Convert to ounces for imperial system (default)
                amount = UnitConverter.round_to_brewing_precision(
                    UnitConverter.convert_weight(amount_kg, "kg", "oz"),
                    "hop",
                    "imperial",
                )
                unit = "oz"

            hop_name = get_text_content(elem, "NAME") or "Unknown Hop"
            hop_use = map_xml_use_to_hop(get_text_content(elem, "USE"))
            hop_time = int(get_text_content(elem, "TIME") or 0)

            # Generate unique compound ID for recipe ingredient (not database ingredient)
            # Format: hopname_use_time_uniqueid to ensure uniqueness for duplicate hops
            compound_id = (
                f"{hop_name.replace(' ', '_')}_{hop_use}_{hop_time}_{str(ObjectId())}"
            )

            hop = {
                "ingredient_id": compound_id,  # Generate unique compound ID
                "name": hop_name,
                "type": "hop",
                "amount": amount,
                "unit": unit,
                "use": hop_use,
                "time": hop_time,
                "alpha_acid": float(get_text_content(elem, "ALPHA") or 0),
                "beerxml_data": {
                    "origin": get_text_content(elem, "ORIGIN"),
                    "form": get_text_content(elem, "FORM"),
                    "beta": get_text_content(elem, "BETA"),
                },
            }

            hops.append(hop)

        except Exception as e:
            print(f"Error parsing hop: {e}")
            continue

    return hops


def parse_yeasts(recipe_elem, detected_unit_system=None):
    """Parse yeast ingredients from recipe"""
    yeasts = []
    yeast_elements = recipe_elem.findall(".//YEASTS/YEAST")

    for elem in yeast_elements:
        try:
            amount = float(get_text_content(elem, "AMOUNT") or 1)
            amount_is_weight = get_text_content(elem, "AMOUNT_IS_WEIGHT") == "TRUE"

            if amount_is_weight:
                # Amount is in kg, convert to grams
                final_amount = amount * 1000
                unit = "g"
            else:
                # Amount is in packages - normalize to practical amounts
                final_amount = UnitConverter.normalize_yeast_amount_to_packages(
                    amount, "pkg"
                )
                unit = "pkg"

            yeast_name = get_text_content(elem, "NAME") or "Unknown Yeast"

            # Generate unique compound ID for recipe ingredient
            # Format: yeastname_type_uniqueid
            yeast_type = get_text_content(elem, "TYPE") or "ale"
            compound_id = (
                f"{yeast_name.replace(' ', '_')}_{yeast_type}_{str(ObjectId())}"
            )

            yeast = {
                "ingredient_id": compound_id,  # Generate unique compound ID
                "name": yeast_name,
                "type": "yeast",
                "amount": final_amount,
                "unit": unit,
                "use": "fermentation",
                "time": 0,
                "attenuation": float(get_text_content(elem, "ATTENUATION") or 75),
                "beerxml_data": {
                    "laboratory": get_text_content(elem, "LABORATORY"),
                    "product_id": get_text_content(elem, "PRODUCT_ID"),
                    "type": get_text_content(elem, "TYPE"),
                    "form": get_text_content(elem, "FORM"),
                    "original_amount": amount,  # Store original for reference
                    "was_normalized": not amount_is_weight and amount != final_amount,
                },
            }

            yeasts.append(yeast)

        except Exception as e:
            print(f"Error parsing yeast: {e}")
            continue

    return yeasts


def parse_misc(recipe_elem, detected_unit_system=None):
    """Parse miscellaneous ingredients from recipe"""
    misc_ingredients = []
    misc_elements = recipe_elem.findall(".//MISCS/MISC")

    for elem in misc_elements:
        try:
            amount = float(get_text_content(elem, "AMOUNT") or 0)
            amount_is_weight = get_text_content(elem, "AMOUNT_IS_WEIGHT") == "TRUE"

            if amount_is_weight:
                # Weight-based misc ingredient
                if detected_unit_system == "metric":
                    # Convert kg to grams for metric
                    final_amount = amount * 1000
                    unit = "g"
                else:
                    # Convert kg to ounces for imperial
                    final_amount = UnitConverter.convert_weight(amount, "kg", "oz")
                    unit = "oz"
            else:
                # Volume-based misc ingredient
                if detected_unit_system == "metric":
                    # Convert liters to ml for metric
                    final_amount = amount * 1000
                    unit = "ml"
                else:
                    # Convert liters to fluid ounces for imperial
                    final_amount = UnitConverter.convert_volume(amount, "l", "floz")
                    unit = "floz"

            misc_name = get_text_content(elem, "NAME") or "Unknown Misc"
            misc_use = map_xml_use_to_misc(get_text_content(elem, "USE"))
            misc_time = int(get_text_content(elem, "TIME") or 0)

            # Generate unique compound ID for recipe ingredient
            # Format: miscname_use_time_uniqueid
            compound_id = f"{misc_name.replace(' ', '_')}_{misc_use}_{misc_time}_{str(ObjectId())}"

            misc = {
                "ingredient_id": compound_id,  # Generate unique compound ID
                "name": misc_name,
                "type": "other",
                "amount": final_amount,
                "unit": unit,
                "use": misc_use,
                "time": misc_time,
                "beerxml_data": {
                    "type": get_text_content(elem, "TYPE"),
                    "use_for": get_text_content(elem, "USE_FOR"),
                },
            }

            misc_ingredients.append(misc)

        except Exception as e:
            print(f"Error parsing misc ingredient: {e}")
            continue

    return misc_ingredients


def get_available_ingredients_grouped():
    """Get all available ingredients grouped by type"""
    ingredients = Ingredient.objects.all()
    grouped = {"grain": [], "hop": [], "yeast": [], "other": []}

    for ingredient in ingredients:
        ing_type = "other" if ingredient.type == "adjunct" else ingredient.type
        if ing_type in grouped:
            grouped[ing_type].append(ingredient.to_dict())

    return grouped


def find_ingredient_matches(imported_ingredient, available_ingredients):
    """Find matching ingredients in database using enhanced fuzzy matching"""
    ingredient_type = imported_ingredient["type"]
    available = available_ingredients.get(ingredient_type, [])

    if not available:
        return []

    matches = []
    imported_name = imported_ingredient["name"]

    # Enhanced fuzzy matching
    for available_ing in available:
        # Calculate enhanced similarity score
        confidence = calculate_name_similarity(
            imported_name, available_ing["name"], ingredient_type, available_ing
        )

        # Type-specific scoring adjustments
        if ingredient_type == "grain":
            confidence = adjust_grain_confidence(
                imported_ingredient, available_ing, confidence
            )
        elif ingredient_type == "hop":
            confidence = adjust_hop_confidence(
                imported_ingredient, available_ing, confidence
            )
        elif ingredient_type == "yeast":
            confidence = adjust_yeast_confidence(
                imported_ingredient, available_ing, confidence
            )

        if confidence > 0.3:  # Minimum threshold
            matches.append(
                {
                    "ingredient": available_ing,
                    "confidence": confidence,
                    "reasons": get_match_reasons(
                        imported_ingredient, available_ing, confidence
                    ),
                }
            )

    # Sort by confidence
    matches.sort(key=lambda x: x["confidence"], reverse=True)
    return matches[:5]  # Top 5 matches


def parse_yeast_name(name):
    """Parse yeast name to extract manufacturer and cleaned name/code"""
    if not name:
        return None, name

    name_lower = name.lower().strip()

    # Known manufacturer patterns (case insensitive)
    manufacturer_patterns = {
        "fermentis": ["fermentis"],
        "wyeast": ["wyeast"],
        "white labs": ["white labs", "whitelabs", "wlp"],
        "omega yeast": ["omega yeast", "omega", "oyl"],
        "imperial yeast": ["imperial yeast", "imperial"],
        "lallemand": ["lallemand"],
    }

    detected_manufacturer = None
    cleaned_name = name.strip()

    # Check for manufacturer prefixes
    for manufacturer, patterns in manufacturer_patterns.items():
        for pattern in patterns:
            if name_lower.startswith(pattern):
                detected_manufacturer = manufacturer
                # Remove manufacturer prefix from name
                cleaned_name = name[len(pattern) :].strip()
                # Remove common separators
                if cleaned_name.startswith(("-", " ", "/")):
                    cleaned_name = cleaned_name[1:].strip()
                break
        if detected_manufacturer:
            break

    return detected_manufacturer, cleaned_name


def enhanced_fuzzy_match(imported_name, existing_ingredient, ingredient_type):
    """Enhanced fuzzy matching for ingredients using multiple strategies"""
    scores = []

    # Normalize names for better matching
    norm_imported = normalize_ingredient_name(imported_name)
    norm_existing = normalize_ingredient_name(existing_ingredient["name"])

    # Strategy 1: Direct name comparison (most reliable)
    direct_score = fuzz.ratio(norm_imported, norm_existing)
    scores.append(("direct_name", direct_score / 100.0, 1.0))  # Full weight

    # Strategy 2: Partial ratio (handles partial matches, but weight less)
    partial_score = fuzz.partial_ratio(norm_imported, norm_existing)
    scores.append(("partial_name", partial_score / 100.0, 0.8))  # Reduced weight

    # Strategy 3: Token set ratio (handles word order differences, but weight less)
    token_score = fuzz.token_set_ratio(norm_imported, norm_existing)
    scores.append(("token_set", token_score / 100.0, 0.7))  # Reduced weight

    # Strategy 4: Semantic word matching for grain ingredients
    if ingredient_type == "grain":
        semantic_score = calculate_semantic_grain_score(
            imported_name, existing_ingredient["name"]
        )
        if semantic_score > 0:
            scores.append(
                ("semantic_grain", semantic_score, 1.0)
            )  # Full weight for semantic matches

    # Strategy 5: For yeasts, try manufacturer-specific matching
    if ingredient_type == "yeast":
        yeast_scores = enhanced_yeast_matching(imported_name, existing_ingredient)
        # Add full weight to yeast-specific scores
        scores.extend([(strategy, score, 1.0) for strategy, score in yeast_scores])

    # Calculate weighted scores and return the best
    if scores:
        weighted_scores = [
            (strategy, score * weight) for strategy, score, weight in scores
        ]
        best_strategy, best_score = max(weighted_scores, key=lambda x: x[1])
        return best_score, best_strategy

    return 0.0, "no_match"


def calculate_semantic_grain_score(imported_name, existing_name):
    """Calculate semantic similarity for grain ingredients based on word relationships"""
    imported_words = set(imported_name.lower().split())
    existing_words = set(existing_name.lower().split())

    # Define semantic relationships for grain terms
    grain_synonyms = {
        "malt": {"malted", "malt"},
        "malted": {"malt", "malted"},
        "crystal": {"caramel", "crystal"},
        "caramel": {"crystal", "caramel"},
        "base": {"base", "pale"},
        "pale": {"base", "pale"},
    }

    # Only apply semantic scoring when there are clear semantic relationships
    # This prevents over-scoring of simple exact matches
    has_semantic_match = False
    matched_pairs = 0
    total_pairs = 0

    for imp_word in imported_words:
        best_match_score = 0
        found_semantic = False

        for ex_word in existing_words:
            if imp_word == ex_word:
                # Exact match
                best_match_score = 1.0
                break
            elif imp_word in grain_synonyms and ex_word in grain_synonyms[imp_word]:
                # Semantic match - this is what we're looking for
                best_match_score = max(best_match_score, 0.9)
                found_semantic = True
                has_semantic_match = True
            elif fuzz.ratio(imp_word, ex_word) > 80:
                # High fuzzy match
                best_match_score = max(best_match_score, 0.8)

        matched_pairs += best_match_score
        total_pairs += 1

    # Only return a semantic score if we found actual semantic relationships
    # This prevents exact word matches from getting artificially high semantic scores
    if not has_semantic_match:
        return 0

    # Normalize by the number of words in the imported name
    base_score = matched_pairs / total_pairs if total_pairs > 0 else 0

    # Apply a slight penalty to prevent semantic matches from always beating direct matches
    return base_score * 0.95


def enhanced_yeast_matching(imported_name, existing_ingredient):
    """Enhanced matching specifically for yeast ingredients"""
    scores = []

    # Parse the imported yeast name
    detected_manufacturer, cleaned_imported_name = parse_yeast_name(imported_name)

    # Strategy 1: Check if detected manufacturer matches
    if detected_manufacturer and existing_ingredient.get("manufacturer"):
        manufacturer_match = fuzz.ratio(
            detected_manufacturer.lower(), existing_ingredient["manufacturer"].lower()
        )
        if manufacturer_match > 80:  # High manufacturer match
            # If manufacturer matches, compare the cleaned names
            name_score = fuzz.ratio(
                cleaned_imported_name.lower(), existing_ingredient["name"].lower()
            )
            combined_score = (manufacturer_match * 0.3 + name_score * 0.7) / 100.0
            scores.append(("manufacturer_name", combined_score))

    # Strategy 2: Check code matching
    if existing_ingredient.get("code"):
        # Try matching cleaned name against code
        code_score = fuzz.ratio(
            cleaned_imported_name.lower(), existing_ingredient["code"].lower()
        )
        scores.append(("code_match", code_score / 100.0))

        # Try matching full imported name against code
        full_code_score = fuzz.ratio(
            imported_name.lower(), existing_ingredient["code"].lower()
        )
        scores.append(("full_code_match", full_code_score / 100.0))

    # Strategy 3: Check if imported name contains the code
    if existing_ingredient.get("code"):
        code = existing_ingredient["code"].lower()
        if code in imported_name.lower():
            # High score if code is contained in imported name
            scores.append(("contains_code", 0.9))

    # Strategy 4: Combined manufacturer + code pattern matching
    if (
        detected_manufacturer
        and existing_ingredient.get("manufacturer")
        and existing_ingredient.get("code")
    ):
        manufacturer = existing_ingredient["manufacturer"].lower()
        code = existing_ingredient["code"].lower()

        # Check if the imported name follows "Manufacturer Code" pattern
        expected_pattern = f"{manufacturer} {code}"
        pattern_score = fuzz.ratio(imported_name.lower(), expected_pattern)
        scores.append(("manufacturer_code_pattern", pattern_score / 100.0))

    return scores


def normalize_ingredient_name(name):
    """Normalize ingredient name for better matching"""
    if not name:
        return ""

    # Convert to lowercase and handle crystal/caramel synonyms
    normalized = name.lower()

    # Handle crystal/caramel interchangeability
    # Crystal malts and caramel malts are essentially the same thing
    normalized = normalized.replace("crystal", "caramel")

    # Remove common redundant words that don't affect matching
    common_words = ["malt", "grain", "base", "specialty"]
    words = normalized.split()
    filtered_words = [word for word in words if word not in common_words]

    # If we removed all words, keep the original normalized name
    if not filtered_words:
        return normalized

    return " ".join(filtered_words)


def calculate_name_similarity(
    name1, name2, ingredient_type="other", existing_ingredient=None
):
    """Calculate name similarity score using enhanced fuzzy matching"""
    if name1 == name2:
        return 1.0

    # Normalize names to handle synonyms
    normalized_name1 = normalize_ingredient_name(name1)
    normalized_name2 = normalize_ingredient_name(name2)

    if normalized_name1 == normalized_name2:
        return 1.0

    # Use enhanced fuzzy matching if existing ingredient data is available
    if existing_ingredient:
        score, strategy = enhanced_fuzzy_match(
            name1, existing_ingredient, ingredient_type
        )
        return score

    # Fallback to simple fuzzy matching
    return fuzz.ratio(normalized_name1, normalized_name2) / 100.0


def adjust_grain_confidence(imported, available, base_confidence):
    """Adjust confidence for grain matching"""
    confidence = base_confidence

    # Color similarity
    if imported.get("color") and available.get("color"):
        color_diff = abs(imported["color"] - available["color"])
        if color_diff <= 2:
            confidence += 0.1
        elif color_diff > 20:
            confidence -= 0.2

    # Potential similarity
    if imported.get("potential") and available.get("potential"):
        potential_diff = abs(imported["potential"] - available["potential"])
        if potential_diff <= 3:
            confidence += 0.1

    return min(confidence, 1.0)


def adjust_hop_confidence(imported, available, base_confidence):
    """Adjust confidence for hop matching"""
    confidence = base_confidence

    # Alpha acid similarity
    if imported.get("alpha_acid") and available.get("alpha_acid"):
        alpha_diff = abs(imported["alpha_acid"] - available["alpha_acid"])
        if alpha_diff <= 1:
            confidence += 0.15
        elif alpha_diff > 5:
            confidence -= 0.2

    return min(confidence, 1.0)


def adjust_yeast_confidence(imported, available, base_confidence):
    """Adjust confidence for yeast matching"""
    confidence = base_confidence

    # Lab/manufacturer matching
    imported_lab = imported.get("beerxml_data", {}).get("laboratory", "").lower()
    available_mfg = available.get("manufacturer", "").lower()

    if imported_lab and available_mfg and imported_lab in available_mfg:
        confidence += 0.2

    # Product ID matching
    imported_id = imported.get("beerxml_data", {}).get("product_id", "").lower()
    available_code = available.get("code", "").lower()

    if imported_id and available_code and imported_id == available_code:
        confidence += 0.3

    return min(confidence, 1.0)


def get_match_reasons(imported, available, confidence):
    """Get reasons why ingredients match"""
    reasons = []

    # Enhanced reasoning based on confidence levels
    if confidence > 0.9:
        reasons.append("Excellent match")
    elif confidence > 0.8:
        reasons.append("Very similar name")
    elif confidence > 0.6:
        reasons.append("Similar name")
    elif confidence > 0.4:
        reasons.append("Partial match")

    # Enhanced type-specific reasons
    if imported["type"] == "grain":
        if imported.get("color") and available.get("color"):
            color_diff = abs(imported["color"] - available["color"])
            if color_diff <= 2:
                reasons.append("Similar color")
            elif color_diff <= 10:
                reasons.append("Close color match")

    elif imported["type"] == "hop":
        if imported.get("alpha_acid") and available.get("alpha_acid"):
            alpha_diff = abs(imported["alpha_acid"] - available["alpha_acid"])
            if alpha_diff <= 1:
                reasons.append("Similar alpha acid")
            elif alpha_diff <= 3:
                reasons.append("Close alpha acid")

    elif imported["type"] == "yeast":
        # Enhanced yeast matching reasons
        detected_manufacturer, cleaned_name = parse_yeast_name(imported["name"])

        # Check manufacturer match
        if detected_manufacturer and available.get("manufacturer"):
            manufacturer_match = fuzz.ratio(
                detected_manufacturer.lower(), available["manufacturer"].lower()
            )
            if manufacturer_match > 80:
                reasons.append("Matching manufacturer")

        # Check code match
        if available.get("code"):
            if cleaned_name.lower() == available["code"].lower():
                reasons.append("Exact code match")
            elif available["code"].lower() in imported["name"].lower():
                reasons.append("Contains product code")
            elif fuzz.ratio(cleaned_name.lower(), available["code"].lower()) > 80:
                reasons.append("Similar code")

        # Check for BeerXML laboratory data
        imported_lab = imported.get("beerxml_data", {}).get("laboratory", "").lower()
        available_mfg = available.get("manufacturer", "").lower()
        if imported_lab and available_mfg and imported_lab in available_mfg:
            reasons.append("Same manufacturer")

    return reasons


def generate_new_ingredient_data(imported_ingredient):
    """Generate data for creating new ingredient"""
    base_data = {
        "name": imported_ingredient["name"],
        "type": imported_ingredient["type"],
        "description": "Imported from BeerXML",
    }

    # Add type-specific fields
    if imported_ingredient["type"] == "grain":
        base_data.update(
            {
                "grain_type": imported_ingredient.get("grain_type", "specialty_malt"),
                "potential": imported_ingredient.get("potential", 35),
                "color": imported_ingredient.get("color", 0),
            }
        )
    elif imported_ingredient["type"] == "hop":
        base_data.update({"alpha_acid": imported_ingredient.get("alpha_acid", 5)})
    elif imported_ingredient["type"] == "yeast":
        beerxml_data = imported_ingredient.get("beerxml_data", {})
        base_data.update(
            {
                "attenuation": imported_ingredient.get("attenuation", 75),
                "manufacturer": beerxml_data.get("laboratory", ""),
                "code": beerxml_data.get("product_id", ""),
                "alcohol_tolerance": 12,
                "min_temperature": 60,
                "max_temperature": 75,
            }
        )

    return base_data


def validate_ingredient_data(ing_data):
    """Validate ingredient data before creation"""
    errors = []

    if not ing_data.get("name"):
        errors.append("Name is required")

    if not ing_data.get("type"):
        errors.append("Type is required")

    # Type-specific validation
    if ing_data.get("type") == "hop":
        alpha_acid = ing_data.get("alpha_acid")
        if alpha_acid and (alpha_acid < 0 or alpha_acid > 25):
            errors.append("Alpha acid must be between 0 and 25%")

    return {"valid": len(errors) == 0, "errors": errors}


# Utility functions
def add_text_element(parent, tag_name, text_content):
    """Add text element to XML parent"""
    element = ET.SubElement(parent, tag_name)
    element.text = str(text_content) if text_content is not None else ""


def _indent_xml(elem, level=0):
    """Add indentation to XML elements for proper formatting"""
    indent = " " * level
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = "\n" + indent + " "
        if not elem.tail or not elem.tail.strip():
            elem.tail = "\n" + indent
        for elem in elem:
            _indent_xml(elem, level + 1)
        if not elem.tail or not elem.tail.strip():
            elem.tail = "\n" + indent
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = "\n" + indent


def get_text_content(parent, tag_name):
    """Get text content from XML element"""
    element = parent.find(tag_name)
    return element.text.strip() if element is not None and element.text else ""


def sanitize_filename(filename):
    """Sanitize filename for download"""
    return re.sub(r"[^\w\s-]", "", filename).strip().replace(" ", "_").lower()


# Mapping functions
def map_grain_type_to_xml(grain_type):
    """Map internal grain type to BeerXML type"""
    type_map = {
        "base_malt": "Grain",
        "caramel_crystal": "Crystal",
        "roasted": "Roasted",
        "specialty_malt": "Specialty",
        "adjunct_grain": "Adjunct",
        "smoked": "Specialty",
    }
    return type_map.get(grain_type, "Grain")


def map_xml_type_to_grain(xml_type):
    """Map BeerXML type to internal grain type"""
    type_map = {
        "Grain": "base_malt",
        "Base": "base_malt",
        "Crystal": "caramel_crystal",
        "Caramel": "caramel_crystal",
        "Roasted": "roasted",
        "Specialty": "specialty_malt",
        "Adjunct": "adjunct_grain",
    }
    return type_map.get(xml_type, "specialty_malt")


def map_hop_use_to_xml(use):
    """Map internal hop use to BeerXML use"""
    use_map = {
        "boil": "Boil",
        "dry-hop": "Dry Hop",
        "whirlpool": "Aroma",
        "mash": "Mash",
    }
    return use_map.get(use, "Boil")


def map_xml_use_to_hop(xml_use):
    """Map BeerXML use to internal hop use"""
    use_map = {
        "Boil": "boil",
        "Dry Hop": "dry-hop",
        "Mash": "mash",
        "First Wort": "boil",
        "Aroma": "whirlpool",
    }
    return use_map.get(xml_use, "boil")


def map_misc_use_to_xml(use):
    """Map internal misc use to BeerXML use"""
    use_map = {
        "boil": "Boil",
        "mash": "Mash",
        "fermentation": "Primary",
        "secondary": "Secondary",
        "packaging": "Bottling",
        "whirlpool": "Boil",
    }
    return use_map.get(use, "Boil")


def validate_ingredient_amounts(recipe_data):
    """
    Validate ingredient amounts for a recipe and flag suspicious values.

    Returns a list of warnings for ingredients that seem unreasonable.
    These are common issues from BeerXML exports with unit conversion problems.
    """
    warnings = []

    # Get batch size in liters for normalization
    batch_size = recipe_data.get("batch_size", 19)
    batch_unit = recipe_data.get("batch_size_unit", "l")

    # Convert to liters if needed
    if batch_unit.lower() in ["gal", "gallon", "gallons"]:
        batch_size_liters = batch_size * 3.78541
    else:
        batch_size_liters = batch_size

    ingredients = recipe_data.get("ingredients", [])

    for ing in ingredients:
        ing_type = ing.get("type", "")
        name = ing.get("name", "Unknown")
        amount = ing.get("amount", 0)
        unit = ing.get("unit", "")

        # Convert to standard units for comparison (grams for weight)
        amount_g = amount
        if unit.lower() in ["kg", "kilogram", "kilograms"]:
            amount_g = amount * 1000
        elif unit.lower() in ["oz", "ounce", "ounces"]:
            amount_g = amount * 28.3495
        elif unit.lower() in ["lb", "lbs", "pound", "pounds"]:
            amount_g = amount * 453.592

        # Grain checks (typically 2-10 kg per 19L batch)
        if ing_type == "grain":
            # Expected range: 100-600 g per liter
            expected_per_liter = amount_g / batch_size_liters
            if expected_per_liter < 50:
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "unusually_low",
                        "message": f"Grain amount seems low ({amount_g:.0f}g for {batch_size_liters:.1f}L batch). Typical range: 2-10kg total.",
                    }
                )
            elif expected_per_liter > 800:
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "unusually_high",
                        "message": f"Grain amount seems high ({amount_g:.0f}g for {batch_size_liters:.1f}L batch). Typical range: 2-10kg total.",
                    }
                )

        # Hop checks (typically 5-100g per 19L batch)
        elif ing_type == "hop":
            # Expected range: 0.5-10 g per liter
            expected_per_liter = amount_g / batch_size_liters
            if expected_per_liter < 0.1:
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "unusually_low",
                        "message": f"Hop amount seems low ({amount_g:.1f}g for {batch_size_liters:.1f}L batch). Typical range: 10-200g total.",
                    }
                )
            elif expected_per_liter > 15:
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "unusually_high",
                        "message": f"Hop amount seems high ({amount_g:.1f}g for {batch_size_liters:.1f}L batch). Double-check if correct.",
                    }
                )

        # Yeast checks (typically 10-50g for dry, or 1-2 packages)
        elif ing_type == "yeast":
            # Dry yeast: 11g per package, typically 1-3 packages for 19L
            # Liquid yeast: varies widely, but typically one vial/pack
            if amount_g > 100:
                # Likely a 10x multiplication error
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "possible_10x_error",
                        "message": f"Yeast amount seems very high ({amount_g:.0f}g). May be incorrectly multiplied by 10. Typical dry yeast: 11-33g (1-3 packages).",
                        "suggested_fix": amount_g / 10,
                    }
                )
            elif amount_g < 5:
                warnings.append(
                    {
                        "ingredient": name,
                        "type": ing_type,
                        "amount": amount,
                        "unit": unit,
                        "issue": "unusually_low",
                        "message": f"Yeast amount seems low ({amount_g:.1f}g). Typical dry yeast: 11-33g per batch.",
                    }
                )

        # Other ingredient checks (water agents, finings, etc.)
        elif ing_type == "other":
            # Check for common issues
            name_lower = name.lower()

            # Whirlfloc/Irish Moss tablets: Should be 1-2 tablets (~1-2g), not 1kg
            if (
                "whirlfloc" in name_lower
                or "irish moss" in name_lower
                or "tablet" in name_lower
            ):
                if amount_g > 50:
                    warnings.append(
                        {
                            "ingredient": name,
                            "type": ing_type,
                            "amount": amount,
                            "unit": unit,
                            "issue": "unit_conversion_error",
                            "message": f"{name} shows as {amount_g:.0f}g, but should be 1-2 tablets (~1-2g). Likely a unit conversion error from 'each' to 'kg'.",
                            "suggested_fix": 1.0,  # Assume 1 tablet
                        }
                    )

            # Water salts: typically 0-10g per batch
            elif any(
                salt in name_lower
                for salt in ["gypsum", "calcium", "sulfate", "chloride"]
            ):
                if amount_g > 20:
                    warnings.append(
                        {
                            "ingredient": name,
                            "type": ing_type,
                            "amount": amount,
                            "unit": unit,
                            "issue": "unusually_high",
                            "message": f"Water salt amount seems high ({amount_g:.1f}g). Typical range: 0-10g per batch.",
                        }
                    )

    return warnings


def map_xml_use_to_misc(xml_use):
    """Map BeerXML use to internal misc use"""
    use_map = {
        "Boil": "boil",
        "Mash": "mash",
        "Primary": "fermentation",
        "Secondary": "secondary",
        "Bottling": "packaging",
    }
    return use_map.get(xml_use, "boil")


def export_recipe_with_style_beerxml(recipe):
    """Enhanced BeerXML export with style information"""
    # Get the existing XML generation
    xml_content = generate_beerxml(recipe)

    # If recipe has a style, try to find it in the style guide
    if recipe.style:
        style_guide = BeerStyleGuide.objects(name__icontains=recipe.style).first()
        if style_guide:
            # Parse existing XML to add style info
            root = ET.fromstring(xml_content)
            recipe_elem = root.find(".//RECIPE")

            if recipe_elem is not None:
                # Add style information
                style_elem = ET.SubElement(recipe_elem, "STYLE")
                add_text_element(style_elem, "NAME", style_guide.name)
                add_text_element(style_elem, "VERSION", "1")
                add_text_element(style_elem, "CATEGORY", style_guide.category)
                add_text_element(style_elem, "CATEGORY_NUMBER", style_guide.category_id)
                add_text_element(
                    style_elem,
                    "STYLE_LETTER",
                    (
                        style_guide.style_id.split(style_guide.category_id)[-1]
                        if style_guide.style_id.startswith(style_guide.category_id)
                        else ""
                    ),
                )
                add_text_element(style_elem, "STYLE_GUIDE", style_guide.style_guide)
                add_text_element(
                    style_elem,
                    "TYPE",
                    "Lager" if "lager" in style_guide.name.lower() else "Ale",
                )

                # Add style ranges
                if style_guide.original_gravity:
                    add_text_element(
                        style_elem, "OG_MIN", str(style_guide.original_gravity.minimum)
                    )
                    add_text_element(
                        style_elem, "OG_MAX", str(style_guide.original_gravity.maximum)
                    )

                if style_guide.final_gravity:
                    add_text_element(
                        style_elem, "FG_MIN", str(style_guide.final_gravity.minimum)
                    )
                    add_text_element(
                        style_elem, "FG_MAX", str(style_guide.final_gravity.maximum)
                    )

                if style_guide.international_bitterness_units:
                    add_text_element(
                        style_elem,
                        "IBU_MIN",
                        str(style_guide.international_bitterness_units.minimum),
                    )
                    add_text_element(
                        style_elem,
                        "IBU_MAX",
                        str(style_guide.international_bitterness_units.maximum),
                    )

                if style_guide.color:
                    add_text_element(
                        style_elem, "COLOR_MIN", str(style_guide.color.minimum)
                    )
                    add_text_element(
                        style_elem, "COLOR_MAX", str(style_guide.color.maximum)
                    )

                if style_guide.alcohol_by_volume:
                    add_text_element(
                        style_elem,
                        "ABV_MIN",
                        str(style_guide.alcohol_by_volume.minimum),
                    )
                    add_text_element(
                        style_elem,
                        "ABV_MAX",
                        str(style_guide.alcohol_by_volume.maximum),
                    )

                # Add descriptions
                if style_guide.overall_impression:
                    add_text_element(
                        style_elem, "NOTES", style_guide.overall_impression
                    )
                if style_guide.ingredients:
                    add_text_element(style_elem, "INGREDIENTS", style_guide.ingredients)
                if style_guide.examples:
                    add_text_element(style_elem, "EXAMPLES", style_guide.examples)

            # Convert back to string with proper formatting
            _indent_xml(root)
            return ET.tostring(root, encoding="unicode")

    return xml_content
