# Core calculation functions used by helpers.py and recipe_calculations.py
from utils.unit_conversions import UnitConverter


def convert_to_pounds(amount, unit):
    """Convert various weight units to pounds - now uses UnitConverter"""
    return UnitConverter.convert_to_pounds(amount, unit)


def convert_to_ounces(amount, unit):
    """Convert weight to ounces - now uses UnitConverter"""
    return UnitConverter.convert_to_ounces(amount, unit)


# Core calculation functions that work with normalized inputs (always imperial units)
def calc_og_core(grain_points, batch_size_gal, efficiency):
    """Core OG calculation with normalized inputs

    Args:
        grain_points: Total gravity points from grains (in PPG format)
        batch_size_gal: Batch size in gallons (always converted to gallons)
        efficiency: Mash efficiency as percentage

    Note: This function always expects gallons and uses standard PPG values.
          Unit conversion should be done BEFORE calling this function.
    """
    og = 1.0 + (grain_points * (efficiency / 100.0)) / (batch_size_gal * 1000.0)
    return round(og, 3)


def calc_fg_core(og, attenuation):
    """Core FG calculation with normalized inputs"""
    fg = og - ((og - 1.0) * (attenuation / 100.0))
    return round(fg, 3)


def calc_abv_core(og, fg):
    """Core ABV calculation with normalized inputs"""
    abv = (og - fg) * 131.25
    return round(abv, 1)


def calc_ibu_core(hops_data, og, batch_size_gal):
    """Core IBU calculation with normalized inputs

    Args:
        hops_data: List of tuples (weight_oz, alpha_acid, time, use_type)
        og: Original gravity
        batch_size_gal: Batch size in gallons (always converted to gallons)
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
        ibu_contribution = aau * utilization * 74.9 / batch_size_gal
        total_ibu += ibu_contribution

    return round(total_ibu, 1)


def calc_srm_core(grain_colors, batch_size_gal):
    """Core SRM calculation with normalized inputs

    Args:
        grain_colors: List of tuples (weight_lb, color)
        batch_size_gal: Batch size in gallons (always converted to gallons)
    """
    total_mcu = 0.0

    for weight_lb, color in grain_colors:
        mcu_contribution = color * weight_lb
        total_mcu += mcu_contribution

    mcu = total_mcu / batch_size_gal
    srm = 1.4922 * pow(mcu, 0.6859)

    return round(srm, 1)
