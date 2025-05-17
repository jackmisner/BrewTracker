// hooks/useIngredientsState.js
import { useState } from "react";
import ApiService from "../services/api";

export function useIngredientsState() {
  const [ingredients, setIngredients] = useState({
    grain: [],
    hop: [],
    yeast: [],
    adjunct: [],
  });
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [error, setError] = useState("");

  const fetchIngredients = async () => {
    try {
      const response = await ApiService.ingredients.getAll();

      // Check if response data is an array directly or nested in an 'ingredients' property
      const ingredientsData = Array.isArray(response.data)
        ? response.data
        : response.data.ingredients || [];

      // Group ingredients by type
      const grouped = {
        grain: [],
        hop: [],
        yeast: [],
        adjunct: [],
      };

      ingredientsData.forEach((ingredient) => {
        if (grouped[ingredient.type]) {
          grouped[ingredient.type].push(ingredient);
        } else {
          console.warn(
            `Ingredient type ${ingredient.type} not recognized. Skipping...`
          );
        }
      });

      setIngredients(grouped);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      console.log("Error details:", err.response?.data);
      setError("Failed to load ingredients");
    }
  };

  const getIngredientName = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    return ingredient ? ingredient.name : "Unknown";
  };

  // Helper function to get relevant ingredient data from ID
  const getIngredientData = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    if (!ingredient) return {};

    if (type === "grain") {
      return { potential: ingredient.potential, color: ingredient.color };
    } else if (type === "hop") {
      return { alpha_acid: ingredient.alpha_acid };
    } else if (type === "yeast") {
      return { attenuation: ingredient.attenuation };
    }
    return {};
  };

  const addIngredient = async (type, ingredientData) => {
    try {
      // Create new ingredient object with a consistent ID format
      const newIngredient = {
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ingredient_id: ingredientData.ingredient_id, // This should be the MongoDB ID
        name: getIngredientName(ingredientData.ingredient_id, type),
        type: type,
        amount: ingredientData.amount,
        unit: ingredientData.unit,
        use: ingredientData.use || "",
        time: ingredientData.time || 0,
        // Include calculation-specific fields
        ...getIngredientData(ingredientData.ingredient_id, type),
      };

      // Update state
      setRecipeIngredients((prevIngredients) => [
        ...prevIngredients,
        newIngredient,
      ]);

      return newIngredient;
    } catch (err) {
      console.error("Error adding ingredient:", err);
      setError("Failed to add ingredient");
      throw err;
    }
  };

  const removeIngredient = async (ingredientId) => {
    try {
      console.log("Removing ingredient with ID:", ingredientId);
      console.log("Current ingredients before removal:", recipeIngredients);

      // Remove from local state
      setRecipeIngredients((prevIngredients) => {
        const filtered = prevIngredients.filter(
          (i) => String(i.id) !== String(ingredientId)
        );
        console.log("Ingredients after removal:", filtered);
        return filtered;
      });
    } catch (err) {
      console.error("Error removing ingredient:", err);
      setError("Failed to remove ingredient");
      throw err;
    }
  };

  const scaleIngredients = (scalingFactor) => {
    // Scale all ingredient amounts
    const scaledIngredients = recipeIngredients.map((ingredient) => {
      return {
        ...ingredient,
        amount: (parseFloat(ingredient.amount) * scalingFactor).toFixed(2),
      };
    });

    setRecipeIngredients(scaledIngredients);
  };

  return {
    ingredients,
    recipeIngredients,
    setRecipeIngredients,
    error,
    setError,
    fetchIngredients,
    addIngredient,
    removeIngredient,
    getIngredientName,
    getIngredientData,
    scaleIngredients,
  };
}
