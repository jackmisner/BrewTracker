import { renderHook, act, waitFor } from "@testing-library/react";
import { useRecipeBuilder } from "../../src/hooks/useRecipeBuilder";
import { Services } from "../../src/services";

// Mock the services
jest.mock("../../src/services", () => ({
  Services: {
    ingredient: {
      fetchIngredients: jest.fn(),
      sortIngredients: jest.fn(),
      validateIngredientData: jest.fn(),
      createRecipeIngredient: jest.fn(),
      scaleIngredients: jest.fn(),
    },
    recipe: {
      fetchRecipe: jest.fn(),
      scaleRecipe: jest.fn(),
      saveRecipe: jest.fn(),
      hasUnsavedChanges: jest.fn(),
      getRecipeDisplayName: jest.fn(),
    },
    metrics: {
      calculateMetrics: jest.fn(),
      calculateMetricsDebounced: jest.fn(),
      cancelCalculation: jest.fn(),
      getRecipeAnalysis: jest.fn(),
    },
  },
}));

// Mock react-router
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

describe("useRecipeBuilder", () => {
  // Mock data
  const mockAvailableIngredients = {
    grain: [{ id: 1, name: "Pale Malt" }],
    hop: [{ id: 2, name: "Cascade" }],
    yeast: [{ id: 3, name: "US-05" }],
    other: [{ id: 4, name: "Irish Moss" }],
  };

  const mockRecipe = {
    recipe_id: "test-recipe-id",
    name: "Test Recipe",
    style: "IPA",
    batch_size: 5,
    description: "Test description",
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: "Test notes",
  };

  const mockIngredients = [
    {
      id: "ing-1",
      name: "Pale Malt",
      type: "grain",
      amount: 5,
    },
  ];

  const mockMetrics = {
    og: 1.05,
    fg: 1.01,
    abv: 5.2,
    ibu: 35,
    srm: 4,
  };

  // Suppress console.error during tests since we're testing error scenarios
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    Services.ingredient.fetchIngredients.mockResolvedValue(
      mockAvailableIngredients
    );
    Services.ingredient.sortIngredients.mockImplementation(
      (ingredients) => ingredients
    );
    Services.recipe.fetchRecipe.mockResolvedValue(mockRecipe);
    Services.metrics.calculateMetrics.mockResolvedValue(mockMetrics);
    Services.metrics.calculateMetricsDebounced.mockResolvedValue(mockMetrics);
    Services.recipe.hasUnsavedChanges.mockReturnValue(true); // Default to true for unsaved changes
    Services.recipe.getRecipeDisplayName.mockReturnValue("Test Recipe");
  });

  describe("initialization", () => {
    it("should initialize with default state for new recipe", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.recipe).toEqual({
        name: "",
        style: "",
        batch_size: 5,
        description: "",
        boil_time: 60,
        efficiency: 75,
        is_public: false,
        notes: "",
      });
      expect(result.current.ingredients).toEqual([]);
      expect(result.current.availableIngredients).toEqual(
        mockAvailableIngredients
      );
      expect(result.current.isEditing).toBe(false);
    });

    it("should load existing recipe when recipeId is provided", async () => {
      // Setup recipe fetch to return recipe with ingredients included
      const recipeWithIngredients = {
        ...mockRecipe,
        ingredients: mockIngredients,
      };
      Services.recipe.fetchRecipe.mockResolvedValue(recipeWithIngredients);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(Services.recipe.fetchRecipe).toHaveBeenCalledWith(
        "test-recipe-id"
      );
      // The hook should have the original recipe data (including ingredients initially)
      expect(result.current.recipe).toEqual(recipeWithIngredients);
      expect(result.current.ingredients).toEqual(mockIngredients);
      expect(result.current.isEditing).toBe(true);
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Failed to load ingredients");
      Services.ingredient.fetchIngredients.mockRejectedValue(error);

      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load ingredients");
    });

    it("should calculate metrics for recipes with ingredients", async () => {
      // Setup recipe fetch to return recipe with ingredients
      const recipeWithIngredients = {
        ...mockRecipe,
        ingredients: mockIngredients,
      };
      Services.recipe.fetchRecipe.mockResolvedValue(recipeWithIngredients);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(Services.metrics.calculateMetrics).toHaveBeenCalledWith(
        recipeWithIngredients,
        mockIngredients
      );
      expect(result.current.metrics).toEqual(mockMetrics);
    });

    it("should use default metrics for recipes without ingredients", async () => {
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: [],
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(Services.metrics.calculateMetrics).not.toHaveBeenCalled();
      expect(result.current.metrics).toEqual({
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      });
    });

    it("should handle metrics calculation timeout", async () => {
      // Setup recipe with ingredients to trigger metrics calculation
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      // Mock a long-running promise that will exceed the timeout
      Services.metrics.calculateMetrics.mockRejectedValue(
        new Error("Metrics calculation timeout")
      );

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 12000 }
      ); // Wait longer for the timeout to happen

      // Should use default metrics when calculation times out
      expect(result.current.metrics).toEqual({
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      });
    });
  });

  describe("updateRecipe", () => {
    it("should update recipe field and mark as changed", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return true after update
      Services.recipe.hasUnsavedChanges.mockReturnValue(true);

      await act(async () => {
        await result.current.updateRecipe("name", "New Recipe Name");
      });

      expect(result.current.recipe.name).toBe("New Recipe Name");
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it("should recalculate metrics for calculation fields", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRecipe("batch_size", 10);
      });

      expect(result.current.calculatingMetrics).toBe(false);
      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
    });

    it("should not recalculate metrics for non-calculation fields", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      Services.metrics.calculateMetricsDebounced.mockClear();

      await act(async () => {
        await result.current.updateRecipe("name", "New Name");
      });

      expect(Services.metrics.calculateMetricsDebounced).not.toHaveBeenCalled();
    });

    it("should handle metrics calculation errors", async () => {
      Services.metrics.calculateMetricsDebounced.mockRejectedValue(
        new Error("Calculation failed")
      );

      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRecipe("batch_size", 10);
      });

      expect(result.current.error).toBe("Failed to recalculate metrics");
      expect(result.current.calculatingMetrics).toBe(false);
    });
  });

  describe("addIngredient", () => {
    const mockIngredientData = {
      name: "New Ingredient",
      amount: 2,
    };

    beforeEach(() => {
      Services.ingredient.validateIngredientData.mockReturnValue({
        isValid: true,
        errors: [],
      });
      Services.ingredient.createRecipeIngredient.mockReturnValue({
        id: "new-ing",
        name: "New Ingredient",
        type: "grain",
        amount: 2,
      });
    });

    it("should add ingredient successfully", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return true after adding
      Services.recipe.hasUnsavedChanges.mockReturnValue(true);

      await act(async () => {
        await result.current.addIngredient("grain", mockIngredientData);
      });

      expect(Services.ingredient.validateIngredientData).toHaveBeenCalledWith(
        "grain",
        mockIngredientData
      );
      expect(Services.ingredient.createRecipeIngredient).toHaveBeenCalled();
      expect(result.current.hasUnsavedChanges).toBe(true);
      expect(result.current.addingIngredient).toBe(false);
    });

    it("should handle validation errors", async () => {
      Services.ingredient.validateIngredientData.mockReturnValue({
        isValid: false,
        errors: ["Amount is required", "Invalid type"],
      });

      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addIngredient("grain", mockIngredientData);
      });

      expect(result.current.error).toBe("Amount is required, Invalid type");
      expect(result.current.addingIngredient).toBe(false);
    });

    it("should recalculate metrics after adding ingredient", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addIngredient("grain", mockIngredientData);
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
      expect(result.current.calculatingMetrics).toBe(false);
    });

    it("should sort ingredients after adding", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addIngredient("grain", mockIngredientData);
      });

      expect(Services.ingredient.sortIngredients).toHaveBeenCalled();
    });
  });

  describe("removeIngredient", () => {
    it("should remove ingredient successfully", async () => {
      // Setup recipe with ingredients first
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Ensure we start with ingredients
      expect(result.current.ingredients).toEqual(mockIngredients);

      // Mock hasUnsavedChanges to return true after removal
      Services.recipe.hasUnsavedChanges.mockReturnValue(true);

      await act(async () => {
        await result.current.removeIngredient("ing-1");
      });

      expect(result.current.ingredients).toEqual([]);
      // The hook should mark as changed after removing ingredient
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it("should recalculate metrics after removing ingredient", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      Services.metrics.calculateMetricsDebounced.mockClear();

      await act(async () => {
        await result.current.removeIngredient("ing-1");
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
    });

    it("should handle removal errors", async () => {
      // Mock metrics calculation to fail with an error that has no message
      const errorWithoutMessage = { name: "CustomError" };
      Services.metrics.calculateMetricsDebounced.mockRejectedValue(
        errorWithoutMessage
      );

      // Setup recipe with ingredients first
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeIngredient("ing-1");
      });

      // Since the error has no message, it should use the fallback
      expect(result.current.error).toBe("Failed to remove ingredient");
    });
  });

  describe("scaleRecipe", () => {
    beforeEach(() => {
      Services.recipe.scaleRecipe.mockReturnValue({
        scaledRecipe: { ...mockRecipe, batch_size: 10 },
        scalingFactor: 2,
      });
      Services.ingredient.scaleIngredients.mockReturnValue([
        { ...mockIngredients[0], amount: 10 },
      ]);
    });

    it("should scale recipe successfully", async () => {
      // Setup recipe with ingredients first
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return true after scaling
      Services.recipe.hasUnsavedChanges.mockReturnValue(true);

      await act(async () => {
        await result.current.scaleRecipe(10);
      });

      expect(Services.recipe.scaleRecipe).toHaveBeenCalled();
      expect(Services.ingredient.scaleIngredients).toHaveBeenCalled();
      expect(result.current.recipe.batch_size).toBe(10);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it("should handle invalid batch sizes", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.scaleRecipe(0);
      });

      expect(result.current.error).toBe("Invalid batch size for scaling");
    });

    it("should recalculate metrics after scaling", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      Services.metrics.calculateMetricsDebounced.mockClear();

      await act(async () => {
        await result.current.scaleRecipe(10);
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
    });
  });

  describe("saveRecipe", () => {
    const mockSavedRecipe = { ...mockRecipe, recipe_id: "saved-recipe-id" };

    beforeEach(() => {
      Services.recipe.saveRecipe.mockResolvedValue(mockSavedRecipe);
    });

    it("should save recipe successfully", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return false after save
      Services.recipe.hasUnsavedChanges.mockReturnValue(false);

      let savedRecipe;
      await act(async () => {
        savedRecipe = await result.current.saveRecipe();
      });

      expect(Services.recipe.saveRecipe).toHaveBeenCalledWith(
        "test-recipe-id",
        expect.any(Object),
        expect.any(Array),
        expect.any(Object)
      );
      expect(result.current.hasUnsavedChanges).toBe(false);
      expect(result.current.saving).toBe(false);
      expect(savedRecipe).toEqual(mockSavedRecipe);
    });

    it("should navigate to new recipe after saving", async () => {
      const { result } = renderHook(() => useRecipeBuilder()); // No recipeId (new recipe)

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.saveRecipe();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/recipes/saved-recipe-id");
    });

    it("should handle save errors", async () => {
      // Mock error without message to test fallback
      const errorWithoutMessage = { name: "SaveError" };
      Services.recipe.saveRecipe.mockRejectedValue(errorWithoutMessage);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The function should throw, but also set the error state
      let thrownError;
      await act(async () => {
        try {
          await result.current.saveRecipe();
        } catch (error) {
          thrownError = error;
        }
      });

      expect(thrownError).toEqual(errorWithoutMessage);
      // Since the error has no message, it should use the fallback
      expect(result.current.error).toBe("Failed to save recipe");
      expect(result.current.saving).toBe(false);
    });

    it("should prevent default on form events", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockEvent = { preventDefault: jest.fn() };

      await act(async () => {
        await result.current.saveRecipe(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe("recalculateMetrics", () => {
    it("should recalculate metrics manually", async () => {
      // Setup with existing recipe and ingredients
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      Services.metrics.calculateMetrics.mockClear();

      await act(async () => {
        await result.current.recalculateMetrics();
      });

      expect(Services.metrics.calculateMetrics).toHaveBeenCalled();
      expect(result.current.calculatingMetrics).toBe(false);
    });

    it("should handle manual recalculation errors", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the initial successful call and make subsequent calls fail
      Services.metrics.calculateMetrics.mockClear();
      const errorWithoutMessage = { name: "CalculationError" };
      Services.metrics.calculateMetrics.mockRejectedValue(errorWithoutMessage);

      await act(async () => {
        await result.current.recalculateMetrics();
      });

      // Since the error has no message, it should use the fallback
      expect(result.current.error).toBe("Failed to recalculate metrics");
      expect(result.current.calculatingMetrics).toBe(false);
    });
  });

  describe("utility functions", () => {
    it("should clear errors", async () => {
      // Start with a service that will cause an error during initialization
      Services.ingredient.fetchIngredients.mockRejectedValue(
        new Error("Test error")
      );

      const { result } = renderHook(() => useRecipeBuilder());

      // Wait for the error to be set
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Test error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it("should cancel operations", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.cancelOperation();
      });

      expect(Services.metrics.cancelCalculation).toHaveBeenCalledWith(
        "recipe-builder"
      );
      expect(result.current.calculatingMetrics).toBe(false);
      expect(result.current.addingIngredient).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should get recipe analysis", async () => {
      const mockAnalysis = { type: "IPA", strength: "Medium" };
      Services.metrics.getRecipeAnalysis.mockReturnValue(mockAnalysis);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const analysis = result.current.getRecipeAnalysis();

      expect(Services.metrics.getRecipeAnalysis).toHaveBeenCalledWith(
        result.current.metrics,
        result.current.recipe
      );
      expect(analysis).toEqual(mockAnalysis);
    });
  });

  describe("computed properties", () => {
    it("should compute canSave correctly", async () => {
      // Setup recipe with ingredients so canSave can be true
      Services.recipe.fetchRecipe.mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should be true when not saving, not loading, and has ingredients
      expect(result.current.canSave).toBe(true);

      // Test saving state
      await act(async () => {
        // Start save operation but don't await it
        result.current.saveRecipe();
      });

      // Should be false while saving (briefly)
      // We'll check this by mocking a slow save operation
    });

    it("should compute recipeDisplayName correctly", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const displayName = result.current.recipeDisplayName;

      expect(Services.recipe.getRecipeDisplayName).toHaveBeenCalledWith(
        result.current.recipe
      );
      expect(displayName).toBe("Test Recipe");
    });
  });

  describe("unsaved changes detection", () => {
    it("should detect unsaved changes", async () => {
      // Start with no unsaved changes, then make a change
      Services.recipe.hasUnsavedChanges.mockReturnValue(false);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      // Mock the service to return true for unsaved changes after update
      Services.recipe.hasUnsavedChanges.mockReturnValue(true);

      await act(async () => {
        await result.current.updateRecipe("name", "Changed Name");
      });

      // The hook should detect unsaved changes
      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("should cancel operations on unmount", async () => {
      const { result, unmount } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unmount();

      expect(Services.metrics.cancelCalculation).toHaveBeenCalledWith(
        "recipe-builder"
      );
    });

    it("should not update state after unmount", async () => {
      let resolveIngredients;
      const ingredientsPromise = new Promise((resolve) => {
        resolveIngredients = resolve;
      });

      Services.ingredient.fetchIngredients.mockReturnValue(ingredientsPromise);

      const { result, unmount } = renderHook(() => useRecipeBuilder());

      expect(result.current.loading).toBe(true);

      // Unmount before promise resolves
      unmount();

      // Resolve promise after unmount - should not cause errors
      await act(async () => {
        resolveIngredients(mockAvailableIngredients);
        // Wait a bit to ensure any state updates would have happened
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Test passes if no errors are thrown
    });
  });
});
