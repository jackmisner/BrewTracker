// Standalone unit conversion utilities that can be used outside of React components
// These mirror the conversion logic from UnitContext but don't require React hooks

// Unit conversion functions (standalone versions)
const convertUnit = (value, fromUnit, toUnit) => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return { value: 0, unit: toUnit };

  // If same unit, return as-is
  if (fromUnit === toUnit) {
    return { value: numValue, unit: toUnit };
  }

  let convertedValue = numValue;

  // Weight conversions
  if (fromUnit === "kg" && toUnit === "lb") {
    convertedValue = numValue * 2.20462;
  } else if (fromUnit === "lb" && toUnit === "kg") {
    convertedValue = numValue / 2.20462;
  } else if (fromUnit === "g" && toUnit === "oz") {
    convertedValue = numValue / 28.3495;
  } else if (fromUnit === "oz" && toUnit === "g") {
    convertedValue = numValue * 28.3495;
  } else if (fromUnit === "kg" && toUnit === "g") {
    convertedValue = numValue * 1000;
  } else if (fromUnit === "g" && toUnit === "kg") {
    convertedValue = numValue / 1000;
  } else if (fromUnit === "lb" && toUnit === "oz") {
    convertedValue = numValue * 16;
  } else if (fromUnit === "oz" && toUnit === "lb") {
    convertedValue = numValue / 16;
  }
  // Missing conversions - ADD THESE
  else if (fromUnit === "g" && toUnit === "lb") {
    convertedValue = numValue / 453.592;
  } else if (fromUnit === "lb" && toUnit === "g") {
    convertedValue = numValue * 453.592;
  } else if (fromUnit === "kg" && toUnit === "oz") {
    convertedValue = numValue * 35.274;
  } else if (fromUnit === "oz" && toUnit === "kg") {
    convertedValue = numValue / 35.274;
  }

  // Volume conversions
  else if (fromUnit === "gal" && toUnit === "l") {
    convertedValue = numValue * 3.78541;
  } else if (fromUnit === "l" && toUnit === "gal") {
    convertedValue = numValue / 3.78541;
  } else if (fromUnit === "ml" && toUnit === "l") {
    convertedValue = numValue / 1000;
  } else if (fromUnit === "l" && toUnit === "ml") {
    convertedValue = numValue * 1000;
  }
  // Missing conversions - ADD THESE
  else if (fromUnit === "ml" && toUnit === "gal") {
    convertedValue = numValue / 3785.41;
  } else if (fromUnit === "gal" && toUnit === "ml") {
    convertedValue = numValue * 3785.41;
  }

  // Temperature conversions
  else if (fromUnit === "f" && toUnit === "c") {
    convertedValue = ((numValue - 32) * 5) / 9;
  } else if (fromUnit === "c" && toUnit === "f") {
    convertedValue = (numValue * 9) / 5 + 32;
  }

  // If no conversion found, return original
  else {
    console.warn(`No conversion available from ${fromUnit} to ${toUnit}`);
    return { value: numValue, unit: fromUnit };
  }

  return {
    value: convertedValue,
    unit: toUnit,
  };
};

// Get appropriate unit for display based on unit system and measurement type
const getAppropriateUnit = (unitSystem, measurementType, amount = 0) => {
  switch (measurementType) {
    case "weight":
      if (unitSystem === "metric") {
        return amount >= 1000 ? "kg" : "g";
      } else {
        return amount >= 16 ? "lb" : "oz";
      }
    case "hop_weight":
      return unitSystem === "metric" ? "g" : "oz";
    case "volume":
      if (unitSystem === "metric") {
        return amount >= 1000 ? "l" : "ml";
      } else {
        return "gal";
      }
    case "temperature":
      return unitSystem === "metric" ? "c" : "f";
    default:
      return unitSystem === "metric" ? "g" : "oz";
  }
};

