from datetime import datetime
from . import db


class BrewSession(db.Model):
    __tablename__ = "brew_sessions"

    session_id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(
        db.Integer, db.ForeignKey("recipes.recipe_id"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    brew_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    name = db.Column(db.String(100), nullable=True)
    status = db.Column(
        db.String(20), nullable=False, default="planned"
    )  # planned, in-progress, fermenting, conditioning, completed, archived

    # Brew day measurements
    mash_temp = db.Column(db.Float, nullable=True)  # in degrees F/C
    actual_og = db.Column(db.Float, nullable=True)
    actual_fg = db.Column(db.Float, nullable=True)
    actual_abv = db.Column(db.Float, nullable=True)
    actual_efficiency = db.Column(db.Float, nullable=True)

    # Dates
    fermentation_start_date = db.Column(db.Date, nullable=True)
    fermentation_end_date = db.Column(db.Date, nullable=True)
    packaging_date = db.Column(db.Date, nullable=True)

    # Tasting and notes
    tasting_notes = db.Column(db.Text, nullable=True)
    batch_rating = db.Column(db.Integer, nullable=True)  # 1-5 scale
    photos_url = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        return {
            "session_id": self.session_id,
            "recipe_id": self.recipe_id,
            "user_id": self.user_id,
            "brew_date": self.brew_date.isoformat() if self.brew_date else None,
            "name": self.name,
            "status": self.status,
            "mash_temp": self.mash_temp,
            "actual_og": self.actual_og,
            "actual_fg": self.actual_fg,
            "actual_abv": self.actual_abv,
            "actual_efficiency": self.actual_efficiency,
            "fermentation_start_date": (
                self.fermentation_start_date.isoformat()
                if self.fermentation_start_date
                else None
            ),
            "fermentation_end_date": (
                self.fermentation_end_date.isoformat()
                if self.fermentation_end_date
                else None
            ),
            "packaging_date": (
                self.packaging_date.isoformat() if self.packaging_date else None
            ),
            "tasting_notes": self.tasting_notes,
            "batch_rating": self.batch_rating,
            "photos_url": self.photos_url,
        }
