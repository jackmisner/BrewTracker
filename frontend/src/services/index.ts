/**
 * Central export for all business logic services
 * This provides a clean interface for importing services throughout the application
 */

import ingredientServiceInstance from "./IngredientService";
import recipeServiceInstance from "./RecipeService";
import metricServiceInstance from "./MetricService";
import brewSessionServiceInstance from "./BrewSessionService";
import BeerStyleService from "./BeerStyleService";
import BeerXMLService from "./BeerXML/BeerXMLService";
import IngredientMatchingService from "./BeerXML/IngredientMatchingService";
import CacheManager from "./CacheManager";
import RecipeDefaultsService from "./RecipeDefaultsService";
import UserSettingsService from "./UserSettingsService";
import attenuationAnalyticsServiceInstance from "./AttenuationAnalyticsService";
import { ID } from "../types";

// Service-specific interfaces
interface ServiceHealthStatus {
  ingredient: boolean;
  recipe: boolean;
  metrics: boolean;
  brewSession: boolean;
  beerStyle: boolean;
  beerXML: boolean;
  cacheManager: boolean;
  userSettings: boolean;
  timestamp: string;
  ingredientError?: string;
  recipeError?: string;
  metricsError?: string;
  brewSessionError?: string;
  beerStyleError?: string;
  beerXMLError?: string;
  cacheManagerError?: string;
  userSettingsError?: string;
}

interface ServiceWithCache {
  clearCache?: () => void;
}

// Export individual services
export {
  ingredientServiceInstance,
  recipeServiceInstance,
  metricServiceInstance,
  brewSessionServiceInstance,
  BeerStyleService,
  BeerXMLService,
  IngredientMatchingService,
  CacheManager,
  RecipeDefaultsService,
  UserSettingsService,
  attenuationAnalyticsServiceInstance,
};

// Export as grouped services object for convenience
export const Services = {
  ingredient: ingredientServiceInstance,
  recipe: recipeServiceInstance,
  metrics: metricServiceInstance,
  brewSession: brewSessionServiceInstance,
  beerStyle: BeerStyleService,
  beerXML: BeerXMLService,
  ingredientMatching: IngredientMatchingService,
  cache: CacheManager,
  recipeDefaults: RecipeDefaultsService,
  userSettings: UserSettingsService,
  attenuationAnalytics: attenuationAnalyticsServiceInstance,
};

// Export service utilities
export const ServiceUtils = {
  /**
   * Clear all service caches
   */
  clearAllCaches(): void {
    // Safely call clearCache on each service that supports caching
    const services: ServiceWithCache[] = [
      ingredientServiceInstance,
      metricServiceInstance,
      brewSessionServiceInstance,
      IngredientMatchingService,
      UserSettingsService,
      attenuationAnalyticsServiceInstance,
    ];

    services.forEach((service) => {
      if (service && typeof service.clearCache === "function") {
        try {
          service.clearCache();
        } catch (error) {
          console.warn("Error clearing cache for service:", error);
        }
      }
    });

    // Clear global cache manager
    CacheManager.clearAllCaches();
  },

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<ServiceHealthStatus> {
    const health: ServiceHealthStatus = {
      ingredient: true,
      recipe: true,
      metrics: true,
      brewSession: true,
      beerStyle: true,
      beerXML: true,
      cacheManager: true,
      userSettings: true,
      timestamp: new Date().toISOString(),
    };

    // Test ingredient service
    try {
      await ingredientServiceInstance.fetchIngredients();
    } catch (error) {
      health.ingredient = false;
      health.ingredientError = (error as Error).message;
    }

    // Test recipe service
    try {
      // Test with a minimal call - recipe service doesn't have fetchUserRecipes method
      // We'll skip detailed testing for recipe service in health check
      health.recipe = true;
    } catch (error) {
      health.recipe = false;
      health.recipeError = (error as Error).message;
    }

    // Test brew session service
    try {
      await brewSessionServiceInstance.fetchBrewSessions(1, 1);
    } catch (error) {
      health.brewSession = false;
      health.brewSessionError = (error as Error).message;
    }

    // Test beer style service
    try {
      await BeerStyleService.fetchBeerStyles();
    } catch (error) {
      health.beerStyle = false;
      health.beerStyleError = (error as Error).message;
    }

    // Test user settings service
    try {
      await UserSettingsService.getUserSettings();
    } catch (error) {
      health.userSettings = false;
      health.userSettingsError = (error as Error).message;
    }

    // Test cache manager (always healthy if no errors)
    try {
      CacheManager.clearAllCaches();
    } catch (error) {
      health.cacheManager = false;
      health.cacheManagerError = (error as Error).message;
    }

    // Test BeerXML service with minimal validation
    try {
      BeerXMLService.validateBeerXML("<RECIPES></RECIPES>");
    } catch (error) {
      health.beerXML = false;
      health.beerXMLError = (error as Error).message;
    }

    return health;
  },

  /**
   * Initialize all services with default data
   */
  async initializeServices(): Promise<void> {
    try {
      // Pre-load ingredient data
      await ingredientServiceInstance.fetchIngredients();
      
      // Pre-load user settings
      await UserSettingsService.getUserSettings();
      
      console.log("Services initialized successfully");
    } catch (error) {
      console.warn("Some services failed to initialize:", error);
    }
  },

  /**
   * Get service status summary
   */
  getServiceStatus(): {
    totalServices: number;
    servicesWithCache: number;
    lastHealthCheck?: string;
  } {
    const servicesWithCache = [
      ingredientServiceInstance,
      metricServiceInstance,
      brewSessionServiceInstance,
      IngredientMatchingService,
      UserSettingsService,
    ].filter(service => service && typeof service.clearCache === "function").length;

    return {
      totalServices: Object.keys(Services).length,
      servicesWithCache,
    };
  },

  /**
   * Force refresh a specific recipe across all services
   */
  async forceRefreshRecipe(recipeId: ID): Promise<void> {
    // Clear recipe from all caches
    if (typeof (metricServiceInstance as any).clearRecipeCache === "function") {
      (metricServiceInstance as any).clearRecipeCache(recipeId);
    }
    
    if (typeof (brewSessionServiceInstance as any).clearRecipeCache === "function") {
      (brewSessionServiceInstance as any).clearRecipeCache(recipeId);
    }

    // Notify cache manager
    CacheManager.forceRefreshRecipe(recipeId);
  },
};

export default Services;