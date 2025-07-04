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


# Formatting functions for various attributes
def format_gravity(gravity):
    return f"{float(gravity):.3f}" if gravity else "1.000"


def format_abv(abv):
    return f"{float(abv):.1f}%" if abv else "0.0%"


def format_ibu(ibu):
    return str(round(ibu)) if ibu else "0"


def format_srm(srm):
    return f"{float(srm):.1f}" if srm else "0.0"


# SRM colour mapping
def get_color_from_srm(srm):
    if not srm or srm <= 0:
        return "#FFE699"
    elif srm <= 2:
        return "#FFD878"
    elif srm <= 3:
        return "#FFCA5A"
    elif srm <= 4:
        return "#FFBF42"
    elif srm <= 6:
        return "#FBB123"
    elif srm <= 8:
        return "#F8A600"
    elif srm <= 10:
        return "#F39C00"
    elif srm <= 13:
        return "#EA8F00"
    elif srm <= 17:
        return "#E58500"
    elif srm <= 20:
        return "#D37600"
    elif srm <= 24:
        return "#CB6600"
    elif srm <= 29:
        return "#C05600"
    elif srm <= 35:
        return "#A64C00"
    else:
        return "#8D4000"


# Descriptions for various attributes
def get_ibu_description(ibu):
    if ibu < 5:
        return "No Perceived Bitterness"
    elif ibu < 10:
        return "Very Low Bitterness"
    elif ibu < 20:
        return "Low Bitterness"
    elif ibu < 30:
        return "Moderate Bitterness"
    elif ibu < 40:
        return "Strong Bitterness"
    elif ibu < 60:
        return "Very Strong Bitterness"
    else:
        return "Extremely Bitter"


def get_abv_description(abv):
    if abv < 3.0:
        return "Session Beer"
    elif abv < 5.0:
        return "Standard"
    elif abv < 7.5:
        return "High ABV"
    elif abv < 10.0:
        return "Very High ABV"
    else:
        return "Extremely High ABV"


# Brewing Conversion Functions
def specific_gravity_to_plato(sg):
    return (-463.37) + (668.72 * sg) - (205.35 * sg * sg)


def plato_to_specific_gravity(plato):
    return 1 + (plato / (258.6 - ((plato / 258.2) * 227.1)))


def fahrenheit_to_celsius(temp_f):
    """Convert Fahrenheit to Celsius - now uses UnitConverter"""
    return UnitConverter.fahrenheit_to_celsius(temp_f)


def celsius_to_fahrenheit(temp_c):
    """Convert Celsius to Fahrenheit - now uses UnitConverter"""
    return UnitConverter.celsius_to_fahrenheit(temp_c)


def calculate_og(recipe):
    """Calculate original gravity from recipe ingredients"""
    if not recipe or not hasattr(recipe, "ingredients"):
        return 1.000

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(
        recipe.batch_size, getattr(recipe, "batch_size_unit", "gal"), "gal"
    )

    total_points = 0.0
    for ri in recipe.ingredients:
        if ri.type == "grain" and ri.potential:
            weight_lb = convert_to_pounds(ri.amount, ri.unit)
            total_points += weight_lb * ri.potential

    return calc_og_core(total_points, batch_size_gal, recipe.efficiency or 75)


def calculate_fg(recipe):
    """Calculate final gravity using improved yeast attenuation estimates"""
    if not recipe or not hasattr(recipe, "ingredients"):
        return 1.000

    # Find yeast with highest improved attenuation estimate
    max_attenuation = 0
    for ri in recipe.ingredients:
        if ri.type == "yeast":
            # Try to get improved attenuation estimate
            from services.attenuation_service import AttenuationService

            improved_attenuation = AttenuationService.get_improved_attenuation_estimate(
                str(ri.ingredient_id)
            )

            # Fall back to theoretical attenuation if no improved estimate
            attenuation = (
                improved_attenuation if improved_attenuation else ri.attenuation
            )

            if attenuation:
                max_attenuation = max(max_attenuation, attenuation)

    og = calculate_og(recipe)
    return calc_fg_core(og, max_attenuation)


def calculate_abv(recipe):
    """Calculate ABV using OG and FG"""
    og = calculate_og(recipe)
    fg = calculate_fg(recipe)
    return calc_abv_core(og, fg)


def calculate_ibu(recipe):
    """Calculate IBUs using Tinseth formula"""
    if not recipe or not hasattr(recipe, "ingredients"):
        return 0.0

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(
        recipe.batch_size, getattr(recipe, "batch_size_unit", "gal"), "gal"
    )

    hops_data = []
    for ri in recipe.ingredients:
        if (
            ri.type == "hop"
            and ri.alpha_acid
            and ri.use in ["boil", "whirlpool"]
            and ri.time
        ):
            weight_oz = convert_to_ounces(ri.amount, ri.unit)
            alpha_acid = ri.alpha_acid
            time = ri.time
            use_type = ri.use
            hops_data.append((weight_oz, alpha_acid, time, use_type))

    og = calculate_og(recipe)
    return calc_ibu_core(hops_data, og, batch_size_gal)


def calculate_srm(recipe):
    """Calculate SRM color using MCU method"""
    if not recipe or not hasattr(recipe, "ingredients"):
        return 0.0

    # Convert batch size to gallons for calculation
    batch_size_gal = UnitConverter.convert_volume(
        recipe.batch_size, getattr(recipe, "batch_size_unit", "gal"), "gal"
    )

    grain_colors = []
    for ri in recipe.ingredients:
        if ri.type == "grain" and ri.color:
            weight_lb = convert_to_pounds(ri.amount, ri.unit)
            color = ri.color
            grain_colors.append((weight_lb, color))

    return calc_srm_core(grain_colors, batch_size_gal)
