import unittest
from datetime import datetime
from models import db
from models.brew_session import BrewSession


class TestBrewSession(unittest.TestCase):
    def setUp(self):
        self.brew_session = BrewSession(
            recipe_id=1,
            user_id=1,
            brew_date=datetime.utcnow().date(),
            name="Test Brew",
            status="planned",
        )

    def test_brew_session_creation(self):
        self.assertEqual(self.brew_session.recipe_id, 1)
        self.assertEqual(self.brew_session.user_id, 1)
        self.assertEqual(self.brew_session.name, "Test Brew")
        self.assertEqual(self.brew_session.status, "planned")

    def test_recipe_id_not_null(self):
        with self.assertRaises(Exception):
            invalid_session = BrewSession(
                user_id=1, brew_date=datetime.utcnow().date(), name="Test Brew"
            )
            db.session.add(invalid_session)
            db.session.commit()

    def test_to_dict(self):
        session_dict = self.brew_session.to_dict()
        self.assertIsInstance(session_dict, dict)
        self.assertEqual(session_dict["recipe_id"], 1)
        self.assertEqual(session_dict["user_id"], 1)
        self.assertEqual(session_dict["name"], "Test Brew")
        self.assertEqual(session_dict["status"], "planned")


if __name__ == "__main__":
    unittest.main()
