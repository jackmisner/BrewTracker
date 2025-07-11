import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useRecipeBuilder } from "../hooks/useRecipeBuilder";
import BeerXMLImportExport from "../components/BeerXML/BeerXMLImportExport";
import beerXMLService from "../services/BeerXML/BeerXMLService";
import RecipeDetails from "../components/RecipeBuilder/RecipeDetails";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import IngredientInputsContainer from "../components/RecipeBuilder/IngredientInputs/IngredientInputsContainer";
import StyleAnalysis from "../components/RecipeBuilder/BeerStyles/StyleAnalysis";
import AISuggestions from "../components/RecipeBuilder/AISuggestions";
import Services from "../services";
import { Recipe, RecipeIngredient } from "../types";
import "../styles/RecipeBuilder.css";

// BeerXML state interface
interface BeerXMLState {
  showImportExport: boolean;
  importing: boolean;
  exporting: boolean;
  importSuccess: boolean;
  exportSuccess: boolean;
}

// BeerXML import data interface
interface BeerXMLImportData {
  recipe: Partial<Recipe>;
  ingredients: RecipeIngredient[];
  createdIngredients?: any[];
}

function RecipeBuilder(): React.ReactElement {
  const { recipeId } = useParams<{ recipeId?: string }>();
  const navigate = useNavigate();

  // BeerXML state
  const [beerXMLState, setBeerXMLState] = useState<BeerXMLState>({
    showImportExport: false,
    importing: false,
    exporting: false,
    importSuccess: false,
    exportSuccess: false,
  });

  // Use custom hook to manage recipe builder state and logic
  const {
    // Core data
    recipe,
    ingredients,
    availableIngredients,
    metrics,

    // UI state
    loading,
    saving,
    error,
    hasUnsavedChanges,
    calculatingMetrics,
    addingIngredient,
    updatingIngredient,

    // Actions
    updateRecipe,
    addIngredient,
    updateIngredient,
    bulkUpdateIngredients,
    removeIngredient,
    importIngredients,
    importRecipeData,
    scaleRecipe,
    saveRecipe,
    clearError,
    refreshAvailableIngredients,

    // Computed properties
    isEditing,
    canSave,
    recipeDisplayName,
  } = useRecipeBuilder(recipeId);

  /**
   * Handle BeerXML import - UPDATED to handle cache invalidation and avoid race conditions
   */
  const handleBeerXMLImport = async (importData: BeerXMLImportData): Promise<void> => {
    setBeerXMLState((prev) => ({ ...prev, importing: true }));

    try {
      // Handle created ingredients first - refresh available ingredients cache
      if (
        importData.createdIngredients &&
        importData.createdIngredients.length > 0
      ) {
        // Clear the ingredient service cache and refresh in the hook
        Services.ingredient.clearCache();
        await refreshAvailableIngredients();
      }

      // For new recipes, replace current recipe with imported data
      if (!isEditing) {
        // Import all recipe data at once to avoid timing issues
        if (importData.recipe && typeof importData.recipe === 'object') {
          // Extract recipe data excluding ingredients since they're handled separately
          const { ingredients: _, ...recipeData } = importData.recipe;
          await importRecipeData(recipeData);
        }

        // Add ALL ingredients at once instead of one by one to avoid race conditions
        await importIngredients(importData.ingredients);

        setBeerXMLState((prev) => ({
          ...prev,
          importing: false,
          showImportExport: false,
          importSuccess: true,
        }));

        // Show success message
        setTimeout(() => {
          setBeerXMLState((prev) => ({ ...prev, importSuccess: false }));
        }, 3000);
      } else {
        // For existing recipes, navigate to new recipe with imported data
        navigate("/recipes/new", {
          state: {
            importedData: importData,
            source: "BeerXML Import",
          },
        });
      }
    } catch (error) {
      console.error("Error importing BeerXML:", error);
      setBeerXMLState((prev) => ({ ...prev, importing: false }));
      // Error handling is done by the component
    }
  };

  /**
   * Handle BeerXML export
   */
  const handleBeerXMLExport = async (): Promise<void> => {
    if (!recipe || !ingredients.length) {
      alert("Please save your recipe before exporting");
      return;
    }

    setBeerXMLState((prev) => ({ ...prev, exporting: true }));

    try {
      if (!recipe.recipe_id) {
        // Save recipe first
        const savedRecipe = await saveRecipe();
        if (!savedRecipe) {
          throw new Error("Failed to save recipe before export");
        }
      }

      // Export using backend service
      const exportResult = await beerXMLService.exportRecipe(recipe.recipe_id);

      // Download the file
      beerXMLService.downloadBeerXML(
        exportResult.xmlContent,
        exportResult.filename
      );

      setBeerXMLState((prev) => ({
        ...prev,
        exporting: false,
        exportSuccess: true,
      }));

      // Show success message
      setTimeout(() => {
        setBeerXMLState((prev) => ({ ...prev, exportSuccess: false }));
      }, 3000);
    } catch (error) {
      console.error("Error exporting BeerXML:", error);
      setBeerXMLState((prev) => ({ ...prev, exporting: false }));
      alert(`Failed to export recipe: ${(error as Error).message}`);
    }
  };

  const handleCancel = (): void => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    navigate("/recipes");
  };

  // Handle beforeUnload event to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Show loading state
  if (loading) {
    return React.createElement(
      "div",
      { className: "container" },
      React.createElement(
        "div",
        { className: "loading-container" },
        React.createElement("div", { className: "loading-spinner" }),
        React.createElement("p", null, "Loading recipe builder...")
      )
    );
  }

  return React.createElement(
    "div",
    { id: "recipe-builder", className: "container" },
    
    // Header with title, status indicators, and BeerXML actions
    React.createElement(
      "div",
      { className: "recipe-builder-header" },
      React.createElement(
        "div",
        { className: "header-main" },
        React.createElement(
          "h1",
          { className: "page-title" },
          isEditing
            ? `Edit Recipe: ${recipeDisplayName}`
            : "Create New Recipe",
          hasUnsavedChanges &&
            React.createElement(
              "span",
              {
                className: "unsaved-indicator",
                title: "You have unsaved changes",
              },
              " *"
            )
        ),

        // BeerXML Actions
        React.createElement(
          "div",
          { className: "beerxml-actions" },
          React.createElement(
            "button",
            {
              onClick: () =>
                setBeerXMLState((prev) => ({
                  ...prev,
                  showImportExport: !prev.showImportExport,
                })),
              className: "btn btn-outline",
              disabled: saving || beerXMLState.importing || beerXMLState.exporting,
            },
            "📄 BeerXML"
          ),

          // Quick export button for existing recipes
          isEditing && recipe.recipe_id &&
            React.createElement(
              "button",
              {
                onClick: handleBeerXMLExport,
                disabled: beerXMLState.exporting || !canSave,
                className: "btn btn-secondary",
                title: "Export to BeerXML",
              },
              beerXMLState.exporting
                ? React.createElement(
                    React.Fragment,
                    null,
                    React.createElement("span", { className: "button-spinner" }),
                    "Exporting..."
                  )
                : "📤 Export"
            )
        )
      ),

      // Status indicators
      React.createElement(
        "div",
        { className: "status-indicators" },
        calculatingMetrics &&
          React.createElement(
            "div",
            { className: "status-indicator calculating" },
            React.createElement("span", { className: "spinner" }),
            "Calculating metrics..."
          ),

        addingIngredient &&
          React.createElement(
            "div",
            { className: "status-indicator adding" },
            React.createElement("span", { className: "spinner" }),
            "Adding ingredient..."
          ),

        updatingIngredient &&
          React.createElement(
            "div",
            { className: "status-indicator updating" },
            React.createElement("span", { className: "spinner" }),
            "Updating ingredient..."
          ),

        saving &&
          React.createElement(
            "div",
            { className: "status-indicator saving" },
            React.createElement("span", { className: "spinner" }),
            "Saving recipe..."
          ),

        beerXMLState.importing &&
          React.createElement(
            "div",
            { className: "status-indicator importing" },
            React.createElement("span", { className: "spinner" }),
            "Importing BeerXML..."
          ),

        beerXMLState.importSuccess &&
          React.createElement(
            "div",
            { className: "status-indicator success" },
            "✅ BeerXML imported successfully"
          ),

        beerXMLState.exportSuccess &&
          React.createElement(
            "div",
            { className: "status-indicator success" },
            "✅ BeerXML exported successfully"
          )
      )
    ),

    // Error display with dismiss option
    error &&
      React.createElement(
        "div",
        { className: "error-banner" },
        React.createElement(
          "div",
          { className: "error-content" },
          React.createElement("div", { className: "error-icon" }, "⚠️"),
          React.createElement("div", { className: "error-message" }, error),
          React.createElement(
            "button",
            {
              onClick: clearError,
              className: "error-dismiss",
              title: "Dismiss error",
            },
            "×"
          )
        )
      ),

    // BeerXML Import/Export Panel
    beerXMLState.showImportExport &&
      React.createElement(
        "div",
        { className: "beerxml-panel" },
        React.createElement(
          "div",
          { className: "panel-header" },
          React.createElement("h3", null, "BeerXML Import/Export"),
          React.createElement(
            "button",
            {
              onClick: () =>
                setBeerXMLState((prev) => ({
                  ...prev,
                  showImportExport: false,
                })),
              className: "panel-close",
            },
            "×"
          )
        ),

        React.createElement(
          "div",
          { className: "panel-content" },
          React.createElement(BeerXMLImportExport, {
            recipe: recipe,
            ingredients: ingredients,
            onImport: handleBeerXMLImport,
            onExport: handleBeerXMLExport,
            mode: "both" as const,
          })
        )
      ),

    // Main layout structure for sticky metrics
    React.createElement(
      "div",
      { className: "recipe-builder-layout" },
      React.createElement(
        "div",
        { className: "recipe-builder-main" },
        
        // Recipe Details Form - UPDATED: Pass metrics to RecipeDetails
        React.createElement(RecipeDetails, {
          recipe: recipe,
          onChange: updateRecipe,
          onSubmit: saveRecipe,
          onCancel: handleCancel,
          isEditing: isEditing,
          saving: saving,
          canSave: canSave,
          hasUnsavedChanges: hasUnsavedChanges,
          metrics: metrics, // NEW: Pass metrics for style selector
        }),

        // Ingredients Section
        React.createElement(
          "div",
          { className: "ingredients-section" },
          React.createElement(
            "div",
            { className: "ingredients-header" },
            React.createElement("h2", { className: "section-title" }, "Ingredients")
          ),

          // AI Suggestions
          React.createElement(AISuggestions, {
            recipe: recipe,
            ingredients: ingredients,
            metrics: metrics,
            onBulkIngredientUpdate: bulkUpdateIngredients,
            disabled: addingIngredient || updatingIngredient || saving,
          }),

          // Ingredients List
          React.createElement(IngredientsList, {
            ingredients: ingredients,
            onRemove: removeIngredient,
            onUpdate: updateIngredient,
            isEditing: true,
          }),

          // Ingredient Input Forms
          React.createElement(IngredientInputsContainer, {
            ingredients: availableIngredients,
            addIngredient: addIngredient,
            disabled: addingIngredient || updatingIngredient || saving,
          })
        )
      ),

      // Metrics sidebar - sticky throughout
      React.createElement(
        "div",
        { className: "recipe-builder-sidebar" },
        React.createElement(
          "div",
          { className: "sticky-metrics-wrapper" },
          React.createElement(RecipeMetrics, {
            metrics: metrics,
            onScale: scaleRecipe,
            calculating: calculatingMetrics,
            recipe: recipe,
          }),

          // UPDATED: Enhanced Style Analysis with real-time capabilities
          React.createElement(StyleAnalysis, {
            recipe: recipe,
            metrics: metrics,
            onStyleSuggestionSelect: (styleName: string) =>
              updateRecipe("style", styleName),
          })
        )
      )
    )
  );
}

export default RecipeBuilder;