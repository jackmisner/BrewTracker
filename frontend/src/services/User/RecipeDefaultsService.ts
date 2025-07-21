import { useUnits } from "../../contexts/UnitContext";

// Service-specific interfaces
interface DefaultRecipeData {
  name: string;
  style: string;
  batch_size: number;
  description: string;
  is_public: boolean;
  boil_time: number;
  efficiency: number;
  notes: string;
}

interface SuggestedUnits {
  grain: string;
  hop: string;
  yeast: string;
  other: string;
  volume: string;
  temperature: string;
}

interface BatchSizeOption {
  value: number;
  label: string;
  description: string;
}

interface IngredientAmount {
  amount: string;
  unit: string;
}

type UnitSystem = "metric" | "imperial";
type IngredientType = "grain" | "hop" | "yeast" | "other";

/**
 * Service to provide appropriate default values for new recipes
 * based on user's unit preferences
 */
class RecipeDefaultsService {
  /**
   * Get default batch size for user's unit system
   */
  static getDefaultBatchSize(unitSystem: UnitSystem): number {
    if (unitSystem === "metric") {
      return 19.0; // 19 liters - standard metric homebrew batch
    } else {
      return 5.0; // 5 gallons - standard imperial homebrew batch
    }
  }

  /**
   * Get default efficiency for new recipes
   */
  static getDefaultEfficiency(): number {
    return 75.0; // 75% is a reasonable default for most homebrew setups
  }

  /**
   * Get default boil time
   */
  static getDefaultBoilTime(): number {
    return 60; // 60 minutes is standard
  }

  /**
   * Get complete default recipe data based on unit system
   */
  static getDefaultRecipeData(
    unitSystem: UnitSystem = "imperial"
  ): DefaultRecipeData {
    return {
      name: "",
      style: "",
      batch_size: this.getDefaultBatchSize(unitSystem),
      description: "",
      is_public: false,
      boil_time: this.getDefaultBoilTime(),
      efficiency: this.getDefaultEfficiency(),
      notes: "",
    };
  }

  /**
   * Get suggested units for different ingredient types based on unit system
   */
  static getSuggestedUnits(unitSystem: UnitSystem): SuggestedUnits {
    if (unitSystem === "metric") {
      return {
        grain: "kg", // Grains in kilograms
        hop: "g", // Hops in grams
        yeast: "pkg", // Yeast in packages (universal)
        other: "g", // Other ingredients in grams
        volume: "l", // Volume in liters
        temperature: "c", // Temperature in Celsius
      };
    } else {
      return {
        grain: "lb", // Grains in pounds
        hop: "oz", // Hops in ounces
        yeast: "pkg", // Yeast in packages (universal)
        other: "oz", // Other ingredients in ounces
        volume: "gal", // Volume in gallons
        temperature: "f", // Temperature in Fahrenheit
      };
    }
  }

  /**
   * Get typical batch sizes for the unit system (for dropdowns/suggestions)
   */
  static getTypicalBatchSizes(unitSystem: UnitSystem): BatchSizeOption[] {
    if (unitSystem === "metric") {
      return [
        {
          value: 10,
          label: "10 L (Small batch)",
          description: "Small test batch",
        },
        {
          value: 19,
          label: "19 L (5 gal)",
          description: "Standard homebrew batch",
        },
        { value: 23, label: "23 L (6 gal)", description: "Large batch" },
        { value: 38, label: "38 L (10 gal)", description: "Very large batch" },
      ];
    } else {
      return [
        { value: 2.5, label: "2.5 gal", description: "Small test batch" },
        { value: 5, label: "5 gal", description: "Standard homebrew batch" },
        { value: 6, label: "6 gal", description: "Large batch" },
        { value: 10, label: "10 gal", description: "Very large batch" },
      ];
    }
  }

