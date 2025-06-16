from utils.brewing_calculation_core import (
    convert_to_pounds,
    convert_to_ounces,
    calc_og_core,
    calc_fg_core,
    calc_abv_core,
    calc_ibu_core,
    calc_srm_core,
)
from utils.unit_conversions import UnitConverter


def calculate_og_preview(recipe_data):
    """Calculate original gravity from recipe data"""
    batch_size = float(recipe_data.get("batch_size", 5))
    batch_size_unit = recipe_data.get("batch_size_unit", "gal")
    efficiency = float(recipe_data.get("efficiency", 75))
    ingredients = recipe_data.get("ingredients", [])

    # Determine unit system from batch size unit
    unit_system = (
        "metric" if batch_size_unit in ["l", "L", "liter", "liters"] else "imperial"
    )

    total_points = 0.0
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("potential"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            total_points += weight_lb * float(ing.get("potential", 0))

    # Convert batch size to appropriate unit for calculation
    if unit_system == "metric":
        # Ensure batch size is in liters
        batch_size_liters = (
            UnitConverter.convert_volume(batch_size, batch_size_unit, "l")
            if batch_size_unit != "l"
            else batch_size
        )
        return calc_og_core(total_points, batch_size_liters, efficiency, unit_system)
    else:
        # Ensure batch size is in gallons
        batch_size_gallons = (
            UnitConverter.convert_volume(batch_size, batch_size_unit, "gal")
            if batch_size_unit != "gal"
            else batch_size
        )
        return calc_og_core(total_points, batch_size_gallons, efficiency, unit_system)


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
    ingredients = recipe_data.get("ingredients", [])

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
    return calc_ibu_core(hops_data, og, batch_size)


def calculate_srm_preview(recipe_data):
    """Calculate SRM color using MCU method"""
    batch_size = float(recipe_data.get("batch_size", 5))
    ingredients = recipe_data.get("ingredients", [])

    grain_colors = []
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("color"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            color = float(ing.get("color", 0))
            grain_colors.append((weight_lb, color))

    return calc_srm_core(grain_colors, batch_size)


def calculate_all_metrics_preview(recipe_data):
    """Calculate all metrics for a recipe preview with enhanced unit awareness"""
    # Normalize batch size to appropriate units for calculation
    batch_size = float(recipe_data.get("batch_size", 5))
    batch_size_unit = recipe_data.get("batch_size_unit", "gal")

    # Pass through the batch_size_unit to preserve it
    normalized_recipe = recipe_data.copy()
    # Don't convert batch size here - let individual calculations handle it

    return {
        "og": calculate_og_preview(normalized_recipe),
        "fg": calculate_fg_preview(normalized_recipe),
        "abv": calculate_abv_preview(normalized_recipe),
        "ibu": calculate_ibu_preview(normalized_recipe),
        "srm": calculate_srm_preview(normalized_recipe),
    }
