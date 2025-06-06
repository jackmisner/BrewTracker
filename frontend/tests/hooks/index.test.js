import {
  HookUtils,
  HOOK_CONSTANTS,
  useComposedHooks,
  useErrorBoundaryReporting,
  HookTestUtils,
} from "../../src/hooks/index";

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
    jest.useFakeTimers();

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
});

describe("useErrorBoundaryReporting", () => {
  it("should log error with hook name", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const hookName = "useTestHook";
    const error = new Error("Test error");
    const report = useErrorBoundaryReporting(hookName);

    report(error);

    expect(spy).toHaveBeenCalledWith(`Error in hook ${hookName}:`, error);
    spy.mockRestore();
  });

  it("should log stack trace in development", () => {
    const spy = jest.spyOn(console, "trace").mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const report = useErrorBoundaryReporting("useTestHook");
    report(new Error("Test"));

    expect(spy).toHaveBeenCalledWith("Hook error stack trace");
    process.env.NODE_ENV = originalEnv;
    spy.mockRestore();
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
  });
});
