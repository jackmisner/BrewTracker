from datetime import datetime
from bson import ObjectId
from pymongo.errors import PyMongoError
from models.mongo_models import User, Recipe, Ingredient, BrewSession, RecipeIngredient


class MongoDBService:
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

    @staticmethod
    def add_ingredient_to_recipe(recipe_id, ingredient_data):
        """Add an ingredient to a recipe"""
        try:
            # Get the recipe
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return False, "Recipe not found"

            # Get the ingredient
            ingredient_id = ingredient_data.get("ingredient_id")
            ingredient = Ingredient.objects(id=ingredient_id).first()
            if not ingredient:
                return False, "Ingredient not found"

            # Create new recipe ingredient
            recipe_ingredient = RecipeIngredient(
                ingredient_id=ingredient.id,
                name=ingredient.name,
                type=ingredient.type,
                amount=ingredient_data.get("amount"),
                unit=ingredient_data.get("unit"),
                use=ingredient_data.get("use"),
                time=ingredient_data.get("time", 0),
                potential=ingredient.potential,
                color=ingredient.color,
                alpha_acid=ingredient.alpha_acid,
                attenuation=ingredient.attenuation,
            )

            # Add to recipe's ingredients list
            recipe.ingredients.append(recipe_ingredient)
            recipe.updated_at = datetime.utcnow()
            recipe.save()

            return True, "Ingredient added successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return False, str(e)

    @staticmethod
    def remove_ingredient_from_recipe(recipe_id, ingredient_index):
        """Remove an ingredient from a recipe by index"""
        try:
            # Get the recipe
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return False, "Recipe not found"

            # Check if index is valid
            if ingredient_index < 0 or ingredient_index >= len(recipe.ingredients):
                return False, "Invalid ingredient index"

            # Remove the ingredient at the specified index
            recipe.ingredients.pop(ingredient_index)
            recipe.updated_at = datetime.utcnow()
            recipe.save()

            return True, "Ingredient removed successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return False, str(e)

    @staticmethod
    def create_recipe(recipe_data):
        """Create a new recipe"""
        try:
            # Extract ingredients data
            ingredients_data = recipe_data.pop("ingredients", [])

            # Create recipe without ingredients first
            recipe = Recipe(**recipe_data)

            # Process and add ingredients
            for ing_data in ingredients_data:
                ingredient_id = ing_data.get("ingredient_id")
                if ingredient_id:
                    # Get ingredient from database
                    ingredient = Ingredient.objects(id=ingredient_id).first()
                    if ingredient:
                        # Create recipe ingredient
                        recipe_ingredient = RecipeIngredient(
                            ingredient_id=ingredient.id,
                            name=ingredient.name,
                            type=ingredient.type,
                            amount=ing_data.get("amount"),
                            unit=ing_data.get("unit"),
                            use=ing_data.get("use"),
                            time=ing_data.get("time", 0),
                            potential=ingredient.potential,
                            color=ingredient.color,
                            alpha_acid=ingredient.alpha_acid,
                            attenuation=ingredient.attenuation,
                        )
                        recipe.ingredients.append(recipe_ingredient)

            # Set creation timestamps
            now = datetime.utcnow()
            recipe.created_at = now
            recipe.updated_at = now

            # Save the recipe
            recipe.save()

            return recipe

        except Exception as e:
            print(f"Database error: {e}")
            return None

    @staticmethod
    def update_recipe(recipe_id, recipe_data):
        """Update an existing recipe"""
        try:
            # Get the recipe
            recipe = Recipe.objects(id=recipe_id).first()
            if not recipe:
                return None, "Recipe not found"

            # Extract ingredients if included
            ingredients_data = recipe_data.pop("ingredients", None)

            # Update recipe fields
            for key, value in recipe_data.items():
                if hasattr(recipe, key):
                    setattr(recipe, key, value)

            # Update ingredients if provided
            if ingredients_data is not None:
                # Clear existing ingredients
                recipe.ingredients = []

                # Add new ingredients
                for ing_data in ingredients_data:
                    ingredient_id = ing_data.get("ingredient_id")
                    if ingredient_id:
                        # Get ingredient from database
                        ingredient = Ingredient.objects(id=ingredient_id).first()
                        if ingredient:
                            # Create recipe ingredient
                            recipe_ingredient = RecipeIngredient(
                                ingredient_id=ingredient.id,
                                name=ingredient.name,
                                type=ingredient.type,
                                amount=ing_data.get("amount"),
                                unit=ing_data.get("unit"),
                                use=ing_data.get("use"),
                                time=ing_data.get("time", 0),
                                potential=ingredient.potential,
                                color=ingredient.color,
                                alpha_acid=ingredient.alpha_acid,
                                attenuation=ingredient.attenuation,
                            )
                            recipe.ingredients.append(recipe_ingredient)

            # Update timestamp
            recipe.updated_at = datetime.utcnow()

            # Save the recipe
            recipe.save()

            return recipe, "Recipe updated successfully"

        except Exception as e:
            print(f"Database error: {e}")
            return None, str(e)

    @staticmethod
    def add_fermentation_entry(session_id, entry_data):
        """Add a fermentation data entry to a brew session"""
        try:
            # Get the brew session
            session = BrewSession.objects(id=session_id).first()
            if not session:
                return False, "Brew session not found"

            # Create new fermentation entry
            from mongo_models import FermentationEntry

            # Set default entry date if not provided
            if "entry_date" not in entry_data:
                entry_data["entry_date"] = datetime.utcnow()

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

            # Return sorted by entry_date
            entries = sorted(session.fermentation_data, key=lambda x: x.entry_date)
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
