from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from models.mongo_models import Recipe, Ingredient, User
from services.mongodb_service import MongoDBService
from utils.unit_conversions import UnitConverter
import xml.etree.ElementTree as ET
from datetime import datetime, UTC
import re

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
    else:
        batch_size_l = UnitConverter.convert_volume(recipe.batch_size, "gal", "l")

    add_text_element(recipe_elem, "BATCH_SIZE", f"{batch_size_l:.2f}")
    add_text_element(
        recipe_elem, "BOIL_SIZE", f"{batch_size_l * 1.2:.2f}"
    )  # 20% larger
    add_text_element(recipe_elem, "BOIL_TIME", str(recipe.boil_time or 60))
    add_text_element(recipe_elem, "EFFICIENCY", str(recipe.efficiency or 75))

    if recipe.description:
        add_text_element(recipe_elem, "NOTES", recipe.description)
    if recipe.notes:
        add_text_element(recipe_elem, "TASTE_NOTES", recipe.notes)

    # Add ingredients
    add_ingredients_to_xml(recipe_elem, recipe.ingredients)

    # Convert to string
    rough_string = ET.tostring(recipes, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{rough_string}'


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
        # Basic recipe info
        recipe = {
            "name": get_text_content(recipe_elem, "NAME") or "Unnamed Recipe",
            "style": get_text_content(recipe_elem, "STYLE") or "",
            "description": get_text_content(recipe_elem, "NOTES") or "",
            "notes": get_text_content(recipe_elem, "TASTE_NOTES") or "",
            "boil_time": int(get_text_content(recipe_elem, "BOIL_TIME") or 60),
            "efficiency": float(get_text_content(recipe_elem, "EFFICIENCY") or 75),
            "is_public": False,
        }

        # Convert batch size from liters to gallons
        batch_size_l = float(get_text_content(recipe_elem, "BATCH_SIZE") or 19)
        recipe["batch_size"] = UnitConverter.convert_volume(batch_size_l, "l", "gal")
        recipe["batch_size_unit"] = "gal"

        # Parse ingredients
        ingredients = []
        ingredients.extend(parse_fermentables(recipe_elem))
        ingredients.extend(parse_hops(recipe_elem))
        ingredients.extend(parse_yeasts(recipe_elem))
        ingredients.extend(parse_misc(recipe_elem))

        return {
            "recipe": recipe,
            "ingredients": ingredients,
            "metadata": {
                "source": "BeerXML Import",
                "imported_at": datetime.now(UTC).isoformat(),
            },
        }

    except Exception as e:
        print(f"Error parsing recipe element: {e}")
        return None


def parse_fermentables(recipe_elem):
    """Parse fermentable ingredients from recipe"""
    fermentables = []
    fermentable_elements = recipe_elem.findall(".//FERMENTABLES/FERMENTABLE")

    for elem in fermentable_elements:
        try:
            # Amount in kg, convert to lb
            amount_kg = float(get_text_content(elem, "AMOUNT") or 0)
            amount_lb = UnitConverter.convert_weight(amount_kg, "kg", "lb")

            # Calculate potential from yield
            yield_pct = float(get_text_content(elem, "YIELD") or 80)
            potential = (yield_pct / 100) * 46

            fermentable = {
                "name": get_text_content(elem, "NAME") or "Unknown Fermentable",
                "type": "grain",
                "amount": amount_lb,
                "unit": "lb",
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


def parse_hops(recipe_elem):
    """Parse hop ingredients from recipe"""
    hops = []
    hop_elements = recipe_elem.findall(".//HOPS/HOP")

    for elem in hop_elements:
        try:
            # Amount in kg, convert to oz
            amount_kg = float(get_text_content(elem, "AMOUNT") or 0)
            amount_oz = UnitConverter.convert_weight(amount_kg, "kg", "oz")

            hop = {
                "name": get_text_content(elem, "NAME") or "Unknown Hop",
                "type": "hop",
                "amount": amount_oz,
                "unit": "oz",
                "use": map_xml_use_to_hop(get_text_content(elem, "USE")),
                "time": int(get_text_content(elem, "TIME") or 0),
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


def parse_yeasts(recipe_elem):
    """Parse yeast ingredients from recipe"""
    yeasts = []
    yeast_elements = recipe_elem.findall(".//YEASTS/YEAST")

    for elem in yeast_elements:
        try:
            amount = float(get_text_content(elem, "AMOUNT") or 1)
            amount_is_weight = get_text_content(elem, "AMOUNT_IS_WEIGHT") == "TRUE"

            yeast = {
                "name": get_text_content(elem, "NAME") or "Unknown Yeast",
                "type": "yeast",
                "amount": (
                    amount * 1000 if amount_is_weight else amount
                ),  # Convert kg to g if weight
                "unit": "g" if amount_is_weight else "pkg",
                "use": "fermentation",
                "time": 0,
                "attenuation": float(get_text_content(elem, "ATTENUATION") or 75),
                "beerxml_data": {
                    "laboratory": get_text_content(elem, "LABORATORY"),
                    "product_id": get_text_content(elem, "PRODUCT_ID"),
                    "type": get_text_content(elem, "TYPE"),
                    "form": get_text_content(elem, "FORM"),
                },
            }

            yeasts.append(yeast)

        except Exception as e:
            print(f"Error parsing yeast: {e}")
            continue

    return yeasts


def parse_misc(recipe_elem):
    """Parse miscellaneous ingredients from recipe"""
    misc_ingredients = []
    misc_elements = recipe_elem.findall(".//MISCS/MISC")

    for elem in misc_elements:
        try:
            amount = float(get_text_content(elem, "AMOUNT") or 0)
            amount_is_weight = get_text_content(elem, "AMOUNT_IS_WEIGHT") == "TRUE"

            if amount_is_weight:
                # Convert kg to g
                final_amount = amount * 1000
                unit = "g"
            else:
                # Convert l to ml
                final_amount = amount * 1000
                unit = "ml"

            misc = {
                "name": get_text_content(elem, "NAME") or "Unknown Misc",
                "type": "other",
                "amount": final_amount,
                "unit": unit,
                "use": map_xml_use_to_misc(get_text_content(elem, "USE")),
                "time": int(get_text_content(elem, "TIME") or 0),
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


def find_ingredient_matches(imported_ingredient, available_ingredients):
    """Find matching ingredients in database"""
    ingredient_type = imported_ingredient["type"]
    available = available_ingredients.get(ingredient_type, [])

    if not available:
        return []

    matches = []
    imported_name = imported_ingredient["name"].lower()

    # Simple name matching - in production, use more sophisticated fuzzy matching
    for available_ing in available:
        available_name = available_ing["name"].lower()

        # Calculate simple similarity score
        confidence = calculate_name_similarity(imported_name, available_name)

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


def calculate_name_similarity(name1, name2):
    """Calculate simple name similarity score"""
    if name1 == name2:
        return 1.0

    # Simple word overlap scoring
    words1 = set(name1.split())
    words2 = set(name2.split())

    if not words1 or not words2:
        return 0.0

    intersection = words1.intersection(words2)
    union = words1.union(words2)

    return len(intersection) / len(union)


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

    if confidence > 0.8:
        reasons.append("Very similar name")
    elif confidence > 0.6:
        reasons.append("Similar name")

    # Type-specific reasons
    if imported["type"] == "grain":
        if imported.get("color") and available.get("color"):
            color_diff = abs(imported["color"] - available["color"])
            if color_diff <= 2:
                reasons.append("Similar color")

    elif imported["type"] == "hop":
        if imported.get("alpha_acid") and available.get("alpha_acid"):
            alpha_diff = abs(imported["alpha_acid"] - available["alpha_acid"])
            if alpha_diff <= 1:
                reasons.append("Similar alpha acid")

    elif imported["type"] == "yeast":
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


def get_available_ingredients_grouped():
    """Get all available ingredients grouped by type"""
    ingredients = Ingredient.objects.all()
    grouped = {"grain": [], "hop": [], "yeast": [], "other": []}

    for ingredient in ingredients:
        ing_type = "other" if ingredient.type == "adjunct" else ingredient.type
        if ing_type in grouped:
            grouped[ing_type].append(ingredient.to_dict())

    return grouped


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
