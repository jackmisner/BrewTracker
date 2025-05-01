import unittest
from datetime import datetime
from models.recipe import Recipe
from models import db


class TestRecipe(unittest.TestCase):
    def setUp(self):
        self.recipe = Recipe(
            user_id=1,
            name="Test Beer",
            style="IPA",
            batch_size=5.0,
            description="A test beer recipe",
            is_public=True,
            estimated_og=1.050,
            estimated_fg=1.010,
            estimated_abv=5.2,
            estimated_ibu=45.0,
            estimated_srm=8.0,
            boil_time=60,
            efficiency=75.0,
            notes="Test notes",
        )

    def test_recipe_creation(self):
        self.assertEqual(self.recipe.user_id, 1)
        self.assertEqual(self.recipe.name, "Test Beer")
        self.assertEqual(self.recipe.style, "IPA")
        self.assertEqual(self.recipe.batch_size, 5.0)
        self.assertTrue(self.recipe.is_public)

    def test_estimated_values(self):
        self.assertEqual(self.recipe.estimated_og, 1.050)
        self.assertEqual(self.recipe.estimated_fg, 1.010)
        self.assertEqual(self.recipe.estimated_abv, 5.2)
        self.assertEqual(self.recipe.estimated_ibu, 45.0)
        self.assertEqual(self.recipe.estimated_srm, 8.0)

    def test_brew_parameters(self):
        self.assertEqual(self.recipe.boil_time, 60)
        self.assertEqual(self.recipe.efficiency, 75.0)
        self.assertEqual(self.recipe.notes, "Test notes")

    def test_to_dict(self):
        recipe_dict = self.recipe.to_dict()
        self.assertIsInstance(recipe_dict, dict)
        self.assertEqual(recipe_dict["name"], "Test Beer")
        self.assertEqual(recipe_dict["style"], "IPA")
        self.assertEqual(recipe_dict["batch_size"], 5.0)
        self.assertTrue(recipe_dict["is_public"])


if __name__ == "__main__":
    unittest.main()
