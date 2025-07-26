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
        if use_type == "boil":
            utilization_factor = 1.0
        elif use_type == "whirlpool":
            utilization_factor = 0.3
        else:
            utilization_factor = 0
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


def calc_temperature_adjusted_attenuation(base_attenuation, mash_temp_f):
    """
    Adjust yeast attenuation based on mash temperature effects on wort fermentability.

    RESEARCH-BACKED IMPLEMENTATION using scientific literature:
    - "Understanding Enzymes - Homebrew Science" (Brew Your Own Magazine)
    - John Palmer's "How to Brew" - mashing temperature sections
    - JASBC papers on enzyme thermostability and fermentability
    - MDPI Foods Journal brewing optimization research

    Key research findings:
    - "1% less attenuation for every degree above 151°F" (brewing literature)
    - 149°F to 156°F change = 6 gravity points difference (experimental data)
    - 152°F (67°C) provides balanced enzyme activity (baseline)
    - 85% of fermentable sugars produced at 62°C within 20 minutes

    Args:
        base_attenuation: Yeast's base attenuation percentage (e.g., 75.0)
        mash_temp_f: Mash temperature in Fahrenheit

    Returns:
        Adjusted apparent attenuation percentage

    Scientific basis:
    - β-amylase optimum: 140-149°F (higher fermentability, more maltose)
    - α-amylase optimum: 158-167°F (lower fermentability, more dextrins)
    - Balanced activity: 152-153°F (moderate fermentability)
    """

    # Baseline temperature where no adjustment is needed (balanced enzyme activity)
    # Research-backed optimal temperature for balanced fermentability
    baseline_temp_f = 152.0  # 67°C

    # Research-backed coefficient: "1% less attenuation per degree above 151°F"
    # Using 152°F as baseline, this translates to 1% per degree deviation
    temp_deviation = mash_temp_f - baseline_temp_f

    # Evidence-based attenuation modifier
    # Negative deviation (lower temp) = higher attenuation (more fermentable)
    # Positive deviation (higher temp) = lower attenuation (less fermentable)
    attenuation_change_percent = -temp_deviation  # 1% per degree deviation

    # Convert percentage change to modifier
    temp_modifier = 1.0 + (attenuation_change_percent / 100.0)

    # Apply safety bounds based on experimental brewing data
    # Research shows up to 10% attenuation variation across 145-160°F range
    # Conservative bounds to prevent unrealistic brewing results
    temp_modifier = max(0.90, min(1.10, temp_modifier))  # Max ±10% adjustment

    adjusted_attenuation = base_attenuation * temp_modifier

    # Keep within reasonable brewing bounds (extended range based on research)
    return min(85, max(60, adjusted_attenuation))


def calc_fg_with_mash_temp(og, base_attenuation, mash_temp_f):
    """
    Enhanced FG calculation incorporating mash temperature effects.

    Args:
        og: Original gravity
        base_attenuation: Yeast's base attenuation percentage
        mash_temp_f: Mash temperature in Fahrenheit

    Returns:
        Final gravity adjusted for mash temperature effects
    """
    adjusted_attenuation = calc_temperature_adjusted_attenuation(
        base_attenuation, mash_temp_f
    )
    return calc_fg_core(og, adjusted_attenuation)
