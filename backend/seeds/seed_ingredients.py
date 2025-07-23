import json
from datetime import datetime

from mongoengine import connect, disconnect
from mongoengine.connection import ConnectionFailure, get_connection

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
                # Remove MongoDB-specific fields that shouldn't be passed to constructor
                clean_data = (
                    ingredient_data.copy()
                )  # Make a copy to avoid modifying original
                clean_data.pop("_id", None)  # Remove _id field if it exists
                clean_data.pop("__v", None)  # Remove version field if it exists

                # Handle MongoDB date format conversion
                if "last_attenuation_update" in clean_data:
                    date_field = clean_data["last_attenuation_update"]
                    if isinstance(date_field, dict) and "$date" in date_field:
                        # Convert MongoDB date format to Python datetime
                        clean_data["last_attenuation_update"] = datetime.fromisoformat(
                            date_field["$date"].replace("Z", "+00:00")
                        )

                # Ensure yeast_type field is properly handled for yeast ingredients
                if clean_data.get("type") == "yeast" and "yeast_type" not in clean_data:
                    # Set yeast_type to None if not provided, will be populated by migration
                    clean_data["yeast_type"] = None

                # Create ingredient object with cleaned data
                ingredient = Ingredient(**clean_data)
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
    json_file_path = (
        Path(__file__).parent.parent / "data" / "brewtracker.ingredients.json"
    )

    seed_ingredients(mongo_uri, json_file_path)
