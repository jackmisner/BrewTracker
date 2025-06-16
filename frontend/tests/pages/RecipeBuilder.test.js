import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import RecipeBuilder from "../../src/pages/RecipeBuilder";
import { useRecipeBuilder } from "../../src/hooks/useRecipeBuilder";

// Mock the useRecipeBuilder hook
jest.mock("../../src/hooks/useRecipeBuilder");

// Mock react-router with controllable return values
const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

// Mock form submission to prevent JSDOM errors
beforeAll(() => {
  HTMLFormElement.prototype.submit = jest.fn();
});

// Mock child components to focus on RecipeBuilder logic
jest.mock("../../src/components/RecipeBuilder/RecipeDetails", () => {
  return function MockRecipeDetails({
    recipe,
    onChange,
    onSubmit,
    onCancel,
    isEditing,
    saving,
    canSave,
    hasUnsavedChanges,
  }) {
    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit(e);
    };

    return (
      <div data-testid="recipe-details">
        <h2>Recipe Details {isEditing ? "(Editing)" : "(New)"}</h2>
        <form onSubmit={handleSubmit}>
          <input
            data-testid="recipe-name"
            value={recipe?.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Recipe name"
          />
          <button
            type="submit"
            disabled={!canSave || saving}
            data-testid="save-button"
          >
            {saving ? "Saving..." : isEditing ? "Update Recipe" : "Save Recipe"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            data-testid="cancel-button"
          >
            Cancel
          </button>
        </form>
        {hasUnsavedChanges && <span data-testid="unsaved-indicator">*</span>}
      </div>
    );
  };
});

jest.mock("../../src/components/RecipeBuilder/RecipeMetrics", () => {
  return function MockRecipeMetrics({ metrics, onScale, calculating, recipe }) {
    return (
      <div data-testid="recipe-metrics">
        <h2>Recipe Metrics</h2>
        <div>OG: {metrics?.og || 0}</div>
        <div>ABV: {metrics?.abv || 0}%</div>
        {calculating && <div data-testid="calculating">Calculating...</div>}
        <button
          onClick={() => onScale && onScale(10)}
          data-testid="scale-button"
        >
          Scale Recipe
        </button>
      </div>
    );
  };
});

jest.mock("../../src/components/RecipeBuilder/IngredientsList", () => {
  return function MockIngredientsList({ ingredients, onRemove, isEditing }) {
    return (
      <div data-testid="ingredients-list">
        <h2>Ingredients List</h2>
        {ingredients.map((ingredient) => (
          <div key={ingredient.id} data-testid="ingredient-item">
            <span>{ingredient.name}</span>
            {isEditing && (
              <button
                onClick={() => onRemove(ingredient.id)}
                data-testid={`remove-${ingredient.id}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock(
  "../../src/components/RecipeBuilder/IngredientInputs/IngredientInputsContainer",
  () => {
    return function MockIngredientInputsContainer({
      ingredients,
      addIngredient,
      disabled,
    }) {
      return (
        <div data-testid="ingredient-inputs">
          <h2>Add Ingredients</h2>
          <button
            onClick={() =>
              addIngredient("grain", {
                ingredient_id: "1",
                amount: 8,
                unit: "lb",
              })
            }
            disabled={disabled}
            data-testid="add-grain-button"
          >
            Add Grain
          </button>
          <button
            onClick={() =>
              addIngredient("yeast", {
                ingredient_id: "2",
                amount: 1,
                unit: "pkg",
              })
            }
            disabled={disabled}
            data-testid="add-yeast-button"
          >
            Add Yeast
          </button>
        </div>
      );
    };
  }
);

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("RecipeBuilder", () => {
  let mockHookReturn;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useParams to return no recipeId by default
    mockUseParams.mockReturnValue({});

    // Default mock hook return
    mockHookReturn = {
      // Core data
      recipe: {
        name: "",
        style: "",
        batch_size: 5,
        description: "",
        boil_time: 60,
        efficiency: 75,
        is_public: false,
        notes: "",
      },
      ingredients: [],
      availableIngredients: {
        grain: [],
        hop: [],
        yeast: [],
        other: [],
      },
      metrics: {
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      },

      // UI state
      loading: false,
      saving: false,
      error: null,
      hasUnsavedChanges: false,
      calculatingMetrics: false,
      addingIngredient: false,

      // Actions
      updateRecipe: jest.fn(),
      addIngredient: jest.fn(),
      removeIngredient: jest.fn(),
      scaleRecipe: jest.fn(),
      saveRecipe: jest.fn(),
      clearError: jest.fn(),

      // Computed properties
      isEditing: false,
      canSave: false,
      recipeDisplayName: "New Recipe",
    };

    useRecipeBuilder.mockReturnValue(mockHookReturn);
  });

  describe("New Recipe Creation", () => {
    test("renders new recipe builder correctly", () => {
      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Create New Recipe")).toBeInTheDocument();
      expect(screen.getByTestId("recipe-details")).toBeInTheDocument();
      expect(screen.getByTestId("recipe-metrics")).toBeInTheDocument();
      expect(screen.getByTestId("ingredients-list")).toBeInTheDocument();
      expect(screen.getByTestId("ingredient-inputs")).toBeInTheDocument();
      expect(screen.getByText("Recipe Details (New)")).toBeInTheDocument();
    });

    test("hook is called with undefined recipeId for new recipe", () => {
      renderWithRouter(<RecipeBuilder />);
      expect(useRecipeBuilder).toHaveBeenCalledWith(undefined);
    });

    test("displays correct page title for new recipe", () => {
      renderWithRouter(<RecipeBuilder />);
      expect(screen.getByText("Create New Recipe")).toBeInTheDocument();
    });
  });

  describe("Existing Recipe Editing", () => {
    beforeEach(() => {
      // Set up useParams to return a recipeId
      mockUseParams.mockReturnValue({ recipeId: "recipe-123" });

      mockHookReturn.isEditing = true;
      mockHookReturn.recipeDisplayName = "Test IPA";
      mockHookReturn.recipe.name = "Test IPA";
      useRecipeBuilder.mockReturnValue(mockHookReturn);
    });

    test("renders edit recipe builder correctly", () => {
      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Edit Recipe: Test IPA")).toBeInTheDocument();
      expect(screen.getByText("Recipe Details (Editing)")).toBeInTheDocument();
    });

    test("hook is called with correct recipeId for editing", () => {
      renderWithRouter(<RecipeBuilder />);
      expect(useRecipeBuilder).toHaveBeenCalledWith("recipe-123");
    });
  });

  describe("Loading States", () => {
    test("shows loading state when loading is true", () => {
      mockHookReturn.loading = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Loading recipe builder...")).toBeInTheDocument();
      expect(screen.queryByTestId("recipe-details")).not.toBeInTheDocument();
    });

    test("shows calculating metrics indicator", () => {
      mockHookReturn.calculatingMetrics = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Calculating metrics...")).toBeInTheDocument();
      expect(screen.getByTestId("calculating")).toBeInTheDocument();
    });

    test("shows adding ingredient indicator", () => {
      mockHookReturn.addingIngredient = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Adding ingredient...")).toBeInTheDocument();
    });

    test("shows saving indicator", () => {
      mockHookReturn.saving = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Saving recipe...")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    test("displays error message when error exists", () => {
      mockHookReturn.error = "Failed to load ingredients";
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(
        screen.getByText("Failed to load ingredients")
      ).toBeInTheDocument();
    });

    test("error can be dismissed", async () => {
      const user = userEvent.setup();
      mockHookReturn.error = "Test error";
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const dismissButton = screen.getByTitle("Dismiss error");
      await user.click(dismissButton);

      expect(mockHookReturn.clearError).toHaveBeenCalled();
    });
  });

  describe("Recipe Operations", () => {
    test("handles recipe field updates", async () => {
      mockHookReturn.canSave = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const nameInput = screen.getByTestId("recipe-name");

      // Use fireEvent.change for predictable single update
      fireEvent.change(nameInput, { target: { value: "Test Recipe" } });

      // Verify the update was called with the correct values
      expect(mockHookReturn.updateRecipe).toHaveBeenCalledWith(
        "name",
        "Test Recipe"
      );
    });

    test("handles recipe saving", async () => {
      const user = userEvent.setup();
      mockHookReturn.canSave = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const saveButton = screen.getByTestId("save-button");
      await user.click(saveButton);

      expect(mockHookReturn.saveRecipe).toHaveBeenCalled();
    });

    test("save button is disabled when cannot save", () => {
      mockHookReturn.canSave = false;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const saveButton = screen.getByTestId("save-button");
      expect(saveButton).toBeDisabled();
    });

    test("save button is disabled when saving", () => {
      mockHookReturn.saving = true;
      mockHookReturn.canSave = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const saveButton = screen.getByTestId("save-button");
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveTextContent("Saving...");
    });
  });

  describe("Ingredient Management", () => {
    beforeEach(() => {
      mockHookReturn.ingredients = [
        {
          id: "1",
          name: "Pale Malt",
          type: "grain",
          amount: 8,
          unit: "lb",
        },
        {
          id: "2",
          name: "US-05",
          type: "yeast",
          amount: 1,
          unit: "pkg",
        },
      ];
      useRecipeBuilder.mockReturnValue(mockHookReturn);
    });

    test("displays ingredients correctly", () => {
      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      expect(screen.getByText("US-05")).toBeInTheDocument();
    });

    test("handles adding ingredients", async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecipeBuilder />);

      const addGrainButton = screen.getByTestId("add-grain-button");
      await user.click(addGrainButton);

      expect(mockHookReturn.addIngredient).toHaveBeenCalledWith("grain", {
        ingredient_id: "1",
        amount: 8,
        unit: "lb",
      });
    });

    test("handles removing ingredients", async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecipeBuilder />);

      const removeButton = screen.getByTestId("remove-1");
      await user.click(removeButton);

      expect(mockHookReturn.removeIngredient).toHaveBeenCalledWith("1");
    });

    test("ingredient inputs are disabled when adding ingredient", () => {
      mockHookReturn.addingIngredient = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const addGrainButton = screen.getByTestId("add-grain-button");
      expect(addGrainButton).toBeDisabled();
    });
  });

  describe("Recipe Scaling", () => {
    test("handles recipe scaling", async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecipeBuilder />);

      const scaleButton = screen.getByTestId("scale-button");
      await user.click(scaleButton);

      expect(mockHookReturn.scaleRecipe).toHaveBeenCalledWith(10);
    });
  });

  describe("Navigation and Cancel", () => {
    test("handles cancel without unsaved changes", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = false;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const cancelButton = screen.getByTestId("cancel-button");
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith("/recipes");
    });

    test("handles cancel with unsaved changes - confirm leave", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = jest.fn(() => true);

      renderWithRouter(<RecipeBuilder />);

      const cancelButton = screen.getByTestId("cancel-button");
      await user.click(cancelButton);

      expect(window.confirm).toHaveBeenCalledWith(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/recipes");

      // Restore window.confirm
      window.confirm = originalConfirm;
    });

    test("handles cancel with unsaved changes - stay on page", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      // Mock window.confirm to return false
      const originalConfirm = window.confirm;
      window.confirm = jest.fn(() => false);

      renderWithRouter(<RecipeBuilder />);

      const cancelButton = screen.getByTestId("cancel-button");
      await user.click(cancelButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();

      // Restore window.confirm
      window.confirm = originalConfirm;
    });
  });

  describe("Unsaved Changes Detection", () => {
    test("shows unsaved changes indicator", () => {
      mockHookReturn.hasUnsavedChanges = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByTestId("unsaved-indicator")).toBeInTheDocument();
      expect(screen.getByTitle("You have unsaved changes")).toBeInTheDocument();
    });

    test("floating action bar save button works", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = true;
      mockHookReturn.canSave = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      // The floating action bar has its own save button
      const saveButtons = screen.getAllByText("Save Recipe");
      const floatingActionBarSaveButton = saveButtons[saveButtons.length - 1];

      await user.click(floatingActionBarSaveButton);

      expect(mockHookReturn.saveRecipe).toHaveBeenCalled();
    });
  });

  describe("BeforeUnload Event Handling", () => {
    test("sets up beforeunload event when hasUnsavedChanges is true", () => {
      mockHookReturn.hasUnsavedChanges = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      const { unmount } = renderWithRouter(<RecipeBuilder />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    test("does not set up beforeunload event when no unsaved changes", () => {
      mockHookReturn.hasUnsavedChanges = false;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      renderWithRouter(<RecipeBuilder />);

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });
  });

  describe("Component Integration", () => {
    test("passes correct props to RecipeDetails", () => {
      mockHookReturn.hasUnsavedChanges = true;
      mockHookReturn.saving = true;
      mockHookReturn.canSave = false;
      mockHookReturn.isEditing = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      // Check that props are passed correctly through the mocked component
      expect(screen.getByText("Recipe Details (Editing)")).toBeInTheDocument();
      expect(screen.getByTestId("unsaved-indicator")).toBeInTheDocument();
      expect(screen.getByTestId("save-button")).toBeDisabled();
      // Use getAllByText since there are multiple "Saving..." buttons
      const savingTexts = screen.getAllByText("Saving...");
      expect(savingTexts.length).toBeGreaterThan(0);
    });

    test("passes correct props to RecipeMetrics", () => {
      mockHookReturn.calculatingMetrics = true;
      mockHookReturn.metrics = {
        og: 1.065,
        fg: 1.012,
        abv: 6.9,
        ibu: 65,
        srm: 6.5,
      };
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("OG: 1.065")).toBeInTheDocument();
      expect(screen.getByText("ABV: 6.9%")).toBeInTheDocument();
      expect(screen.getByTestId("calculating")).toBeInTheDocument();
    });

    test("passes correct props to IngredientsList", () => {
      mockHookReturn.ingredients = [
        { id: "1", name: "Test Ingredient", type: "grain" },
      ];
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Test Ingredient")).toBeInTheDocument();
      expect(screen.getByTestId("remove-1")).toBeInTheDocument();
    });

    test("passes correct props to IngredientInputsContainer", () => {
      mockHookReturn.addingIngredient = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const addGrainButton = screen.getByTestId("add-grain-button");
      expect(addGrainButton).toBeDisabled();
    });
  });

  describe("Status Indicators Priority", () => {
    test("shows all status indicators when multiple states are active", () => {
      mockHookReturn.calculatingMetrics = true;
      mockHookReturn.addingIngredient = true;
      mockHookReturn.saving = true;
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Calculating metrics...")).toBeInTheDocument();
      expect(screen.getByText("Adding ingredient...")).toBeInTheDocument();
      expect(screen.getByText("Saving recipe...")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("has proper heading structure", () => {
      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Create New Recipe"
      );
    });

    test("error message has proper role", () => {
      mockHookReturn.error = "Test error";
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const errorElement = screen
        .getByText("Test error")
        .closest(".error-banner");
      expect(errorElement).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    test("handles missing recipe data gracefully", () => {
      mockHookReturn.recipe = {
        name: "",
        style: "",
        batch_size: 5,
        description: "",
        boil_time: 60,
        efficiency: 75,
        is_public: false,
        notes: "",
      };
      mockHookReturn.ingredients = [];
      mockHookReturn.metrics = {
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      };
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      // Should not crash when recipe has empty/default values
      expect(() => renderWithRouter(<RecipeBuilder />)).not.toThrow();
    });

    test("handles empty ingredients array", () => {
      mockHookReturn.ingredients = [];
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByTestId("ingredients-list")).toBeInTheDocument();
    });

    test("handles missing metrics data gracefully", () => {
      mockHookReturn.metrics = {
        og: 0,
        fg: 0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      };
      useRecipeBuilder.mockReturnValue(mockHookReturn);

      expect(() => renderWithRouter(<RecipeBuilder />)).not.toThrow();
    });
  });
});
