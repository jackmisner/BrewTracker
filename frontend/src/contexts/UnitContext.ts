import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Services } from "../services";
import {
  UnitSystem,
  MeasurementType,
  UnitConversion,
  RecipeIngredient,
  IngredientUnit,
} from "../types";

// Unit option interface for common units
interface UnitOption {
  value: string;
  label: string;
  description: string;
}

// Batch size option interface
interface BatchSizeOption {
  value: number;
  label: string;
}

// Unit context value interface
interface UnitContextValue {
  // State
  unitSystem: UnitSystem;
  loading: boolean;
  error: string | null;

  // Actions
  updateUnitSystem: (newSystem: UnitSystem) => Promise<void>;
  setError: (error: string | null) => void;

  // Unit preferences
  getPreferredUnit: (unitType: MeasurementType) => string;

  // Conversions
  convertUnit: (
    value: number | string,
    fromUnit: string,
    toUnit: string
  ) => UnitConversion;
  convertForDisplay: (
    value: number | string,
    storageUnit: string,
    measurementType: MeasurementType
  ) => UnitConversion;
  convertForStorage: (
    value: number | string,
    displayUnit: string,
    measurementType: MeasurementType
  ) => UnitConversion;

  // Formatting
  formatValue: (
    value: number | string,
    unit: string,
    measurementType: MeasurementType,
    precision?: number
  ) => string;

  // Utilities
  getUnitSystemLabel: () => string;
  getUnitSystemIcon: () => string;
  getCommonUnits: (measurementType: MeasurementType) => UnitOption[];
  convertBatch: (
    ingredients: RecipeIngredient[],
    fromBatchSize: number,
    toBatchSize: number,
    fromUnit: string,
    toUnit: string
  ) => RecipeIngredient[];
  getTypicalBatchSizes: () => BatchSizeOption[];
}

// Provider props interface
interface UnitProviderProps {
  children: ReactNode;
}

const UnitContext = createContext<UnitContextValue | undefined>(undefined);

export const useUnits = (): UnitContextValue => {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error("useUnits must be used within a UnitProvider");
  }
  return context;
};

