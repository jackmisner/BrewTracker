import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import "../styles/RecipeBuilder.css";

// Import custom hooks
import { useRecipeState } from "../hooks/useRecipeState";
import { useIngredientsState } from "../hooks/useIngredientsState";
import { useMetricsCalculation } from "../hooks/useMetricsCalculation";
import { useRecipeForm } from "../hooks/useRecipeForm";

// Import components
import RecipeDetails from "../components/RecipeBuilder/RecipeDetails";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import IngredientInputsContainer from "../components/RecipeBuilder/IngredientInputs/IngredientInputsContainer";

function RecipeBuilder() {
  const { recipeId } = useParams();
  const navigate = useNavigate();

  // Custom hooks for state management
  const {
    recipe,
    loading,
    error: recipeError,
    setError: setRecipeError,
    handleRecipeChange,
    handleScaleRecipe,
  } = useRecipeState(recipeId);

  const {
    ingredients,
    recipeIngredients,
    setRecipeIngredients,
    error: ingredientsError,
    setError: setIngredientsError,
    fetchIngredients,
    addIngredient,
    removeIngredient,
    scaleIngredients,
  } = useIngredientsState();

  const {
    metrics,
    calculateRecipeMetrics,
    error: metricsError,
  } = useMetricsCalculation(recipeId, recipeIngredients, recipe, loading);

  const {
    handleSubmit: submitForm,
    saving,
    error: formError,
    setError: setFormError,
  } = useRecipeForm(recipeId);

  // Combine all errors
  const error = recipeError || ingredientsError || metricsError || formError;

  useEffect(() => {
    // Fetch ingredients
    fetchIngredients();
  }, []);

  useEffect(() => {
    // When recipe is loaded and not in loading state
    if (
      !loading &&
      recipe &&
      recipe.ingredients &&
      recipe.ingredients.length > 0
    ) {
      // Map each ingredient to ensure it has an id field for client-side operations
      const ingredientsWithIds = recipe.ingredients.map((ingredient) => {
        // Give each ingredient a consistent id property for the frontend
        return {
          ...ingredient,
          id:
            ingredient.id ||
            // If this is a MongoDB ObjectId
            (ingredient._id
              ? String(ingredient._id)
              : // If we have ingredient_id from the database
              ingredient.ingredient_id
              ? `ing-${String(ingredient.ingredient_id)}`
              : // Fallback to generate a unique ID
                `existing-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`),
        };
      });

      setRecipeIngredients(ingredientsWithIds);
    }
  }, [recipe, loading, setRecipeIngredients]);

  // Handle recipe scaling
  const handleRecipeScaling = (newBatchSize) => {
    // Scale the recipe (batch size)
    const scalingFactor = handleScaleRecipe(newBatchSize);

    // Scale the ingredients based on the same factor
    if (scalingFactor) {
      scaleIngredients(scalingFactor);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    submitForm(e, recipe, recipeIngredients, metrics);
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div id="recipe-builder" className="container">
      <h1 className="page-title">
        {recipeId ? "Edit Recipe" : "Create New Recipe"}
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      )}

      <div className="grid">
        {/* Recipe Details Form */}
        <div className="grid-col-2-3">
          <RecipeDetails
            recipe={recipe}
            onChange={handleRecipeChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/recipes")}
            isEditing={!!recipeId || true}
            saving={saving}
          />
        </div>

        {/* Recipe Metrics */}
        <div className="grid-col-1-3">
          <RecipeMetrics
            metrics={metrics}
            onCalculate={calculateRecipeMetrics}
            onScale={handleRecipeScaling}
          />
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="mt-6">
        <h2 className="section-title">Ingredients</h2>

        {/* Ingredients Tables */}
        <IngredientsList
          ingredients={recipeIngredients}
          onRemove={removeIngredient}
          isEditing={!!recipeId || true}
        />

        {/* Ingredient Input Forms */}
        <IngredientInputsContainer
          ingredients={ingredients}
          addIngredient={addIngredient}
          calculateMetrics={calculateRecipeMetrics}
        />
      </div>
    </div>
  );
}

export default RecipeBuilder;
