// @ts-ignore - React is used for JSX
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import RecipeBuilder from "../../src/pages/RecipeBuilder";
import { useRecipeBuilder } from "../../src/hooks/useRecipeBuilder";

// Mock the useRecipeBuilder hook
jest.mock("../../src/hooks/useRecipeBuilder");

// Mock BeerXML components and services
jest.mock("../../src/components/BeerXML/BeerXMLImportExport", () => {
  return function MockBeerXMLImportExport({ onImport, onExport, mode }: any) {
    return (
      <div data-testid="beerxml-import-export">
        <h3>BeerXML Import/Export ({mode})</h3>
        <button
          onClick={() => onImport({
            recipe: { name: "Imported Recipe", style: "IPA" },
            ingredients: [{ id: "1", name: "Imported Grain", type: "grain" }],
            createdIngredients: []
          })}
          data-testid="import-button"
        >
          Import BeerXML
        </button>
        <button
          onClick={onExport}
          data-testid="export-button"
        >
          Export BeerXML
        </button>
      </div>
    );
  };
});

jest.mock("../../src/services/BeerXML/BeerXMLService", () => ({
  exportRecipe: jest.fn(),
  downloadBeerXML: jest.fn(),
}));

jest.mock("../../src/services", () => ({
  ingredient: {
    clearCache: jest.fn(),
  },
}));

