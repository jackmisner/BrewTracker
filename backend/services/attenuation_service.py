from datetime import UTC, datetime
from typing import List, Optional, Tuple

from models.mongo_models import BrewSession, Ingredient, User
from mongoengine import Q


class AttenuationService:
    """Service for collecting and analyzing real-world yeast attenuation data"""
    
    # Minimum and maximum reasonable attenuation values for outlier detection
    MIN_ATTENUATION = 40.0  # 40% minimum reasonable attenuation
    MAX_ATTENUATION = 95.0  # 95% maximum reasonable attenuation
    
    # Confidence scoring parameters
    MIN_DATA_POINTS_FOR_CONFIDENCE = 5  # Minimum samples for meaningful confidence
    MAX_DATA_POINTS_FOR_CONFIDENCE = 50  # Diminishing returns after this many samples
    
    @staticmethod
    def calculate_actual_attenuation(og: float, fg: float) -> Optional[float]:
        """Calculate actual attenuation percentage from OG and FG"""
        if not og or not fg or og <= 1.0 or fg <= 0.0:
            return None
        
        if og <= fg:  # Invalid: FG should be less than OG
            return None
            
        attenuation = ((og - fg) / (og - 1.0)) * 100
        return round(attenuation, 1)
    
    @staticmethod
    def is_valid_attenuation(attenuation: float) -> bool:
        """Check if attenuation value is within reasonable bounds"""
        return (AttenuationService.MIN_ATTENUATION <= attenuation <= 
                AttenuationService.MAX_ATTENUATION)
    
    @staticmethod
    def calculate_confidence_score(data_point_count: int) -> float:
        """Calculate confidence score (0-1) based on number of data points"""
        if data_point_count < AttenuationService.MIN_DATA_POINTS_FOR_CONFIDENCE:
            return 0.0
        
        if data_point_count >= AttenuationService.MAX_DATA_POINTS_FOR_CONFIDENCE:
            return 1.0
        
        # Linear interpolation between min and max
        progress = (data_point_count - AttenuationService.MIN_DATA_POINTS_FOR_CONFIDENCE) / \
                  (AttenuationService.MAX_DATA_POINTS_FOR_CONFIDENCE - AttenuationService.MIN_DATA_POINTS_FOR_CONFIDENCE)
        return round(progress, 2)
    
    @staticmethod
    def process_completed_brew_session(session: BrewSession) -> bool:
        """Process a completed brew session to extract attenuation data"""
        # Verify session has required data
        if not session.actual_og or not session.actual_fg:
            return False
        
        # Calculate actual attenuation
        actual_attenuation = AttenuationService.calculate_actual_attenuation(
            session.actual_og, session.actual_fg
        )
        
        if not actual_attenuation or not AttenuationService.is_valid_attenuation(actual_attenuation):
            return False
        
        # Check user privacy settings
        user = User.objects(id=session.user_id).first()
        if not user or not user.settings or not user.settings.share_yeast_performance:
            return False
        
        # Find yeast ingredients from the session's recipe
        from models.mongo_models import Recipe
        recipe = Recipe.objects(id=session.recipe_id).first()
        if not recipe:
            return False
        
        yeast_ingredients = [ing for ing in recipe.ingredients if ing.type == "yeast"]
        if not yeast_ingredients:
            return False
        
        # Update attenuation data for each yeast ingredient
        updated_count = 0
        for yeast_ingredient in yeast_ingredients:
            if AttenuationService.update_yeast_attenuation_data(
                yeast_ingredient.ingredient_id, actual_attenuation
            ):
                updated_count += 1
        
        return updated_count > 0
    
    @staticmethod
    def update_yeast_attenuation_data(ingredient_id: str, actual_attenuation: float) -> bool:
        """Update a yeast ingredient's attenuation data with a new data point"""
        try:
            ingredient = Ingredient.objects(id=ingredient_id, type="yeast").first()
            if not ingredient:
                return False
            
            # Initialize lists if they don't exist
            if not ingredient.actual_attenuation_data:
                ingredient.actual_attenuation_data = []
            
            # Add new data point
            ingredient.actual_attenuation_data.append(actual_attenuation)
            
            # Keep only the most recent 100 data points to prevent unlimited growth
            if len(ingredient.actual_attenuation_data) > 100:
                ingredient.actual_attenuation_data = ingredient.actual_attenuation_data[-100:]
            
            # Recalculate average
            ingredient.actual_attenuation_average = round(
                sum(ingredient.actual_attenuation_data) / len(ingredient.actual_attenuation_data), 1
            )
            
            # Update count
            ingredient.actual_attenuation_count = len(ingredient.actual_attenuation_data)
            
            # Update confidence score
            ingredient.attenuation_confidence = AttenuationService.calculate_confidence_score(
                ingredient.actual_attenuation_count
            )
            
            # Update timestamp
            ingredient.last_attenuation_update = datetime.now(UTC)
            
            # Save changes
            ingredient.save()
            return True
            
        except Exception as e:
            print(f"Error updating yeast attenuation data: {e}")
            return False
    
    @staticmethod
    def get_improved_attenuation_estimate(ingredient_id: str) -> Optional[float]:
        """Get improved attenuation estimate combining theoretical and actual data"""
        try:
            ingredient = Ingredient.objects(id=ingredient_id, type="yeast").first()
            if not ingredient:
                return None
            
            theoretical_attenuation = ingredient.attenuation
            actual_average = ingredient.actual_attenuation_average
            confidence = ingredient.attenuation_confidence or 0.0
            
            # If no actual data, use theoretical
            if not actual_average or confidence == 0.0:
                return theoretical_attenuation
            
            # If no theoretical data, use actual
            if not theoretical_attenuation:
                return actual_average
            
            # Weighted average based on confidence
            # Low confidence: favor theoretical (70/30)
            # High confidence: favor actual (30/70)
            theoretical_weight = 0.7 - (confidence * 0.4)  # 0.7 to 0.3
            actual_weight = 1.0 - theoretical_weight
            
            improved_estimate = (theoretical_attenuation * theoretical_weight + 
                               actual_average * actual_weight)
            
            return round(improved_estimate, 1)
            
        except Exception as e:
            print(f"Error calculating improved attenuation estimate: {e}")
            return None
    
    @staticmethod
    def get_attenuation_analytics(ingredient_id: str) -> Optional[dict]:
        """Get detailed attenuation analytics for a yeast ingredient"""
        try:
            ingredient = Ingredient.objects(id=ingredient_id, type="yeast").first()
            if not ingredient:
                return None
            
            analytics = {
                "ingredient_id": str(ingredient.id),
                "name": ingredient.name,
                "manufacturer": ingredient.manufacturer,
                "code": ingredient.code,
                "theoretical_attenuation": ingredient.attenuation,
                "actual_attenuation_average": ingredient.actual_attenuation_average,
                "actual_attenuation_count": ingredient.actual_attenuation_count,
                "attenuation_confidence": ingredient.attenuation_confidence,
                "improved_estimate": AttenuationService.get_improved_attenuation_estimate(ingredient_id),
                "last_update": ingredient.last_attenuation_update.isoformat() if ingredient.last_attenuation_update else None
            }
            
            # Add statistical data if we have actual data
            if ingredient.actual_attenuation_data and len(ingredient.actual_attenuation_data) > 1:
                data = ingredient.actual_attenuation_data
                analytics["min_actual"] = min(data)
                analytics["max_actual"] = max(data)
                analytics["std_deviation"] = round(
                    (sum((x - ingredient.actual_attenuation_average) ** 2 for x in data) / len(data)) ** 0.5, 1
                )
            
            return analytics
            
        except Exception as e:
            print(f"Error getting attenuation analytics: {e}")
            return None
    
    @staticmethod
    def get_all_yeast_analytics() -> List[dict]:
        """Get analytics for all yeast ingredients with actual data"""
        try:
            # Find all yeast ingredients that have actual attenuation data
            yeast_ingredients = Ingredient.objects(
                type="yeast", 
                actual_attenuation_count__gt=0
            ).order_by("-actual_attenuation_count")
            
            analytics_list = []
            for ingredient in yeast_ingredients:
                analytics = AttenuationService.get_attenuation_analytics(str(ingredient.id))
                if analytics:
                    analytics_list.append(analytics)
            
            return analytics_list
            
        except Exception as e:
            print(f"Error getting all yeast analytics: {e}")
            return []