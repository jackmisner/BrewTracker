// hooks/useMetricsCalculation.js
import { useState, useCallback, useEffect } from "react";
import ApiService from "../services/api";

export function useMetricsCalculation(
  recipeId,
  recipeIngredients,
  recipe,
  loading
) {
  const [metrics, setMetrics] = useState({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });
  const [error, setError] = useState("");

  const calculateRecipeMetrics = useCallback(async () => {
    try {
      // Always use the preview endpoint to get real-time updates
      // based on the current recipe state (including unsaved changes)

      // Prepare the recipe data with current ingredients
      const recipeData = {
        ...recipe,
        ingredients: recipeIngredients.map((ing) => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use || "",
          time: parseInt(ing.time) || 0,
          // Include calculation-specific fields
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          attenuation: ing.attenuation,
        })),
      };

      // Send to backend for calculation
      const response = await ApiService.recipes.calculateMetricsPreview(
        recipeData
      );

      // Update metrics state with results
      setMetrics(response.data);
    } catch (err) {
      console.error("Error calculating metrics:", err);
      setError("Failed to calculate recipe metrics");
    }
  }, [recipeIngredients, recipe]);

  // Calculate metrics when recipe ingredients or parameters change
  useEffect(() => {
    if (!loading && recipeIngredients.length >= 0) {
      calculateRecipeMetrics();
    }
  }, [
    recipeIngredients,
    recipe.batch_size,
    recipe.efficiency,
    recipe.boil_time,
    calculateRecipeMetrics,
    loading,
  ]);

  return { metrics, calculateRecipeMetrics, error };
}
