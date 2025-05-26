import React from "react";
import { useParams, useNavigate } from "react-router";
import { useRecipeBuilder } from "../hooks/useRecipeBuilder";
import "../styles/RecipeBuilder.css";

// Import components
import RecipeDetails from "../components/RecipeBuilder/RecipeDetails";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import IngredientInputsContainer from "../components/RecipeBuilder/IngredientInputs/IngredientInputsContainer";

function RecipeBuilder() {
  const { recipeId } = useParams();
  const navigate = useNavigate();

  // Single unified hook replaces all the complex state management
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

    // Actions
    updateRecipe,
    addIngredient,
    removeIngredient,
    scaleRecipe,
    saveRecipe,
    clearError,

    // Computed properties
    isEditing,
    canSave,
    recipeDisplayName,
  } = useRecipeBuilder(recipeId);

  // Handle form cancellation with unsaved changes warning
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    navigate("/recipes");
  };

  // Handle beforeunload event to warn about unsaved changes
  React.useEffect(() => {
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
        <div className="text-center py-10">
          <div className="loading-spinner"></div>
          <p>Loading recipe builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="recipe-builder" className="container">
      {/* Header with title and status indicators */}
      <div className="recipe-builder-header">
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

          {saving && (
            <div className="status-indicator saving">
              <span className="spinner"></span>
              Saving recipe...
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

      <div className="grid">
        {/* Recipe Details Form */}
        <div className="grid-col-2-3">
          <RecipeDetails
            recipe={recipe}
            onChange={updateRecipe}
            onSubmit={saveRecipe}
            onCancel={handleCancel}
            isEditing={isEditing}
            saving={saving}
            canSave={canSave}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>

        {/* Recipe Metrics */}
        <div className="grid-col-1-3">
          <RecipeMetrics
            metrics={metrics}
            onScale={scaleRecipe}
            calculating={calculatingMetrics}
            recipe={recipe}
          />
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="ingredients-section">
        <div className="ingredients-header">
          <h2 className="section-title">
            Ingredients
            {ingredients.length > 0 && (
              <span className="ingredient-count">({ingredients.length})</span>
            )}
          </h2>

          {/* Quick stats */}
          {ingredients.length > 0 && (
            <div className="ingredient-stats">
              <span className="stat">
                Grains: {ingredients.filter((i) => i.type === "grain").length}
              </span>
              <span className="stat">
                Hops: {ingredients.filter((i) => i.type === "hop").length}
              </span>
              <span className="stat">
                Yeast: {ingredients.filter((i) => i.type === "yeast").length}
              </span>
            </div>
          )}
        </div>

        {/* Ingredients List */}
        <IngredientsList
          ingredients={ingredients}
          onRemove={removeIngredient}
          isEditing={true}
        />

        {/* Ingredient Input Forms */}
        <IngredientInputsContainer
          ingredients={availableIngredients}
          addIngredient={addIngredient}
          disabled={addingIngredient || saving}
        />
      </div>

      {/* Floating Action Bar (for better UX) */}
      {hasUnsavedChanges && (
        <div className="floating-action-bar">
          <div className="action-bar-content">
            <div className="changes-info">
              <span className="changes-icon">●</span>
              <span className="changes-text">You have unsaved changes</span>
            </div>

            <div className="action-buttons">
              <button
                type="button"
                onClick={handleCancel}
                className="btn btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveRecipe}
                disabled={!canSave}
                className="btn btn-primary"
              >
                {saving ? (
                  <>
                    <span className="button-spinner"></span>
                    Saving...
                  </>
                ) : (
                  `${isEditing ? "Update" : "Save"} Recipe`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Stats Summary */}
      {!loading && ingredients.length > 0 && (
        <div className="recipe-summary">
          <h3 className="summary-title">Recipe Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Total Ingredients:</span>
              <span className="summary-value">{ingredients.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Estimated OG:</span>
              <span className="summary-value">{metrics.og.toFixed(3)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Estimated ABV:</span>
              <span className="summary-value">{metrics.abv.toFixed(1)}%</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Estimated IBU:</span>
              <span className="summary-value">{Math.round(metrics.ibu)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeBuilder;
