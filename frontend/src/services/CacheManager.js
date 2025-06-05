import BrewSessionService from "./BrewSessionService";

/**
 * Global cache management utility
 * Use this to coordinate cache invalidation across the entire application
 */
class CacheManager {
  constructor() {
    this.eventListeners = new Map();
  }

  /**
   * Register for cache invalidation events
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit cache invalidation event
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error("Error in cache invalidation callback:", error);
        }
      });
    }
  }

  /**
   * Invalidate caches when a brew session is created
   */
  onBrewSessionCreated(sessionData) {
    if (!sessionData || !sessionData.session_id) {
      console.warn("Invalid session data for creation:", sessionData);
      return;
    }

    // Clear recipe-specific caches
    if (sessionData.recipe_id) {
      BrewSessionService.clearRecipeCache(sessionData.recipe_id);
    }

    // Emit event for components to react
    this.emit("brew-session-created", sessionData);
  }

  /**
   * Invalidate caches when a brew session is updated
   */
  onBrewSessionUpdated(sessionData) {
    if (!sessionData) {
      console.warn("Invalid session data for creation:", sessionData);
      return;
    }

    // Clear recipe cache if recipe_id exists
    if (sessionData.recipe_id) {
      BrewSessionService.clearRecipeCache(sessionData.recipe_id);
    }

    // Clear session cache if session_id exists
    if (sessionData.session_id) {
      BrewSessionService.clearSessionCache(sessionData.session_id);
    }

    this.emit("brew-session-updated", sessionData);
  }

  /**
   * Invalidate caches when a brew session is deleted
   */
  onBrewSessionDeleted(sessionData) {
    console.log("Cache invalidation: Brew session deleted", sessionData);

    // Clear all related caches
    if (sessionData.recipe_id) {
      BrewSessionService.clearRecipeCache(sessionData.recipe_id);
    }

    if (sessionData.session_id) {
      BrewSessionService.clearSessionCache(sessionData.session_id);
    }

    // Also clear all recipe caches as a safety measure
    BrewSessionService.clearAllRecipeCaches();

    // Emit event for components to react
    this.emit("brew-session-deleted", sessionData);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    console.log("Cache invalidation: Clearing all caches");
    BrewSessionService.clearCache();

    // Emit event for components to react
    this.emit("cache-cleared");
  }

  /**
   * Force refresh for a specific recipe
   */
  forceRefreshRecipe(recipeId) {
    console.log("Cache invalidation: Force refresh recipe", recipeId);
    BrewSessionService.clearRecipeCache(recipeId);

    // Emit event for components to react
    this.emit("recipe-refresh", { recipe_id: recipeId });
  }
}

// Export as singleton
const cacheManagerInstance = new CacheManager();
export default cacheManagerInstance;

// Convenience methods for easy import
export const invalidateBrewSessionCaches = {
  onCreated: (sessionData) =>
    cacheManagerInstance.onBrewSessionCreated(sessionData),
  onUpdated: (sessionData) =>
    cacheManagerInstance.onBrewSessionUpdated(sessionData),
  onDeleted: (sessionData) =>
    cacheManagerInstance.onBrewSessionDeleted(sessionData),
  forceRefreshRecipe: (recipeId) =>
    cacheManagerInstance.forceRefreshRecipe(recipeId),
};
