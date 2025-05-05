from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
from .recipe import Recipe
from .ingredient import Ingredient
from .recipe_ingredient import RecipeIngredient
from .user import User
from .brew_session import BrewSession
