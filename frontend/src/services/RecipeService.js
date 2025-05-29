import ApiService from "./api";

/**
 * Service class for managing recipe business logic
 */
class RecipeService {
  /**
   * Fetch recipe with enhanced error handling and data processing
   */
  async fetchRecipe(recipeId) {
    try {
      const response = await ApiService.recipes.getById(recipeId);
      return this.processRecipeData(response.data);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      throw this.createRecipeError("Failed to load recipe", error);
    }
  }

  /**
   * Save recipe with comprehensive validation and formatting
   */
  async saveRecipe(recipeId, recipeData, ingredients, metrics) {
    try {
      // Validate recipe data
      const validation = this.validateRecipeData(recipeData, ingredients);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Prepare recipe data for API
      const formattedData = this.formatRecipeForApi(
        recipeData,
        ingredients,
        metrics
      );

      let response;
      if (recipeId) {
        response = await ApiService.recipes.update(recipeId, formattedData);
      } else {
        response = await ApiService.recipes.create(formattedData);
      }

      if (!response.data) {
        throw new Error("Invalid server response");
      }

      return this.processRecipeData(response.data);
    } catch (error) {
      console.error("Error saving recipe:", error);
      throw this.createRecipeError("Failed to save recipe", error);
    }
  }

  /**
   * Clone recipe with proper version handling
   */
  async cloneRecipe(recipeId) {
    try {
      const response = await ApiService.recipes.clone(recipeId);
      return this.processRecipeData(response.data);
    } catch (error) {
      console.error("Error cloning recipe:", error);
      throw this.createRecipeError("Failed to clone recipe", error);
    }
  }

  /**
   * Scale recipe to new batch size
   */
  scaleRecipe(recipe, ingredients, newBatchSize) {
    const currentBatchSize = recipe.batch_size;
    const scalingFactor = newBatchSize / currentBatchSize;

    return {
      scaledRecipe: {
        ...recipe,
        batch_size: newBatchSize,
      },
      scalingFactor,
    };
  }

  /**
   * Calculate recipe statistics
   */
  async calculateRecipeStats(recipeId) {
    try {
      const response = await ApiService.recipes.calculateMetrics(recipeId);
      return response.data;
    } catch (error) {
      console.error("Error calculating recipe stats:", error);
      // Return default stats if calculation fails
      return {
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      };
    }
  }

  /**
   * Get recipe version history
   */
  async getVersionHistory(recipeId) {
    try {
      const response = await ApiService.recipes.getVersionHistory(recipeId);
      return response.data;
    } catch (error) {
      console.error("Error fetching version history:", error);
      return null;
    }
  }

