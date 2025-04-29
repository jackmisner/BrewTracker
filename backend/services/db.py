from models import db
from models.user import User
from models.recipe import Recipe
from models.brew_session import BrewSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, desc, cast, Float


class DatabaseService:
    @staticmethod
    def get_user_by_id(user_id):
        """Retrieve a user by ID"""
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_username(username):
        """Retrieve a user by username"""
        return User.query.filter_by(username=username).first()

    @staticmethod
    def get_user_recipes(user_id, page=1, per_page=10):
        """Get all recipes for a user with pagination"""
        return Recipe.query.filter_by(user_id=user_id).paginate(
            page=page, per_page=per_page
        )

    @staticmethod
    def get_user_brew_sessions(user_id, page=1, per_page=10):
        """Get all brew sessions for a user with pagination"""
        return BrewSession.query.filter_by(user_id=user_id).paginate(
            page=page, per_page=per_page
        )

    @staticmethod
    def get_recipe_brew_sessions(recipe_id):
        """Get all brew sessions for a specific recipe"""
        return BrewSession.query.filter_by(recipe_id=recipe_id).all()

    @staticmethod
    def calculate_recipe_stats(recipe_id):
        """Calculate statistics for a recipe based on its brew sessions"""
        try:
            # Get all completed brew sessions for this recipe
            sessions = BrewSession.query.filter_by(
                recipe_id=recipe_id, status="completed"
            ).all()

            if not sessions:
                return None

            # Calculate average values from brew sessions
            avg_og = sum(s.actual_og for s in sessions if s.actual_og) / len(
                [s for s in sessions if s.actual_og]
            )
            avg_fg = sum(s.actual_fg for s in sessions if s.actual_fg) / len(
                [s for s in sessions if s.actual_fg]
            )
            avg_abv = sum(s.actual_abv for s in sessions if s.actual_abv) / len(
                [s for s in sessions if s.actual_abv]
            )
            avg_efficiency = sum(
                s.actual_efficiency for s in sessions if s.actual_efficiency
            ) / len([s for s in sessions if s.actual_efficiency])

            # Calculate attenuation
            avg_attenuation = (
                ((avg_og - avg_fg) / avg_og) * 100 if avg_og and avg_fg else None
            )

            return {
                "avg_og": avg_og,
                "avg_fg": avg_fg,
                "avg_abv": avg_abv,
                "avg_efficiency": avg_efficiency,
                "avg_attenuation": avg_attenuation,
                "total_brews": len(sessions),
            }
        except SQLAlchemyError as e:
            # Log error
            print(f"Database error: {e}")
            return None
        except ZeroDivisionError:
            # Handle case where there are no valid measurements
            return None

    @staticmethod
    def get_attenuation_by_recipe(user_id):
        """Get attenuation statistics for all user recipes"""
        try:
            # Get all completed brew sessions for user
            sessions = (
                db.session.query(
                    Recipe.name,
                    Recipe.style,
                    func.avg(BrewSession.actual_og).label("avg_og"),
                    func.avg(BrewSession.actual_fg).label("avg_fg"),
                )
                .join(Recipe, Recipe.recipe_id == BrewSession.recipe_id)
                .filter(
                    Recipe.user_id == user_id,
                    BrewSession.status == "completed",
                    BrewSession.actual_og.isnot(None),
                    BrewSession.actual_fg.isnot(None),
                )
                .group_by(Recipe.recipe_id, Recipe.name, Recipe.style)
                .all()
            )

            results = []
            for name, style, og, fg in sessions:
                attenuation = ((og - fg) / og) * 100 if og and fg else None
                results.append(
                    {
                        "name": name,
                        "style": style,
                        "og": og,
                        "fg": fg,
                        "attenuation": attenuation,
                    }
                )

            return results
        except SQLAlchemyError as e:
            # Log error
            print(f"Database error: {e}")
            return []

    @staticmethod
    def get_recent_activity(user_id, limit=5):
        """Get recent brewing activity for a user"""
        try:
            # Get recent brew sessions
            recent_sessions = (
                BrewSession.query.filter_by(user_id=user_id)
                .order_by(desc(BrewSession.brew_date))
                .limit(limit)
                .all()
            )

            # Get recent recipes
            recent_recipes = (
                Recipe.query.filter_by(user_id=user_id)
                .order_by(desc(Recipe.created_at))
                .limit(limit)
                .all()
            )

            return {
                "recent_sessions": [session.to_dict() for session in recent_sessions],
                "recent_recipes": [recipe.to_dict() for recipe in recent_recipes],
            }
        except SQLAlchemyError as e:
            # Log error
            print(f"Database error: {e}")
            return {"recent_sessions": [], "recent_recipes": []}
