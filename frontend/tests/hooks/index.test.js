import {
  HookUtils,
  HOOK_CONSTANTS,
  useComposedHooks,
  useErrorBoundaryReporting,
  HookTestUtils,
} from "../../src/hooks/index";

// Suppress console errors and traces during tests
const originalConsoleError = console.error;
const originalConsoleTrace = console.trace;

beforeAll(() => {
  console.error = jest.fn();
  console.trace = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.trace = originalConsoleTrace;
});

describe("HookUtils", () => {
  describe("createSafeStateSetter", () => {
    it("should call setState if mounted.current is true", () => {
      const mounted = { current: true };
      const setState = jest.fn();
      const safeSetter = HookUtils.createSafeStateSetter(mounted, setState);

      const updater = jest.fn();
      safeSetter(updater);

      expect(setState).toHaveBeenCalledWith(updater);
    });

    it("should not call setState if mounted.current is false", () => {
      const mounted = { current: false };
      const setState = jest.fn();
      const safeSetter = HookUtils.createSafeStateSetter(mounted, setState);

      const updater = jest.fn();
      safeSetter(updater);

      expect(setState).not.toHaveBeenCalled();
    });
  });

  describe("createAsyncCleanup", () => {
    it("should return cleanup and isCancelled functions", () => {
      const { cleanup, isCancelled } = HookUtils.createAsyncCleanup();
      expect(isCancelled()).toBe(false);
      cleanup();
      expect(isCancelled()).toBe(true);
    });
  });

  describe("createDebouncedFunction", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should debounce the function call", () => {
      const func = jest.fn();
      const debounced = HookUtils.createDebouncedFunction(func, 100);

      debounced("a");
      debounced("b");
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith("b");
    });

    it("should use default delay if not provided", () => {
      const func = jest.fn();
      const debounced = HookUtils.createDebouncedFunction(func);

      debounced("test");
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300); // Default delay
      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith("test");
    });
  });
});

describe("HOOK_CONSTANTS", () => {
  it("should have correct debounce delays", () => {
    expect(HOOK_CONSTANTS.DEBOUNCE_DELAYS.METRICS_CALCULATION).toBe(500);
    expect(HOOK_CONSTANTS.DEBOUNCE_DELAYS.SEARCH).toBe(300);
    expect(HOOK_CONSTANTS.DEBOUNCE_DELAYS.VALIDATION).toBe(200);
  });

  it("should have correct cache durations", () => {
    expect(HOOK_CONSTANTS.CACHE_DURATIONS.INGREDIENTS).toBe(5 * 60 * 1000);
    expect(HOOK_CONSTANTS.CACHE_DURATIONS.RECIPES).toBe(2 * 60 * 1000);
  });

  it("should have correct error types", () => {
    expect(HOOK_CONSTANTS.ERROR_TYPES.VALIDATION).toBe("validation");
    expect(HOOK_CONSTANTS.ERROR_TYPES.NETWORK).toBe("network");
    expect(HOOK_CONSTANTS.ERROR_TYPES.BUSINESS).toBe("business");
    expect(HOOK_CONSTANTS.ERROR_TYPES.SYSTEM).toBe("system");
  });
});

describe("useComposedHooks", () => {
  it("should compose errors and loading state", () => {
    const hooks = [
      { error: null, loading: false, clearError: jest.fn() },
      { error: "Some error", loading: false, clearError: jest.fn() },
      { error: null, loading: true, clearError: jest.fn() },
    ];
    const { composedError, composedLoading } = useComposedHooks(hooks);
    expect(composedError).toBe("Some error");
    expect(composedLoading).toBe(true);
  });

  it("should clear all errors", () => {
    const clearError1 = jest.fn();
    const clearError2 = jest.fn();
    const hooks = [
      { error: "err1", loading: false, clearError: clearError1 },
      { error: "err2", loading: false, clearError: clearError2 },
    ];
    const { clearAllErrors } = useComposedHooks(hooks);
    clearAllErrors();
    expect(clearError1).toHaveBeenCalled();
    expect(clearError2).toHaveBeenCalled();
  });

  it("should handle hooks without clearError method", () => {
    const hooks = [
      { error: "err1", loading: false }, // No clearError method
      { error: "err2", loading: false, clearError: jest.fn() },
    ];
    const { clearAllErrors } = useComposedHooks(hooks);

    // Should not throw an error
    expect(() => clearAllErrors()).not.toThrow();
  });

  it("should return null error when no errors exist", () => {
    const hooks = [
      { error: null, loading: false, clearError: jest.fn() },
      { error: null, loading: false, clearError: jest.fn() },
    ];
    const { composedError } = useComposedHooks(hooks);
    expect(composedError).toBe(null);
  });

  it("should return false loading when no hooks are loading", () => {
    const hooks = [
      { error: null, loading: false, clearError: jest.fn() },
      { error: null, loading: false, clearError: jest.fn() },
    ];
    const { composedLoading } = useComposedHooks(hooks);
    expect(composedLoading).toBe(false);
  });
});

