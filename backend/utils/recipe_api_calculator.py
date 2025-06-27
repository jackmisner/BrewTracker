from utils.brewing_calculation_core import (
    calc_abv_core,
    calc_fg_core,
    calc_ibu_core,
    calc_og_core,
    calc_srm_core,
    convert_to_ounces,
    convert_to_pounds,
)
from utils.unit_conversions import UnitConverter


def calculate_og_preview(recipe_data):
    """Calculate original gravity from recipe data"""
    batch_size = float(recipe_data.get("batch_size", 5))
    batch_size_unit = recipe_data.get("batch_size_unit", "gal")
    efficiency = float(recipe_data.get("efficiency", 75))
    ingredients = recipe_data.get("ingredients", [])

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(batch_size, batch_size_unit, "gal")

    total_points = 0.0
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("potential"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            total_points += weight_lb * float(ing.get("potential", 0))

    # Use simplified calc_og_core (always expects gallons)
    return calc_og_core(total_points, batch_size_gal, efficiency)


def calculate_fg_preview(recipe_data):
    """Calculate final gravity using yeast attenuation"""
    ingredients = recipe_data.get("ingredients", [])

    # Find yeast with highest attenuation
    max_attenuation = 0
    for ing in ingredients:
        if ing.get("type") == "yeast" and ing.get("attenuation"):
            max_attenuation = max(max_attenuation, float(ing.get("attenuation", 0)))

    og = calculate_og_preview(recipe_data)
    return calc_fg_core(og, max_attenuation)


def calculate_abv_preview(recipe_data):
    """Calculate ABV using OG and FG"""
    og = calculate_og_preview(recipe_data)
    fg = calculate_fg_preview(recipe_data)

    return calc_abv_core(og, fg)


def calculate_ibu_preview(recipe_data):
    """Calculate IBUs using Tinseth formula"""
    batch_size = float(recipe_data.get("batch_size", 5))
    batch_size_unit = recipe_data.get("batch_size_unit", "gal")
    ingredients = recipe_data.get("ingredients", [])

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(batch_size, batch_size_unit, "gal")

    hops_data = []
    for ing in ingredients:
        if (
            ing.get("type") == "hop"
            and ing.get("alpha_acid")
            and ing.get("use") in ["boil", "whirlpool"]
            and ing.get("time")
        ):
            weight_oz = convert_to_ounces(
                float(ing.get("amount", 0)), ing.get("unit", "oz")
            )
            alpha_acid = float(ing.get("alpha_acid", 0))
            time = int(ing.get("time", 0))
            use_type = ing.get("use")
            hops_data.append((weight_oz, alpha_acid, time, use_type))

    og = calculate_og_preview(recipe_data)
    return calc_ibu_core(hops_data, og, batch_size_gal)


def calculate_srm_preview(recipe_data):
    """Calculate SRM color using MCU method"""
    batch_size = float(recipe_data.get("batch_size", 5))
    batch_size_unit = recipe_data.get("batch_size_unit", "gal")
    ingredients = recipe_data.get("ingredients", [])

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(batch_size, batch_size_unit, "gal")

    grain_colors = []
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("color"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            color = float(ing.get("color", 0))
            grain_colors.append((weight_lb, color))

    return calc_srm_core(grain_colors, batch_size_gal)


def calculate_all_metrics_preview(recipe_data):
    """Calculate all metrics for a recipe preview with proper unit handling"""
    try:
        return {
            "og": calculate_og_preview(recipe_data),
            "fg": calculate_fg_preview(recipe_data),
            "abv": calculate_abv_preview(recipe_data),
            "ibu": calculate_ibu_preview(recipe_data),
            "srm": calculate_srm_preview(recipe_data),
        }
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        # Return default values if calculation fails
        return {
            "og": 1.000,
            "fg": 1.000,
            "abv": 0.0,
            "ibu": 0,
            "srm": 0,
        }
