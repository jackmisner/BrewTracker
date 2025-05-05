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


def calculate_og(recipe):
    """
    Calculate the original gravity of a recipe based on the grains and batch size

    Formula: OG = 1 + (total_points / volume_in_gallons / 1000)
    where total_points = sum(grain_weight_lb * grain_potential)
    """
    if not recipe or not recipe.ingredients:
        return 1.000

    grain_points = 0.0
    for ingredient in recipe.ingredients:
        if ingredient.ingredient.type == "grain" and ingredient.ingredient.potential:
            # Convert to pounds if not already
            weight_lb = ingredient.amount
            if ingredient.unit == "oz":
                weight_lb = ingredient.amount / 16.0
            elif ingredient.unit == "g":
                weight_lb = ingredient.amount / 453.592
            elif ingredient.unit == "kg":
                weight_lb = ingredient.amount * 2.20462

            grain_points += weight_lb * ingredient.ingredient.potential

    og = 1.0 + (grain_points / recipe.batch_size / 1000.0)
    return round(og, 3)


def calculate_fg(recipe):
    """
    Calculate the final gravity based on the OG and yeast attenuation

    Formula: FG = OG - (OG - 1.0) * (attenuation / 100)
    """
    if not recipe or not recipe.ingredients or not recipe.original_gravity:
        return 1.000

    # Find yeast with highest attenuation
    max_attenuation = 75.0  # Default attenuation if no yeast specified
    for ingredient in recipe.ingredients:
        if ingredient.ingredient.type == "yeast" and ingredient.ingredient.attenuation:
            if ingredient.ingredient.attenuation > max_attenuation:
                max_attenuation = ingredient.ingredient.attenuation

    og = recipe.original_gravity
    fg = og - ((og - 1.0) * (max_attenuation / 100.0))
    return round(fg, 3)


def calculate_abv(recipe):
    """
    Calculate the alcohol by volume based on OG and FG

    Formula: ABV = (OG - FG) * 131.25
    """
    if not recipe or not recipe.original_gravity or not recipe.final_gravity:
        return 0.0

    abv = (recipe.original_gravity - recipe.final_gravity) * 131.25
    return round(abv, 1)


def calculate_ibu(recipe):
    """
    Calculate the International Bitterness Units based on hop additions

    Uses the Tinseth formula:
    IBU = sum(AAU * Utilization * 74.9 / volume_in_gallons)
    where AAU = weight_oz * alpha_acid_percent
    and Utilization = 1.65 * 0.000125^(gravity - 1) * (1 - e^(-0.04 * time)) / 4.15
    """
    if not recipe or not recipe.ingredients or not recipe.original_gravity:
        return 0.0

    total_ibu = 0.0
    og = recipe.original_gravity

    for ingredient in recipe.ingredients:
        if (
            ingredient.ingredient.type == "hop"
            and ingredient.ingredient.alpha_acid
            and ingredient.use in ["boil", "whirlpool"]
            and ingredient.time
        ):

            # Convert to ounces if not already
            weight_oz = ingredient.amount
            if ingredient.unit == "g":
                weight_oz = ingredient.amount / 28.3495
            elif ingredient.unit == "kg":
                weight_oz = ingredient.amount * 35.274
            elif ingredient.unit == "lb":
                weight_oz = ingredient.amount * 16.0

            alpha_acid = ingredient.ingredient.alpha_acid
            time = ingredient.time

            # Calculate utilization based on time and gravity
            # Whirlpool hops get reduced utilization
            utilization_factor = 1.0
            if ingredient.use == "whirlpool":
                utilization_factor = 0.3  # Approximation for whirlpool at ~170°F

            # Tinseth formula factors
            gravity_factor = 1.65 * pow(0.000125, og - 1.0)
            time_factor = (1.0 - pow(2.718, -0.04 * time)) / 4.15
            utilization = gravity_factor * time_factor * utilization_factor

            # Calculate IBUs for this hop addition
            aau = weight_oz * alpha_acid
            ibu_contribution = aau * utilization * 74.9 / recipe.batch_size
            total_ibu += ibu_contribution

    return round(total_ibu, 1)


def calculate_srm(recipe):
    """
    Calculate the Standard Reference Method (color) based on grain colors

    Formula: SRM = 1.4922 * (MCU ^ 0.6859)
    where MCU = sum(grain_color_lovibond * grain_weight_lb) / volume_in_gallons
    """
    if not recipe or not recipe.ingredients:
        return 0.0

    total_mcu = 0.0
    for ingredient in recipe.ingredients:
        if ingredient.ingredient.type == "grain" and ingredient.ingredient.color:
            # Convert to pounds if not already
            weight_lb = ingredient.amount
            if ingredient.unit == "oz":
                weight_lb = ingredient.amount / 16.0
            elif ingredient.unit == "g":
                weight_lb = ingredient.amount / 453.592
            elif ingredient.unit == "kg":
                weight_lb = ingredient.amount * 2.20462

            color = ingredient.ingredient.color
            mcu_contribution = color * weight_lb
            total_mcu += mcu_contribution

    mcu = total_mcu / recipe.batch_size
    srm = 1.4922 * pow(mcu, 0.6859)

    return round(srm, 1)
