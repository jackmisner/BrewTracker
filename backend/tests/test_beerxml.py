import xml.etree.ElementTree as ET

import pytest

from models.mongo_models import Ingredient, Recipe, User


class TestBeerXMLEndpoints:
    """Comprehensive tests for BeerXML import/export functionality"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user, return user and auth headers"""
        # Register user
        client.post(
            "/api/auth/register",
            json={
                "username": "beerxmluser",
                "email": "beerxml@example.com",
                "password": "TestPass123!",
            },
        )

        # Login to get token
        login_response = client.post(
            "/api/auth/login",
            json={"username": "beerxmluser", "password": "TestPass123!"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="beerxmluser").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients for recipe testing"""
        ingredients = [
            Ingredient(
                name="Pale Malt (2-row)",
                type="grain",
                grain_type="base_malt",
                potential=36,
                color=2.0,
                description="Base malt",
            ),
            Ingredient(
                name="Crystal 60L",
                type="grain",
                grain_type="caramel_crystal",
                potential=34,
                color=60.0,
                description="Caramel malt",
            ),
            Ingredient(
                name="Caramel Rye",
                type="grain",
                grain_type="caramel_crystal",
                potential=32,
                color=60.0,
                description="Crystal malt made from rye",
            ),
            Ingredient(
                name="Malted Rye",
                type="grain",
                grain_type="adjunct_grain",
                potential=40,
                color=3.0,
                description="Malted rye grain",
            ),
            Ingredient(
                name="Cascade",
                type="hop",
                alpha_acid=5.5,
                description="Citrus hop",
            ),
            Ingredient(
                name="Centennial",
                type="hop",
                alpha_acid=10.0,
                description="Floral hop",
            ),
            Ingredient(
                name="US-05",
                type="yeast",
                attenuation=81.0,
                manufacturer="Fermentis",
                code="US-05",
                description="American ale yeast",
            ),
            Ingredient(
                name="W34/70",
                type="yeast",
                attenuation=82.0,
                manufacturer="Fermentis",
                code="W34/70",
                description="German lager yeast",
            ),
            Ingredient(
                name="American Ale",
                type="yeast",
                attenuation=73.0,
                manufacturer="Wyeast",
                code="1056",
                description="Clean American ale yeast",
            ),
            Ingredient(
                name="WLP001 California Ale",
                type="yeast",
                attenuation=73.0,
                manufacturer="White Labs",
                code="WLP001",
                description="California ale yeast",
            ),
            Ingredient(
                name="Irish Moss",
                type="other",
                description="Clarifying agent",
            ),
        ]

        for ingredient in ingredients:
            ingredient.save()

        return ingredients

    @pytest.fixture
    def sample_recipe(self, authenticated_user, sample_ingredients):
        """Create a sample recipe for testing"""
        user, headers = authenticated_user

        recipe_data = {
            "name": "American IPA",
            "style": "American IPA",
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "description": "Hoppy American IPA",
            "boil_time": 60,
            "efficiency": 75,
            "is_public": False,
            "estimated_og": 1.060,
            "estimated_fg": 1.012,
            "estimated_abv": 6.3,
            "estimated_ibu": 45,
            "estimated_srm": 6,
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt (2-row)",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 10.0,
                    "unit": "lb",
                    "use": "mash",
                    "time": 0,
                    "potential": 36,
                    "color": 2.0,
                },
                {
                    "ingredient_id": str(sample_ingredients[1].id),
                    "name": "Crystal 60L",
                    "type": "grain",
                    "grain_type": "caramel_crystal",
                    "amount": 1.0,
                    "unit": "lb",
                    "use": "mash",
                    "time": 0,
                    "potential": 34,
                    "color": 60.0,
                },
                {
                    "ingredient_id": str(sample_ingredients[2].id),
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "use": "boil",
                    "time": 60,
                    "alpha_acid": 5.5,
                },
                {
                    "ingredient_id": str(sample_ingredients[3].id),
                    "name": "Centennial",
                    "type": "hop",
                    "amount": 0.5,
                    "unit": "oz",
                    "use": "boil",
                    "time": 15,
                    "alpha_acid": 10.0,
                },
                {
                    "ingredient_id": str(sample_ingredients[4].id),
                    "name": "US-05",
                    "type": "yeast",
                    "amount": 1.0,
                    "unit": "pkg",
                    "use": "fermentation",
                    "time": 0,
                    "attenuation": 81.0,
                },
                {
                    "ingredient_id": str(sample_ingredients[5].id),
                    "name": "Irish Moss",
                    "type": "other",
                    "amount": 1.0,
                    "unit": "tsp",
                    "use": "boil",
                    "time": 15,
                },
            ],
        }

        return recipe_data

    def test_export_recipe_beerxml_success(
        self, client, authenticated_user, sample_recipe
    ):
        """Test successful BeerXML export"""
        user, headers = authenticated_user

        # Create recipe first
        create_response = client.post(
            "/api/recipes", json=sample_recipe, headers=headers
        )
        assert create_response.status_code == 201
        recipe_id = create_response.json["recipe_id"]

        # Export recipe
        response = client.get(f"/api/beerxml/export/{recipe_id}", headers=headers)

        assert response.status_code == 200
        assert "xml" in response.json
        assert "filename" in response.json
        assert response.json["filename"] == "american_ipa_recipe.xml"

        # Verify XML structure
        xml_content = response.json["xml"]
        assert "<?xml version=" in xml_content
        assert "<RECIPES>" in xml_content
        assert "<RECIPE>" in xml_content
        assert "<NAME>American IPA</NAME>" in xml_content

    def test_export_recipe_not_found(self, client, authenticated_user):
        """Test exporting non-existent recipe"""
        user, headers = authenticated_user

        response = client.get(
            "/api/beerxml/export/507f1f77bcf86cd799439011", headers=headers
        )

        assert response.status_code == 404
        assert "Recipe not found" in response.json["error"]

    def test_export_recipe_unauthorized(
        self, client, authenticated_user, sample_recipe
    ):
        """Test exporting recipe without permission"""
        user, headers = authenticated_user

        # Create recipe with first user
        create_response = client.post(
            "/api/recipes", json=sample_recipe, headers=headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Create second user
        client.post(
            "/api/auth/register",
            json={
                "username": "user2",
                "email": "user2@example.com",
                "password": "TestPass123!",
            },
        )
        login_response = client.post(
            "/api/auth/login", json={"username": "user2", "password": "TestPass123!"}
        )
        user2_token = login_response.json["access_token"]
        user2_headers = {"Authorization": f"Bearer {user2_token}"}

        # Try to export other user's private recipe
        response = client.get(f"/api/beerxml/export/{recipe_id}", headers=user2_headers)

        assert response.status_code == 403
        assert "Access denied" in response.json["error"]

    def test_export_public_recipe_access(
        self, client, authenticated_user, sample_recipe
    ):
        """Test exporting public recipe by different user"""
        user, headers = authenticated_user

        # Create public recipe
        sample_recipe["is_public"] = True
        create_response = client.post(
            "/api/recipes", json=sample_recipe, headers=headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Create second user
        client.post(
            "/api/auth/register",
            json={
                "username": "user2",
                "email": "user2@example.com",
                "password": "TestPass123!",
            },
        )
        login_response = client.post(
            "/api/auth/login", json={"username": "user2", "password": "TestPass123!"}
        )
        user2_token = login_response.json["access_token"]
        user2_headers = {"Authorization": f"Bearer {user2_token}"}

        # Export public recipe should work
        response = client.get(f"/api/beerxml/export/{recipe_id}", headers=user2_headers)

        assert response.status_code == 200
        assert "xml" in response.json

    def test_parse_beerxml_success(self, client, authenticated_user):
        """Test successful BeerXML parsing"""
        user, headers = authenticated_user

        # Sample BeerXML content
        beerxml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <RECIPES>
            <RECIPE>
                <NAME>Test Recipe</NAME>
                <VERSION>1</VERSION>
                <TYPE>All Grain</TYPE>
                <STYLE>American IPA</STYLE>
                <BATCH_SIZE>19.00</BATCH_SIZE>
                <BOIL_SIZE>22.80</BOIL_SIZE>
                <BOIL_TIME>60</BOIL_TIME>
                <EFFICIENCY>75</EFFICIENCY>
                <NOTES>Test recipe for parsing</NOTES>
                <FERMENTABLES>
                    <FERMENTABLE>
                        <NAME>Pale Malt (2-row)</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>4.540</AMOUNT>
                        <TYPE>Grain</TYPE>
                        <YIELD>80.0</YIELD>
                        <COLOR>2.0</COLOR>
                    </FERMENTABLE>
                </FERMENTABLES>
                <HOPS>
                    <HOP>
                        <NAME>Cascade</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>0.028</AMOUNT>
                        <ALPHA>5.5</ALPHA>
                        <USE>Boil</USE>
                        <TIME>60</TIME>
                        <FORM>Pellet</FORM>
                    </HOP>
                </HOPS>
                <YEASTS>
                    <YEAST>
                        <NAME>US-05</NAME>
                        <VERSION>1</VERSION>
                        <TYPE>Ale</TYPE>
                        <FORM>Liquid</FORM>
                        <AMOUNT>1</AMOUNT>
                        <AMOUNT_IS_WEIGHT>FALSE</AMOUNT_IS_WEIGHT>
                        <ATTENUATION>75</ATTENUATION>
                    </YEAST>
                </YEASTS>
            </RECIPE>
        </RECIPES>"""

        parse_data = {"xml_content": beerxml_content}

        response = client.post("/api/beerxml/parse", json=parse_data, headers=headers)

        assert response.status_code == 200
        assert "recipes" in response.json
        assert len(response.json["recipes"]) == 1

        recipe = response.json["recipes"][0]
        assert recipe["recipe"]["name"] == "Test Recipe"
        assert recipe["recipe"]["style"] == "American IPA"
        assert len(recipe["ingredients"]) == 3  # 1 grain, 1 hop, 1 yeast

    def test_parse_beerxml_no_content(self, client, authenticated_user):
        """Test parsing BeerXML with no content"""
        user, headers = authenticated_user

        parse_data = {}  # No xml_content

        response = client.post("/api/beerxml/parse", json=parse_data, headers=headers)

        assert response.status_code == 400
        assert "XML content is required" in response.json["error"]

    def test_parse_beerxml_invalid_xml(self, client, authenticated_user):
        """Test parsing invalid XML"""
        user, headers = authenticated_user

        parse_data = {"xml_content": "<invalid>xml</invalid><unclosed>"}

        response = client.post("/api/beerxml/parse", json=parse_data, headers=headers)

        assert response.status_code == 400
        assert "Failed to parse BeerXML" in response.json["error"]

    def test_parse_beerxml_no_recipes(self, client, authenticated_user):
        """Test parsing BeerXML with no valid recipes"""
        user, headers = authenticated_user

        beerxml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <RECIPES>
        </RECIPES>"""

        parse_data = {"xml_content": beerxml_content}

        response = client.post("/api/beerxml/parse", json=parse_data, headers=headers)

        assert response.status_code == 400
        assert "No valid recipes found in XML" in response.json["error"]

    def test_match_ingredients_success(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test successful ingredient matching"""
        user, headers = authenticated_user

        imported_ingredients = [
            {
                "name": "Pale Malt (2-row)",
                "type": "grain",
                "amount": 10,
                "unit": "lb",
                "potential": 36,
                "color": 2.0,
            },
            {
                "name": "Cascade Hops",
                "type": "hop",
                "amount": 1,
                "unit": "oz",
                "alpha_acid": 5.5,
            },
            {
                "name": "Unknown Ingredient",
                "type": "grain",
                "amount": 1,
                "unit": "lb",
                "potential": 30,
                "color": 10.0,
            },
        ]

        match_data = {"ingredients": imported_ingredients}

        response = client.post(
            "/api/beerxml/match-ingredients", json=match_data, headers=headers
        )

        assert response.status_code == 200
        assert "matching_results" in response.json
        assert len(response.json["matching_results"]) == 3

        # First ingredient should have high confidence match
        first_match = response.json["matching_results"][0]
        assert first_match["imported"]["name"] == "Pale Malt (2-row)"
        assert len(first_match["matches"]) > 0
        assert first_match["best_match"] is not None

    def test_match_ingredients_no_ingredients(self, client, authenticated_user):
        """Test ingredient matching with no ingredients"""
        user, headers = authenticated_user

        match_data = {}  # No ingredients

        response = client.post(
            "/api/beerxml/match-ingredients", json=match_data, headers=headers
        )

        assert response.status_code == 400
        assert "No ingredients provided" in response.json["error"]

    def test_match_ingredients_empty_list(self, client, authenticated_user):
        """Test ingredient matching with empty ingredients list"""
        user, headers = authenticated_user

        match_data = {"ingredients": []}

        response = client.post(
            "/api/beerxml/match-ingredients", json=match_data, headers=headers
        )

        assert response.status_code == 400
        assert "No ingredients provided" in response.json["error"]

    def test_create_missing_ingredients_success(self, client, authenticated_user):
        """Test creating missing ingredients"""
        user, headers = authenticated_user

        new_ingredients = [
            {
                "name": "Munich Malt",
                "type": "grain",
                "grain_type": "base_malt",
                "potential": 37,
                "color": 9.0,
                "description": "Imported from BeerXML",
            },
            {
                "name": "Simcoe",
                "type": "hop",
                "alpha_acid": 13.0,
                "description": "Imported from BeerXML",
            },
        ]

        create_data = {"ingredients": new_ingredients}

        response = client.post(
            "/api/beerxml/create-ingredients", json=create_data, headers=headers
        )

        assert response.status_code == 201
        assert "created_ingredients" in response.json
        assert len(response.json["created_ingredients"]) == 2

        # Verify ingredients were actually created
        munich = Ingredient.objects(name="Munich Malt").first()
        assert munich is not None
        assert munich.type == "grain"
        assert munich.potential == 37

        simcoe = Ingredient.objects(name="Simcoe").first()
        assert simcoe is not None
        assert simcoe.type == "hop"
        assert simcoe.alpha_acid == 13.0

    def test_create_missing_ingredients_no_ingredients(
        self, client, authenticated_user
    ):
        """Test creating ingredients with no ingredients provided"""
        user, headers = authenticated_user

        create_data = {}  # No ingredients

        response = client.post(
            "/api/beerxml/create-ingredients", json=create_data, headers=headers
        )

        assert response.status_code == 400
        assert "No ingredients to create" in response.json["error"]

    def test_create_missing_ingredients_validation_error(
        self, client, authenticated_user
    ):
        """Test creating ingredients with validation errors"""
        user, headers = authenticated_user

        invalid_ingredients = [
            {
                # Missing name
                "type": "grain",
                "potential": 37,
            }
        ]

        create_data = {"ingredients": invalid_ingredients}

        response = client.post(
            "/api/beerxml/create-ingredients", json=create_data, headers=headers
        )

        assert response.status_code == 400
        assert "Invalid ingredient data" in response.json["error"]

    def test_beerxml_unauthorized_access(self, client, sample_recipe):
        """Test BeerXML endpoints without authentication"""
        # Export
        response = client.get("/api/beerxml/export/507f1f77bcf86cd799439011")
        assert response.status_code == 401

        # Parse
        response = client.post("/api/beerxml/parse", json={"xml_content": "<test/>"})
        assert response.status_code == 401

        # Match ingredients
        response = client.post(
            "/api/beerxml/match-ingredients", json={"ingredients": []}
        )
        assert response.status_code == 401

        # Create ingredients
        response = client.post(
            "/api/beerxml/create-ingredients", json={"ingredients": []}
        )
        assert response.status_code == 401

    def test_beerxml_export_xml_structure(
        self, client, authenticated_user, sample_recipe
    ):
        """Test that exported BeerXML has correct structure"""
        user, headers = authenticated_user

        # Create recipe
        create_response = client.post(
            "/api/recipes", json=sample_recipe, headers=headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Export recipe
        response = client.get(f"/api/beerxml/export/{recipe_id}", headers=headers)
        xml_content = response.json["xml"]

        # Parse exported XML to verify structure
        root = ET.fromstring(xml_content)

        # Check root element
        assert root.tag == "RECIPES"

        # Check recipe element
        recipe_elem = root.find("RECIPE")
        assert recipe_elem is not None

        # Check required fields
        assert recipe_elem.find("NAME").text == "American IPA"
        assert recipe_elem.find("VERSION").text == "1"
        assert recipe_elem.find("BATCH_SIZE") is not None
        assert recipe_elem.find("BOIL_TIME").text == "60"

        # Check ingredient sections
        assert recipe_elem.find("FERMENTABLES") is not None
        assert recipe_elem.find("HOPS") is not None
        assert recipe_elem.find("YEASTS") is not None
        assert recipe_elem.find("MISCS") is not None

        # Check fermentables
        fermentables = recipe_elem.find("FERMENTABLES").findall("FERMENTABLE")
        assert len(fermentables) == 2  # Pale malt and Crystal

        # Check hops
        hops = recipe_elem.find("HOPS").findall("HOP")
        assert len(hops) == 2  # Cascade and Centennial

        # Check yeasts
        yeasts = recipe_elem.find("YEASTS").findall("YEAST")
        assert len(yeasts) == 1  # US-05

        # Check misc
        miscs = recipe_elem.find("MISCS").findall("MISC")
        assert len(miscs) == 1  # Irish Moss

    def test_beerxml_parse_complex_recipe(self, client, authenticated_user):
        """Test parsing a complex BeerXML recipe with all ingredient types"""
        user, headers = authenticated_user

        complex_beerxml = """<?xml version="1.0" encoding="UTF-8"?>
        <RECIPES>
            <RECIPE>
                <NAME>Complex IPA</NAME>
                <VERSION>1</VERSION>
                <TYPE>All Grain</TYPE>
                <STYLE>American IPA</STYLE>
                <BATCH_SIZE>19.00</BATCH_SIZE>
                <BOIL_SIZE>22.80</BOIL_SIZE>
                <BOIL_TIME>60</BOIL_TIME>
                <EFFICIENCY>75</EFFICIENCY>
                <NOTES>Complex recipe with all ingredient types</NOTES>
                <FERMENTABLES>
                    <FERMENTABLE>
                        <NAME>Pale Malt</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>4.540</AMOUNT>
                        <TYPE>Grain</TYPE>
                        <YIELD>80.0</YIELD>
                        <COLOR>2.0</COLOR>
                    </FERMENTABLE>
                    <FERMENTABLE>
                        <NAME>Crystal 60L</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>0.454</AMOUNT>
                        <TYPE>Crystal</TYPE>
                        <YIELD>75.0</YIELD>
                        <COLOR>60.0</COLOR>
                    </FERMENTABLE>
                </FERMENTABLES>
                <HOPS>
                    <HOP>
                        <NAME>Magnum</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>0.014</AMOUNT>
                        <ALPHA>14.0</ALPHA>
                        <USE>Boil</USE>
                        <TIME>60</TIME>
                        <FORM>Pellet</FORM>
                    </HOP>
                    <HOP>
                        <NAME>Cascade</NAME>
                        <VERSION>1</VERSION>
                        <AMOUNT>0.028</AMOUNT>
                        <ALPHA>5.5</ALPHA>
                        <USE>Dry Hop</USE>
                        <TIME>0</TIME>
                        <FORM>Pellet</FORM>
                    </HOP>
                </HOPS>
                <YEASTS>
                    <YEAST>
                        <NAME>WLP001</NAME>
                        <VERSION>1</VERSION>
                        <TYPE>Ale</TYPE>
                        <FORM>Liquid</FORM>
                        <AMOUNT>1</AMOUNT>
                        <AMOUNT_IS_WEIGHT>FALSE</AMOUNT_IS_WEIGHT>
                        <ATTENUATION>75</ATTENUATION>
                        <LABORATORY>White Labs</LABORATORY>
                        <PRODUCT_ID>WLP001</PRODUCT_ID>
                    </YEAST>
                </YEASTS>
                <MISCS>
                    <MISC>
                        <NAME>Irish Moss</NAME>
                        <VERSION>1</VERSION>
                        <TYPE>Fining</TYPE>
                        <AMOUNT_IS_WEIGHT>TRUE</AMOUNT_IS_WEIGHT>
                        <AMOUNT>0.005</AMOUNT>
                        <USE>Boil</USE>
                        <TIME>15</TIME>
                    </MISC>
                </MISCS>
            </RECIPE>
        </RECIPES>"""

        parse_data = {"xml_content": complex_beerxml}

        response = client.post("/api/beerxml/parse", json=parse_data, headers=headers)

        assert response.status_code == 200
        assert len(response.json["recipes"]) == 1

        recipe = response.json["recipes"][0]
        assert recipe["recipe"]["name"] == "Complex IPA"

        # Check all ingredient types are parsed
        ingredients = recipe["ingredients"]
        grain_count = sum(1 for ing in ingredients if ing["type"] == "grain")
        hop_count = sum(1 for ing in ingredients if ing["type"] == "hop")
        yeast_count = sum(1 for ing in ingredients if ing["type"] == "yeast")
        other_count = sum(1 for ing in ingredients if ing["type"] == "other")

        assert grain_count == 2
        assert hop_count == 2
        assert yeast_count == 1
        assert other_count == 1

        # Check specific ingredient properties
        pale_malt = next(
            (ing for ing in ingredients if ing["name"] == "Pale Malt"), None
        )
        assert pale_malt is not None
        assert pale_malt["type"] == "grain"
        assert pale_malt["unit"] == "oz"  # Base unit for imperial after migration

        dry_hop = next((ing for ing in ingredients if ing["use"] == "dry-hop"), None)
        assert dry_hop is not None
        assert dry_hop["name"] == "Cascade"

    def test_ingredient_matching_confidence_scoring(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test ingredient matching confidence scoring"""
        user, headers = authenticated_user

        # Test exact match (should have high confidence)
        exact_match_ingredients = [
            {
                "name": "Pale Malt (2-row)",  # Exact match
                "type": "grain",
                "potential": 36,
                "color": 2.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": exact_match_ingredients},
            headers=headers,
        )

        assert response.status_code == 200
        exact_result = response.json["matching_results"][0]
        assert exact_result["confidence"] > 0.8  # High confidence for exact match
        assert exact_result["requires_new"] is False

        # Test partial match with identical properties (should still have high confidence)
        partial_match_ingredients = [
            {
                "name": "Pale Malt",  # Partial match but identical properties
                "type": "grain",
                "potential": 36,
                "color": 2.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": partial_match_ingredients},
            headers=headers,
        )

        partial_result = response.json["matching_results"][0]
        assert (
            partial_result["confidence"] > 0.7
        )  # High confidence due to identical properties
        assert partial_result["requires_new"] is False

        # Test partial match with different properties (should have medium confidence)
        medium_match_ingredients = [
            {
                "name": "Pale Malt",  # Partial match with different properties
                "type": "grain",
                "potential": 30,  # Different potential
                "color": 10.0,  # Different color
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": medium_match_ingredients},
            headers=headers,
        )

        medium_result = response.json["matching_results"][0]
        assert 0.3 < medium_result["confidence"] <= 0.8  # Medium confidence

        # Test no match (should suggest creating new)
        no_match_ingredients = [
            {
                "name": "Completely Unknown Ingredient",
                "type": "grain",
                "potential": 30,
                "color": 50.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": no_match_ingredients},
            headers=headers,
        )

        no_match_result = response.json["matching_results"][0]
        assert no_match_result["requires_new"] is True
        assert "suggestedIngredientData" in no_match_result

    def test_crystal_caramel_synonym_matching(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that Crystal ingredients match to Caramel ingredients"""
        user, headers = authenticated_user

        # Test Crystal Rye should match to Caramel Rye
        crystal_rye_ingredients = [
            {
                "name": "Crystal Rye",  # Should match to "Caramel Rye"
                "type": "grain",
                "potential": 32,
                "color": 55.0,  # Slightly different to avoid exact color match with Crystal 60L
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": crystal_rye_ingredients},
            headers=headers,
        )

        assert response.status_code == 200
        crystal_result = response.json["matching_results"][0]

        # Should find a match with high confidence
        assert crystal_result["confidence"] > 0.7
        assert crystal_result["requires_new"] is False
        assert crystal_result["best_match"]["ingredient"]["name"] == "Caramel Rye"

        # Test that the match was found due to name normalization
        matches = crystal_result["matches"]
        assert len(matches) > 0
        best_match = matches[0]
        assert best_match["ingredient"]["name"] == "Caramel Rye"

    def test_enhanced_yeast_matching_manufacturer_prefix(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that yeasts with manufacturer prefixes match correctly"""
        user, headers = authenticated_user

        # Test cases for different yeast manufacturer patterns
        test_cases = [
            {
                "name": "Fermentis W34/70",  # Should match to W34/70
                "expected_match": "W34/70",
                "expected_manufacturer": "Fermentis",
                "description": "Manufacturer prefix with code",
            },
            {
                "name": "Fermentis US-05",  # Should match to US-05
                "expected_match": "US-05",
                "expected_manufacturer": "Fermentis",
                "description": "Manufacturer prefix with different code",
            },
            {
                "name": "Wyeast 1056",  # Should match to American Ale
                "expected_match": "American Ale",
                "expected_manufacturer": "Wyeast",
                "description": "Manufacturer with numeric code",
            },
            {
                "name": "White Labs WLP001",  # Should match to WLP001 California Ale
                "expected_match": "WLP001 California Ale",
                "expected_manufacturer": "White Labs",
                "description": "White Labs with code",
            },
        ]

        for test_case in test_cases:
            yeast_ingredients = [
                {
                    "name": test_case["name"],
                    "type": "yeast",
                    "attenuation": 75.0,
                }
            ]

            response = client.post(
                "/api/beerxml/match-ingredients",
                json={"ingredients": yeast_ingredients},
                headers=headers,
            )

            assert response.status_code == 200, f"Failed for {test_case['description']}"
            result = response.json["matching_results"][0]

            # Should find a high confidence match
            assert (
                result["confidence"] > 0.6
            ), f"Low confidence for {test_case['description']}: {result['confidence']}"
            assert (
                result["requires_new"] is False
            ), f"Incorrectly requires new ingredient for {test_case['description']}"

            # Check that it matched to the correct ingredient
            best_match = result["best_match"]["ingredient"]
            assert (
                best_match["name"] == test_case["expected_match"]
            ), f"Wrong match for {test_case['description']}: got {best_match['name']}, expected {test_case['expected_match']}"
            assert (
                best_match["manufacturer"] == test_case["expected_manufacturer"]
            ), f"Wrong manufacturer for {test_case['description']}"

    def test_enhanced_yeast_matching_code_in_name(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that yeast names containing codes match correctly"""
        user, headers = authenticated_user

        # Test case where the code is embedded in a longer name
        yeast_ingredients = [
            {
                "name": "Some Random Software W34/70 Yeast",  # Contains W34/70 code
                "type": "yeast",
                "attenuation": 82.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": yeast_ingredients},
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json["matching_results"][0]

        # Should find a match because the code W34/70 is contained in the name
        assert result["confidence"] > 0.5
        assert result["requires_new"] is False

        # Should match to W34/70
        best_match = result["best_match"]["ingredient"]
        assert best_match["name"] == "W34/70"
        assert best_match["manufacturer"] == "Fermentis"

        # Check that the reason includes code matching
        reasons = result["best_match"]["reasons"]
        assert any("code" in reason.lower() for reason in reasons)

    def test_yeast_name_parsing(self, client, authenticated_user, sample_ingredients):
        """Test the yeast name parsing functionality"""
        user, headers = authenticated_user

        # Import the parse_yeast_name function to test directly
        from routes.beerxml import parse_yeast_name

        test_cases = [
            ("Fermentis W34/70", "fermentis", "W34/70"),
            ("Wyeast 1056", "wyeast", "1056"),
            ("White Labs WLP001", "white labs", "WLP001"),
            ("WLP WLP002", "white labs", "WLP002"),  # WLP prefix
            ("Omega OYL-218", "omega yeast", "OYL-218"),
            ("Imperial A38", "imperial yeast", "A38"),
            ("Lallemand Belle Saison", "lallemand", "Belle Saison"),
            ("Just A Regular Name", None, "Just A Regular Name"),  # No manufacturer
        ]

        for input_name, expected_manufacturer, expected_cleaned in test_cases:
            manufacturer, cleaned = parse_yeast_name(input_name)
            assert (
                manufacturer == expected_manufacturer
            ), f"Failed manufacturer parsing for '{input_name}': got {manufacturer}, expected {expected_manufacturer}"
            assert (
                cleaned == expected_cleaned
            ), f"Failed name cleaning for '{input_name}': got '{cleaned}', expected '{expected_cleaned}'"

    def test_improved_crystal_rye_malt_matching(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that Crystal Rye Malt matches to Caramel Rye with high confidence"""
        user, headers = authenticated_user

        # Test the specific case from the user's BeerXML import
        crystal_rye_malt_ingredients = [
            {
                "name": "Crystal Rye Malt",  # Should match to "Caramel Rye"
                "type": "grain",
                "color": 60.0,
                "potential": 32.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": crystal_rye_malt_ingredients},
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json["matching_results"][0]

        # Should find a high confidence match (>= 0.7 to not require new ingredient)
        assert (
            result["confidence"] >= 0.7
        ), f"Confidence too low: {result['confidence']}"
        assert result["requires_new"] is False, "Should not require new ingredient"

        # Should match to Caramel Rye specifically
        assert result["best_match"]["ingredient"]["name"] == "Caramel Rye"

        # Should have excellent match reason due to normalization
        reasons = result["best_match"]["reasons"]
        assert any(
            "excellent" in reason.lower() or "match" in reason.lower()
            for reason in reasons
        )

    def test_semantic_grain_matching_rye_malt(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that Rye Malt matches to Malted Rye better than Caramel Rye"""
        user, headers = authenticated_user

        # Test the specific case where semantic matching should prefer Malted Rye
        rye_malt_ingredients = [
            {
                "name": "Rye Malt",  # Should prefer "Malted Rye" over "Caramel Rye"
                "type": "grain",
                "color": 3.0,
                "potential": 40.0,
            }
        ]

        response = client.post(
            "/api/beerxml/match-ingredients",
            json={"ingredients": rye_malt_ingredients},
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json["matching_results"][0]

        # Should find a high confidence match
        assert (
            result["confidence"] >= 0.7
        ), f"Confidence too low: {result['confidence']}"
        assert result["requires_new"] is False, "Should not require new ingredient"

        # Should match to Malted Rye specifically (not Caramel Rye)
        assert result["best_match"]["ingredient"]["name"] == "Malted Rye"

        # Check that Malted Rye has higher confidence than Caramel Rye in the matches list
        matches = result["matches"]
        malted_rye_match = next(
            (m for m in matches if m["ingredient"]["name"] == "Malted Rye"), None
        )
        caramel_rye_match = next(
            (m for m in matches if m["ingredient"]["name"] == "Caramel Rye"), None
        )

        assert malted_rye_match is not None, "Malted Rye should be in matches"
        assert caramel_rye_match is not None, "Caramel Rye should be in matches"
        assert (
            malted_rye_match["confidence"] > caramel_rye_match["confidence"]
        ), f"Malted Rye ({malted_rye_match['confidence']}) should score higher than Caramel Rye ({caramel_rye_match['confidence']})"
