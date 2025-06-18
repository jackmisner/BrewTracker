import json
from mongoengine import connect, disconnect
from mongoengine.connection import get_connection, ConnectionFailure
from models.mongo_models import BeerStyleGuide, StyleRange


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


def seed_beer_styles(mongo_uri, json_file_path):
    """Seed the database with beer styles from JSON file"""
    try:
        # Only initialize DB if not already connected
        initialize_db(mongo_uri)

        # Check if beer styles already exist
        if BeerStyleGuide.objects.count() > 0:
            print("Beer styles already exist, skipping seed operation")
            return

        # Load beer styles from JSON file
        with open(json_file_path, "r") as file:
            beer_styles_data = json.load(file)

        # Extract styles from the BeerJSON format
        styles_list = beer_styles_data.get("beerjson", {}).get("styles", [])

        if not styles_list:
            print("No styles found in the JSON file")
            return

        print(f"Loading {len(styles_list)} beer styles...")

        # Insert beer styles into database
        created_count = 0
        for style_data in styles_list:
            try:
                # Create StyleRange objects for each range field
                ranges = {}
                range_fields = [
                    "original_gravity",
                    "international_bitterness_units",
                    "final_gravity",
                    "alcohol_by_volume",
                    "color",
                ]

                for field in range_fields:
                    if field in style_data and style_data[field]:
                        range_data = style_data[field]
                        ranges[field] = StyleRange(
                            minimum=range_data["minimum"]["value"],
                            maximum=range_data["maximum"]["value"],
                            unit=range_data["minimum"]["unit"],
                        )

                # Prepare tags (convert string to list if needed)
                tags = style_data.get("tags", "")
                if isinstance(tags, str):
                    tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
                elif not isinstance(tags, list):
                    tags = []

                # Create the beer style guide instance
                style_guide = BeerStyleGuide(
                    name=style_data.get("name"),
                    category=style_data.get("category"),
                    category_id=style_data.get("category_id"),
                    style_id=style_data.get("style_id"),
                    category_description=style_data.get("category_description"),
                    overall_impression=style_data.get("overall_impression"),
                    aroma=style_data.get("aroma"),
                    appearance=style_data.get("appearance"),
                    flavor=style_data.get("flavor"),
                    mouthfeel=style_data.get("mouthfeel"),
                    comments=style_data.get("comments"),
                    history=style_data.get("history"),
                    style_comparison=style_data.get("style_comparison"),
                    tags=tags,
                    ingredients=style_data.get("ingredients"),
                    examples=style_data.get("examples"),
                    style_guide=style_data.get("style_guide", "BJCP2021"),
                    type=style_data.get("type", "beer"),
                    version=style_data.get("version", 2.01),
                    **ranges,  # Add all the range fields
                )

                style_guide.save()
                created_count += 1

            except Exception as e:
                print(
                    f"Error creating beer style {style_data.get('name', 'Unknown')}: {e}"
                )
                continue

        print(f"Successfully seeded {created_count} beer styles into the database")

    except FileNotFoundError:
        print(f"Beer styles file not found: {json_file_path}")
    except json.JSONDecodeError as e:
        print(f"Error parsing beer styles JSON file: {e}")
    except Exception as e:
        print(f"Error seeding beer styles: {e}")


if __name__ == "__main__":
    import os
    from pathlib import Path

    # Default values for standalone execution
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/brewtracker")
    json_file_path = Path(__file__).parent / "data" / "beer_style_guides.json"

    seed_beer_styles(mongo_uri, json_file_path)
