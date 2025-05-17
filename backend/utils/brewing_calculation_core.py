# Core calculation functions used by helpers.py and recipe_calculations.py


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


def convert_to_ounces(amount, unit):
    """Convert weight to ounces"""
    if unit == "g":
        return amount / 28.3495
    elif unit == "kg":
        return amount * 35.274
    elif unit == "lb":
        return amount * 16.0
    return amount  # Default to ounces


# Core calculation functions that work with normalized inputs
def calc_og_core(grain_points, batch_size, efficiency):
    """Core OG calculation with normalized inputs"""
    og = 1.0 + (grain_points * (efficiency / 100.0)) / (batch_size * 1000.0)
    return round(og, 3)


def calc_fg_core(og, attenuation):
    """Core FG calculation with normalized inputs"""
    fg = og - ((og - 1.0) * (attenuation / 100.0))
    return round(fg, 3)


def calc_abv_core(og, fg):
    """Core ABV calculation with normalized inputs"""
    abv = (og - fg) * 131.25
    return round(abv, 1)


def calc_ibu_core(hops_data, og, batch_size):
    """Core IBU calculation with normalized inputs

    hops_data is a list of tuples: (weight_oz, alpha_acid, time, use_type)
    """
    total_ibu = 0.0

    for weight_oz, alpha_acid, time, use_type in hops_data:
        # Utilization calculations
        utilization_factor = 0.3 if use_type == "whirlpool" else 1.0
        gravity_factor = 1.65 * pow(0.000125, og - 1.0)
        time_factor = (1.0 - pow(2.718, -0.04 * time)) / 4.15
        utilization = gravity_factor * time_factor * utilization_factor

        # IBU calculation
        aau = weight_oz * alpha_acid
        ibu_contribution = aau * utilization * 74.9 / batch_size
        total_ibu += ibu_contribution

    return round(total_ibu, 1)


def calc_srm_core(grain_colors, batch_size):
    """Core SRM calculation with normalized inputs

    grain_colors is a list of tuples: (weight_lb, color)
    """
    total_mcu = 0.0

    for weight_lb, color in grain_colors:
        mcu_contribution = color * weight_lb
        total_mcu += mcu_contribution

    mcu = total_mcu / batch_size
    srm = 1.4922 * pow(mcu, 0.6859)

    return round(srm, 1)