describe("useErrorBoundaryReporting", () => {
  it("should log error with hook name", () => {
    const hookName = "useTestHook";
    const error = new Error("Test error");
    const report = useErrorBoundaryReporting(hookName);

    report(error);

    expect(console.error).toHaveBeenCalledWith(
      `Error in hook ${hookName}:`,
      error
    );
  });

  it("should log stack trace in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const report = useErrorBoundaryReporting("useTestHook");
    report(new Error("Test"));

    expect(console.trace).toHaveBeenCalledWith("Hook error stack trace");

    process.env.NODE_ENV = originalEnv;
  });

  it("should not log stack trace in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const report = useErrorBoundaryReporting("useTestHook");
    report(new Error("Test"));

    expect(console.trace).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });
});

describe("HookTestUtils", () => {
  describe("createMockHookReturn", () => {
    it("should return default mock values", () => {
      const mock = HookTestUtils.createMockHookReturn();
      expect(mock).toEqual({ loading: false, error: null, data: null });
    });

    it("should override default values", () => {
      const mock = HookTestUtils.createMockHookReturn({
        loading: true,
        data: [1, 2],
      });
      expect(mock.loading).toBe(true);
      expect(mock.data).toEqual([1, 2]);
      expect(mock.error).toBe(null); // Should preserve defaults for non-overridden values
    });

    it("should handle complex override objects", () => {
      const complexData = { users: [{ id: 1, name: "Test" }], total: 1 };
      const mock = HookTestUtils.createMockHookReturn({
        data: complexData,
        error: "Network error",
        loading: true,
      });
      expect(mock.data).toEqual(complexData);
      expect(mock.error).toBe("Network error");
      expect(mock.loading).toBe(true);
    });
  });

  describe("createTestProps", () => {
    it("should return base props for known hook", () => {
      const props = HookTestUtils.createTestProps("useRecipeBuilder");
      expect(props).toHaveProperty("recipeId", "test-recipe-id");
    });

    it("should merge custom props", () => {
      const props = HookTestUtils.createTestProps("useRecipeBuilder", {
        custom: 123,
      });
      expect(props).toHaveProperty("custom", 123);
      expect(props).toHaveProperty("recipeId", "test-recipe-id");
    });

    it("should return empty object for unknown hook", () => {
      const props = HookTestUtils.createTestProps("unknownHook");
      expect(props).toEqual({});
    });

    it("should override base props with custom props", () => {
      const props = HookTestUtils.createTestProps("useRecipeBuilder", {
        recipeId: "custom-recipe-id",
      });
      expect(props.recipeId).toBe("custom-recipe-id");
    });

    it("should handle all defined hook types", () => {
      const hookTypes = [
        "useRecipeBuilder",
        "useRecipeState",
        "useIngredientsState",
        "useMetricsCalculation",
        "useRecipeForm",
      ];

      hookTypes.forEach((hookType) => {
        const props = HookTestUtils.createTestProps(hookType);
        expect(props).toBeDefined();
        expect(typeof props).toBe("object");
      });
    });

    it("should return props with correct structure for useMetricsCalculation", () => {
      const props = HookTestUtils.createTestProps("useMetricsCalculation");
      expect(props).toHaveProperty("recipeId");
      expect(props).toHaveProperty("recipeIngredients");
      expect(props).toHaveProperty("recipe");
      expect(props).toHaveProperty("loading");
      expect(Array.isArray(props.recipeIngredients)).toBe(true);
      expect(typeof props.recipe).toBe("object");
      expect(typeof props.loading).toBe("boolean");
    });
  });
});
