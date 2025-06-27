// Standalone unit conversion utilities that can be used outside of React components
// These mirror the conversion logic from UnitContext but don't require React hooks

import {
  UnitSystem,
  WeightUnit,
  VolumeUnit,
  TemperatureUnit,
  MeasurementType,
  UnitConversion,
  IngredientType,
} from '../types';

// Unit conversion functions (standalone versions)
export const convertUnit = (
  value: number | string,
  fromUnit: string,
  toUnit: string
): UnitConversion => {
  const numValue = parseFloat(value.toString());
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
export const getAppropriateUnit = (
  unitSystem: UnitSystem,
  measurementType: MeasurementType,
  amount: number = 0
): string => {
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
export const formatValueStandalone = (
  value: number | string,
  unit: string,
  measurementType: MeasurementType,
  precision: number = 2
): string => {
  const numValue = parseFloat(value.toString());
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
export function formatGravity(gravity: number | string | null | undefined): string {
  if (!gravity) return "1.000";
  const numGravity = parseFloat(gravity.toString());
  return isNaN(numGravity) ? "1.000" : numGravity.toFixed(3);
}

export function formatAbv(abv: number | string | null | undefined): string {
  if (!abv) return "0.0%";
  const numAbv = parseFloat(abv.toString());
  return isNaN(numAbv) ? "0.0%" : `${numAbv.toFixed(1)}%`;
}

export function formatIbu(ibu: number | string | null | undefined): string {
  if (!ibu) return "0";
  const numIbu = parseFloat(ibu.toString());
  return isNaN(numIbu) ? "0" : Math.round(numIbu).toString();
}

export function formatSrm(srm: number | string | null | undefined): string {
  if (!srm) return "0.0";
  const numSrm = parseFloat(srm.toString());
  return isNaN(numSrm) ? "0.0" : numSrm.toFixed(1);
}

// Unit-aware formatting functions
export function formatWeight(
  amount: number | string | null | undefined,
  unit: WeightUnit | string,
  unitSystem: UnitSystem = "imperial"
): string {
  if (!amount && amount !== 0) return "-";

  const numAmount = parseFloat(amount.toString());
  if (isNaN(numAmount)) return "-";

  // Only convert if we're crossing unit systems
  const metricWeight = ["g", "kg"];
  const imperialWeight = ["oz", "lb"];

  const needsConversion =
    (metricWeight.includes(unit) && unitSystem === "imperial") ||
    (imperialWeight.includes(unit) && unitSystem === "metric");

  if (needsConversion) {
    const targetUnit = getAppropriateUnit(unitSystem, "weight", numAmount);
    const converted = convertUnit(numAmount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "weight");
  } else {
    // Stay in the same unit system, only convert to larger units if amount is large
    let targetUnit = unit;
    if (unit === "g" && numAmount >= 1000) {
      targetUnit = "kg";
    } else if (unit === "oz" && numAmount >= 16) {
      targetUnit = "lb";
    }

    const converted = convertUnit(numAmount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "weight");
  }
}

export function formatVolume(
  amount: number | string | null | undefined,
  unit: VolumeUnit | string,
  unitSystem: UnitSystem = "imperial"
): string {
  if (!amount && amount !== 0) return "-";

  const numAmount = parseFloat(amount.toString());
  if (isNaN(numAmount)) return "-";

  // Only convert if we're crossing unit systems
  const metricVolume = ["ml", "l"];
  const imperialVolume = ["gal", "floz", "cup", "pint", "quart"];

  const needsConversion =
    (metricVolume.includes(unit) && unitSystem === "imperial") ||
    (imperialVolume.includes(unit) && unitSystem === "metric");

  if (needsConversion) {
    const targetUnit = getAppropriateUnit(unitSystem, "volume", numAmount);
    const converted = convertUnit(numAmount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "volume");
  } else {
    // Stay in the same unit system, only convert to larger units if amount is large
    let targetUnit = unit;
    if (unit === "ml" && numAmount >= 1000) {
      targetUnit = "l";
    } else if (unit === "l" && numAmount === 0) {
      // Special case: 0 liters should be displayed as 0 ml
      targetUnit = "ml";
    }
    // Note: We don't auto-convert oz/cup/pint/quart to gal as those are different use cases

    const converted = convertUnit(numAmount, unit, targetUnit);
    return formatValueStandalone(converted.value, converted.unit, "volume");
  }
}

export function formatTemperature(
  temp: number | string | null | undefined,
  unit: TemperatureUnit | string,
  unitSystem: UnitSystem = "imperial"
): string {
  if (!temp && temp !== 0) return "-";

  const numTemp = parseFloat(temp.toString());
  if (isNaN(numTemp)) return "-";

  const targetUnit = getAppropriateUnit(unitSystem, "temperature");
  const converted = convertUnit(numTemp, unit, targetUnit);

  return `${Math.round(converted.value)}°${converted.unit.toUpperCase()}`;
}

// Batch size specific formatting
export function formatBatchSize(
  size: number | string | null | undefined,
  unit: string = "gal",
  unitSystem: UnitSystem = "imperial"
): string {
  if (!size && size !== 0) return "-";

  const numSize = parseFloat(size.toString());
  if (isNaN(numSize)) return "-";

  if (unitSystem === "metric") {
    const converted = convertUnit(numSize, unit, "l");
    return `${converted.value.toFixed(1)} L`;
  } else {
    const converted = convertUnit(numSize, unit, "gal");
    return `${converted.value.toFixed(1)} gal`;
  }
}

// Ingredient amount formatting with smart unit selection
export function formatIngredientAmount(
  amount: number | string | null | undefined,
  unit: string,
  ingredientType: IngredientType | string,
  unitSystem: UnitSystem = "imperial"
): string {
  if (!amount && amount !== 0) return "-";

  const numAmount = parseFloat(amount.toString());
  if (isNaN(numAmount)) return "-";

  // Determine if it's weight or volume based on unit
  const isWeight = ["g", "kg", "oz", "lb"].includes(unit);
  const isVolume = ["ml", "l", "floz", "cup", "pint", "quart", "gal"].includes(unit);

  if (isWeight) {
    // Use hop-specific formatting for hops
    if (ingredientType === "hop") {
      return formatWeight(numAmount, unit as WeightUnit, unitSystem);
    }
    return formatWeight(numAmount, unit as WeightUnit, unitSystem);
  } else if (isVolume) {
    return formatVolume(numAmount, unit as VolumeUnit, unitSystem);
  }

  // For non-standard units (like 'pkg', 'tsp', 'tbsp'), return as-is with clean formatting
  // Clean up the display value
  const cleanAmount =
    numAmount % 1 === 0 ? numAmount.toString() : numAmount.toFixed(1);
  return `${cleanAmount} ${unit}`;
}

// Enhanced unit-aware ingredient formatting
export function formatIngredientAmountWithContext(
  amount: number | string | null | undefined,
  unit: string,
  ingredientType: IngredientType | string,
  unitSystem: UnitSystem = "imperial"
): string {
  if (!amount && amount !== 0) return "-";

  const numAmount = parseFloat(amount.toString());
  if (isNaN(numAmount)) return "-";

  // Determine measurement type based on ingredient type and unit
  let measurementType: MeasurementType = "weight";

  if (ingredientType === "hop") {
    measurementType = "hop_weight";
  } else if (["ml", "l", "floz", "cup", "pint", "quart", "gal"].includes(unit)) {
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
    return formatValueStandalone(converted.value, converted.unit, measurementType);
  }

  // Otherwise format in original unit
  return formatValueStandalone(numAmount, unit, measurementType);
}

// Helper function to determine if unit conversion makes sense - FIXED
function shouldConvertUnit(amount: number, fromUnit: string, toUnit: string): boolean {
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


export function getSrmColour(srm: number | string | null | undefined): string {
  if (!srm) return "#FFE699";
  const numSrm = parseFloat(srm.toString());
  if (isNaN(numSrm) || numSrm <= 0) return "#FFE699";
  
  if (numSrm > 0 && numSrm <= 2) return "#FFE699";
  if (numSrm > 2 && numSrm <= 3) return "#FFCA5A";
  if (numSrm > 3 && numSrm <= 4) return "#FFBF42";
  if (numSrm > 4 && numSrm <= 6) return "#FBB123";
  if (numSrm > 6 && numSrm <= 8) return "#F39C00";
  if (numSrm > 8 && numSrm <= 10) return "#E58500";
  if (numSrm > 10 && numSrm <= 13) return "#CF6900";
  if (numSrm > 13 && numSrm <= 17) return "#BB5100";
  if (numSrm > 17 && numSrm <= 20) return "#A13700";
  if (numSrm > 20 && numSrm <= 24) return "#8E2900";
  if (numSrm > 24 && numSrm <= 29) return "#701400";
  if (numSrm > 29 && numSrm <= 35) return "#600903";
  return "#3D0708";
}


export function getIbuDescription(ibu: number | string | null | undefined): string {
  if (!ibu) return "No Perceived Bitterness";
  const numIbu = parseFloat(ibu.toString());
  if (isNaN(numIbu)) return "No Perceived Bitterness";
  
  if (numIbu < 5) return "No Perceived Bitterness";
  if (numIbu < 10) return "Very Low Bitterness";
  if (numIbu < 20) return "Low Bitterness";
  if (numIbu < 30) return "Moderate Bitterness";
  if (numIbu < 40) return "Strong Bitterness";
  if (numIbu < 60) return "Very Strong Bitterness";
  return "Extremely Bitter";
}

export function getAbvDescription(abv: number | string | null | undefined): string {
  if (!abv) return "Session Beer";
  const numAbv = parseFloat(abv.toString());
  if (isNaN(numAbv)) return "Session Beer";
  
  if (numAbv < 3.0) return "Session Beer";
  if (numAbv < 5.0) return "Standard";
  if (numAbv < 7.5) return "High ABV";
  if (numAbv < 10.0) return "Very High ABV";
  return "Extremely High ABV";
}

export function getSrmDescription(srm: number | string | null | undefined): string {
  if (!srm) return "Pale Straw";
  const numSrm = parseFloat(srm.toString());
  if (isNaN(numSrm)) return "Pale Straw";
  
  if (numSrm < 2) return "Pale Straw";
  if (numSrm < 4) return "Straw";
  if (numSrm < 6) return "Pale Gold";
  if (numSrm < 8) return "Gold";
  if (numSrm < 10) return "Amber";
  if (numSrm < 13) return "Copper";
  if (numSrm < 17) return "Brown";
  if (numSrm < 20) return "Dark Brown";
  if (numSrm < 24) return "Black Brown";
  if (numSrm < 29) return "Black";
  return "Opaque Black";
}

export function getBalanceDescription(ratio: number | string | null | undefined): string {
  if (!ratio) return "Balanced";
  const numRatio = parseFloat(ratio.toString());
  if (isNaN(numRatio)) return "Balanced";
  
  if (numRatio < 0.3) return "Very Malty";
  if (numRatio < 0.6) return "Malty";
  if (numRatio < 0.8) return "Balanced (Malt)";
  if (numRatio < 1.2) return "Balanced";
  if (numRatio < 1.5) return "Balanced (Hoppy)";
  if (numRatio < 2.0) return "Hoppy";
  return "Very Hoppy";
}

// Helper function to get unit abbreviations for display
export function getUnitAbbreviation(unit: string): string {
  const abbreviations: Record<string, string> = {
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
  convertWeight: (amount: number | string, fromUnit: string, toUnit: string): number =>
    convertUnit(amount, fromUnit, toUnit).value,
  convertVolume: (amount: number | string, fromUnit: string, toUnit: string): number =>
    convertUnit(amount, fromUnit, toUnit).value,
  convertTemperature: (temp: number | string, fromUnit: string, toUnit: string): number =>
    convertUnit(temp, fromUnit, toUnit).value,
  convertUnit,
};