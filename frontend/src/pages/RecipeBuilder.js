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
import Services from "../services";
import "../styles/RecipeBuilder.css";

function RecipeBuilder() {
  const { recipeId } = useParams();
  const navigate = useNavigate();

  // BeerXML state
  const [beerXMLState, setBeerXMLState] = useState({
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
    removeIngredient,
    importIngredients,
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
  const handleBeerXMLImport = async (importData) => {
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
        // Update recipe details first
        Object.keys(importData.recipe).forEach((key) => {
          updateRecipe(key, importData.recipe[key]);
        });

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
  const handleBeerXMLExport = async () => {
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
      alert(`Failed to export recipe: ${error.message}`);
    }
  };

  const handleCancel = () => {
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
    const handleBeforeUnload = (e) => {
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
    return (
      <div className="container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading recipe builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="recipe-builder" className="container">
      {/* Header with title, status indicators, and BeerXML actions */}
      <div className="recipe-builder-header">
        <div className="header-main">
          <h1 className="page-title">
            {isEditing
              ? `Edit Recipe: ${recipeDisplayName}`
              : "Create New Recipe"}
            {hasUnsavedChanges && (
              <span
                className="unsaved-indicator"
                title="You have unsaved changes"
              >
                {" "}
                *
              </span>
            )}
          </h1>

          {/* BeerXML Actions */}
          <div className="beerxml-actions">
            <button
              onClick={() =>
                setBeerXMLState((prev) => ({
                  ...prev,
                  showImportExport: !prev.showImportExport,
                }))
              }
              className="btn btn-outline"
              disabled={
                saving || beerXMLState.importing || beerXMLState.exporting
              }
            >
              📄 BeerXML
            </button>

            {/* Quick export button for existing recipes */}
            {isEditing && recipe.recipe_id && (
              <button
                onClick={handleBeerXMLExport}
                disabled={beerXMLState.exporting || !canSave}
                className="btn btn-secondary"
                title="Export to BeerXML"
              >
                {beerXMLState.exporting ? (
                  <>
                    <span className="button-spinner"></span>
                    Exporting...
                  </>
                ) : (
                  "📤 Export"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="status-indicators">
          {calculatingMetrics && (
            <div className="status-indicator calculating">
              <span className="spinner"></span>
              Calculating metrics...
            </div>
          )}

          {addingIngredient && (
            <div className="status-indicator adding">
              <span className="spinner"></span>
              Adding ingredient...
            </div>
          )}

          {updatingIngredient && (
            <div className="status-indicator updating">
              <span className="spinner"></span>
              Updating ingredient...
            </div>
          )}

          {saving && (
            <div className="status-indicator saving">
              <span className="spinner"></span>
              Saving recipe...
            </div>
          )}

          {beerXMLState.importing && (
            <div className="status-indicator importing">
              <span className="spinner"></span>
              Importing BeerXML...
            </div>
          )}

          {beerXMLState.importSuccess && (
            <div className="status-indicator success">
              ✅ BeerXML imported successfully
            </div>
          )}

          {beerXMLState.exportSuccess && (
            <div className="status-indicator success">
              ✅ BeerXML exported successfully
            </div>
          )}
        </div>
      </div>

      {/* Error display with dismiss option */}
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <div className="error-message">{error}</div>
            <button
              onClick={clearError}
              className="error-dismiss"
              title="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* BeerXML Import/Export Panel */}
      {beerXMLState.showImportExport && (
        <div className="beerxml-panel">
          <div className="panel-header">
            <h3>BeerXML Import/Export</h3>
            <button
              onClick={() =>
                setBeerXMLState((prev) => ({
                  ...prev,
                  showImportExport: false,
                }))
              }
              className="panel-close"
            >
              ×
            </button>
          </div>

          <div className="panel-content">
            <BeerXMLImportExport
              recipe={recipe}
              ingredients={ingredients}
              availableIngredients={availableIngredients}
              onImport={handleBeerXMLImport}
              onExport={handleBeerXMLExport}
              mode="both"
            />
          </div>
        </div>
      )}

      {/* Main layout structure for sticky metrics */}
      <div className="recipe-builder-layout">
        <div className="recipe-builder-main">
          {/* Recipe Details Form - UPDATED: Pass metrics to RecipeDetails */}
          <RecipeDetails
            recipe={recipe}
            onChange={updateRecipe}
            onSubmit={saveRecipe}
            onCancel={handleCancel}
            isEditing={isEditing}
            saving={saving}
            canSave={canSave}
            hasUnsavedChanges={hasUnsavedChanges}
            metrics={metrics} // NEW: Pass metrics for style selector
          />

          {/* Ingredients Section */}
          <div className="ingredients-section">
            <div className="ingredients-header">
              <h2 className="section-title">Ingredients</h2>
            </div>

            {/* Ingredients List */}
            <IngredientsList
              ingredients={ingredients}
              onRemove={removeIngredient}
              onUpdate={updateIngredient}
              isEditing={true}
            />

            {/* Ingredient Input Forms */}
            <IngredientInputsContainer
              ingredients={availableIngredients}
              addIngredient={addIngredient}
              disabled={addingIngredient || updatingIngredient || saving}
            />
          </div>
        </div>

        {/* Metrics sidebar - sticky throughout */}
        <div className="recipe-builder-sidebar">
          <div className="sticky-metrics-wrapper">
            <RecipeMetrics
              metrics={metrics}
              onScale={scaleRecipe}
              calculating={calculatingMetrics}
              recipe={recipe}
            />

            {/* UPDATED: Enhanced Style Analysis with real-time capabilities */}
            <StyleAnalysis
              recipe={recipe}
              metrics={metrics}
              onStyleSuggestionSelect={(styleName) =>
                updateRecipe("style", styleName)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecipeBuilder;