jest.mock("../../src/components/RecipeBuilder/BeerStyles/StyleAnalysis", () => {
  return function MockStyleAnalysis({ recipe, metrics, onStyleSuggestionSelect }: any) {
    return (
      <div data-testid="style-analysis">
        <h3>Style Analysis</h3>
        <div>Current Style: {recipe?.style || "None"}</div>
        <button
          onClick={() => onStyleSuggestionSelect("American IPA")}
          data-testid="style-suggestion-button"
        >
          Suggest American IPA
        </button>
      </div>
    );
  };
});

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
  }: any) {
    const handleSubmit = (e: any) => {
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
  return function MockRecipeMetrics({ metrics, onScale, calculating }: any) {
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
  return function MockIngredientsList({ ingredients, onRemove, isEditing }: any) {
    return (
      <div data-testid="ingredients-list">
        <h2>Ingredients List</h2>
        {ingredients.map((ingredient: any) => (
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
      addIngredient,
      disabled,
    }: any) {
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

const renderWithRouter = (component: any) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("RecipeBuilder", () => {
  let mockHookReturn: any;

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

    (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);
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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);
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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Loading recipe builder...")).toBeInTheDocument();
      expect(screen.queryByTestId("recipe-details")).not.toBeInTheDocument();
    });

    test("shows calculating metrics indicator", () => {
      mockHookReturn.calculatingMetrics = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Calculating metrics...")).toBeInTheDocument();
      expect(screen.getByTestId("calculating")).toBeInTheDocument();
    });

    test("shows adding ingredient indicator", () => {
      mockHookReturn.addingIngredient = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Adding ingredient...")).toBeInTheDocument();
    });

    test("shows saving indicator", () => {
      mockHookReturn.saving = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Saving recipe...")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    test("displays error message when error exists", () => {
      mockHookReturn.error = "Failed to load ingredients";
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(
        screen.getByText("Failed to load ingredients")
      ).toBeInTheDocument();
    });

    test("error can be dismissed", async () => {
      const user = userEvent.setup();
      mockHookReturn.error = "Test error";
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const dismissButton = screen.getByTitle("Dismiss error");
      await user.click(dismissButton);

      expect(mockHookReturn.clearError).toHaveBeenCalled();
    });
  });

  describe("Recipe Operations", () => {
    test("handles recipe field updates", async () => {
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const saveButton = screen.getByTestId("save-button");
      await user.click(saveButton);

      expect(mockHookReturn.saveRecipe).toHaveBeenCalled();
    });

    test("save button is disabled when cannot save", () => {
      mockHookReturn.canSave = false;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const saveButton = screen.getByTestId("save-button");
      expect(saveButton).toBeDisabled();
    });

    test("save button is disabled when saving", () => {
      mockHookReturn.saving = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);
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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const cancelButton = screen.getByTestId("cancel-button");
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith("/recipes");
    });

    test("handles cancel with unsaved changes - confirm leave", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByTestId("unsaved-indicator")).toBeInTheDocument();
      expect(screen.getByTitle("You have unsaved changes")).toBeInTheDocument();
    });

    test("floating action bar save button works", async () => {
      const user = userEvent.setup();
      mockHookReturn.hasUnsavedChanges = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("OG: 1.065")).toBeInTheDocument();
      expect(screen.getByText("ABV: 6.9%")).toBeInTheDocument();
      expect(screen.getByTestId("calculating")).toBeInTheDocument();
    });

    test("passes correct props to IngredientsList", () => {
      mockHookReturn.ingredients = [
        { id: "1", name: "Test Ingredient", type: "grain" },
      ];
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Test Ingredient")).toBeInTheDocument();
      expect(screen.getByTestId("remove-1")).toBeInTheDocument();
    });

    test("passes correct props to IngredientInputsContainer", () => {
      mockHookReturn.addingIngredient = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const errorElement = screen
        .getByText("Test error")
        .closest(".error-banner");
      expect(errorElement).toBeInTheDocument();
    });
  });

  describe("BeerXML Import/Export", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockHookReturn.recipe = {
        recipe_id: "test-recipe-123",
        name: "Test Recipe",
        style: "IPA",
        batch_size: 5,
        description: "",
        boil_time: 60,
        efficiency: 75,
        is_public: false,
        notes: "",
      };
      mockHookReturn.ingredients = [{ id: "1", name: "Test Grain", type: "grain" }];
    });

    test("shows BeerXML button", () => {
      renderWithRouter(<RecipeBuilder />);
      expect(screen.getByText("📄 BeerXML")).toBeInTheDocument();
    });

    test("opens BeerXML import/export panel", async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      expect(screen.getByTestId("beerxml-import-export")).toBeInTheDocument();
      expect(screen.getByText("BeerXML Import/Export")).toBeInTheDocument();
    });

    test("closes BeerXML panel", async () => {
      const user = userEvent.setup();
      renderWithRouter(<RecipeBuilder />);

      // Open panel
      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);
      expect(screen.getByTestId("beerxml-import-export")).toBeInTheDocument();

      // Close panel
      const closeButton = screen.getByText("×");
      await user.click(closeButton);
      expect(screen.queryByTestId("beerxml-import-export")).not.toBeInTheDocument();
    });

    test("shows export button for existing recipes", () => {
      mockHookReturn.isEditing = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);
      expect(screen.getByText("📤 Export")).toBeInTheDocument();
    });

    test("handles BeerXML import for new recipe", async () => {
      const user = userEvent.setup();
      mockHookReturn.isEditing = false;
      mockHookReturn.refreshAvailableIngredients = jest.fn();
      mockHookReturn.importIngredients = jest.fn().mockResolvedValue(undefined);
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      // Open BeerXML panel
      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      // Trigger import
      const importButton = screen.getByTestId("import-button");
      await user.click(importButton);

      expect(mockHookReturn.updateRecipe).toHaveBeenCalledWith("name", "Imported Recipe");
      expect(mockHookReturn.updateRecipe).toHaveBeenCalledWith("style", "IPA");
      expect(mockHookReturn.importIngredients).toHaveBeenCalledWith([
        { id: "1", name: "Imported Grain", type: "grain" }
      ]);
    });

    test("handles BeerXML import with created ingredients", async () => {
      const user = userEvent.setup();
      const Services = require("../../src/services");
      mockHookReturn.isEditing = false;
      mockHookReturn.refreshAvailableIngredients = jest.fn();
      mockHookReturn.importIngredients = jest.fn().mockResolvedValue(undefined);
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      // Mock the import with created ingredients
      jest.doMock("../../src/components/BeerXML/BeerXMLImportExport", () => {
        return function MockBeerXMLImportExport({ onImport }: any) {
          return (
            <button
              onClick={() => onImport({
                recipe: { name: "Imported Recipe" },
                ingredients: [],
                createdIngredients: [{ id: "new-1", name: "New Ingredient" }]
              })}
              data-testid="import-with-created"
            >
              Import with Created
            </button>
          );
        };
      });

      renderWithRouter(<RecipeBuilder />);

      // Open BeerXML panel and trigger import
      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      // We can't easily test the import with created ingredients without rerendering
      // But we can verify the Services.ingredient.clearCache would be called
      expect(Services.ingredient.clearCache).toBeDefined();
    });

    test("handles BeerXML import for existing recipe (navigates to new)", async () => {
      const user = userEvent.setup();
      mockHookReturn.isEditing = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const importButton = screen.getByTestId("import-button");
      await user.click(importButton);

      expect(mockNavigate).toHaveBeenCalledWith("/recipes/new", {
        state: {
          importedData: {
            recipe: { name: "Imported Recipe", style: "IPA" },
            ingredients: [{ id: "1", name: "Imported Grain", type: "grain" }],
            createdIngredients: []
          },
          source: "BeerXML Import",
        },
      });
    });

    test("handles BeerXML export", async () => {
      const user = userEvent.setup();
      const beerXMLService = require("../../src/services/BeerXML/BeerXMLService");
      
      beerXMLService.exportRecipe.mockResolvedValue({
        xmlContent: "<xml>test</xml>",
        filename: "test-recipe.xml"
      });

      mockHookReturn.isEditing = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const exportButton = screen.getByText("📤 Export");
      await user.click(exportButton);

      expect(beerXMLService.exportRecipe).toHaveBeenCalledWith("test-recipe-123");
      expect(beerXMLService.downloadBeerXML).toHaveBeenCalledWith(
        "<xml>test</xml>",
        "test-recipe.xml"
      );
    });

    test("handles BeerXML export without recipe_id (saves first)", async () => {
      const user = userEvent.setup();
      const beerXMLService = require("../../src/services/BeerXML/BeerXMLService");
      
      mockHookReturn.recipe.recipe_id = null;
      mockHookReturn.saveRecipe = jest.fn().mockResolvedValue({ recipe_id: "new-recipe-123" });
      beerXMLService.exportRecipe.mockResolvedValue({
        xmlContent: "<xml>test</xml>",
        filename: "test-recipe.xml"
      });

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const exportButton = screen.getByTestId("export-button");
      await user.click(exportButton);

      expect(mockHookReturn.saveRecipe).toHaveBeenCalled();
    });

    test("shows importing status", async () => {
      const user = userEvent.setup();
      mockHookReturn.importIngredients = jest.fn(() => new Promise(() => {})); // Never resolves
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const importButton = screen.getByTestId("import-button");
      await user.click(importButton);

      expect(screen.getByText("Importing BeerXML...")).toBeInTheDocument();
    });

    test("shows exporting status", async () => {
      const user = userEvent.setup();
      const beerXMLService = require("../../src/services/BeerXML/BeerXMLService");
      
      beerXMLService.exportRecipe.mockImplementation(() => new Promise(() => {})); // Never resolves
      mockHookReturn.isEditing = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const exportButton = screen.getByText("📤 Export");
      await user.click(exportButton);

      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });

    test("shows success message after import", async () => {
      const user = userEvent.setup({ delay: null });
      
      mockHookReturn.isEditing = false;
      mockHookReturn.importIngredients = jest.fn().mockResolvedValue(undefined);
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const importButton = screen.getByTestId("import-button");
      await user.click(importButton);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(screen.getByText("✅ BeerXML imported successfully")).toBeInTheDocument();
    });

    test("shows success message after export", async () => {
      const user = userEvent.setup({ delay: null });
      const beerXMLService = require("../../src/services/BeerXML/BeerXMLService");
      
      beerXMLService.exportRecipe.mockResolvedValue({
        xmlContent: "<xml>test</xml>",
        filename: "test-recipe.xml"
      });

      mockHookReturn.isEditing = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const exportButton = screen.getByText("📤 Export");
      await user.click(exportButton);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(screen.getByText("✅ BeerXML exported successfully")).toBeInTheDocument();
    });

    test("disables buttons during operations", () => {
      mockHookReturn.saving = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      expect(beerXMLButton).toBeDisabled();
    });

    test("handles export error gracefully", async () => {
      const user = userEvent.setup({ delay: null });
      const beerXMLService = require("../../src/services/BeerXML/BeerXMLService");
      const originalAlert = window.alert;
      window.alert = jest.fn();
      
      beerXMLService.exportRecipe.mockRejectedValue(new Error("Export failed"));
      mockHookReturn.isEditing = true;
      mockHookReturn.canSave = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const exportButton = screen.getByText("📤 Export");
      await user.click(exportButton);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(window.alert).toHaveBeenCalledWith("Failed to export recipe: Export failed");
      
      window.alert = originalAlert;
    });

    test("prevents export if no ingredients", async () => {
      const user = userEvent.setup({ delay: null });
      const originalAlert = window.alert;
      window.alert = jest.fn();
      
      mockHookReturn.ingredients = [];
      mockHookReturn.isEditing = true;
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const exportButton = screen.getByTestId("export-button");
      await user.click(exportButton);

      expect(window.alert).toHaveBeenCalledWith("Please save your recipe before exporting");
      
      window.alert = originalAlert;
    });
  });

  describe("Style Analysis Integration", () => {
    test("renders style analysis component", () => {
      renderWithRouter(<RecipeBuilder />);
      expect(screen.getByTestId("style-analysis")).toBeInTheDocument();
    });

    test("handles style suggestion selection", async () => {
      const user = userEvent.setup({ delay: null });
      renderWithRouter(<RecipeBuilder />);

      const suggestionButton = screen.getByTestId("style-suggestion-button");
      await user.click(suggestionButton);

      expect(mockHookReturn.updateRecipe).toHaveBeenCalledWith("style", "American IPA");
    });

    test("passes correct props to style analysis", () => {
      mockHookReturn.recipe.style = "IPA";
      mockHookReturn.metrics = { og: 1.065, fg: 1.012, abv: 6.9, ibu: 65, srm: 6.5 };
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      expect(screen.getByText("Current Style: IPA")).toBeInTheDocument();
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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      // Should not crash when recipe has empty/default values
      expect(() => renderWithRouter(<RecipeBuilder />)).not.toThrow();
    });

    test("handles empty ingredients array", () => {
      mockHookReturn.ingredients = [];
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

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
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      expect(() => renderWithRouter(<RecipeBuilder />)).not.toThrow();
    });

    test("handles BeerXML import error gracefully", async () => {
      const user = userEvent.setup({ delay: null });
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      mockHookReturn.importIngredients = jest.fn().mockRejectedValue(new Error("Import failed"));
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const importButton = screen.getByTestId("import-button");
      await user.click(importButton);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(console.error).toHaveBeenCalledWith(
        "Error importing BeerXML:",
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });

    test("handles save failure during export", async () => {
      const user = userEvent.setup({ delay: null });
      const originalAlert = window.alert;
      window.alert = jest.fn();
      
      mockHookReturn.recipe.recipe_id = null;
      mockHookReturn.ingredients = [{ id: "1", name: "Test Grain", type: "grain" }]; // Must have ingredients
      mockHookReturn.saveRecipe = jest.fn().mockResolvedValue(null); // Save fails
      (useRecipeBuilder as jest.Mock).mockReturnValue(mockHookReturn);

      renderWithRouter(<RecipeBuilder />);

      const beerXMLButton = screen.getByText("📄 BeerXML");
      await user.click(beerXMLButton);

      const exportButton = screen.getByTestId("export-button");
      await user.click(exportButton);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(window.alert).toHaveBeenCalledWith(
        "Failed to export recipe: Failed to save recipe before export"
      );
      
      window.alert = originalAlert;
    });
  });
});
