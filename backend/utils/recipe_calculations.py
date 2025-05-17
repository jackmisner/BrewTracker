from utils.helpers import (
    convert_to_pounds,
    convert_to_ounces,
    format_gravity,
    format_abv,
    format_ibu,
    format_srm,
)


def calculate_og_preview(recipe_data):
    """Calculate original gravity from recipe data"""
    batch_size = float(recipe_data.get("batch_size", 5))
    efficiency = float(recipe_data.get("efficiency", 75))
    ingredients = recipe_data.get("ingredients", [])

    total_points = 0.0
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("potential"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            total_points += (weight_lb * float(ing.get("potential", 0))) * (
                efficiency / 100.0
            )

    og = 1.0 + (total_points / batch_size / 1000.0)
    return round(og, 3)


def calculate_fg_preview(recipe_data):
    """Calculate final gravity using yeast attenuation"""
    ingredients = recipe_data.get("ingredients", [])

    # Find yeast with highest attenuation
    max_attenuation = 0
    for ing in ingredients:
        if ing.get("type") == "yeast" and ing.get("attenuation"):
            max_attenuation = max(max_attenuation, float(ing.get("attenuation", 0)))

    og = calculate_og_preview(recipe_data)
    fg = og - ((og - 1.0) * (max_attenuation / 100.0))
    return round(fg, 3)


def calculate_abv_preview(recipe_data):
    """Calculate ABV using OG and FG"""
    og = calculate_og_preview(recipe_data)
    fg = calculate_fg_preview(recipe_data)

    abv = (og - fg) * 131.25
    return round(abv, 1)


def calculate_ibu_preview(recipe_data):
    """Calculate IBUs using Tinseth formula"""
    batch_size = float(recipe_data.get("batch_size", 5))
    boil_time = int(recipe_data.get("boil_time", 60))
    ingredients = recipe_data.get("ingredients", [])

    total_ibu = 0.0
    og = calculate_og_preview(recipe_data)

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

            # Utilization calculations
            utilization_factor = 0.3 if ing.get("use") == "whirlpool" else 1.0
            gravity_factor = 1.65 * pow(0.000125, og - 1.0)
            time_factor = (1.0 - pow(2.718, -0.04 * time)) / 4.15
            utilization = gravity_factor * time_factor * utilization_factor

            # IBU calculation
            aau = weight_oz * alpha_acid
            ibu_contribution = aau * utilization * 74.9 / batch_size
            total_ibu += ibu_contribution

    return round(total_ibu, 1)


def calculate_srm_preview(recipe_data):
    """Calculate SRM color using MCU method"""
    batch_size = float(recipe_data.get("batch_size", 5))
    ingredients = recipe_data.get("ingredients", [])

    total_mcu = 0.0
    for ing in ingredients:
        if ing.get("type") == "grain" and ing.get("color"):
            weight_lb = convert_to_pounds(
                float(ing.get("amount", 0)), ing.get("unit", "lb")
            )
            mcu_contribution = float(ing.get("color", 0)) * weight_lb
            total_mcu += mcu_contribution

    mcu = total_mcu / batch_size
    srm = 1.4922 * pow(mcu, 0.6859)
    return round(srm, 1)


def calculate_all_metrics_preview(recipe_data):
    """Calculate all metrics for a recipe preview"""
    return {
        "og": calculate_og_preview(recipe_data),
        "fg": calculate_fg_preview(recipe_data),
        "abv": calculate_abv_preview(recipe_data),
        "ibu": calculate_ibu_preview(recipe_data),
        "srm": calculate_srm_preview(recipe_data),
    }
