import { useState } from "react";
import RecipeCard from "./RecipeCard";

const RecipeCardContainer = ({ recipes: initialRecipes }) => {
  const [recipes, setRecipes] = useState(initialRecipes);
  
  const handleDeleteRecipe = (deletedRecipeId) => {
    console.log("Removing recipe with ID:", deletedRecipeId);
    console.log("Before deletion - recipes count:", recipes.length);
    
    // Filter out the deleted recipe from the state
    const updatedRecipes = recipes.filter(recipe => recipe.recipe_id !== deletedRecipeId);
    console.log("After deletion - recipes count:", updatedRecipes.length);
    
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