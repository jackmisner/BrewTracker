/**
 * Central export for all business logic services
 * This provides a clean interface for importing services throughout the application
 */

import ingredientServiceInstance from "./IngredientService";
import recipeServiceInstance from "./RecipeService";
import metricServiceInstance from "./MetricService";
import brewSessionServiceInstance from "./BrewSessionService";

// Export individual services
export {
  ingredientServiceInstance,
  recipeServiceInstance,
  metricServiceInstance,
  brewSessionServiceInstance,
};

// Export as grouped services object for convenience
export const Services = {
  ingredient: ingredientServiceInstance,
  recipe: recipeServiceInstance,
  metrics: metricServiceInstance,
  brewSession: brewSessionServiceInstance,
};

// Export service utilities
export const ServiceUtils = {
  clearAllCaches() {
    // Safely call clearCache on each service
    const services = [
      ingredientServiceInstance,
      metricServiceInstance,
      brewSessionServiceInstance,
    ];

    services.forEach((service) => {
      if (service && typeof service.clearCache === "function") {
        service.clearCache();
      }
    });
  },

  /**
   * Health check for all services
   */
  async healthCheck() {
    const health = {
      ingredient: true,
      recipe: true,
      metrics: true,
      brewSession: true,
      timestamp: new Date().toISOString(),
    };

    try {
      // Test ingredient service
      await ingredientServiceInstance.fetchIngredients();
    } catch (error) {
      health.ingredient = false;
      health.ingredientError = error.message;
    }

    try {
      // Test brew session service
      await brewSessionServiceInstance.fetchBrewSessions(1, 1);
    } catch (error) {
      health.brewSession = false;
      health.brewSessionError = error.message;
    }

    return health;
  },
};

export default Services;
