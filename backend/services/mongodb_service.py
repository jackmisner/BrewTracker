from datetime import UTC, datetime

from bson import ObjectId
from pymongo.errors import PyMongoError

from models.mongo_models import (
    BrewSession,
    FermentationEntry,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
)
from utils.unit_conversions import UnitConverter


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
        """Get recipe in its original units (no conversion)"""
        try:
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return None

            # Return recipe in its original units without conversion
            return recipe.to_dict()

        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def get_user_recipes_with_units(user_id, page=1, per_page=10):
        """Get user recipes with unit system information"""
        try:
            # Calculate skip value based on page and per_page
            skip = (page - 1) * per_page

            # Get recipes with pagination
            recipes = (
                Recipe.objects(user_id=user_id)
                .order_by("-created_at")
                .skip(skip)
                .limit(per_page)
            )

            # Count total documents for pagination metadata
            total = Recipe.objects(user_id=user_id).count()

            # Calculate pagination metadata
            total_pages = (total + per_page - 1) // per_page  # Ceiling division
            has_next = page < total_pages
            has_prev = page > 1

            # Convert to dicts with unit_system
            recipes_data = []
            for recipe in recipes:
                recipe_dict = recipe.to_dict()
                # Ensure unit_system is included
                if "unit_system" not in recipe_dict:
                    recipe_dict["unit_system"] = getattr(
                        recipe, "unit_system", "imperial"
                    )
                recipes_data.append(recipe_dict)

            return {
                "items": recipes_data,
                "page": page,
                "pages": total_pages,
                "per_page": per_page,
                "total": total,
                "has_next": has_next,
                "has_prev": has_prev,
                "next_num": page + 1 if has_next else None,
                "prev_num": page - 1 if has_prev else None,
            }

        except Exception as e:
            print(f"Error getting user recipes: {e}")
            return {
                "items": [],
                "page": 1,
                "pages": 0,
                "per_page": per_page,
                "total": 0,
                "has_next": False,
                "has_prev": False,
                "next_num": None,
                "prev_num": None,
            }

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
    def get_default_batch_size_for_user(user_id):
        """Get appropriate default batch size based on user's unit preference"""
        try:
            user = User.objects(id=user_id).first()
            if not user:
                return 5.0  # Default to imperial

            unit_system = user.get_preferred_units()

            # Return batch size in gallons (storage unit)
            # Frontend will convert for display
            if unit_system == "metric":
                return 5.0  # Will be displayed as ~19L by frontend
            else:
                return 5.0  # Will be displayed as 5 gal by frontend

        except Exception as e:
            print(f"Database error: {e}")
            return 5.0

    @staticmethod
    def create_recipe(recipe_data, user_id=None):
        """Create a new recipe with unit conversion support"""
        try:
            # Get user for unit preferences
            user = None
            if user_id:
                user = User.objects(id=user_id).first()

            # Remove 'id' field if present - MongoDB will auto-generate _id
            recipe_data.pop("id", None)

            # Extract ingredients data if provided
            ingredients_data = recipe_data.pop("ingredients", [])

            # Store the batch_size_unit if provided, otherwise infer from user preference
            if "batch_size_unit" not in recipe_data:
                if user and user.get_preferred_units() == "metric":
                    recipe_data["batch_size_unit"] = "l"
                else:
                    recipe_data["batch_size_unit"] = "gal"

            # Create recipe object
            recipe = Recipe(**recipe_data)

            # Process and add ingredients as embedded documents
            # Normalize ingredients to base units
            user_unit_system = (
                user.get_preferred_units()
                if user
                else recipe_data.get("unit_system", "imperial")
            )

            for ing_data in ingredients_data:
                # Normalize ingredient amounts to base units before saving
                normalized_ing_data = (
                    MongoDBService._normalize_ingredient_to_base_units(
                        ing_data, user_unit_system
                    )
                )
                recipe_ingredient = RecipeIngredient(**normalized_ing_data)
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
            print(f"Recipe data: {recipe_data}")
            import traceback

            traceback.print_exc()
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

            # Remove unit_system from update data if present
            # We don't want to change the unit system after creation
            if "unit_system" in recipe_data:
                recipe_data.pop("unit_system")

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

                # Get user for unit system preferences
                user = User.objects(id=recipe.user_id).first()
                user_unit_system = (
                    user.get_preferred_units() if user else recipe.unit_system
                )

                # Add new ingredients with base unit normalization
                for ing_data in ingredients_data:
                    # Normalize ingredient to base units
                    normalized_ing_data = (
                        MongoDBService._normalize_ingredient_to_base_units(
                            ing_data, user_unit_system
                        )
                    )
                    # Create RecipeIngredient embedded document
                    from models.mongo_models import RecipeIngredient

                    # Only include fields that exist in the RecipeIngredient model
                    recipe_ingredient_fields = {
                        "ingredient_id": normalized_ing_data.get("ingredient_id"),
                        "name": normalized_ing_data.get("name"),
                        "type": normalized_ing_data.get("type"),
                        "grain_type": normalized_ing_data.get("grain_type"),
                        "amount": float(normalized_ing_data.get("amount", 0)),
                        "unit": normalized_ing_data.get("unit", ""),
                        "use": normalized_ing_data.get("use", ""),
                        "time": int(normalized_ing_data.get("time", 0)),
                        "potential": normalized_ing_data.get("potential"),
                        "color": normalized_ing_data.get("color"),
                        "alpha_acid": normalized_ing_data.get("alpha_acid"),
                        "attenuation": normalized_ing_data.get("attenuation"),
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
            return None, str(e)

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

            # Get the cloner's unit system preference
            user = User.objects(id=user_id).first()
            unit_system = user.get_preferred_units() if user else "imperial"

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
            new_recipe.batch_size_unit = original_recipe.batch_size_unit
            new_recipe.description = original_recipe.description
            new_recipe.is_public = False  # Cloned recipes start as private
            new_recipe.boil_time = original_recipe.boil_time
            new_recipe.efficiency = original_recipe.efficiency
            new_recipe.notes = original_recipe.notes

            # Set unit system to cloner's preference
            new_recipe.unit_system = unit_system

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

            # Store original values for comparison
            original_og = brew_session.actual_og
            original_fg = brew_session.actual_fg
            original_status = brew_session.status

            # Update fields
            for key, value in session_data.items():
                if hasattr(brew_session, key):
                    setattr(brew_session, key, value)

            # Save the updated session
            brew_session.save()

            # Automatically set actual_fg and calculate actual_abv when status changes to completed
            if (
                brew_session.status == "completed"
                and original_status != "completed"
                and brew_session.fermentation_data
            ):

                # Find the most recent gravity reading for final gravity
                latest_gravity = None
                for entry in reversed(brew_session.fermentation_data):
                    if entry.gravity:
                        latest_gravity = entry.gravity
                        break

                # Set actual_fg if we found a gravity reading and it's not already set
                if latest_gravity and not brew_session.actual_fg:
                    brew_session.actual_fg = latest_gravity
                    print(
                        f"Automatically set actual_fg to {latest_gravity} from latest fermentation entry"
                    )

                # Calculate actual_abv if we have both OG and FG
                if brew_session.actual_og and brew_session.actual_fg:
                    from utils.brewing_calculation_core import calc_abv_core

                    brew_session.actual_abv = calc_abv_core(
                        brew_session.actual_og, brew_session.actual_fg
                    )
                    print(
                        f"Automatically calculated actual_abv as {brew_session.actual_abv}%"
                    )

                # Save again with the new calculated values
                brew_session.save()

            # Check if this session is newly completed and has attenuation data
            if (
                brew_session.status == "completed"
                and original_status != "completed"
                and brew_session.actual_og
                and brew_session.actual_fg
            ):

                # Process attenuation data collection
                try:
                    from services.attenuation_service import AttenuationService

                    AttenuationService.process_completed_brew_session(brew_session)
                except Exception as attenuation_error:
                    print(f"Error processing attenuation data: {attenuation_error}")
                    # Don't fail the update if attenuation processing fails

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

            # Automatically set actual_og from the first gravity reading if not already set
            if (
                fermentation_entry.gravity
                and not session.actual_og
                and len(session.fermentation_data) == 0
            ):
                session.actual_og = fermentation_entry.gravity
                print(
                    f"Automatically set actual_og to {fermentation_entry.gravity} from first fermentation entry"
                )

            # Add to session's fermentation data list
            session.fermentation_data.append(fermentation_entry)

            # If session is completed and this entry has gravity, update actual_fg and actual_abv
            if session.status == "completed" and fermentation_entry.gravity:
                session.actual_fg = fermentation_entry.gravity
                print(
                    f"Updated actual_fg to {fermentation_entry.gravity} from new fermentation entry"
                )

                # Recalculate actual_abv if we have both OG and FG
                if session.actual_og and session.actual_fg:
                    from utils.brewing_calculation_core import calc_abv_core

                    session.actual_abv = calc_abv_core(
                        session.actual_og, session.actual_fg
                    )
                    print(f"Recalculated actual_abv as {session.actual_abv}%")

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

    ###########################################################
    #                   Beer Style Methods                    #
    ###########################################################

    @staticmethod
    def get_all_beer_styles():
        """Get all beer styles grouped by category"""
        try:
            from models.mongo_models import BeerStyleGuide

            # Get all styles ordered by category and style_id
            styles = BeerStyleGuide.objects().order_by("category_id", "style_id")

            # Group by category
            categories = {}
            for style in styles:
                category_key = style.category_id
                if category_key not in categories:
                    categories[category_key] = {
                        "category": style.category,
                        "category_id": style.category_id,
                        "description": style.category_description,
                        "styles": [],
                    }

                categories[category_key]["styles"].append(style.to_dict())

            return categories
        except Exception as e:
            print(f"Database error: {e}")
            return {}

    @staticmethod
    def search_beer_styles(query):
        """Search beer styles by name, category, or tags"""
        try:
            from mongoengine.queryset.visitor import Q

            from models.mongo_models import BeerStyleGuide

            if not query or len(query.strip()) < 2:
                return []

            query_term = query.strip().lower()

            # Search in multiple fields
            search_query = (
                Q(name__icontains=query_term)
                | Q(category__icontains=query_term)
                | Q(style_id__icontains=query_term)
                | Q(tags__icontains=query_term)
                | Q(overall_impression__icontains=query_term)
            )

            styles = BeerStyleGuide.objects(search_query).order_by("style_id").limit(20)

            return [style.to_dict() for style in styles]
        except Exception as e:
            print(f"Database error: {e}")
            return []

    @staticmethod
    def get_style_suggestions_for_recipe(recipe_id):
        """Get style suggestions based on recipe metrics"""
        try:
            from models.mongo_models import Recipe

            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return []

            # Use the Recipe model's built-in suggestion method
            suggestions = recipe.suggest_matching_styles()

            return suggestions
        except Exception as e:
            print(f"Database error: {e}")
            return []

    @staticmethod
    def get_recipe_style_analysis(recipe_id):
        """Get detailed style analysis for a recipe"""
        try:
            from models.mongo_models import Recipe

            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return None

            # Use the Recipe model's built-in analysis method
            analysis = recipe.get_style_analysis()

            return analysis
        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def find_matching_styles_by_metrics(metrics):
        """Find styles matching given metrics (for frontend-calculated metrics)"""
        try:
            from models.mongo_models import BeerStyleGuide

            matches = []

            # Get all styles and test against metrics
            styles = BeerStyleGuide.objects()

            for style in styles:
                match_result = style.matches_recipe_specs(metrics)
                if match_result["match_percentage"] >= 50:  # At least 50% match
                    matches.append(
                        {
                            "style": style.to_dict(),
                            "match_percentage": match_result["match_percentage"],
                            "matches": match_result["matches"],
                        }
                    )

            # Sort by match percentage
            matches.sort(key=lambda x: x["match_percentage"], reverse=True)
            return matches[:10]  # Return top 10 matches

        except Exception as e:
            print(f"Database error: {e}")
            return []

    ###########################################################
    #                 Fermentation Analysis Methods           #
    ###########################################################

    @staticmethod
    def analyze_gravity_stabilization(session_id):
        """Analyze fermentation data to detect gravity stabilization and suggest completion"""
        try:
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return None, "Brew session not found"

            # Skip if session is already completed
            if session.status == "completed":
                return {
                    "is_stable": True,
                    "completion_suggested": False,
                    "reason": "Session is already marked as completed",
                    "current_gravity": session.actual_fg,
                    "stabilization_confidence": 1.0,
                }, "Session already completed"

            # Need at least 3 gravity readings to detect patterns
            gravity_readings = [
                entry
                for entry in session.fermentation_data
                if entry.gravity is not None
            ]

            if len(gravity_readings) < 3:
                return {
                    "is_stable": False,
                    "completion_suggested": False,
                    "reason": "Insufficient gravity readings for analysis (minimum 3 required)",
                    "current_gravity": (
                        gravity_readings[-1].gravity if gravity_readings else None
                    ),
                    "stabilization_confidence": 0.0,
                }, "Insufficient data for analysis"

            # Sort by entry date to ensure chronological order
            gravity_readings.sort(key=lambda x: x.entry_date)
            recent_readings = gravity_readings[-5:]  # Look at last 5 readings

            # Extract gravity values and dates
            gravity_values = [reading.gravity for reading in recent_readings]
            current_gravity = gravity_values[-1]

            # Calculate gravity change patterns
            gravity_changes = []
            for i in range(1, len(gravity_values)):
                change = (
                    gravity_values[i - 1] - gravity_values[i]
                )  # Positive means gravity dropped
                gravity_changes.append(change)

            # Analysis criteria
            max_change_threshold = (
                0.002  # Maximum change per reading to consider stable
            )
            min_stable_readings = 3  # Minimum consecutive stable readings
            target_gravity_tolerance = (
                0.005  # Tolerance for comparing against estimated FG
            )

            # Check if recent changes are minimal (stable)
            recent_changes = (
                gravity_changes[-(min_stable_readings - 1) :]
                if len(gravity_changes) >= min_stable_readings - 1
                else gravity_changes
            )
            is_stable = all(
                abs(change) <= max_change_threshold for change in recent_changes
            )

            # Calculate stabilization confidence based on number of stable readings
            stable_reading_count = 0
            for change in reversed(gravity_changes):
                if abs(change) <= max_change_threshold:
                    stable_reading_count += 1
                else:
                    break

            stabilization_confidence = min(
                stable_reading_count / min_stable_readings, 1.0
            )

            # Calculate expected final gravity based on actual OG and yeast attenuation
            from models.mongo_models import Recipe
            from utils.brewing_calculation_core import calc_fg_core

            recipe = Recipe.objects(id=session.recipe_id).first()
            estimated_fg = recipe.estimated_fg if recipe else None
            actual_og = session.actual_og

            # Calculate a more intelligent expected FG if we have both actual OG and recipe data
            adjusted_expected_fg = None
            if actual_og and recipe:
                # Get yeast ingredients to determine expected attenuation
                yeast_ingredients = [
                    ing for ing in recipe.ingredients if ing.ingredient_type == "yeast"
                ]

                if yeast_ingredients:
                    # Use the first yeast's attenuation (could be improved to handle multiple yeasts)
                    yeast_ingredient = yeast_ingredients[0]

                    # Try to get improved attenuation estimate from analytics
                    from services.attenuation_service import AttenuationService

                    improved_attenuation = None

                    try:
                        # Get the actual ingredient object to check for improved estimates
                        ingredient_obj = Ingredient.objects(
                            id=yeast_ingredient.ingredient_id
                        ).first()
                        if (
                            ingredient_obj
                            and hasattr(ingredient_obj, "improved_attenuation_estimate")
                            and ingredient_obj.improved_attenuation_estimate
                        ):
                            improved_attenuation = (
                                ingredient_obj.improved_attenuation_estimate
                            )
                        elif ingredient_obj and ingredient_obj.attenuation:
                            improved_attenuation = ingredient_obj.attenuation
                    except Exception as e:
                        print(f"Could not get improved attenuation: {e}")

                    # Calculate expected FG based on actual OG and yeast attenuation
                    if improved_attenuation:
                        adjusted_expected_fg = calc_fg_core(
                            actual_og, improved_attenuation
                        )

                # Fallback: If we have both actual and estimated OG, adjust the estimated FG proportionally
                if not adjusted_expected_fg and estimated_fg and recipe.estimated_og:
                    # Calculate the original expected attenuation from recipe
                    recipe_attenuation = (
                        (recipe.estimated_og - estimated_fg)
                        / (recipe.estimated_og - 1.0)
                    ) * 100
                    # Apply the same attenuation to actual OG
                    adjusted_expected_fg = calc_fg_core(actual_og, recipe_attenuation)

            # Use adjusted expected FG if available, otherwise fall back to recipe estimated FG
            expected_fg_for_analysis = adjusted_expected_fg or estimated_fg

            # Determine completion suggestion
            completion_suggested = False
            reason = "Gravity still dropping"

            if is_stable:
                if expected_fg_for_analysis:
                    # Compare against intelligently calculated expected FG
                    gravity_difference = abs(current_gravity - expected_fg_for_analysis)
                    if gravity_difference <= target_gravity_tolerance:
                        completion_suggested = True
                        if adjusted_expected_fg:
                            reason = f"Gravity stable at {current_gravity:.3f}, close to adjusted expected FG ({expected_fg_for_analysis:.3f}) based on actual OG"
                        else:
                            reason = f"Gravity stable at {current_gravity:.3f}, close to estimated FG ({expected_fg_for_analysis:.3f})"
                    else:
                        if (
                            current_gravity
                            > expected_fg_for_analysis + target_gravity_tolerance
                        ):
                            if adjusted_expected_fg:
                                reason = f"Gravity stable at {current_gravity:.3f}, but higher than adjusted expected FG ({expected_fg_for_analysis:.3f}). May need more time or have attenuation issues."
                            else:
                                reason = f"Gravity stable at {current_gravity:.3f}, but higher than estimated FG ({expected_fg_for_analysis:.3f}). May need more time or have attenuation issues."
                        else:
                            completion_suggested = True
                            if adjusted_expected_fg:
                                reason = f"Gravity stable at {current_gravity:.3f}, lower than adjusted expected FG ({expected_fg_for_analysis:.3f}). Fermentation likely complete."
                            else:
                                reason = f"Gravity stable at {current_gravity:.3f}, lower than estimated FG ({expected_fg_for_analysis:.3f}). Fermentation likely complete."
                else:
                    # No expected FG to compare against, suggest based on stability alone
                    completion_suggested = True
                    reason = f"Gravity stable at {current_gravity:.3f} for {stable_reading_count} consecutive readings"

            # Additional safety check - ensure gravity is reasonable for completion
            if completion_suggested and current_gravity > 1.020:
                completion_suggested = False
                reason = f"Gravity appears stable but high ({current_gravity:.3f}). Consider checking for stuck fermentation."

            return {
                "is_stable": is_stable,
                "completion_suggested": completion_suggested,
                "reason": reason,
                "current_gravity": current_gravity,
                "estimated_fg": expected_fg_for_analysis,
                "gravity_difference": (
                    abs(current_gravity - expected_fg_for_analysis)
                    if expected_fg_for_analysis
                    else None
                ),
                "stabilization_confidence": round(stabilization_confidence, 2),
                "stable_reading_count": stable_reading_count,
                "total_readings": len(gravity_readings),
                "recent_changes": [round(change, 4) for change in recent_changes],
            }, "Analysis completed successfully"

        except Exception as e:
            print(f"Error analyzing gravity stabilization: {e}")
            import traceback

            traceback.print_exc()
            return None, str(e)

    @staticmethod
    def _normalize_ingredient_to_base_units(ingredient_data, unit_system):
        """
        Normalize ingredient amounts to base units before storing in database

        Args:
            ingredient_data: Dictionary containing ingredient data
            unit_system: User's preferred unit system ('metric' or 'imperial')

        Returns:
            Dictionary with normalized ingredient data
        """
        # Make a copy to avoid modifying the original
        normalized_data = ingredient_data.copy()

        # Only normalize weight-based ingredients
        ingredient_type = normalized_data.get("type", "")
        if ingredient_type not in ["grain", "hop", "other"]:
            # Keep non-weight ingredients as-is (yeast packages, etc.)
            return normalized_data

        # Check if ingredient has amount and unit
        if "amount" not in normalized_data or "unit" not in normalized_data:
            return normalized_data

        current_amount = normalized_data["amount"]
        current_unit = normalized_data["unit"]

        # Get target base unit for this unit system
        target_unit = UnitConverter.get_ingredient_target_unit(
            ingredient_type, unit_system
        )

        if target_unit and current_unit != target_unit:
            try:
                # Convert to base unit
                normalized_amount, base_unit = UnitConverter.normalize_to_base_unit(
                    current_amount, current_unit, unit_system
                )

                # Update the ingredient data
                normalized_data["amount"] = normalized_amount
                normalized_data["unit"] = base_unit

                # Log the conversion for debugging
                print(
                    f"Normalized ingredient: {normalized_data.get('name', 'Unknown')} - "
                    f"{current_amount} {current_unit} -> {normalized_amount} {base_unit}"
                )

            except Exception as e:
                print(
                    f"Warning: Could not normalize ingredient {normalized_data.get('name', 'Unknown')}: {e}"
                )
                # Keep original values if conversion fails

        return normalized_data
