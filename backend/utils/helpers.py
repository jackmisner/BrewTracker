# Formating functions for various attributes
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
    return (temp_f - 32) * 5 / 9


def celsius_to_fahrenheit(temp_c):
    return (temp_c * 9 / 5) + 32


def convert_to_pounds(amount, unit):
    """Convert various weight units to pounds"""
    if unit == "oz":
        return amount / 16.0
    elif unit == "g":
        return amount / 453.592
    elif unit == "kg":
        return amount * 2.20462
    elif unit == "lb":
        return amount
    return amount  # Default to assuming pounds if unit not recognized


def calculate_og(recipe):
    """Calculate original gravity from recipe ingredients"""
    if not recipe or not hasattr(recipe, "recipe_ingredients"):
        return 1.000

    total_points = 0.0
    for ri in recipe.recipe_ingredients:
        if ri.ingredient.type == "grain" and ri.ingredient.potential:
            weight_lb = convert_to_pounds(ri.amount, ri.unit)
            total_points += (weight_lb * ri.ingredient.potential)*(recipe.efficiency / 100.0)

    og = 1.0 + (total_points / recipe.batch_size / 1000.0)
    return round(og, 3)


def calculate_fg(recipe):
    """Calculate final gravity using yeast attenuation"""
    if not recipe or not hasattr(recipe, "recipe_ingredients"):
        return 1.000

    # Find yeast with highest attenuation
    max_attenuation = 0
    for ri in recipe.recipe_ingredients:
        if ri.ingredient.type == "yeast" and ri.ingredient.attenuation:
            max_attenuation = max(max_attenuation, ri.ingredient.attenuation) # Set max attenuation to yeast attenuation if found, otherwise 0

    og = calculate_og(recipe)  # Calculate OG if not already set
    fg = og - ((og - 1.0) * (max_attenuation / 100.0)) # Calculate FG using max attenuation (will return og if no yeast found)
    return round(fg, 3)


def calculate_abv(recipe):
    """Calculate ABV using OG and FG"""
    og = calculate_og(recipe)
    fg = calculate_fg(recipe)

    if not og or not fg:
        return 0.0

    abv = (og - fg) * 131.25
    return round(abv, 1)


def calculate_ibu(recipe):
    """Calculate IBUs using Tinseth formula"""
    if not recipe or not hasattr(recipe, "recipe_ingredients"):
        return 0.0

    total_ibu = 0.0
    og = calculate_og(recipe)

    for ri in recipe.recipe_ingredients:
        if (
            ri.ingredient.type == "hop"
            and ri.ingredient.alpha_acid
            and ri.use in ["boil", "whirlpool"]
            and ri.time
        ):

            weight_oz = convert_to_ounces(ri.amount, ri.unit)
            alpha_acid = ri.ingredient.alpha_acid
            time = ri.time

            # Utilization calculations
            utilization_factor = 0.3 if ri.use == "whirlpool" else 1.0
            gravity_factor = 1.65 * pow(0.000125, og - 1.0)
            time_factor = (1.0 - pow(2.718, -0.04 * time)) / 4.15
            utilization = gravity_factor * time_factor * utilization_factor

            # IBU calculation
            aau = weight_oz * alpha_acid
            ibu_contribution = aau * utilization * 74.9 / recipe.batch_size
            total_ibu += ibu_contribution

    return round(total_ibu, 1)


def calculate_srm(recipe):
    """Calculate SRM color using MCU method"""
    if not recipe or not hasattr(recipe, "recipe_ingredients"):
        return 0.0

    total_mcu = 0.0
    for ri in recipe.recipe_ingredients:
        if ri.ingredient.type == "grain" and ri.ingredient.color:
            weight_lb = convert_to_pounds(ri.amount, ri.unit)
            mcu_contribution = ri.ingredient.color * weight_lb
            total_mcu += mcu_contribution

    mcu = total_mcu / recipe.batch_size
    srm = 1.4922 * pow(mcu, 0.6859)
    return round(srm, 1)


def convert_to_ounces(amount, unit):
    """Convert weight to ounces"""
    if unit == "g":
        return amount / 28.3495
    elif unit == "kg":
        return amount * 35.274
    elif unit == "lb":
        return amount * 16.0
    return amount  # Default to ounces
