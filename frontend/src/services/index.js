/**
 * Central export for all business logic services
 * This provides a clean interface for importing services throughout the application
 */

import ingredientServiceInstance from "./IngredientService";
import recipeServiceInstance from "./RecipeService";
import metricServiceInstance from "./MetricService";

// Export individual services
export {
  ingredientServiceInstance,
  recipeServiceInstance,
  metricServiceInstance,
};

// Export as grouped services object for convenience
export const Services = {
  ingredient: ingredientServiceInstance,
  recipe: recipeServiceInstance,
  metrics: metricServiceInstance,
};

// Export service utilities
export const ServiceUtils = {
  /**
   * Clear all service caches
   */
  clearAllCaches() {
    ingredientServiceInstance.clearCache();
    metricServiceInstance.clearCache();
  },

  /**
   * Health check for all services
   */
  async healthCheck() {
    const health = {
      ingredient: true,
      recipe: true,
      metrics: true,
      timestamp: new Date().toISOString(),
    };

    try {
      // Test ingredient service
      await ingredientServiceInstance.fetchIngredients();
    } catch (error) {
      health.ingredient = false;
      health.ingredientError = error.message;
    }

    return health;
  },
};

export default Services;