export const UnitProvider: React.FC<UnitProviderProps> = ({ children }) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial"); // Default to imperial
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's unit preference on mount
  useEffect(() => {
    const loadUnitPreference = async (): Promise<void> => {
      try {
        const settings = await Services.userSettings.getUserSettings();
        const preferredUnits: UnitSystem =
          settings.settings?.preferred_units || "imperial";
        setUnitSystem(preferredUnits);
      } catch (err) {
        console.warn("Failed to load unit preferences, using default:", err);
        setUnitSystem("imperial"); // Fallback to imperial
      } finally {
        setLoading(false);
      }
    };

    loadUnitPreference();
  }, []);

  // Update unit system and persist to backend
  const updateUnitSystem = async (newSystem: UnitSystem): Promise<void> => {
    const previousSystem = unitSystem; // Store the previous value
    try {
      setUnitSystem(newSystem);

      // Persist to backend
      await Services.userSettings.updateSettings({
        preferred_units: newSystem,
      });
    } catch (err) {
      console.error("Failed to update unit system:", err);
      setError("Failed to save unit preference");
      // Revert on error using the stored previous value
      setUnitSystem(previousSystem);
    }
  };

  /**
   * Get preferred unit for different ingredient/measurement types
   */
  const getPreferredUnit = (unitType: MeasurementType): string => {
    switch (unitType) {
      case "weight":
        return unitSystem === "metric" ? "kg" : "lb";
      case "hop_weight":
        return unitSystem === "metric" ? "g" : "oz";
      case "yeast":
        return "pkg"; // Universal - packages are standard
      case "other":
        return unitSystem === "metric" ? "g" : "oz";
      case "volume":
        return unitSystem === "metric" ? "l" : "gal";
      case "temperature":
        return unitSystem === "metric" ? "c" : "f";
      default:
        return unitSystem === "metric" ? "kg" : "lb";
    }
  };

  /**
   * Convert a value from one unit to another
   */
  const convertUnit = (
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

  /**
   * Convert a value from storage unit to display unit
   */
  const convertForDisplay = (
    value: number | string,
    storageUnit: string,
    measurementType: MeasurementType
  ): UnitConversion => {
    const preferredUnit = getPreferredUnit(measurementType);
    return convertUnit(value, storageUnit, preferredUnit);
  };

  /**
   * Convert a value from display unit to storage unit
   */
  const convertForStorage = (
    value: number | string,
    displayUnit: string,
    measurementType: MeasurementType
  ): UnitConversion => {
    // Storage units are typically:
    // - Volume: gallons (gal)
    // - Weight: pounds (lb) for fermentables, grams (g) for hops/other
    // - Temperature: Fahrenheit (f)

    let storageUnit: string;
    switch (measurementType) {
      case "volume":
        storageUnit = "gal";
        break;
      case "weight":
        storageUnit = "lb";
        break;
      case "hop_weight":
      case "other":
        storageUnit = "g";
        break;
      case "temperature":
        storageUnit = "f";
        break;
      default:
        storageUnit = displayUnit; // No conversion if type unknown
    }

    return convertUnit(value, displayUnit, storageUnit);
  };

  /**
   * Format a value with its unit for display
   */
  const formatValue = (
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
    } else if (
      measurementType === "weight" ||
      measurementType === "hop_weight"
    ) {
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

  /**
   * Get display label for unit system
   */
  const getUnitSystemLabel = (): string => {
    return unitSystem === "metric" ? "Metric" : "Imperial";
  };

  /**
   * Get unit system icon
   */
  const getUnitSystemIcon = (): string => {
    return unitSystem === "metric" ? "🌍" : "🇺🇸";
  };

  /**
   * Get common units for a measurement type
   */
  const getCommonUnits = (measurementType: MeasurementType): UnitOption[] => {
    switch (measurementType) {
      case "weight":
        return unitSystem === "metric"
          ? [
              { value: "kg", label: "kg", description: "Kilograms" },
              { value: "g", label: "g", description: "Grams" },
            ]
          : [
              { value: "lb", label: "lb", description: "Pounds" },
              { value: "oz", label: "oz", description: "Ounces" },
            ];

      case "hop_weight":
        return unitSystem === "metric"
          ? [
              { value: "g", label: "g", description: "Grams" },
              { value: "oz", label: "oz", description: "Ounces" },
            ]
          : [
              { value: "oz", label: "oz", description: "Ounces" },
              { value: "g", label: "g", description: "Grams" },
            ];

      case "volume":
        return unitSystem === "metric"
          ? [
              { value: "l", label: "L", description: "Liters" },
              { value: "ml", label: "mL", description: "Milliliters" },
            ]
          : [
              { value: "gal", label: "gal", description: "Gallons" },
              { value: "qt", label: "qt", description: "Quarts" },
            ];

      case "temperature":
        return unitSystem === "metric"
          ? [{ value: "c", label: "°C", description: "Celsius" }]
          : [{ value: "f", label: "°F", description: "Fahrenheit" }];

      default:
        return [];
    }
  };

  /**
   * Batch conversion helper for recipe scaling
   */
  const convertBatch = (
    ingredients: RecipeIngredient[],
    fromBatchSize: number,
    toBatchSize: number,
    fromUnit: string,
    toUnit: string
  ): RecipeIngredient[] => {
    const scalingFactor = toBatchSize / fromBatchSize;

    return ingredients.map((ingredient) => {
      let convertedAmount =
        parseFloat(ingredient.amount.toString()) * scalingFactor;
      let convertedUnit: IngredientUnit = ingredient.unit;

      // Convert units if needed
      if (fromUnit !== toUnit) {
        const converted = convertUnit(convertedAmount, ingredient.unit, toUnit);
        convertedAmount = converted.value;
        convertedUnit = converted.unit as IngredientUnit;
      }

      return {
        ...ingredient,
        amount: parseFloat(convertedAmount.toFixed(2)),
        unit: convertedUnit,
      };
    });
  };

  /**
   * Get typical batch sizes for the current unit system
   */
  const getTypicalBatchSizes = (): BatchSizeOption[] => {
    if (unitSystem === "metric") {
      return [
        { value: 19, label: "19 L (5 gal)" },
        { value: 23, label: "23 L (6 gal)" },
        { value: 38, label: "38 L (10 gal)" },
      ];
    } else {
      return [
        { value: 5, label: "5 gal" },
        { value: 6, label: "6 gal" },
        { value: 10, label: "10 gal" },
      ];
    }
  };

  const contextValue: UnitContextValue = {
    // State
    unitSystem,
    loading,
    error,

    // Actions
    updateUnitSystem,
    setError,

    // Unit preferences
    getPreferredUnit,

    // Conversions
    convertUnit,
    convertForDisplay,
    convertForStorage,

    // Formatting
    formatValue,

    // Utilities
    getUnitSystemLabel,
    getUnitSystemIcon,
    getCommonUnits,
    convertBatch,
    getTypicalBatchSizes,
  };

  if (loading) {
    return React.createElement(
      UnitContext.Provider,
      { value: { ...contextValue, loading: true } },
      children
    );
  }

  return React.createElement(
    UnitContext.Provider,
    { value: contextValue },
    children
  );
};

export default UnitContext;
