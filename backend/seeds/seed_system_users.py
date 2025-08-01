"""
System users seeding script for BrewTracker.

Seeds the database with system users (Anonymous User, BrewTracker System, Community)
if they don't already exist. This follows the same pattern as ingredient and beer style seeding.
"""

import json
import os
import secrets
import string
from datetime import UTC, datetime

from models.mongo_models import User, UserSettings, initialize_db


def generate_secure_password(length=32):
    """Generate a cryptographically secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def seed_system_users(mongo_uri, json_file_path):
    """Seed the database with system users from JSON file"""
    try:
        # Initialize database connection
        initialize_db(mongo_uri)

        # Check if system users already exist
        system_user_count = User.objects(email__endswith="@brewtracker.system").count()
        if system_user_count > 0:
            print("System users already exist, skipping seed operation")
            return

        # Load system users data from JSON
        if not os.path.exists(json_file_path):
            print(f"System users JSON file not found: {json_file_path}")
            return

        with open(json_file_path, "r", encoding="utf-8") as file:
            system_users_data = json.load(file)

        print(f"Loading {len(system_users_data)} system users from {json_file_path}")

        created_count = 0
        for user_data in system_users_data:
            try:
                # Check if this specific system user already exists
                existing_user = User.objects(username=user_data["username"]).first()
                if existing_user:
                    print(
                        f"System user '{user_data['username']}' already exists, skipping"
                    )
                    continue

                # Create user settings
                settings_data = user_data.get("settings", {})
                settings = UserSettings(
                    contribute_anonymous_data=settings_data.get(
                        "contribute_anonymous_data", False
                    ),
                    share_yeast_performance=settings_data.get(
                        "share_yeast_performance", False
                    ),
                    share_recipe_metrics=settings_data.get(
                        "share_recipe_metrics", False
                    ),
                    public_recipes_default=settings_data.get(
                        "public_recipes_default", False
                    ),
                    default_batch_size=settings_data.get("default_batch_size", 5.0),
                    preferred_units=settings_data.get("preferred_units", "imperial"),
                    timezone=settings_data.get("timezone", "UTC"),
                )

                # Create system user
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    settings=settings,
                    is_active=True,
                    created_at=datetime.now(UTC),
                )

                # Set secure random password (system users should never login normally)
                secure_password = generate_secure_password()
                user.set_password(secure_password)

                # Save the user
                user.save()
                created_count += 1

                print(f"Created system user: {user_data['username']}")

            except Exception as e:
                print(
                    f"Error creating system user '{user_data.get('username', 'unknown')}': {e}"
                )
                continue

        print(f"Successfully seeded {created_count} system users into the database")

        # Verify system users are accessible
        verify_system_users()

    except FileNotFoundError:
        print(f"System users JSON file not found: {json_file_path}")
    except json.JSONDecodeError as e:
        print(f"Error parsing system users JSON file: {e}")
    except Exception as e:
        print(f"Error seeding system users: {e}")


def verify_system_users():
    """Verify that system users were created successfully and are accessible."""
    try:
        system_users = User.objects(email__endswith="@brewtracker.system")
        print(f"Verification: Found {system_users.count()} system users in database")

        for user in system_users:
            print(f"  - {user.username} ({user.email}) - Created: {user.created_at}")

    except Exception as e:
        print(f"Error verifying system users: {e}")


# Script can be run directly for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python seed_system_users.py <mongo_uri> <json_file_path>")
        sys.exit(1)

    mongo_uri = sys.argv[1]
    json_file_path = sys.argv[2]

    seed_system_users(mongo_uri, json_file_path)
