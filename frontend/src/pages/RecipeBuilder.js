import React, { useEffect } from "react";
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
    updatingIngredient, // NEW STATE

    // Actions
    updateRecipe,
    addIngredient,
    updateIngredient, // NEW ACTION
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

      {/* New layout structure for sticky metrics */}
      <div className="recipe-builder-layout">
        <div className="recipe-builder-main">
          {/* Recipe Details Form */}
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

          {/* Ingredients Section */}
          <div className="ingredients-section">
            <div className="ingredients-header">
              <h2 className="section-title">Ingredients</h2>
            </div>

            {/* Ingredients List - NOW WITH UPDATE SUPPORT */}
            <IngredientsList
              ingredients={ingredients}
              onRemove={removeIngredient}
              onUpdate={updateIngredient} // NEW PROP
              isEditing={true}
            />

            {/* Ingredient Input Forms */}
            <IngredientInputsContainer
              ingredients={availableIngredients}
              addIngredient={addIngredient}
              disabled={addingIngredient || updatingIngredient || saving} // Include updatingIngredient
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecipeBuilder;
