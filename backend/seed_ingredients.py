import json
import os
import sys
from pathlib import Path

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.mongo_models import initialize_db, Ingredient


def seed_ingredients(mongo_uri, json_file_path):
    """Seed the ingredients collection with data from the JSON file."""

    # Connect to the database
    initialize_db(mongo_uri)

    # Check if ingredients already exist
    existing_count = Ingredient.objects.count()
    if existing_count > 0:
        print(f"Found {existing_count} existing ingredients. Skipping seed operation.")
        return

    # Load JSON data
    try:
        with open(json_file_path, "r") as file:
            ingredients_data = json.load(file)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return

    print(f"Loaded {len(ingredients_data)} ingredients from JSON file.")

    # Process and insert each ingredient
    added_count = 0
    skipped_count = 0

    for item in ingredients_data:
        # Handle MongoDB ObjectID format in the JSON
        if "_id" in item and "$oid" in item["_id"]:
            del item["_id"]  # Let MongoDB generate new IDs

        # Create ingredient object
        try:
            ingredient = Ingredient(**item)
            ingredient.save()
            added_count += 1
        except Exception as e:
            print(f"Error adding ingredient {item.get('name', 'unknown')}: {e}")
            skipped_count += 1

    print(f"Seed operation completed.")
    print(f"Added: {added_count}")
    print(f"Skipped: {skipped_count}")


if __name__ == "__main__":
    # Get MongoDB URI from environment variable or use default
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/brewtracker")

    # Path to the ingredients JSON file
    json_file_path = Path(__file__).parent / "data" / "brewtracker.ingredients.json"

    # Check if file exists
    if not json_file_path.exists():
        print(f"Ingredients file not found at {json_file_path}")
        # Try another common location
        json_file_path = Path(__file__).parent / "brewtracker.ingredients.json"
        if not json_file_path.exists():
            print(f"Ingredients file not found at {json_file_path} either")
            sys.exit(1)

    # Run seed operation
    seed_ingredients(mongo_uri, json_file_path)