  /**
   * Get appropriate default amounts for ingredients based on batch size and unit system
   */
  static getDefaultIngredientAmounts(
    ingredientType: IngredientType,
    batchSize: number,
    unitSystem: UnitSystem
  ): IngredientAmount {
    const batchSizeInGallons =
      unitSystem === "metric" ? batchSize / 3.78541 : batchSize;

    switch (ingredientType) {
      case "grain":
        // Rough estimate: 1.5-2 lbs per gallon for base malt
        const grainAmount = batchSizeInGallons * 1.75;
        if (unitSystem === "metric") {
          return {
            amount: (grainAmount / 2.20462).toFixed(1), // Convert to kg
            unit: "kg",
          };
        } else {
          return {
            amount: grainAmount.toFixed(1),
            unit: "lb",
          };
        }

      case "hop":
        // Rough estimate: 1 oz per 5 gallons for moderate bitterness
        const hopAmount = batchSizeInGallons * 0.2;
        if (unitSystem === "metric") {
          return {
            amount: (hopAmount * 28.3495).toFixed(0), // Convert to grams
            unit: "g",
          };
        } else {
          return {
            amount: hopAmount.toFixed(2),
            unit: "oz",
          };
        }

      case "yeast":
        return {
          amount: "1",
          unit: "pkg",
        };

      default:
        // For other ingredients, provide small amounts
        if (unitSystem === "metric") {
          return {
            amount: "10",
            unit: "g",
          };
        } else {
          return {
            amount: "0.5",
            unit: "oz",
          };
        }
    }
  }

  /**
   * Get brewing stage recommendations based on unit system
   */
  static getBrewingStageDefaults(unitSystem: UnitSystem): {
    mashTemperature: { value: number; unit: string };
    spargeTemperature: { value: number; unit: string };
    fermentationTemperature: { value: number; unit: string };
  } {
    if (unitSystem === "metric") {
      return {
        mashTemperature: { value: 65, unit: "°C" },
        spargeTemperature: { value: 75, unit: "°C" },
        fermentationTemperature: { value: 20, unit: "°C" },
      };
    } else {
      return {
        mashTemperature: { value: 149, unit: "°F" },
        spargeTemperature: { value: 167, unit: "°F" },
        fermentationTemperature: { value: 68, unit: "°F" },
      };
    }
  }

  /**
   * Get hop addition timing defaults
   */
  static getHopTimingDefaults(): { timing: number; label: string }[] {
    return [
      { timing: 60, label: "60 min (Bittering)" },
      { timing: 20, label: "20 min (Flavor)" },
      { timing: 5, label: "5 min (Aroma)" },
      { timing: 0, label: "Flame out" },
    ];
  }

  /**
   * Get default grain percentages for common recipe types
   */
  static getGrainPercentageDefaults(): {
    [key: string]: { base: number; specialty: number; adjunct: number };
  } {
    return {
      ale: { base: 85, specialty: 10, adjunct: 5 },
      lager: { base: 90, specialty: 8, adjunct: 2 },
      wheat: { base: 50, specialty: 30, adjunct: 20 },
      stout: { base: 70, specialty: 25, adjunct: 5 },
      ipa: { base: 80, specialty: 15, adjunct: 5 },
    };
  }
}

/**
 * React hook to get recipe defaults with current unit context
 */
export const useRecipeDefaults = () => {
  const { unitSystem } = useUnits();

  return {
    getDefaultRecipeData: (): DefaultRecipeData =>
      RecipeDefaultsService.getDefaultRecipeData(unitSystem as UnitSystem),
    getDefaultBatchSize: (): number =>
      RecipeDefaultsService.getDefaultBatchSize(unitSystem as UnitSystem),
    getSuggestedUnits: (): SuggestedUnits =>
      RecipeDefaultsService.getSuggestedUnits(unitSystem as UnitSystem),
    getTypicalBatchSizes: (): BatchSizeOption[] =>
      RecipeDefaultsService.getTypicalBatchSizes(unitSystem as UnitSystem),
    getDefaultIngredientAmounts: (
      ingredientType: IngredientType,
      batchSize: number
    ): IngredientAmount =>
      RecipeDefaultsService.getDefaultIngredientAmounts(
        ingredientType,
        batchSize,
        unitSystem as UnitSystem
      ),
    getBrewingStageDefaults: () =>
      RecipeDefaultsService.getBrewingStageDefaults(unitSystem as UnitSystem),
    getHopTimingDefaults: () => RecipeDefaultsService.getHopTimingDefaults(),
    getGrainPercentageDefaults: () =>
      RecipeDefaultsService.getGrainPercentageDefaults(),
  };
};

export default RecipeDefaultsService;
