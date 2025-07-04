import BrewSessionService from "./BrewSessionService";
import attenuationAnalyticsServiceInstance from "./AttenuationAnalyticsService";
import { ID } from "../types";

// Service-specific interfaces
interface CacheEventCallback {
  (data?: any): void;
}

interface BrewSessionEventData {
  session_id?: ID;
  recipe_id?: ID;
  [key: string]: any;
}

interface RecipeRefreshEventData {
  recipe_id: ID;
}

type CacheEventType = 
  | "brew-session-created"
  | "brew-session-updated" 
  | "brew-session-deleted"
  | "cache-cleared"
  | "recipe-refresh";

/**
 * Global cache management utility
 * Use this to coordinate cache invalidation across the entire application
 */
class CacheManager {
  private eventListeners: Map<CacheEventType, CacheEventCallback[]>;

  constructor() {
    this.eventListeners = new Map();
  }

  /**
   * Register for cache invalidation events
   */
  addEventListener(event: CacheEventType, callback: CacheEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: CacheEventType, callback: CacheEventCallback): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit cache invalidation event
   */
  emit(event: CacheEventType, data?: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((callback) => {
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
  onBrewSessionCreated(sessionData: BrewSessionEventData): void {
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
  onBrewSessionUpdated(sessionData: BrewSessionEventData): void {
    if (!sessionData) {
      console.warn("Invalid session data for update:", sessionData);
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

    // Clear attenuation analytics cache when brew session is updated
    // This is especially important when sessions are marked as completed
    // since new attenuation data may have been collected
    attenuationAnalyticsServiceInstance.clearCache();

    this.emit("brew-session-updated", sessionData);
  }

  /**
   * Invalidate caches when a brew session is deleted
   */
  onBrewSessionDeleted(sessionData: BrewSessionEventData): void {
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
  clearAllCaches(): void {
    console.log("Cache invalidation: Clearing all caches");
    BrewSessionService.clearCache();
    attenuationAnalyticsServiceInstance.clearCache();

    // Emit event for components to react
    this.emit("cache-cleared");
  }

  /**
   * Force refresh for a specific recipe
   */
  forceRefreshRecipe(recipeId: ID): void {
    console.log("Cache invalidation: Force refresh recipe", recipeId);
    BrewSessionService.clearRecipeCache(recipeId);

    // Emit event for components to react
    this.emit("recipe-refresh", { recipe_id: recipeId } as RecipeRefreshEventData);
  }

  /**
   * Get all registered event types
   */
  getRegisteredEvents(): CacheEventType[] {
    return Array.from(this.eventListeners.keys());
  }

  /**
   * Get listener count for a specific event
   */
  getListenerCount(event: CacheEventType): number {
    return this.eventListeners.get(event)?.length || 0;
  }

  /**
   * Clear all event listeners
   */
  clearAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Clear listeners for a specific event
   */
  clearEventListeners(event: CacheEventType): void {
    this.eventListeners.delete(event);
  }
}

// Export as singleton
const cacheManagerInstance = new CacheManager();
export default cacheManagerInstance;

// Convenience methods for easy import
export const invalidateBrewSessionCaches = {
  onCreated: (sessionData: BrewSessionEventData) =>
    cacheManagerInstance.onBrewSessionCreated(sessionData),
  onUpdated: (sessionData: BrewSessionEventData) =>
    cacheManagerInstance.onBrewSessionUpdated(sessionData),
  onDeleted: (sessionData: BrewSessionEventData) =>
    cacheManagerInstance.onBrewSessionDeleted(sessionData),
  forceRefreshRecipe: (recipeId: ID) =>
    cacheManagerInstance.forceRefreshRecipe(recipeId),
};