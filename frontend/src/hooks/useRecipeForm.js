// hooks/useRecipeForm.js
import { useState } from "react";
import { useNavigate } from "react-router";
import ApiService from "../services/api";

export function useRecipeForm(recipeId) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e, recipe, recipeIngredients, metrics) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Prepare recipe data with metrics
      const recipeData = {
        ...recipe,
        estimated_og: metrics.og,
        estimated_fg: metrics.fg,
        estimated_abv: metrics.abv,
        estimated_ibu: metrics.ibu,
        estimated_srm: metrics.srm,
      };

      // Format ingredients for MongoDB
      const formattedIngredients = recipeIngredients.map((ing) => {
        return {
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use || "",
          time: parseInt(ing.time) || 0,
          // Include any calculation-specific fields if needed
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          attenuation: ing.attenuation,
        };
      });

      // Add ingredients to recipe data
      recipeData.ingredients = formattedIngredients;

      let recipeResponse;

      if (recipeId) {
        // Update existing recipe
        recipeResponse = await ApiService.recipes.update(recipeId, recipeData);

        if (!recipeResponse.data) {
          throw new Error("Failed to update recipe: Invalid server response");
        }

        alert("Recipe updated successfully!");
      } else {
        // Create new recipe
        recipeResponse = await ApiService.recipes.create(recipeData);

        if (!recipeResponse.data) {
          throw new Error("Failed to create recipe: Invalid server response");
        }

        alert("Recipe created successfully!");

        // Get the new recipe ID
        const newRecipeId =
          recipeResponse.data.recipe_id ||
          recipeResponse.data._id ||
          recipeResponse.data.id;

        if (!newRecipeId) {
          throw new Error("Failed to get new recipe ID from server response");
        }

        // Navigate to the new recipe
        navigate(`/recipes/${newRecipeId}`);
      }

      return recipeResponse.data;
    } catch (err) {
      console.error("Error saving recipe:", err);
      console.log("Error response:", err.response?.data);
      setError(`Failed to save recipe: ${err.message || "Unknown error"}`);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return { handleSubmit, saving, error, setError };
}
