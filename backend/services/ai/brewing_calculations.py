"""
Brewing calculations wrapper for the flowchart AI system.

This module provides a wrapper around the existing brewing calculation system
that can be safely imported from the AI services without circular dependencies.
"""

import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class BrewingCalculations:
    """
    Wrapper class for brewing calculations that handles import and calculation logic.
    """
    
    def __init__(self):
        """Initialize the brewing calculations system."""
        self._calculations_available = self._try_import_calculations()
    
    def _try_import_calculations(self) -> bool:
        """Try to import the full brewing calculation system."""
        try:
            # Try multiple import approaches
            try:
                # Approach 1: Direct import
                from utils.brewing_calculation_core import (
                    calc_og_core, calc_fg_core, calc_abv_core, 
                    calc_ibu_core, calc_srm_core, convert_to_pounds, convert_to_ounces
                )
                self.calc_og_core = calc_og_core
                self.calc_fg_core = calc_fg_core
                self.calc_abv_core = calc_abv_core
                self.calc_ibu_core = calc_ibu_core
                self.calc_srm_core = calc_srm_core
                self.convert_to_pounds = convert_to_pounds
                self.convert_to_ounces = convert_to_ounces
                logger.info("✅ Successfully imported full brewing calculations")
                return True
                
            except ImportError:
                # Approach 2: Try importing from current directory context
                import sys
                import os
                
                # Add the backend directory to Python path
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                if backend_dir not in sys.path:
                    sys.path.insert(0, backend_dir)
                
                from utils.brewing_calculation_core import (
                    calc_og_core, calc_fg_core, calc_abv_core, 
                    calc_ibu_core, calc_srm_core, convert_to_pounds, convert_to_ounces
                )
                self.calc_og_core = calc_og_core
                self.calc_fg_core = calc_fg_core
                self.calc_abv_core = calc_abv_core
                self.calc_ibu_core = calc_ibu_core
                self.calc_srm_core = calc_srm_core
                self.convert_to_pounds = convert_to_pounds
                self.convert_to_ounces = convert_to_ounces
                logger.info("✅ Successfully imported brewing calculations (path adjusted)")
                return True
                
        except Exception as e:
            logger.warning(f"⚠️ Could not import full brewing calculations: {e}")
            logger.info("📝 Falling back to simplified calculations")
            return False
    
    def calculate_metrics(self, recipe_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate recipe metrics using the full brewing calculation system.
        
        Args:
            recipe_data: Recipe data including ingredients, batch size, efficiency, etc.
            
        Returns:
            Dictionary containing calculated metrics (OG, FG, ABV, IBU, SRM)
        """
        try:
            if self._calculations_available:
                return self._calculate_metrics_full(recipe_data)
            else:
                return self._calculate_metrics_simple(recipe_data)
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            return self._get_default_metrics()
    
    def _calculate_metrics_full(self, recipe_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate metrics using the full brewing calculation system."""
        ingredients = recipe_data.get('ingredients', [])
        batch_size = recipe_data.get('batch_size', 5.0)
        batch_size_unit = recipe_data.get('batch_size_unit', 'gal')
        efficiency = recipe_data.get('efficiency', 75.0)
        boil_time = recipe_data.get('boil_time', 60)
        
        # Convert batch size to gallons
        if batch_size_unit == 'L':
            batch_size_gal = batch_size * 0.264172
        else:
            batch_size_gal = batch_size
        
        # Prepare grain data for OG calculation
        grain_points = 0.0
        grains = [ing for ing in ingredients if ing.get('type') == 'grain']
        
        for grain in grains:
            amount = grain.get('amount', 0)
            unit = grain.get('unit', 'lb')
            potential = grain.get('potential', 1.037)
            
            # Convert to pounds
            amount_lb = self.convert_to_pounds(amount, unit)
            
            # Calculate points
            ppg = (potential - 1.0) * 1000
            grain_points += ppg * amount_lb
        
        # Calculate OG
        og = self.calc_og_core(grain_points, batch_size_gal, efficiency)
        
        # Prepare hop data for IBU calculation
        hops_data = []
        hops = [ing for ing in ingredients if ing.get('type') == 'hop']
        
        for hop in hops:
            if hop.get('use') == 'boil':
                amount = hop.get('amount', 0)
                unit = hop.get('unit', 'oz')
                alpha_acid = hop.get('alpha_acid', 5.0)
                time = hop.get('time', 60)
                use_type = hop.get('use', 'boil')
                
                # Convert to ounces
                amount_oz = self.convert_to_ounces(amount, unit)
                
                hops_data.append((amount_oz, alpha_acid, time, use_type))
        
        # Calculate IBU
        ibu = self.calc_ibu_core(hops_data, og, batch_size_gal)
        
        # Prepare grain data for SRM calculation
        grain_colors = []
        for grain in grains:
            amount = grain.get('amount', 0)
            unit = grain.get('unit', 'lb')
            color = grain.get('color', 2.0)
            
            # Convert to pounds
            amount_lb = self.convert_to_pounds(amount, unit)
            grain_colors.append((amount_lb, color))
        
        # Calculate SRM
        srm = self.calc_srm_core(grain_colors, batch_size_gal)
        
        # Calculate FG and ABV
        yeast_ingredients = [ing for ing in ingredients if ing.get('type') == 'yeast']
        avg_attenuation = 75.0  # Default
        if yeast_ingredients:
            attenuations = [ing.get('attenuation', 75.0) for ing in yeast_ingredients]
            avg_attenuation = sum(attenuations) / len(attenuations)
        
        fg = self.calc_fg_core(og, avg_attenuation)
        abv = self.calc_abv_core(og, fg)
        
        return {
            'OG': round(og, 3),
            'FG': round(fg, 3),
            'ABV': round(abv, 1),
            'IBU': round(ibu, 1),
            'SRM': round(srm, 1),
            'attenuation': avg_attenuation
        }
    
    def _calculate_metrics_simple(self, recipe_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate metrics using simplified calculations."""
        ingredients = recipe_data.get('ingredients', [])
        batch_size = recipe_data.get('batch_size', 5.0)
        batch_size_unit = recipe_data.get('batch_size_unit', 'gal')
        efficiency = recipe_data.get('efficiency', 75.0)
        
        # Convert batch size to gallons
        if batch_size_unit == 'L':
            batch_size_gal = batch_size * 0.264172
        else:
            batch_size_gal = batch_size
        
        # Simple OG calculation
        og = self._calculate_og_simple(ingredients, batch_size_gal, efficiency)
        
        # Simple IBU calculation
        ibu = self._calculate_ibu_simple(ingredients, batch_size_gal, og)
        
        # Simple SRM calculation
        srm = self._calculate_srm_simple(ingredients, batch_size_gal)
        
        # Calculate FG and ABV
        yeast_ingredients = [ing for ing in ingredients if ing.get('type') == 'yeast']
        avg_attenuation = 75.0
        if yeast_ingredients:
            attenuations = [ing.get('attenuation', 75.0) for ing in yeast_ingredients]
            avg_attenuation = sum(attenuations) / len(attenuations)
        
        fg = og - ((og - 1.0) * (avg_attenuation / 100.0))
        abv = (og - fg) * 131.25
        
        return {
            'OG': round(og, 3),
            'FG': round(fg, 3),
            'ABV': round(abv, 1),
            'IBU': round(ibu, 1),
            'SRM': round(srm, 1),
            'attenuation': avg_attenuation
        }
    
    def _calculate_og_simple(self, ingredients, batch_size_gal, efficiency):
        """Simple OG calculation."""
        total_points = 0.0
        grains = [ing for ing in ingredients if ing.get('type') == 'grain']
        
        for grain in grains:
            amount = grain.get('amount', 0)
            unit = grain.get('unit', 'lb')
            potential = grain.get('potential', 1.037)
            
            # Convert to pounds if needed
            if unit in ['kg', 'kilograms']:
                amount_lb = amount * 2.20462
            else:
                amount_lb = amount
            
            # Calculate points per gallon (PPG)
            ppg = (potential - 1.0) * 1000
            grain_points = ppg * amount_lb
            total_points += grain_points
        
        # Calculate OG
        og = 1.0 + (total_points * (efficiency / 100.0)) / (batch_size_gal * 1000.0)
        return round(og, 3)
    
    def _calculate_ibu_simple(self, ingredients, batch_size_gal, og):
        """Simple IBU calculation."""
        total_ibu = 0.0
        hops = [ing for ing in ingredients if ing.get('type') == 'hop']
        
        for hop in hops:
            if hop.get('use') != 'boil':
                continue
                
            amount = hop.get('amount', 0)
            unit = hop.get('unit', 'oz')
            alpha_acid = hop.get('alpha_acid', 5.0)
            time = hop.get('time', 60)
            
            # Convert to ounces if needed
            if unit in ['g', 'grams']:
                amount_oz = amount * 0.035274
            else:
                amount_oz = amount
            
            # Utilization calculation
            gravity_factor = 1.65 * pow(0.000125, og - 1.0)
            time_factor = (1.0 - pow(2.718, -0.04 * time)) / 4.15
            utilization = gravity_factor * time_factor
            
            # IBU calculation
            aau = amount_oz * alpha_acid
            ibu_contribution = aau * utilization * 74.9 / batch_size_gal
            total_ibu += ibu_contribution
        
        return round(total_ibu, 1)
    
    def _calculate_srm_simple(self, ingredients, batch_size_gal):
        """Simple SRM calculation."""
        total_mcu = 0.0
        grains = [ing for ing in ingredients if ing.get('type') == 'grain']
        
        for grain in grains:
            amount = grain.get('amount', 0)
            unit = grain.get('unit', 'lb')
            color = grain.get('color', 2.0)
            
            # Convert to pounds if needed
            if unit in ['kg', 'kilograms']:
                amount_lb = amount * 2.20462
            else:
                amount_lb = amount
            
            mcu_contribution = color * amount_lb
            total_mcu += mcu_contribution
        
        mcu = total_mcu / batch_size_gal
        srm = 1.4922 * pow(mcu, 0.6859)
        
        return round(srm, 1)
    
    def _get_default_metrics(self) -> Dict[str, Any]:
        """Return default metrics when calculations fail."""
        return {
            'OG': 1.050,
            'FG': 1.012,
            'ABV': 5.0,
            'IBU': 20.0,
            'SRM': 8.0,
            'attenuation': 75.0
        }


# Global instance
_brewing_calculations = None


def get_brewing_calculations() -> BrewingCalculations:
    """Get the global BrewingCalculations instance."""
    global _brewing_calculations
    if _brewing_calculations is None:
        _brewing_calculations = BrewingCalculations()
    return _brewing_calculations