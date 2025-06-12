from datetime import datetime, UTC
from bson import ObjectId
from pymongo.errors import PyMongoError
from models.mongo_models import (
    User,
    Recipe,
    Ingredient,
    BrewSession,
    RecipeIngredient,
    FermentationEntry,
)


class MongoDBService:

    ###########################################################
    #                       User Methods                      #
    ###########################################################

    @staticmethod
    def get_user_by_id(user_id):
        """Retrieve a user by ID"""
        try:
            return User.objects(id=user_id).first()
        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def get_user_by_username(username):
        """Retrieve a user by username"""
        try:
            return User.objects(username=username).first()
        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def get_recent_activity(user_id, limit=5):
        """Get recent brewing activity for a user"""
        try:
            # Get recent brew sessions
            recent_sessions = (
                BrewSession.objects(user_id=user_id).order_by("-brew_date").limit(limit)
            )

            # Get recent recipes
            recent_recipes = (
                Recipe.objects(user_id=user_id).order_by("-created_at").limit(limit)
            )

            return {
                "recent_sessions": [session.to_dict() for session in recent_sessions],
                "recent_recipes": [recipe.to_dict() for recipe in recent_recipes],
            }
        except Exception as e:
            print(f"Database error: {e}")
            return {"recent_sessions": [], "recent_recipes": []}

    ###########################################################
    #                       Recipe Methods                    #
    ###########################################################

    @staticmethod
    def get_recipe_for_user(recipe_id, user_id):
        """Get recipe converted to user's preferred units"""
        try:
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return None

            user = User.objects(id=user_id).first()
            if not user:
                return recipe.to_dict()

            # Convert recipe to user's preferred units
            recipe_dict = recipe.to_dict()
            return user.convert_recipe_to_preferred_units(recipe_dict)

        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def get_user_recipes_with_units(user_id, page=1, per_page=10):
        """Get user recipes with unit conversion"""
        try:
            user = User.objects(id=user_id).first()
            if not user:
                return MongoDBService.get_user_recipes(user_id, page, per_page)

            # Get recipes normally
            result = MongoDBService.get_user_recipes(user_id, page, per_page)

            # Convert each recipe to user's preferred units
            converted_recipes = []
            for recipe in result["items"]:
                recipe_dict = recipe.to_dict()
                converted_dict = user.convert_recipe_to_preferred_units(recipe_dict)
                # Just append the converted dictionary, don't create a type object
                converted_recipes.append(converted_dict)

            result["items"] = converted_recipes
            return result

        except Exception as e:
            print(f"Database error: {e}")
            return MongoDBService.get_user_recipes(user_id, page, per_page)

    @staticmethod
    def get_user_recipes(user_id, page=1, per_page=10):
        """Get all recipes for a user with pagination"""
        try:
            # Calculate skip value based on page and per_page
            skip = (page - 1) * per_page

            # Get recipes with pagination
            recipes = Recipe.objects(user_id=user_id).skip(skip).limit(per_page)

            # Count total documents for pagination metadata
            total = Recipe.objects(user_id=user_id).count()

            # Calculate pagination metadata
            total_pages = (total + per_page - 1) // per_page  # Ceiling division
            has_next = page < total_pages
            has_prev = page > 1

            # Return pagination object similar to SQLAlchemy's pagination
            return {
                "items": recipes,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev,
                "next_num": page + 1 if has_next else None,
                "prev_num": page - 1 if has_prev else None,
            }
        except Exception as e:
            print(f"Database error: {e}")
            return {
                "items": [],
                "page": page,
                "per_page": per_page,
                "total": 0,
                "pages": 0,
                "has_next": False,
                "has_prev": False,
                "next_num": None,
                "prev_num": None,
            }

    @staticmethod
    def calculate_recipe_stats(recipe_id):
        """Calculate statistics for a recipe based on its brew sessions"""
        try:
            # Use MongoDB's aggregation framework for calculations
            pipeline = [
                {"$match": {"recipe_id": ObjectId(recipe_id), "status": "completed"}},
                {
                    "$group": {
                        "_id": None,
                        "avg_og": {"$avg": "$actual_og"},
                        "avg_fg": {"$avg": "$actual_fg"},
                        "avg_abv": {"$avg": "$actual_abv"},
                        "avg_efficiency": {"$avg": "$actual_efficiency"},
                        "total_brews": {"$sum": 1},
                    }
                },
            ]

            result = list(BrewSession.objects.aggregate(pipeline))

            if not result:
                # No completed brew sessions, return predicted recipe metrics if available
                recipe = Recipe.objects(id=recipe_id).first()
                if recipe:
                    return {
                        "og": (
                            recipe.estimated_og
                            if hasattr(recipe, "estimated_og")
                            else None
                        ),
                        "fg": (
                            recipe.estimated_fg
                            if hasattr(recipe, "estimated_fg")
                            else None
                        ),
                        "abv": (
                            recipe.estimated_abv
                            if hasattr(recipe, "estimated_abv")
                            else None
                        ),
                        "ibu": (
                            recipe.estimated_ibu
                            if hasattr(recipe, "estimated_ibu")
                            else None
                        ),
                        "srm": (
                            recipe.estimated_srm
                            if hasattr(recipe, "estimated_srm")
                            else None
                        ),
                        "efficiency": (
                            recipe.efficiency if hasattr(recipe, "efficiency") else None
                        ),
                        "total_brews": 0,
                    }
                return None

            stats = result[0]

            # Calculate attenuation
            avg_og = stats.get("avg_og")
            avg_fg = stats.get("avg_fg")
            avg_attenuation = (
                ((avg_og - avg_fg) / avg_og) * 100 if avg_og and avg_fg else None
            )

            return {
                "avg_og": stats.get("avg_og"),
                "avg_fg": stats.get("avg_fg"),
                "avg_abv": stats.get("avg_abv"),
                "avg_efficiency": stats.get("avg_efficiency"),
                "avg_attenuation": avg_attenuation,
                "total_brews": stats.get("total_brews"),
            }
        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def get_attenuation_by_recipe(user_id):
        """Get attenuation statistics for all user recipes"""
        try:
            # First, get all completed brew sessions for user's recipes
            pipeline = [
                # Join recipes and brew sessions
                {
                    "$lookup": {
                        "from": "brew_sessions",
                        "localField": "_id",
                        "foreignField": "recipe_id",
                        "as": "sessions",
                    }
                },
                # Filter by user ID and only include completed sessions
                {
                    "$match": {
                        "user_id": ObjectId(user_id),
                        "sessions.status": "completed",
                        "sessions.actual_og": {"$ne": None},
                        "sessions.actual_fg": {"$ne": None},
                    }
                },
                # Unwind the sessions array to work with individual sessions
                {"$unwind": "$sessions"},
                # Group by recipe to calculate averages
                {
                    "$group": {
                        "_id": "$_id",
                        "name": {"$first": "$name"},
                        "style": {"$first": "$style"},
                        "avg_og": {"$avg": "$sessions.actual_og"},
                        "avg_fg": {"$avg": "$sessions.actual_fg"},
                    }
                },
            ]

            recipes = Recipe.objects.aggregate(pipeline)

            # Calculate attenuation for each recipe
            results = []
            for recipe in recipes:
                og = recipe.get("avg_og")
                fg = recipe.get("avg_fg")
                attenuation = ((og - fg) / og) * 100 if og and fg else None

                results.append(
                    {
                        "name": recipe.get("name"),
                        "style": recipe.get("style"),
                        "og": og,
                        "fg": fg,
                        "attenuation": attenuation,
                    }
                )

            return results
        except Exception as e:
            print(f"Database error: {e}")
            return []

    @staticmethod
    def create_recipe(recipe_data, user_id=None):
        """Create a new recipe with unit conversion support"""
        try:
            # Get user for unit preferences
            user = None
            if user_id:
                user = User.objects(id=user_id).first()

            # Extract ingredients data if provided
            ingredients_data = recipe_data.pop("ingredients", [])

            # Convert recipe data to storage format (keep user's preferred units)
            if user and user.get_preferred_units() == "metric":
                # Store metric batch sizes in liters
                if "batch_size" in recipe_data and "batch_size_unit" not in recipe_data:
                    # Assume gallons if no unit specified
                    from utils.unit_conversions import UnitConverter

                    recipe_data["batch_size"] = UnitConverter.convert_volume(
                        recipe_data["batch_size"], "gal", "l"
                    )

            # Create recipe object
            recipe = Recipe(**recipe_data)

            # Process and add ingredients as embedded documents
            for ing_data in ingredients_data:
                recipe_ingredient = RecipeIngredient(**ing_data)
                recipe.ingredients.append(recipe_ingredient)

            # Set creation timestamps
            now = datetime.now(UTC)
            recipe.created_at = now
            recipe.updated_at = now

            # Save the recipe
            recipe.save()

            return recipe
        except Exception as e:
            print(f"Database error creating recipe: {e}")
            return None

    @staticmethod
    def update_recipe(recipe_id, recipe_data):
        """Update an existing recipe with support for embedded ingredients"""
        try:
            # Get the recipe
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return None, "Recipe not found"

            # Extract ingredients if included
            ingredients_data = recipe_data.pop("ingredients", None)

            # Log data for debugging
            # print(f"Updating recipe {recipe_id}")
            # print(f"Recipe data: {recipe_data}")
            # print(f"Ingredients data: {ingredients_data}")

            # Update recipe fields
            for key, value in recipe_data.items():
                if hasattr(recipe, key):
                    setattr(recipe, key, value)
                else:
                    print(f"Warning: Field '{key}' not found in Recipe model")

            # Update ingredients if provided
            if ingredients_data is not None:
                # Clear existing ingredients
                recipe.ingredients = []

                # Add new ingredients
                for ing_data in ingredients_data:
                    # Create RecipeIngredient embedded document
                    from models.mongo_models import RecipeIngredient

                    # Only include fields that exist in the RecipeIngredient model
                    recipe_ingredient_fields = {
                        "ingredient_id": ing_data.get("ingredient_id"),
                        "name": ing_data.get("name"),
                        "type": ing_data.get("type"),
                        "amount": float(ing_data.get("amount", 0)),
                        "unit": ing_data.get("unit", ""),
                        "use": ing_data.get("use", ""),
                        "time": int(ing_data.get("time", 0)),
                        "potential": ing_data.get("potential"),
                        "color": ing_data.get("color"),
                        "alpha_acid": ing_data.get("alpha_acid"),
                        "attenuation": ing_data.get("attenuation"),
                    }

                    # Filter out None values to avoid validation errors
                    recipe_ingredient_fields = {
                        k: v
                        for k, v in recipe_ingredient_fields.items()
                        if v is not None
                    }

                    recipe_ingredient = RecipeIngredient(**recipe_ingredient_fields)
                    recipe.ingredients.append(recipe_ingredient)

            # Update timestamp
            recipe.updated_at = datetime.now(UTC)

            # Save the recipe
            recipe.save()

            return recipe, "Recipe updated successfully"

        except Exception as e:
            print(f"Database error updating recipe: {e}")

    @staticmethod
    def clone_recipe(recipe_id, user_id):
        """Create a new version of an existing recipe"""
        try:
            # Get the original recipe
            original_recipe = Recipe.objects(id=recipe_id).first()
            if not original_recipe:
                return None, "Original recipe not found"

            # Check if user has access to this recipe
            if (
                str(original_recipe.user_id) != user_id
                and not original_recipe.is_public
            ):
                return None, "Access denied"

            # Find the root recipe (the one without a parent)
            root_recipe = original_recipe
            if original_recipe.parent_recipe_id:
                root_recipe = Recipe.objects(
                    id=original_recipe.parent_recipe_id
                ).first()
                if not root_recipe:
                    return None, "Root recipe not found"

            # Find the highest version number among all variants of the root recipe
            highest_version = (
                Recipe.objects(parent_recipe_id=root_recipe.id)
                .order_by("-version")
                .first()
            )

            # Calculate new version number based on root recipe variants
            new_version = (highest_version.version + 1) if highest_version else 2

            # Create new recipe object as a copy of the original (not the root)
            new_recipe = Recipe()
            new_recipe.user_id = ObjectId(user_id)
            # Use root recipe name for consistency in naming
            base_name = root_recipe.name.split(" (v")[
                0
            ]  # Remove any existing version suffix
            new_recipe.name = f"{base_name} (v{new_version})"

            # Copy fields from the recipe being cloned
            new_recipe.style = original_recipe.style
            new_recipe.batch_size = original_recipe.batch_size
            new_recipe.description = original_recipe.description
            new_recipe.is_public = original_recipe.is_public
            new_recipe.boil_time = original_recipe.boil_time
            new_recipe.efficiency = original_recipe.efficiency
            new_recipe.notes = original_recipe.notes

            # Set version info with new calculated version
            new_recipe.parent_recipe_id = root_recipe.id  # Always link to root recipe
            new_recipe.version = new_version

            # Copy metrics from the recipe being cloned
            new_recipe.estimated_og = original_recipe.estimated_og
            new_recipe.estimated_fg = original_recipe.estimated_fg
            new_recipe.estimated_abv = original_recipe.estimated_abv
            new_recipe.estimated_ibu = original_recipe.estimated_ibu
            new_recipe.estimated_srm = original_recipe.estimated_srm

            # Copy ingredients from the recipe being cloned
            for ing in original_recipe.ingredients:
                new_ing = RecipeIngredient()
                new_ing.ingredient_id = ing.ingredient_id
                new_ing.name = ing.name
                new_ing.type = ing.type
                new_ing.grain_type = ing.grain_type
                new_ing.amount = ing.amount
                new_ing.unit = ing.unit
                new_ing.use = ing.use
                new_ing.time = ing.time
                new_ing.potential = ing.potential
                new_ing.color = ing.color
                new_ing.alpha_acid = ing.alpha_acid
                new_ing.attenuation = ing.attenuation
                new_recipe.ingredients.append(new_ing)

            # Set creation timestamps
            now = datetime.now(UTC)
            new_recipe.created_at = now
            new_recipe.updated_at = now

            # Save the new recipe
            new_recipe.save()

            return new_recipe, "Recipe cloned successfully"
        except Exception as e:
            print(f"Database error cloning recipe: {e}")
            return None, str(e)

    @staticmethod
    def search_recipes(query, page=1, per_page=10):
        """Search recipes by name or style"""
        try:
            # Create text index if it doesn't exist (only needs to be done once)
            # Recipe.create_index([("name", "text"), ("style", "text"), ("description", "text")])

            # Search using the text index
            recipes = (
                Recipe.objects.search_text(query)
                .filter(is_public=True)
                .skip((page - 1) * per_page)
                .limit(per_page)
            )

            # Count total results
            total = Recipe.objects.search_text(query).filter(is_public=True).count()

            # Calculate pagination info
            total_pages = (total + per_page - 1) // per_page
            has_next = page < total_pages
            has_prev = page > 1

            return {
                "items": recipes,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev,
                "next_num": page + 1 if has_next else None,
                "prev_num": page - 1 if has_prev else None,
            }

        except Exception as e:
            print(f"Database error: {e}")
            return {
                "items": [],
                "page": page,
                "per_page": per_page,
                "total": 0,
                "pages": 0,
                "has_next": False,
                "has_prev": False,
                "next_num": None,
                "prev_num": None,
            }

    @staticmethod
    def get_ingredient_recipes(ingredient_id, page=1, per_page=10):
        """Find public recipes that use a specific ingredient"""
        try:
            # Query recipes that contain the ingredient in the embedded array
            recipes = (
                Recipe.objects(ingredients__ingredient_id=ingredient_id, is_public=True)
                .skip((page - 1) * per_page)
                .limit(per_page)
            )

            # Count total results
            total = Recipe.objects(
                ingredients__ingredient_id=ingredient_id, is_public=True
            ).count()

            # Calculate pagination info
            total_pages = (total + per_page - 1) // per_page
            has_next = page < total_pages
            has_prev = page > 1

            return {
                "items": recipes,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev,
                "next_num": page + 1 if has_next else None,
                "prev_num": page - 1 if has_prev else None,
            }

        except Exception as e:
            print(f"Database error: {e}")
            return {
                "items": [],
                "page": page,
                "per_page": per_page,
                "total": 0,
                "pages": 0,
                "has_next": False,
                "has_prev": False,
                "next_num": None,
                "prev_num": None,
            }

    ###########################################################
    #                   Brew Session Methods                  #
    ###########################################################

    @staticmethod
    def get_user_brew_sessions(user_id, page=1, per_page=10):
        """Get all brew sessions for a user with pagination"""
        try:
            # Calculate skip value
            skip = (page - 1) * per_page

            # Get brew sessions with pagination
            sessions = BrewSession.objects(user_id=user_id).skip(skip).limit(per_page)

            # Count total documents
            total = BrewSession.objects(user_id=user_id).count()

            # Calculate pagination metadata
            total_pages = (total + per_page - 1) // per_page
            has_next = page < total_pages
            has_prev = page > 1

            return {
                "items": sessions,
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev,
                "next_num": page + 1 if has_next else None,
                "prev_num": page - 1 if has_prev else None,
            }
        except Exception as e:
            print(f"Database error: {e}")
            return {
                "items": [],
                "page": page,
                "per_page": per_page,
                "total": 0,
                "pages": 0,
                "has_next": False,
                "has_prev": False,
                "next_num": None,
                "prev_num": None,
            }

    @staticmethod
    def get_recipe_brew_sessions(recipe_id):
        """Get all brew sessions for a specific recipe"""
        try:
            return BrewSession.objects(recipe_id=recipe_id)
        except Exception as e:
            print(f"Database error: {e}")
            return []

    @staticmethod
    def create_brew_session(session_data):
        """Create a new brew session"""
        # print(f"Creating brew session with data: {session_data}")
        try:
            # Set default values
            session_data["brew_date"] = datetime.now(UTC)
            session_data["status"] = session_data.get("status", "in_progress")

            # Create the brew session
            brew_session = BrewSession(**session_data)
            brew_session.save()

            return brew_session
        except Exception as e:
            print(f"Database error creating brew session: {e}")
            return None, str(e)

    @staticmethod
    def update_brew_session(session_id, session_data):
        """Update an existing brew session"""
        try:
            # Get the brew session
            brew_session = BrewSession.objects(id=session_id).first()
            if not brew_session:
                return None, "Brew session not found"

            # Update fields
            for key, value in session_data.items():
                if hasattr(brew_session, key):
                    setattr(brew_session, key, value)

            # Save the updated session
            brew_session.save()

            # Reload the session from database to ensure all data is fresh
            brew_session.reload()

            return brew_session, "Brew session updated successfully"

        except Exception as e:
            print(f"Database error updating brew session: {e}")
            import traceback

            traceback.print_exc()  # This will help debug the actual error
            return None, str(e)

    ###########################################################
    #                   Fermentation Methods                  #
    ###########################################################

    @staticmethod
    def add_fermentation_entry(session_id, entry_data):
        """Add a fermentation data entry to a brew session"""
        try:
            # Get the brew session
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return False, "Brew session not found"

            # Set default entry date if not provided
            if "entry_date" not in entry_data:
                entry_data["entry_date"] = datetime.now(UTC)

            fermentation_entry = FermentationEntry(**entry_data)

            # Add to session's fermentation data list
            session.fermentation_data.append(fermentation_entry)
            session.save()

            return True, "Fermentation entry added successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return False, str(e)

    @staticmethod
    def get_fermentation_data(session_id):
        """Get all fermentation data entries for a brew session"""
        try:
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return None, "Brew session not found"

            # Return sorted by entry_date - this will be an empty list if no data exists
            entries = (
                sorted(session.fermentation_data, key=lambda x: x.entry_date)
                if session.fermentation_data
                else []
            )

            # Always return the list (empty or with data) and success message
            return [
                entry.to_dict() for entry in entries
            ], "Fermentation data retrieved successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return None, str(e)

    @staticmethod
    def update_fermentation_entry(session_id, entry_index, entry_data):
        """Update a specific fermentation entry by index"""
        try:
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return False, "Brew session not found"

            # Check if index is valid
            if entry_index < 0 or entry_index >= len(session.fermentation_data):
                return False, "Invalid entry index"

            # Update the entry fields
            entry = session.fermentation_data[entry_index]
            for key, value in entry_data.items():
                if hasattr(entry, key):
                    setattr(entry, key, value)

            session.save()
            return True, "Fermentation entry updated successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return False, str(e)

    @staticmethod
    def delete_fermentation_entry(session_id, entry_index):
        """Delete a fermentation entry by index"""
        try:
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return False, "Brew session not found"

            # Check if index is valid
            if entry_index < 0 or entry_index >= len(session.fermentation_data):
                return False, "Invalid entry index"

            # Remove the entry
            session.fermentation_data.pop(entry_index)
            session.save()

            return True, "Fermentation entry deleted successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return False, str(e)

    @staticmethod
    def get_fermentation_stats(session_id):
        """Calculate fermentation statistics for visualization and analysis"""
        try:
            session = BrewSession.objects(id=session_id).first()
            if not session or not session.fermentation_data:
                return None, "No fermentation data available"

            # Sort entries by date
            entries = sorted(session.fermentation_data, key=lambda x: x.entry_date)

            # Extract data series for each measurement type
            temperature_data = []
            gravity_data = []
            ph_data = []

            for entry in entries:
                entry_date = entry.entry_date.isoformat()

                if entry.temperature is not None:
                    temperature_data.append(
                        {"date": entry_date, "value": entry.temperature}
                    )

                if entry.gravity is not None:
                    gravity_data.append({"date": entry_date, "value": entry.gravity})

                if entry.ph is not None:
                    ph_data.append({"date": entry_date, "value": entry.ph})

            # Calculate trends and statistics
            stats = {
                "temperature": {
                    "data": temperature_data,
                    "min": (
                        min([d["value"] for d in temperature_data])
                        if temperature_data
                        else None
                    ),
                    "max": (
                        max([d["value"] for d in temperature_data])
                        if temperature_data
                        else None
                    ),
                    "avg": (
                        sum([d["value"] for d in temperature_data])
                        / len(temperature_data)
                        if temperature_data
                        else None
                    ),
                },
                "gravity": {
                    "data": gravity_data,
                    "initial": gravity_data[0]["value"] if gravity_data else None,
                    "current": gravity_data[-1]["value"] if gravity_data else None,
                    "drop": (
                        (gravity_data[0]["value"] - gravity_data[-1]["value"])
                        if len(gravity_data) > 1
                        else None
                    ),
                    "attenuation": (
                        (
                            (gravity_data[0]["value"] - gravity_data[-1]["value"])
                            / (gravity_data[0]["value"] - 1.0)
                            * 100
                        )
                        if len(gravity_data) > 1 and gravity_data[0]["value"] > 1.0
                        else None
                    ),
                },
                "ph": {
                    "data": ph_data,
                    "min": min([d["value"] for d in ph_data]) if ph_data else None,
                    "max": max([d["value"] for d in ph_data]) if ph_data else None,
                    "avg": (
                        sum([d["value"] for d in ph_data]) / len(ph_data)
                        if ph_data
                        else None
                    ),
                },
            }

            return stats, "Fermentation statistics calculated successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return None, str(e)