// Standalone formatting function with precision control
const formatValueStandalone = (value, unit, measurementType, precision = 2) => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return "0 " + unit;

  // Determine appropriate precision based on value and unit
  let displayPrecision = precision;

  if (measurementType === "volume") {
    displayPrecision = numValue < 1 ? 2 : 1;
  } else if (measurementType === "weight" || measurementType === "hop_weight") {
    if (unit === "g" && numValue < 10) {
      displayPrecision = 1;
    } else if (unit === "oz" && numValue < 1) {
      displayPrecision = 2;
    } else if (unit === "kg" || unit === "lb") {
      displayPrecision = numValue < 1 ? 2 : 1;
    }
  } else if (measurementType === "temperature") {
    displayPrecision = 0; // Whole degrees
  }

  const formattedValue = numValue.toFixed(displayPrecision);

  // Remove trailing zeros after decimal point
  const cleanValue = parseFloat(formattedValue).toString();

  return `${cleanValue} ${unit}`;
};

// Enhanced format functions that work with unit context.
export function formatGravity(gravity) {
  return gravity ? parseFloat(gravity).toFixed(3) : "1.000";
}

export function formatAbv(abv) {
  return abv ? `${parseFloat(abv).toFixed(1)}%` : "0.0%";
}

export function formatIbu(ibu) {
  return ibu ? Math.round(ibu).toString() : "0";
}

export function formatSrm(srm) {
  return srm ? parseFloat(srm).toFixed(1) : "0.0";
}

// Unit-aware formatting functions
export function formatWeight(amount, unit, unitSystem = "imperial") {
  if (!amount && amount !== 0) return "-";

  // Only convert if we're crossing unit systems
  const metricWeight = ["g", "kg"];
  const imperialWeight = ["oz", "lb"];

  const needsConversion =
    (metricWeight.includes(unit) && unitSystem === "imperial") ||
    (imperialWeight.includes(unit) && unitSystem === "metric");

  if (needsConversion) {
    const targetUnit = getAppropriateUnit(unitSystem, "weight", amount);
    const converted = convertUnit(amount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "weight");
  } else {
    // Stay in the same unit system, only convert to larger units if amount is large
    let targetUnit = unit;
    if (unit === "g" && amount >= 1000) {
      targetUnit = "kg";
    } else if (unit === "oz" && amount >= 16) {
      targetUnit = "lb";
    }

    const converted = convertUnit(amount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "weight");
  }
}

export function formatVolume(amount, unit, unitSystem = "imperial") {
  if (!amount && amount !== 0) return "-";

  // Only convert if we're crossing unit systems
  const metricVolume = ["ml", "l"];
  const imperialVolume = ["gal", "floz", "cup", "pint", "quart"];

  const needsConversion =
    (metricVolume.includes(unit) && unitSystem === "imperial") ||
    (imperialVolume.includes(unit) && unitSystem === "metric");

  if (needsConversion) {
    const targetUnit = getAppropriateUnit(unitSystem, "volume", amount);
    const converted = convertUnit(amount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "volume");
  } else {
    // Stay in the same unit system, only convert to larger units if amount is large
    let targetUnit = unit;
    if (unit === "ml" && amount >= 1000) {
      targetUnit = "l";
    } else if (unit === "l" && amount === 0) {
      // Special case: 0 liters should be displayed as 0 ml
      targetUnit = "ml";
    }
    // Note: We don't auto-convert oz/cup/pint/quart to gal as those are different use cases

    const converted = convertUnit(amount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "volume");
  }
}

export function formatTemperature(temp, unit, unitSystem = "imperial") {
  if (!temp && temp !== 0) return "-";

  const targetUnit = getAppropriateUnit(unitSystem, "temperature");
  const converted = convertUnit(temp, unit, targetUnit);

  return `${Math.round(converted.value)}°${converted.unit.toUpperCase()}`;
}

// Batch size specific formatting
export function formatBatchSize(size, unit = "gal", unitSystem = "imperial") {
  if (!size && size !== 0) return "-";

  if (unitSystem === "metric") {
    const converted = convertUnit(size, unit, "l");
    return `${converted.value.toFixed(1)} L`;
  } else {
    const converted = convertUnit(size, unit, "gal");
    return `${converted.value.toFixed(1)} gal`;
  }
}

