// hooks/useMetricsCalculation.js
import { useState, useCallback, useEffect } from "react";
import ApiService from "../services/api";
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateSRM,
} from "../utils/recipeCalculations";

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
      if (recipeId) {
        // If recipe exists, get calculated metrics from server
        const response = await ApiService.recipes.calculateMetrics(recipeId);

        if (response.data) {
          setMetrics({
            og: response.data.og || response.data.avg_og || 1.0,
            fg: response.data.fg || response.data.avg_fg || 1.0,
            abv: response.data.abv || response.data.avg_abv || 0.0,
            ibu: response.data.ibu || 0,
            srm: response.data.srm || 0,
          });
        }
      } else {
        // Client-side estimation for new recipes
        const mappedIngredients = recipeIngredients.map((ing) => ({
          // Map ingredients to the format expected by calculation functions
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use || "",
          time: parseInt(ing.time) || 0,
          // Include any calculation-specific fields
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          attenuation: ing.attenuation,
        }));

        // Calculate metrics with properly formatted data
        const og = calculateOG(
          mappedIngredients,
          recipe.batch_size,
          recipe.efficiency
        );
        const fg = calculateFG(mappedIngredients, og);
        const abv = calculateABV(og, fg);
        const ibu = calculateIBU(
          mappedIngredients,
          og,
          recipe.batch_size,
          recipe.boil_time
        );
        const srm = calculateSRM(mappedIngredients, recipe.batch_size);

        // Update the metrics state with new values
        setMetrics({
          og: og,
          fg: fg,
          abv: abv,
          ibu: ibu,
          srm: srm,
        });
      }
    } catch (err) {
      console.error("Error calculating metrics:", err);
      setError("Failed to calculate recipe metrics");
    }
  }, [
    recipeId,
    recipeIngredients,
    recipe.batch_size,
    recipe.efficiency,
    recipe.boil_time,
  ]);

  // Calculate metrics when recipe ingredients change
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
