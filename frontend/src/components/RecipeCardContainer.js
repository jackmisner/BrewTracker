import { useState } from "react";
import RecipeCard from "./RecipeCard";

const RecipeCardContainer = ({ recipes: initialRecipes, refreshTrigger }) => {
  const [recipes, setRecipes] = useState(initialRecipes);

  const handleDeleteRecipe = (deletedRecipeId) => {
    // Filter out the deleted recipe from the state
    const updatedRecipes = recipes.filter(
      (recipe) => recipe._id !== deletedRecipeId
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
            key={recipe._id}
            recipe={recipe}
            onDelete={handleDeleteRecipe}
          />
        ))
      )}
    </div>
  );
};

export default RecipeCardContainer;
