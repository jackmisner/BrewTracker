import CacheManager, {
  invalidateBrewSessionCaches,
} from "../../src/services/CacheManager";
import BrewSessionService from "../../src/services/BrewSessionService";

// Mock the BrewSessionService
jest.mock("../../src/services/BrewSessionService", () => ({
  clearRecipeCache: jest.fn(),
  clearSessionCache: jest.fn(),
  clearAllRecipeCaches: jest.fn(),
  clearCache: jest.fn(),
}));

describe("CacheManager", () => {
  let cacheManager;
  let consoleLogSpy;
  let consoleErrorSpy;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    cacheManager = CacheManager;
    // Clear any existing event listeners
    console.warn = jest.fn();
    console.error = jest.fn();
    cacheManager.eventListeners.clear();
    jest.clearAllMocks();

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console mocks
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("Event Listener Management", () => {
    describe("addEventListener", () => {
      test("adds event listener successfully", () => {
        const callback = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, callback);

        expect(cacheManager.eventListeners.has(event)).toBe(true);
        expect(cacheManager.eventListeners.get(event)).toContain(callback);
      });

      test("adds multiple listeners for the same event", () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, callback1);
        cacheManager.addEventListener(event, callback2);

        const listeners = cacheManager.eventListeners.get(event);
        expect(listeners).toHaveLength(2);
        expect(listeners).toContain(callback1);
        expect(listeners).toContain(callback2);
      });

      test("creates new event array if event doesn't exist", () => {
        const callback = jest.fn();
        const event = "new-event";

        expect(cacheManager.eventListeners.has(event)).toBe(false);

        cacheManager.addEventListener(event, callback);

        expect(cacheManager.eventListeners.has(event)).toBe(true);
        expect(cacheManager.eventListeners.get(event)).toEqual([callback]);
      });
    });

    describe("removeEventListener", () => {
      test("removes event listener successfully", () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, callback1);
        cacheManager.addEventListener(event, callback2);

        cacheManager.removeEventListener(event, callback1);

        const listeners = cacheManager.eventListeners.get(event);
        expect(listeners).toHaveLength(1);
        expect(listeners).toContain(callback2);
        expect(listeners).not.toContain(callback1);
      });

      test("handles removing non-existent listener gracefully", () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, callback1);

        // Try to remove a callback that wasn't added
        expect(() => {
          cacheManager.removeEventListener(event, callback2);
        }).not.toThrow();

        // Original callback should still be there
        expect(cacheManager.eventListeners.get(event)).toContain(callback1);
      });

      test("handles removing listener from non-existent event", () => {
        const callback = jest.fn();

        expect(() => {
          cacheManager.removeEventListener("non-existent-event", callback);
        }).not.toThrow();
      });

      test("removes all instances of a callback", () => {
        const callback = jest.fn();
        const event = "test-event";

        // Add the same callback multiple times (edge case)
        cacheManager.addEventListener(event, callback);
        cacheManager.eventListeners.get(event).push(callback);

        cacheManager.removeEventListener(event, callback);

        const listeners = cacheManager.eventListeners.get(event);
        expect(listeners.filter((cb) => cb === callback)).toHaveLength(1);
      });
    });

    describe("emit", () => {
      test("calls all registered listeners with provided data", () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const event = "test-event";
        const testData = { test: "data" };

        cacheManager.addEventListener(event, callback1);
        cacheManager.addEventListener(event, callback2);

        cacheManager.emit(event, testData);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback1).toHaveBeenCalledWith(testData);
        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledWith(testData);
      });

      test("handles emit for event with no listeners", () => {
        expect(() => {
          cacheManager.emit("non-existent-event", { data: "test" });
        }).not.toThrow();
      });

      test("handles errors in callback execution", () => {
        const errorCallback = jest.fn().mockImplementation(() => {
          throw new Error("Callback error");
        });
        const successCallback = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, errorCallback);
        cacheManager.addEventListener(event, successCallback);

        cacheManager.emit(event, { test: "data" });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error in cache invalidation callback:",
          expect.any(Error)
        );
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(successCallback).toHaveBeenCalledTimes(1); // Should still execute
      });

      test("continues executing remaining callbacks after error", () => {
        const callback1 = jest.fn();
        const errorCallback = jest.fn().mockImplementation(() => {
          throw new Error("Test error");
        });
        const callback3 = jest.fn();
        const event = "test-event";

        cacheManager.addEventListener(event, callback1);
        cacheManager.addEventListener(event, errorCallback);
        cacheManager.addEventListener(event, callback3);

        cacheManager.emit(event, { test: "data" });

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(callback3).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Brew Session Cache Invalidation", () => {
    describe("onBrewSessionCreated", () => {
      test("clears recipe cache and emits event", () => {
        const sessionData = {
          session_id: "session-123",
          recipe_id: "recipe-456",
          name: "Test Brew Session",
        };
        const eventListener = jest.fn();

        cacheManager.addEventListener("brew-session-created", eventListener);
        cacheManager.onBrewSessionCreated(sessionData);

        expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledWith(
          "recipe-456"
        );
        expect(eventListener).toHaveBeenCalledWith(sessionData);
      });

      test("handles session data without recipe_id", () => {
        const sessionData = {
          session_id: "session-123",
          name: "Test Brew Session",
        };

        expect(() => {
          cacheManager.onBrewSessionCreated(sessionData);
        }).not.toThrow();

        expect(BrewSessionService.clearRecipeCache).not.toHaveBeenCalled();
      });
    });

    describe("onBrewSessionUpdated", () => {
      test("clears both recipe and session cache and emits event", () => {
        const sessionData = {
          session_id: "session-123",
          recipe_id: "recipe-456",
          name: "Updated Brew Session",
        };
        const eventListener = jest.fn();

        cacheManager.addEventListener("brew-session-updated", eventListener);
        cacheManager.onBrewSessionUpdated(sessionData);

        expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledWith(
          "recipe-456"
        );
        expect(BrewSessionService.clearSessionCache).toHaveBeenCalledWith(
          "session-123"
        );
        expect(eventListener).toHaveBeenCalledWith(sessionData);
      });

      test("handles partial session data", () => {
        const sessionDataNoRecipe = {
          session_id: "session-123",
          name: "Test Session",
        };

        cacheManager.onBrewSessionUpdated(sessionDataNoRecipe);

        expect(BrewSessionService.clearRecipeCache).not.toHaveBeenCalled();
        expect(BrewSessionService.clearSessionCache).toHaveBeenCalledWith(
          "session-123"
        );

        jest.clearAllMocks();

        const sessionDataNoSession = {
          recipe_id: "recipe-456",
          name: "Test Session",
        };

        cacheManager.onBrewSessionUpdated(sessionDataNoSession);

        expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledWith(
          "recipe-456"
        );
        expect(BrewSessionService.clearSessionCache).not.toHaveBeenCalled();
      });
    });

    describe("onBrewSessionDeleted", () => {
      test("clears all related caches and emits event", () => {
        const sessionData = {
          session_id: "session-123",
          recipe_id: "recipe-456",
          name: "Deleted Brew Session",
        };
        const eventListener = jest.fn();

        cacheManager.addEventListener("brew-session-deleted", eventListener);
        cacheManager.onBrewSessionDeleted(sessionData);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Cache invalidation: Brew session deleted",
          sessionData
        );
        expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledWith(
          "recipe-456"
        );
        expect(BrewSessionService.clearSessionCache).toHaveBeenCalledWith(
          "session-123"
        );
        expect(BrewSessionService.clearAllRecipeCaches).toHaveBeenCalled();
        expect(eventListener).toHaveBeenCalledWith(sessionData);
      });

      test("still clears all recipe caches even without specific IDs", () => {
        const sessionData = {
          name: "Deleted Session",
        };

        cacheManager.onBrewSessionDeleted(sessionData);

        expect(BrewSessionService.clearRecipeCache).not.toHaveBeenCalled();
        expect(BrewSessionService.clearSessionCache).not.toHaveBeenCalled();
        expect(BrewSessionService.clearAllRecipeCaches).toHaveBeenCalled();
      });
    });
  });

  describe("General Cache Management", () => {
    describe("clearAllCaches", () => {
      test("clears all caches and emits event", () => {
        const eventListener = jest.fn();

        cacheManager.addEventListener("cache-cleared", eventListener);
        cacheManager.clearAllCaches();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Cache invalidation: Clearing all caches"
        );
        expect(BrewSessionService.clearCache).toHaveBeenCalled();
        expect(eventListener).toHaveBeenCalled();
      });
    });

    describe("forceRefreshRecipe", () => {
      test("clears recipe cache and emits event", () => {
        const recipeId = "recipe-123";
        const eventListener = jest.fn();

        cacheManager.addEventListener("recipe-refresh", eventListener);
        cacheManager.forceRefreshRecipe(recipeId);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Cache invalidation: Force refresh recipe",
          recipeId
        );
        expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledWith(
          recipeId
        );
        expect(eventListener).toHaveBeenCalledWith({ recipe_id: recipeId });
      });
    });
  });

  describe("Convenience Export Functions", () => {
    describe("invalidateBrewSessionCaches", () => {
      test("onCreated calls cacheManager.onBrewSessionCreated", () => {
        const sessionData = { session_id: "123", recipe_id: "456" };

        // Spy on the cacheManager method
        const spy = jest.spyOn(cacheManager, "onBrewSessionCreated");

        invalidateBrewSessionCaches.onCreated(sessionData);

        expect(spy).toHaveBeenCalledWith(sessionData);

        spy.mockRestore();
      });

      test("onUpdated calls cacheManager.onBrewSessionUpdated", () => {
        const sessionData = { session_id: "123", recipe_id: "456" };

        const spy = jest.spyOn(cacheManager, "onBrewSessionUpdated");

        invalidateBrewSessionCaches.onUpdated(sessionData);

        expect(spy).toHaveBeenCalledWith(sessionData);

        spy.mockRestore();
      });

      test("onDeleted calls cacheManager.onBrewSessionDeleted", () => {
        const sessionData = { session_id: "123", recipe_id: "456" };

        const spy = jest.spyOn(cacheManager, "onBrewSessionDeleted");

        invalidateBrewSessionCaches.onDeleted(sessionData);

        expect(spy).toHaveBeenCalledWith(sessionData);

        spy.mockRestore();
      });

      test("forceRefreshRecipe calls cacheManager.forceRefreshRecipe", () => {
        const recipeId = "recipe-123";

        const spy = jest.spyOn(cacheManager, "forceRefreshRecipe");

        invalidateBrewSessionCaches.forceRefreshRecipe(recipeId);

        expect(spy).toHaveBeenCalledWith(recipeId);

        spy.mockRestore();
      });
    });
  });

  describe("Integration Scenarios", () => {
    test("handles complex workflow with multiple events", () => {
      const createdListener = jest.fn();
      const updatedListener = jest.fn();
      const deletedListener = jest.fn();

      cacheManager.addEventListener("brew-session-created", createdListener);
      cacheManager.addEventListener("brew-session-updated", updatedListener);
      cacheManager.addEventListener("brew-session-deleted", deletedListener);

      const sessionData = {
        session_id: "session-123",
        recipe_id: "recipe-456",
        name: "Test Session",
      };

      // Simulate full lifecycle
      cacheManager.onBrewSessionCreated(sessionData);
      cacheManager.onBrewSessionUpdated({
        ...sessionData,
        name: "Updated Session",
      });
      cacheManager.onBrewSessionDeleted(sessionData);

      expect(createdListener).toHaveBeenCalledTimes(1);
      expect(updatedListener).toHaveBeenCalledTimes(1);
      expect(deletedListener).toHaveBeenCalledTimes(1);

      // Verify cache clearing calls
      expect(BrewSessionService.clearRecipeCache).toHaveBeenCalledTimes(3);
      expect(BrewSessionService.clearSessionCache).toHaveBeenCalledTimes(2); // update and delete
      expect(BrewSessionService.clearAllRecipeCaches).toHaveBeenCalledTimes(1); // only delete
    });

    test("handles multiple listeners for same event with errors", () => {
      const successListener1 = jest.fn();
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const successListener2 = jest.fn();

      cacheManager.addEventListener("brew-session-created", successListener1);
      cacheManager.addEventListener("brew-session-created", errorListener);
      cacheManager.addEventListener("brew-session-created", successListener2);

      const sessionData = {
        session_id: "session-123",
        recipe_id: "recipe-123",
      };

      cacheManager.emit("brew-session-created", sessionData);

      expect(successListener1).toHaveBeenCalledWith(sessionData);
      expect(errorListener).toHaveBeenCalledWith(sessionData);
      expect(successListener2).toHaveBeenCalledWith(sessionData);
    });
  });

  describe("Singleton Behavior", () => {
    test("exports same instance", () => {
      // Import the module again to test singleton
      const CacheManager2 = require("../../src/services/CacheManager").default;

      expect(CacheManager).toBe(CacheManager2);
    });

    test("maintains state across imports", () => {
      const callback = jest.fn();
      cacheManager.addEventListener("test-event", callback);

      // Import and use the module again
      const {
        default: CacheManager2,
      } = require("../../src/services/CacheManager");
      CacheManager2.emit("test-event", { test: "data" });

      expect(callback).toHaveBeenCalledWith({ test: "data" });
    });
  });

  describe("Edge Cases", () => {
    test("handles undefined or null session data", () => {
      expect(() => {
        cacheManager.onBrewSessionCreated(null);
      }).not.toThrow();

      expect(() => {
        cacheManager.onBrewSessionUpdated(undefined);
      }).not.toThrow();

      expect(() => {
        cacheManager.onBrewSessionDeleted({});
      }).not.toThrow();
    });

    test("handles empty string IDs", () => {
      const sessionData = {
        session_id: "",
        recipe_id: "",
      };

      cacheManager.onBrewSessionUpdated(sessionData);

      // Should not call cache clearing methods with empty strings
      expect(BrewSessionService.clearRecipeCache).not.toHaveBeenCalled();
      expect(BrewSessionService.clearSessionCache).not.toHaveBeenCalled();
    });

    test("handles very long event listener arrays", () => {
      const callbacks = [];
      const event = "stress-test";

      // Add many listeners
      for (let i = 0; i < 1000; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        cacheManager.addEventListener(event, callback);
      }

      // Emit event
      cacheManager.emit(event, { test: "data" });

      // All should be called
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });
});
