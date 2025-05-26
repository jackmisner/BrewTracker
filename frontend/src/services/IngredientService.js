import ApiService from "./api";

/**
 * Service class for managing ingredients business logic
 */
class IngredientService {
  constructor() {
    this.ingredientsCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch and group ingredients by type with caching
   */
  async fetchIngredients() {
    // Check cache first
    if (this.ingredientsCache && this.isCacheValid()) {
      return this.ingredientsCache;
    }

    try {
      const response = await ApiService.ingredients.getAll();
      const ingredientsData = Array.isArray(response.data)
        ? response.data
        : response.data.ingredients || [];

      const grouped = this.groupIngredientsByType(ingredientsData);

      // Update cache
      this.ingredientsCache = grouped;
      this.cacheTimestamp = Date.now();

      return grouped;
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      throw new Error("Failed to load ingredients");
    }
  }

  /**
   * Group ingredients by type
   */
  groupIngredientsByType(ingredients) {
    const grouped = {
      grain: [],
      hop: [],
      yeast: [],
      adjunct: [],
    };

    ingredients.forEach((ingredient) => {
      if (grouped[ingredient.type]) {
        grouped[ingredient.type].push(ingredient);
      } else {
        console.warn(
          `Ingredient type ${ingredient.type} not recognized. Skipping...`
        );
      }
    });

    return grouped;
  }

  /**
   * Create a new recipe ingredient with proper ID and metadata
   */
  createRecipeIngredient(type, ingredientData, availableIngredients) {
    const baseData = this.getIngredientMetadata(
      ingredientData.ingredient_id,
      type,
      availableIngredients
    );
    const ingredientName = this.getIngredientName(
      ingredientData.ingredient_id,
      type,
      availableIngredients
    );

    const newIngredient = {
      id: this.generateIngredientId(),
      ingredient_id: ingredientData.ingredient_id,
      name: ingredientName,
      type: type,
      amount: parseFloat(ingredientData.amount),
      unit: ingredientData.unit,
      use: ingredientData.use || "",
      time: parseInt(ingredientData.time) || 0,
      time_unit: ingredientData.time_unit || "",
      // Include calculation-specific fields
      ...baseData,
    };

    // Override with custom values if provided
    if (type === "hop" && ingredientData.alpha_acid) {
      newIngredient.alpha_acid = parseFloat(ingredientData.alpha_acid);
    }

    if (type === "grain" && ingredientData.color) {
      newIngredient.color = parseFloat(ingredientData.color);
    }

    return newIngredient;
  }

  /**
   * Scale ingredient amounts by a given factor
   */
  scaleIngredients(ingredients, scalingFactor) {
    return ingredients.map((ingredient) => ({
      ...ingredient,
      amount: (parseFloat(ingredient.amount) * scalingFactor).toFixed(2),
    }));
  }

  /**
   * Sort ingredients by type and usage
   */
  sortIngredients(ingredients) {
    const typeOrder = { grain: 1, hop: 2, yeast: 3, adjunct: 4 };
    const hopUseOrder = { boil: 1, whirlpool: 2, "dry hop": 3 };

    return [...ingredients].sort((a, b) => {
      const typeA = a.type || "";
      const typeB = b.type || "";
      const orderA = typeOrder[typeA] || 999;
      const orderB = typeOrder[typeB] || 999;

      // Sort by type first
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Type-specific sorting
      if (typeA === "grain") {
        return a.name.localeCompare(b.name);
      } else if (typeA === "hop") {
        const useA = (a.use || "").toLowerCase();
        const useB = (b.use || "").toLowerCase();
        const useOrderA = hopUseOrder[useA] || 999;
        const useOrderB = hopUseOrder[useB] || 999;

        if (useOrderA !== useOrderB) {
          return useOrderA - useOrderB;
        }

        // Sort by time (higher first)
        const timeA = parseFloat(a.time) || 0;
        const timeB = parseFloat(b.time) || 0;
        return timeB - timeA;
      } else if (typeA === "yeast") {
        return a.name.localeCompare(b.name);
      }

      return a.id - b.id;
    });
  }

  /**
   * Validate ingredient data before adding
   */
  validateIngredientData(type, ingredientData) {
    const errors = [];

    if (!ingredientData.ingredient_id) {
      errors.push("Ingredient selection is required");
    }

    if (!ingredientData.amount || parseFloat(ingredientData.amount) <= 0) {
      errors.push("Amount must be greater than 0");
    }

    if (!ingredientData.unit) {
      errors.push("Unit is required");
    }

    // Type-specific validation
    if (type === "hop") {
      if (!ingredientData.use) {
        errors.push("Hop usage is required");
      }
      if (
        ingredientData.use === "boil" &&
        (!ingredientData.time || parseInt(ingredientData.time) < 0)
      ) {
        errors.push("Boil time is required for boil hops");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format ingredients for API submission
   */
  formatIngredientsForApi(ingredients) {
    return ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      name: ing.name,
      type: ing.type,
      amount: parseFloat(ing.amount),
      unit: ing.unit,
      use: ing.use || "",
      time: parseInt(ing.time) || 0,
      potential: ing.potential,
      color: ing.color,
      alpha_acid: ing.alpha_acid,
      attenuation: ing.attenuation,
    }));
  }

  // Private helper methods
  getIngredientName(ingredientId, type, availableIngredients) {
    const ingredient = availableIngredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    return ingredient ? ingredient.name : "Unknown";
  }

  getIngredientMetadata(ingredientId, type, availableIngredients) {
    const ingredient = availableIngredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );

    if (!ingredient) return {};

    const metadata = {};

    if (type === "grain") {
      if (ingredient.potential) metadata.potential = ingredient.potential;
      if (ingredient.color) metadata.color = ingredient.color;
    } else if (type === "hop") {
      if (ingredient.alpha_acid) metadata.alpha_acid = ingredient.alpha_acid;
    } else if (type === "yeast") {
      if (ingredient.attenuation) metadata.attenuation = ingredient.attenuation;
    }

    return metadata;
  }

  generateIngredientId() {
    return `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  isCacheValid() {
    return (
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }

  /**
   * Clear the ingredients cache
   */
  clearCache() {
    this.ingredientsCache = null;
    this.cacheTimestamp = null;
  }
}

// Export as singleton
const ingredientServiceInstance = new IngredientService();
export default ingredientServiceInstance;
