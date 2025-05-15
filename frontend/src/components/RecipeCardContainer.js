import { useState } from "react";
import RecipeCard from "./RecipeCard";

const RecipeCardContainer = ({ recipes: initialRecipes }) => {
  const [recipes, setRecipes] = useState(initialRecipes);

  const handleDeleteRecipe = (deletedRecipeId) => {
    // Filter out the deleted recipe from the state
    const updatedRecipes = recipes.filter(
      (recipe) => recipe.recipe_id !== deletedRecipeId
    );
    // Update the state with the new list of recipes
    setRecipes(updatedRecipes);
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
