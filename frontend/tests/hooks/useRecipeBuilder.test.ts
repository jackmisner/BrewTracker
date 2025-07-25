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

// Mock UnitContext
jest.mock("../../src/contexts/UnitContext", () => ({
  useUnits: () => ({
    unitSystem: "imperial", // Default to imperial for tests
  }),
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
    batch_size_unit: "gal",
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
    (Services.ingredient.fetchIngredients as jest.Mock).mockResolvedValue(
      mockAvailableIngredients
    );
    (Services.ingredient.sortIngredients as jest.Mock).mockImplementation(
      (ingredients) => ingredients
    );
    (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
    (Services.metrics.calculateMetrics as jest.Mock).mockResolvedValue(mockMetrics);
    (Services.metrics.calculateMetricsDebounced as jest.Mock).mockResolvedValue(mockMetrics);
    (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true); // Default to true for unsaved changes
    (Services.recipe.getRecipeDisplayName as jest.Mock).mockReturnValue("Test Recipe");
  });

  describe("initialization", () => {
    it("should initialize with default state for new recipe", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.recipe).toEqual({
        id: "",
        recipe_id: "",
        name: "",
        style: "",
        batch_size: 5,
        batch_size_unit: "gal",
        description: "",
        boil_time: 60,
        efficiency: 75,
        is_public: false,
        notes: "",
        ingredients: [],
        created_at: "",
        updated_at: "",
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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(recipeWithIngredients);

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
      (Services.ingredient.fetchIngredients as jest.Mock).mockRejectedValue(error);

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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(recipeWithIngredients);

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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      // Mock a long-running promise that will exceed the timeout
      (Services.metrics.calculateMetrics as jest.Mock).mockRejectedValue(
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

    it("should use existing estimated metrics when editing a recipe with pre-calculated values", async () => {
      // This test covers the bug where existing recipe metrics weren't loaded in edit mode
      const recipeWithEstimatedMetrics = {
        ...mockRecipe,
        ingredients: mockIngredients,
        // Include estimated metrics that should be used instead of recalculating
        estimated_og: 1.048,
        estimated_fg: 1.012,
        estimated_abv: 4.7,
        estimated_ibu: 25,
        estimated_srm: 6.5,
      };
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(recipeWithEstimatedMetrics);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT call calculateMetrics since we're using existing estimated values
      expect(Services.metrics.calculateMetrics).not.toHaveBeenCalled();
      
      // Should use the estimated metrics from the recipe data
      expect(result.current.metrics).toEqual({
        og: 1.048,
        fg: 1.012,
        abv: 4.7,
        ibu: 25,
        srm: 6.5,
      });
    });

    it("should gracefully handle partial estimated metrics when editing a recipe", async () => {
      // Test partial estimated metrics (some fields missing)
      const recipeWithPartialMetrics = {
        ...mockRecipe,
        ingredients: mockIngredients,
        // Only some estimated metrics are available
        estimated_og: 1.055,
        estimated_abv: 5.8,
        // estimated_fg, estimated_ibu, estimated_srm are missing
      };
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(recipeWithPartialMetrics);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT call calculateMetrics since we have some estimated values
      expect(Services.metrics.calculateMetrics).not.toHaveBeenCalled();
      
      // Should use available estimated metrics and defaults for missing ones
      expect(result.current.metrics).toEqual({
        og: 1.055,    // from estimated_og
        fg: 1.0,      // default (estimated_fg missing)
        abv: 5.8,     // from estimated_abv
        ibu: 0,       // default (estimated_ibu missing)
        srm: 0,       // default (estimated_srm missing)
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
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true);

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

      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockClear();

      await act(async () => {
        await result.current.updateRecipe("name", "New Name");
      });

      expect(Services.metrics.calculateMetricsDebounced).not.toHaveBeenCalled();
    });

    it("should handle metrics calculation errors", async () => {
      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockRejectedValue(
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
      (Services.ingredient.validateIngredientData as jest.Mock).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (Services.ingredient.createRecipeIngredient as jest.Mock).mockReturnValue({
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
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true);

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
      (Services.ingredient.validateIngredientData as jest.Mock).mockReturnValue({
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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
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
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true);

      await act(async () => {
        await result.current.removeIngredient("ing-1");
      });

      expect(result.current.ingredients).toEqual([]);
      // The hook should mark as changed after removing ingredient
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it("should recalculate metrics after removing ingredient", async () => {
      // Setup recipe fetch to return recipe with ingredients included
      const recipeWithIngredients = {
        ...mockRecipe,
        ingredients: mockIngredients,
      };
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue(recipeWithIngredients);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Ensure we have ingredients to remove
      expect(result.current.ingredients).toEqual(mockIngredients);

      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockClear();

      await act(async () => {
        await result.current.removeIngredient("ing-1");
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
    });

    it("should handle removal errors", async () => {
      // Mock metrics calculation to fail with an error that has no message
      const errorWithoutMessage = { name: "CustomError" };
      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockRejectedValue(
        errorWithoutMessage
      );

      // Setup recipe with ingredients first
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
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
      (Services.recipe.scaleRecipe as jest.Mock).mockReturnValue({
        scaledRecipe: { ...mockRecipe, batch_size: 10 },
        scalingFactor: 2,
      });
      (Services.ingredient.scaleIngredients as jest.Mock).mockReturnValue([
        { ...mockIngredients[0], amount: 10 },
      ]);
    });

    it("should scale recipe successfully", async () => {
      // Setup recipe with ingredients first
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return true after scaling
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true);

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

      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockClear();

      await act(async () => {
        await result.current.scaleRecipe(10);
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalled();
    });
  });

  describe("saveRecipe", () => {
    const mockSavedRecipe = { ...mockRecipe, recipe_id: "saved-recipe-id" };

    beforeEach(() => {
      (Services.recipe.saveRecipe as jest.Mock).mockResolvedValue(mockSavedRecipe);
    });

    it("should save recipe successfully", async () => {
      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock hasUnsavedChanges to return false after save
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(false);

      let savedRecipe: any;
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
      (Services.recipe.saveRecipe as jest.Mock).mockRejectedValue(errorWithoutMessage);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The function should throw, but also set the error state
      let thrownError: any;
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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
        ...mockRecipe,
        ingredients: mockIngredients,
      });

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      (Services.metrics.calculateMetrics as jest.Mock).mockClear();

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
      (Services.metrics.calculateMetrics as jest.Mock).mockClear();
      const errorWithoutMessage = { name: "CalculationError" };
      (Services.metrics.calculateMetrics as jest.Mock).mockRejectedValue(errorWithoutMessage);

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
      (Services.ingredient.fetchIngredients as jest.Mock).mockRejectedValue(
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
      (Services.metrics.getRecipeAnalysis as jest.Mock).mockReturnValue(mockAnalysis);

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
      (Services.recipe.fetchRecipe as jest.Mock).mockResolvedValue({
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
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useRecipeBuilder("test-recipe-id"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      // Mock the service to return true for unsaved changes after update
      (Services.recipe.hasUnsavedChanges as jest.Mock).mockReturnValue(true);

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
      let resolveIngredients: any;
      const ingredientsPromise = new Promise((resolve) => {
        resolveIngredients = resolve;
      });

      (Services.ingredient.fetchIngredients as jest.Mock).mockReturnValue(ingredientsPromise);

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

  describe("importRecipeData", () => {
    beforeEach(() => {
      // Set up default mocks
      (Services.ingredient.fetchIngredients as jest.Mock).mockResolvedValue(
        mockAvailableIngredients
      );
      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockResolvedValue({
        og: 1.050,
        fg: 1.010,
        abv: 5.2,
        ibu: 25,
        srm: 8,
      });
    });

    test("imports recipe data correctly", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const importData = {
        name: "Imported Recipe",
        style: "American IPA",
        description: "A hoppy beer",
        batch_size: 5.5,
        efficiency: 75,
        boil_time: 60,
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      expect(result.current.recipe.name).toBe("Imported Recipe");
      expect(result.current.recipe.style).toBe("American IPA");
      expect(result.current.recipe.description).toBe("A hoppy beer");
      expect(result.current.recipe.batch_size).toBe(5.5);
      expect(result.current.recipe.efficiency).toBe(75);
      expect(result.current.recipe.boil_time).toBe(60);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    test("rounds batch size to 2 decimal places", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const importData = {
        batch_size: 5.000002351132373, // Problematic precision from BeerXML
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      expect(result.current.recipe.batch_size).toBe(5.0);
    });

    test("handles edge cases for batch size rounding", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const testCases = [
        { input: 4.999999, expected: 5.0 },
        { input: 5.001, expected: 5.0 },
        { input: 5.126, expected: 5.13 },
        { input: 19.789123, expected: 19.79 },
      ];

      for (const testCase of testCases) {
        await act(async () => {
          await result.current.importRecipeData({
            batch_size: testCase.input,
          });
        });

        expect(result.current.recipe.batch_size).toBe(testCase.expected);
      }
    });

    test("imports only provided fields without affecting others", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Import partial data
      const importData = {
        style: "Belgian Witbier",
        batch_size: 4.5,
        name: "Imported Recipe",
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      // Should have imported data
      expect(result.current.recipe.style).toBe("Belgian Witbier");
      expect(result.current.recipe.batch_size).toBe(4.5);
      expect(result.current.recipe.name).toBe("Imported Recipe");
      
      // Should have default values for non-imported fields
      expect(result.current.recipe.efficiency).toBe(75); // Default value
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    test("triggers metrics recalculation for calculation fields", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Add some ingredients first so metrics calculation makes sense
      const mockIngredients = [
        {
          id: "1",
          name: "Pale Malt",
          amount: 10,
          unit: "lb",
          type: "grain" as const,
        },
      ];
      
      await act(async () => {
        await result.current.importIngredients(mockIngredients);
      });

      jest.clearAllMocks();

      const importData = {
        batch_size: 5.5,
        efficiency: 75,
        boil_time: 90,
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      expect(Services.metrics.calculateMetricsDebounced).toHaveBeenCalledWith(
        "recipe-builder",
        expect.objectContaining({
          batch_size: 5.5,
          efficiency: 75,
          boil_time: 90,
        }),
        expect.any(Array)
      );
    });

    test("does not trigger metrics recalculation for non-calculation fields", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      jest.clearAllMocks();

      const importData = {
        name: "Test Recipe",
        style: "IPA",
        description: "A test recipe",
        notes: "Some notes",
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      expect(Services.metrics.calculateMetricsDebounced).not.toHaveBeenCalled();
    });

    test("handles errors gracefully", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Add some ingredients first so metrics calculation will be triggered
      const mockIngredients = [
        {
          id: "1",
          name: "Test Ingredient",
          amount: 1,
          unit: "lb",
          type: "grain" as const,
        },
      ];
      
      await act(async () => {
        await result.current.importIngredients(mockIngredients);
      });

      // Mock metrics calculation to throw an error
      (Services.metrics.calculateMetricsDebounced as jest.Mock).mockRejectedValue(
        new Error("Metrics calculation failed")
      );

      const importData = {
        name: "Test Recipe",
        batch_size: 5.5, // This should trigger metrics calculation
      };

      await act(async () => {
        await result.current.importRecipeData(importData);
      });

      // Recipe data should still be imported despite metrics error
      expect(result.current.recipe.name).toBe("Test Recipe");
      expect(result.current.recipe.batch_size).toBe(5.5);
      expect(result.current.error).toBe("Failed to recalculate metrics");
    });

    test("handles empty import data", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalRecipe = { ...result.current.recipe };

      await act(async () => {
        await result.current.importRecipeData({});
      });

      // Recipe should remain unchanged except for hasUnsavedChanges
      expect(result.current.recipe).toEqual({
        ...originalRecipe,
      });
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    test("handles null and undefined values correctly", async () => {
      const { result } = renderHook(() => useRecipeBuilder());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const importData = {
        name: "Test Recipe",
        style: undefined,
        description: null,
        notes: "",
        batch_size: 0,
      };

      await act(async () => {
        await result.current.importRecipeData(importData as any);
      });

      expect(result.current.recipe.name).toBe("Test Recipe");
      expect(result.current.recipe.style).toBeUndefined();
      expect(result.current.recipe.description).toBeNull();
      expect(result.current.recipe.notes).toBe("");
      expect(result.current.recipe.batch_size).toBe(0);
    });
  });
});
