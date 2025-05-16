// services/RecipeService.js
import ApiService from "./api";

export const RecipeService = {
  fetchRecipe: async (recipeId) => {
    try {
      const response = await ApiService.recipes.getById(recipeId);
      return response.data;
    } catch (error) {
      console.error("Error fetching recipe:", error);
      throw error;
    }
  },

  saveRecipe: async (recipeId, recipeData) => {
    try {
      let response;
      if (recipeId) {
        response = await ApiService.recipes.update(recipeId, recipeData);
      } else {
        response = await ApiService.recipes.create(recipeData);
      }
      return response.data;
    } catch (error) {
      console.error("Error saving recipe:", error);
      throw error;
    }
  },

  calculateMetrics: async (recipeId) => {
    try {
      const response = await ApiService.recipes.calculateMetrics(recipeId);
      return response.data;
    } catch (error) {
      console.error("Error calculating metrics:", error);
      throw error;
    }
  },
};