// Ingredient amount formatting with smart unit selection
export function formatIngredientAmount(
  amount,
  unit,
  ingredientType,
  unitSystem = "imperial"
) {
  if (!amount && amount !== 0) return "-";

  // Determine if it's weight or volume based on unit
  const isWeight = ["g", "kg", "oz", "lb"].includes(unit);
  const isVolume = ["ml", "l", "floz", "cup", "pint", "quart", "gal"].includes(
    unit
  );

  if (isWeight) {
    return formatWeight(amount, unit, unitSystem);
  } else if (isVolume) {
    return formatVolume(amount, unit, unitSystem);
  }

  // For non-standard units (like 'pkg', 'tsp', 'tbsp'), return as-is with clean formatting
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return "-";

  // Clean up the display value
  const cleanAmount =
    numAmount % 1 === 0 ? numAmount.toString() : numAmount.toFixed(1);
  return `${cleanAmount} ${unit}`;
}

// Enhanced unit-aware ingredient formatting
export function formatIngredientAmountWithContext(
  amount,
  unit,
  ingredientType,
  unitSystem = "imperial"
) {
  if (!amount && amount !== 0) return "-";

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return "-";

  // Determine measurement type based on ingredient type and unit
  let measurementType = "weight";

  if (ingredientType === "hop") {
    measurementType = "hop_weight";
  } else if (
    ["ml", "l", "floz", "cup", "pint", "quart", "gal"].includes(unit)
  ) {
    measurementType = "volume";
  } else if (["pkg", "tsp", "tbsp", "each"].includes(unit)) {
    // Non-convertible units - format as-is
    const cleanAmount =
      numAmount % 1 === 0 ? numAmount.toString() : numAmount.toFixed(1);
    return `${cleanAmount} ${unit}`;
  }

  // For convertible units, potentially convert to user's preferred unit
  const targetUnit = getAppropriateUnit(unitSystem, measurementType, numAmount);

  // Only convert if it makes sense (don't convert small amounts to larger units)
  if (shouldConvertUnit(numAmount, unit, targetUnit)) {
    const converted = convertUnit(numAmount, unit, targetUnit);
    return formatValueStandalone(
      converted.value,
      converted.unit,
      measurementType
    );
  }

  // Otherwise format in original unit
  return formatValueStandalone(numAmount, unit, measurementType);
}

// Helper function to determine if unit conversion makes sense - FIXED
function shouldConvertUnit(amount, fromUnit, toUnit) {
  // Don't convert if same unit
  if (fromUnit === toUnit) return false;

  // Allow conversions between different unit systems
  const metricWeight = ["g", "kg"];
  const imperialWeight = ["oz", "lb"];
  const metricVolume = ["ml", "l"];
  const imperialVolume = ["gal", "floz", "cup", "pint", "quart"];

  // Always convert between different unit systems
  if (
    (metricWeight.includes(fromUnit) && imperialWeight.includes(toUnit)) ||
    (imperialWeight.includes(fromUnit) && metricWeight.includes(toUnit)) ||
    (metricVolume.includes(fromUnit) && imperialVolume.includes(toUnit)) ||
    (imperialVolume.includes(fromUnit) && metricVolume.includes(toUnit))
  ) {
    return true;
  }

  // Within same unit system, only convert small units to larger ones when it makes sense
  // Don't convert small amounts to larger units within the same system
  if (fromUnit === "g" && toUnit === "kg" && amount < 1000) return false;
  if (fromUnit === "oz" && toUnit === "lb" && amount < 16) return false;
  if (fromUnit === "ml" && toUnit === "l" && amount < 1000) return false;

  // NEVER convert larger units to smaller ones within same system
  if (fromUnit === "kg" && toUnit === "g") return false;
  if (fromUnit === "lb" && toUnit === "oz") return false;
  if (fromUnit === "l" && toUnit === "ml") return false;

  return true;
}

