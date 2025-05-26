/**
 * Central export for all React hooks
 */

// Unified hook for complete recipe builder functionality
export { useRecipeBuilder } from "./useRecipeBuilder";

/**
 * Hook utilities for common patterns
 */
export const HookUtils = {
  /**
   * Create a safe state setter that only updates if component is mounted
   */
  createSafeStateSetter: (mounted, setState) => {
    return (updater) => {
      if (mounted.current) {
        setState(updater);
      }
    };
  },

  /**
   * Create a cleanup function for async operations
   */
  createAsyncCleanup: () => {
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
    };

    const isCancelled = () => cancelled;

    return { cleanup, isCancelled };
  },

  /**
   * Create a debounced function for hooks
   */
  createDebouncedFunction: (func, delay = 300) => {
    let timeoutId;

    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },
};

// ============================================================================
// HOOK CONSTANTS
// ============================================================================

export const HOOK_CONSTANTS = {
  // Default debounce delays
  DEBOUNCE_DELAYS: {
    METRICS_CALCULATION: 500,
    SEARCH: 300,
    VALIDATION: 200,
  },

  // Cache durations
  CACHE_DURATIONS: {
    INGREDIENTS: 5 * 60 * 1000, // 5 minutes
    RECIPES: 2 * 60 * 1000, // 2 minutes
  },

  // Error types
  ERROR_TYPES: {
    VALIDATION: "validation",
    NETWORK: "network",
    BUSINESS: "business",
    SYSTEM: "system",
  },
};

// ============================================================================
// HOOK COMPOSITION HELPERS
// ============================================================================

/**
 * Compose multiple hooks with shared error handling
 */
export function useComposedHooks(hooks) {
  const errors = hooks.map((hook) => hook.error).filter(Boolean);
  const loading = hooks.some((hook) => hook.loading);

  const clearAllErrors = () => {
    hooks.forEach((hook) => {
      if (hook.clearError) {
        hook.clearError();
      }
    });
  };

  return {
    composedError: errors[0] || null, // Return first error
    composedLoading: loading,
    clearAllErrors,
  };
}

/**
 * Create a hook with automatic error boundary reporting
 */
export function useErrorBoundaryReporting(hookName) {
  return (error) => {
    console.error(`Error in hook ${hookName}:`, error);

    // You could integrate with error reporting services here
    // e.g., Sentry, LogRocket, etc.

    if (process.env.NODE_ENV === "development") {
      console.trace("Hook error stack trace");
    }
  };
}

// ============================================================================
// HOOK TESTING UTILITIES
// ============================================================================

export const HookTestUtils = {
  /**
   * Mock hook return values for testing
   */
  createMockHookReturn: (overrides = {}) => ({
    loading: false,
    error: null,
    data: null,
    ...overrides,
  }),

  /**
   * Create test props for hooks that need them
   */
  createTestProps: (hookName, customProps = {}) => {
    const baseProps = {
      useRecipeBuilder: { recipeId: "test-recipe-id" },
      useRecipeState: { recipeId: "test-recipe-id" },
      useIngredientsState: {},
      useMetricsCalculation: {
        recipeId: "test-recipe-id",
        recipeIngredients: [],
        recipe: { batch_size: 5 },
        loading: false,
      },
      useRecipeForm: { recipeId: "test-recipe-id" },
    };

    return {
      ...baseProps[hookName],
      ...customProps,
    };
  },
};
