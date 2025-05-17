// hooks/useRecipeState.js
import { useState, useEffect } from "react";
import ApiService from "../services/api";

export function useRecipeState(recipeId) {
  const [recipe, setRecipe] = useState({
    name: "",
    style: "",
    batch_size: 5,
    description: "",
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // If editing an existing recipe, fetch it
    if (recipeId) {
      fetchRecipe(recipeId);
    } else {
      setLoading(false);
    }
  }, [recipeId]);

  const fetchRecipe = async (recipeId) => {
    try {
      setLoading(true);
      const response = await ApiService.recipes.getById(recipeId);
      setRecipe(response.data);
      setLoading(false);
      return response.data;
    } catch (err) {
      console.error("Error fetching recipe:", err);
      setError("Failed to load recipe");
      setLoading(false);
      throw err;
    }
  };

  const handleRecipeChange = (fieldName, newValue) => {
    setRecipe((prevRecipe) => ({
      ...prevRecipe,
      [fieldName]: newValue,
    }));
  };

  const handleScaleRecipe = (newBatchSize) => {
    if (!newBatchSize || isNaN(newBatchSize) || newBatchSize <= 0) {
      setError("Invalid batch size for scaling");
      return;
    }

    // Get current batch size
    const currentBatchSize = recipe.batch_size;

    // Calculate scaling factor
    const scalingFactor = newBatchSize / currentBatchSize;

    // Update the recipe batch size
    setRecipe((prev) => ({
      ...prev,
      batch_size: newBatchSize,
    }));

    return scalingFactor;
  };

  return {
    recipe,
    setRecipe,
    loading,
    error,
    setError,
    fetchRecipe,
    handleRecipeChange,
    handleScaleRecipe,
  };
}