  /**
   * Validate recipe data comprehensively
   */
  validateRecipeData(recipeData, ingredients = []) {
    const errors = [];

    // Basic recipe validation
    if (!recipeData.name || recipeData.name.trim().length === 0) {
      errors.push("Recipe name is required");
    }

    if (!recipeData.batch_size || recipeData.batch_size <= 0) {
      errors.push("Batch size must be greater than 0");
    }

    if (
      recipeData.efficiency &&
      (recipeData.efficiency < 0 || recipeData.efficiency > 100)
    ) {
      errors.push("Efficiency must be between 0 and 100%");
    }

    if (recipeData.boil_time && recipeData.boil_time < 0) {
      errors.push("Boil time cannot be negative");
    }

    // Ingredient validation
    if (ingredients.length === 0) {
      errors.push("At least one ingredient is required");
    }

    // Check for at least one grain (base malt)
    const grains = ingredients.filter((ing) => ing.type === "grain");
    if (grains.length === 0) {
      errors.push("At least one grain/malt is required");
    }

    // Check for yeast
    const yeasts = ingredients.filter((ing) => ing.type === "yeast");
    if (yeasts.length === 0) {
      errors.push("Yeast is required for fermentation");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format recipe data for API submission
   */
  formatRecipeForApi(recipeData, ingredients, metrics) {
    const formattedRecipe = {
      name: recipeData.name.trim(),
      style: recipeData.style?.trim() || "",
      batch_size: parseFloat(recipeData.batch_size),
      description: recipeData.description?.trim() || "",
      is_public: Boolean(recipeData.is_public),
      boil_time: recipeData.boil_time ? parseInt(recipeData.boil_time) : null,
      efficiency: recipeData.efficiency
        ? parseFloat(recipeData.efficiency)
        : null,
      notes: recipeData.notes?.trim() || "",
    };

    // Add metrics if available
    if (metrics) {
      formattedRecipe.estimated_og = metrics.og;
      formattedRecipe.estimated_fg = metrics.fg;
      formattedRecipe.estimated_abv = metrics.abv;
      formattedRecipe.estimated_ibu = metrics.ibu;
      formattedRecipe.estimated_srm = metrics.srm;
    }

    // Format ingredients
    if (ingredients && ingredients.length > 0) {
      formattedRecipe.ingredients = ingredients.map((ing) => ({
        ingredient_id: ing.ingredient_id,
        name: ing.name,
        type: ing.type,
        amount: parseFloat(ing.amount),
        unit: ing.unit,
        use: ing.use || "",
        time: parseInt(ing.time) || 0,
        potential: ing.potential,
        color: ing.color,
        grain_type: ing.grain_type,
        alpha_acid: ing.alpha_acid,
        attenuation: ing.attenuation,
      }));
    }

    return formattedRecipe;
  }

  /**
   * Process recipe data from API response
   */
  processRecipeData(rawRecipe) {
    if (!rawRecipe) return null;

    // Ensure all required fields have defaults
    const processedRecipe = {
      recipe_id: rawRecipe.recipe_id || rawRecipe._id || rawRecipe.id,
      name: rawRecipe.name || "",
      style: rawRecipe.style || "",
      batch_size: parseFloat(rawRecipe.batch_size) || 5,
      description: rawRecipe.description || "",
      is_public: Boolean(rawRecipe.is_public),
      boil_time: rawRecipe.boil_time ? parseInt(rawRecipe.boil_time) : 60,
      efficiency: rawRecipe.efficiency ? parseFloat(rawRecipe.efficiency) : 75,
      notes: rawRecipe.notes || "",
      created_at: rawRecipe.created_at,
      updated_at: rawRecipe.updated_at,
      version: rawRecipe.version || 1,
      parent_recipe_id: rawRecipe.parent_recipe_id,
      estimated_og: rawRecipe.estimated_og,
      estimated_fg: rawRecipe.estimated_fg,
      estimated_abv: rawRecipe.estimated_abv,
      estimated_ibu: rawRecipe.estimated_ibu,
      estimated_srm: rawRecipe.estimated_srm,
      ingredients: rawRecipe.ingredients || [],
    };

    // Process ingredients to ensure consistent ID format
    if (processedRecipe.ingredients.length > 0) {
      processedRecipe.ingredients = processedRecipe.ingredients.map(
        (ingredient) => ({
          ...ingredient,
          id:
            ingredient.id ||
            (ingredient._id
              ? String(ingredient._id)
              : ingredient.ingredient_id
              ? `ing-${String(ingredient.ingredient_id)}`
              : `existing-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`),
        })
      );
    }

    return processedRecipe;
  }

  /**
   * Create standardized recipe error
   */
  createRecipeError(message, originalError) {
    const error = new Error(message);
    error.originalError = originalError;
    error.isRecipeError = true;

    // Extract more specific error message if available
    if (originalError?.response?.data?.error) {
      error.message = `${message}: ${originalError.response.data.error}`;
    } else if (originalError?.message) {
      error.message = `${message}: ${originalError.message}`;
    }

    return error;
  }

  /**
   * Get recipe display name with version info
   */
  getRecipeDisplayName(recipe) {
    if (!recipe) return "Unknown Recipe";

    let displayName = recipe.name;
    if (recipe.version && recipe.version > 1) {
      displayName += ` (v${recipe.version})`;
    }

    return displayName;
  }

  /**
   * Check if recipe has unsaved changes
   */
  hasUnsavedChanges(originalRecipe, currentRecipe, currentIngredients) {
    if (!originalRecipe) return true; // New recipe

    // Compare basic fields
    const fieldsToCompare = [
      "name",
      "style",
      "batch_size",
      "description",
      "is_public",
      "boil_time",
      "efficiency",
      "notes",
    ];
    for (const field of fieldsToCompare) {
      if (originalRecipe[field] !== currentRecipe[field]) {
        return true;
      }
    }

    // Compare ingredients
    if (originalRecipe.ingredients.length !== currentIngredients.length) {
      return true;
    }

    // Deep compare ingredients (if same number of ingredients, check IDs)
    const originalIngredientIds = originalRecipe.ingredients
      .map((ing) => ing.ingredient_id)
      .sort();
    const currentIngredientIds = currentIngredients
      .map((ing) => ing.ingredient_id)
      .sort();

    return (
      JSON.stringify(originalIngredientIds) !==
      JSON.stringify(currentIngredientIds)
    );
  }
}

// Export as singleton
const recipeServiceInstance = new RecipeService();
export default recipeServiceInstance;
