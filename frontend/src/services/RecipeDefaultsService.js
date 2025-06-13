import { useUnits } from "../contexts/UnitContext";

/**
 * Service to provide appropriate default values for new recipes
 * based on user's unit preferences
 */
class RecipeDefaultsService {
  /**
   * Get default batch size for user's unit system
   */
  static getDefaultBatchSize(unitSystem) {
    if (unitSystem === "metric") {
      return 19.0; // 19 liters - standard metric homebrew batch
    } else {
      return 5.0; // 5 gallons - standard imperial homebrew batch
    }
  }

  /**
   * Get default efficiency for new recipes
   */
  static getDefaultEfficiency() {
    return 75.0; // 75% is a reasonable default for most homebrew setups
  }

  /**
   * Get default boil time
   */
  static getDefaultBoilTime() {
    return 60; // 60 minutes is standard
  }

  /**
   * Get complete default recipe data based on unit system
   */
  static getDefaultRecipeData(unitSystem = "imperial") {
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
  static getSuggestedUnits(unitSystem) {
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
  static getTypicalBatchSizes(unitSystem) {
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
  static getDefaultIngredientAmounts(ingredientType, batchSize, unitSystem) {
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
}

/**
 * React hook to get recipe defaults with current unit context
 */
export const useRecipeDefaults = () => {
  const { unitSystem } = useUnits();

  return {
    getDefaultRecipeData: () =>
      RecipeDefaultsService.getDefaultRecipeData(unitSystem),
    getDefaultBatchSize: () =>
      RecipeDefaultsService.getDefaultBatchSize(unitSystem),
    getSuggestedUnits: () =>
      RecipeDefaultsService.getSuggestedUnits(unitSystem),
    getTypicalBatchSizes: () =>
      RecipeDefaultsService.getTypicalBatchSizes(unitSystem),
    getDefaultIngredientAmounts: (ingredientType, batchSize) =>
      RecipeDefaultsService.getDefaultIngredientAmounts(
        ingredientType,
        batchSize,
        unitSystem
      ),
  };
};

export default RecipeDefaultsService;
