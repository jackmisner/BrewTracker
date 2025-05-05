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