// Color formatting remains the same
export function getSrmColour(srm) {
  if (!srm || srm <= 0) return "#FFE699";
  if (srm > 0 && srm <= 2) return "#FFE699";
  if (srm > 2 && srm <= 3) return "#FFCA5A";
  if (srm > 3 && srm <= 4) return "#FFBF42";
  if (srm > 4 && srm <= 6) return "#FBB123";
  if (srm > 6 && srm <= 8) return "#F39C00";
  if (srm > 8 && srm <= 10) return "#E58500";
  if (srm > 10 && srm <= 13) return "#CF6900";
  if (srm > 13 && srm <= 17) return "#BB5100";
  if (srm > 17 && srm <= 20) return "#A13700";
  if (srm > 20 && srm <= 24) return "#8E2900";
  if (srm > 24 && srm <= 29) return "#701400";
  if (srm > 29 && srm <= 35) return "#600903";
  return "#3D0708";
}

// Description functions remain the same
export function getIbuDescription(ibu) {
  if (ibu < 5) return "No Perceived Bitterness";
  if (ibu < 10) return "Very Low Bitterness";
  if (ibu < 20) return "Low Bitterness";
  if (ibu < 30) return "Moderate Bitterness";
  if (ibu < 40) return "Strong Bitterness";
  if (ibu < 60) return "Very Strong Bitterness";
  return "Extremely Bitter";
}

export function getAbvDescription(abv) {
  if (abv < 3.0) return "Session Beer";
  if (abv < 5.0) return "Standard";
  if (abv < 7.5) return "High ABV";
  if (abv < 10.0) return "Very High ABV";
  return "Extremely High ABV";
}

export function getSrmDescription(srm) {
  if (srm < 2) return "Pale Straw";
  if (srm < 4) return "Straw";
  if (srm < 6) return "Pale Gold";
  if (srm < 8) return "Gold";
  if (srm < 10) return "Amber";
  if (srm < 13) return "Copper";
  if (srm < 17) return "Brown";
  if (srm < 20) return "Dark Brown";
  if (srm < 24) return "Black Brown";
  if (srm < 29) return "Black";
  return "Opaque Black";
}

export function getBalanceDescription(ratio) {
  if (ratio < 0.3) return "Very Malty";
  if (ratio < 0.6) return "Malty";
  if (ratio < 0.8) return "Balanced (Malt)";
  if (ratio < 1.2) return "Balanced";
  if (ratio < 1.5) return "Balanced (Hoppy)";
  if (ratio < 2.0) return "Hoppy";
  return "Very Hoppy";
}

// Helper function to get unit abbreviations for display
export function getUnitAbbreviation(unit) {
  const abbreviations = {
    gram: "g",
    grams: "g",
    kilogram: "kg",
    kilograms: "kg",
    ounce: "oz",
    ounces: "oz",
    pound: "lb",
    pounds: "lb",
    milliliter: "ml",
    milliliters: "ml",
    liter: "l",
    liters: "l",
    "fluid ounce": "floz",
    "fluid ounces": "floz",
    gallon: "gal",
    gallons: "gal",
    celsius: "C",
    fahrenheit: "F",
  };

  return abbreviations[unit.toLowerCase()] || unit;
}

// Export the standalone conversion utilities for use in other parts of the app
export const UnitConverter = {
  convertUnit,
  getAppropriateUnit,
  formatValue: formatValueStandalone,
};

// Backward compatibility - create a FrontendUnitConverter-like object
export const FrontendUnitConverter = {
  getAppropriateUnit,
  convertWeight: (amount, fromUnit, toUnit) =>
    convertUnit(amount, fromUnit, toUnit).value,
  convertVolume: (amount, fromUnit, toUnit) =>
    convertUnit(amount, fromUnit, toUnit).value,
  convertTemperature: (temp, fromUnit, toUnit) =>
    convertUnit(temp, fromUnit, toUnit).value,
  convertUnit,
};
