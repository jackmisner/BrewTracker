import json
from mongoengine import connect, disconnect
from mongoengine.connection import get_connection, ConnectionFailure
from models.mongo_models import Ingredient


def initialize_db(mongo_uri):
    """Initialize database connection only if not already connected"""
    try:
        # Check if connection already exists
        get_connection()
        print("Database connection already exists, using existing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        print(f"Connecting to MongoDB: {mongo_uri}")
        connect(host=mongo_uri, uuidRepresentation="standard")


def seed_ingredients(mongo_uri, json_file_path):
    """Seed the database with ingredients from JSON file"""
    try:
        # Only initialize DB if not already connected
        initialize_db(mongo_uri)

        # Check if ingredients already exist
        if Ingredient.objects.count() > 0:
            print("Ingredients already exist, skipping seed operation")
            return

        # Load ingredients from JSON file
        with open(json_file_path, "r") as file:
            ingredients_data = json.load(file)

        print(f"Loading {len(ingredients_data)} ingredients...")

        # Insert ingredients into database
        created_count = 0
        for ingredient_data in ingredients_data:
            try:
                # Create ingredient object
                ingredient = Ingredient(**ingredient_data)
                ingredient.save()
                created_count += 1
            except Exception as e:
                print(
                    f"Error creating ingredient {ingredient_data.get('name', 'Unknown')}: {e}"
                )
                continue

        print(f"Successfully seeded {created_count} ingredients into the database")

    except FileNotFoundError:
        print(f"Ingredients file not found: {json_file_path}")
    except json.JSONDecodeError as e:
        print(f"Error parsing ingredients JSON file: {e}")
    except Exception as e:
        print(f"Error seeding ingredients: {e}")


if __name__ == "__main__":
    import os
    from pathlib import Path

    # Default values for standalone execution
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/brewtracker")
    json_file_path = Path(__file__).parent / "data" / "brewtracker.ingredients.json"

    seed_ingredients(mongo_uri, json_file_path)
