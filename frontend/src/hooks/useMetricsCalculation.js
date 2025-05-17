import { useState, useCallback, useEffect, useRef } from "react";
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
  const debounceTimerRef = useRef(null);

  // Extract only the properties that affect calculations
  const batchSize = recipe.batch_size;
  const efficiency = recipe.efficiency;
  const boilTime = recipe.boil_time;

  // This function creates the payload we'll send to the API
  const prepareCalculationData = useCallback(() => {
    return {
      batch_size: batchSize,
      efficiency: efficiency,
      boil_time: boilTime,
      ingredients: recipeIngredients.map((ing) => ({
        ingredient_id: ing.ingredient_id,
        name: ing.name,
        type: ing.type,
        amount: parseFloat(ing.amount),
        unit: ing.unit,
        use: ing.use || "",
        time: parseInt(ing.time) || 0,
        potential: ing.potential,
        color: ing.color,
        alpha_acid: ing.alpha_acid,
        attenuation: ing.attenuation,
      })),
    };
  }, [batchSize, efficiency, boilTime, recipeIngredients]);

  // This function handles the actual API call with debouncing
  const calculateRecipeMetrics = useCallback(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        console.log("Calculating metrics...");

        const recipeData = prepareCalculationData();
        const response = await ApiService.recipes.calculateMetricsPreview(
          recipeData
        );
        setMetrics(response.data);
      } catch (err) {
        console.error("Error calculating metrics:", err);
        setError("Failed to calculate recipe metrics");
      }
    }, 500); // 500ms debounce delay
  }, [prepareCalculationData]);

  // Calculate metrics when recipe ingredients or brew parameters change
  useEffect(() => {
    if (!loading) {
      calculateRecipeMetrics();
    }

    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [calculateRecipeMetrics, loading]);

  return { metrics, calculateRecipeMetrics, error };
}
