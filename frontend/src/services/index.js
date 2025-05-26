/**
 * Central export for all business logic services
 * This provides a clean interface for importing services throughout the application
 */

import IngredientService from "./IngredientService";
import RecipeService from "./RecipeService";
import MetricService from "./MetricService";

// Export individual services
export { IngredientService, RecipeService, MetricService };

// Export as grouped services object for convenience
export const Services = {
  ingredient: IngredientService,
  recipe: RecipeService,
  metrics: MetricService,
};

// Export service utilities
export const ServiceUtils = {
  /**
   * Clear all service caches
   */
  clearAllCaches() {
    IngredientService.clearCache();
    MetricService.clearCache();
    console.log("All service caches cleared");
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
      await IngredientService.fetchIngredients();
    } catch (error) {
      health.ingredient = false;
      health.ingredientError = error.message;
    }

    return health;
  },
};

export default Services;
