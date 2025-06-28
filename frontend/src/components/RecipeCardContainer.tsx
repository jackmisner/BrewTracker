import React, { useState, useEffect } from "react";
import RecipeCard from "./RecipeCard";
import { Recipe, ID } from "../types";

interface RecipeCardContainerProps {
  recipes: Recipe[];
  refreshTrigger: () => void;
}

const RecipeCardContainer: React.FC<RecipeCardContainerProps> = ({ 
  recipes: initialRecipes, 
  refreshTrigger 
}) => {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);

  // Update local state when props change
  useEffect(() => {
    setRecipes(initialRecipes);
  }, [initialRecipes]);

  const handleDeleteRecipe = (deletedRecipeId: ID): void => {
    // Filter out the deleted recipe from the state
    // Support both _id (test format) and recipe_id (actual format)
    const updatedRecipes = recipes.filter(
      (recipe) => recipe.recipe_id !== deletedRecipeId && (recipe as any)._id !== deletedRecipeId
    );
    // Update the state with the new list of recipes
    setRecipes(updatedRecipes);
    // Call the refreshTrigger function to refresh the parent component
    refreshTrigger();
  };

  return (
    <div className="recipe-card-container">
      {recipes.length === 0 ? (
        <div className="text-center py-10">No recipes found.</div>
      ) : (
        recipes.map((recipe) => (
          <RecipeCard
            key={recipe.recipe_id}
            recipe={recipe}
            onDelete={handleDeleteRecipe}
          />
        ))
      )}
    </div>
  );
};

export default RecipeCardContainer;