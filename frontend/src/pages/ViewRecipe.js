import { useState, useEffect } from "react";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import RecipeDetails from "../components/RecipeBuilder/RecipeDetails";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import ApiService from "../services/api";
import { useParams } from "react-router";

const ViewRecipe = () => {
  const { recipeId } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const recipeResponse = await ApiService.recipes.getById(recipeId);
        const ingredientsResponse =
          await ApiService.recipes.getIngredients(recipeId);
        const metricsResponse =
          await ApiService.recipes.calculateMetrics(recipeId);
        console.log("metricsResponse.data:", metricsResponse.data);

        setRecipe(recipeResponse.data);
        setIngredients(ingredientsResponse.data);
        setMetrics(metricsResponse.data);
      } catch (error) {
        console.error("Error fetching recipe:", error);
        setError("Failed to load recipe.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId]);
  if (loading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  if (!recipe) {
    return <div className="text-red-500">Recipe not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">View Recipe: </h1>
      <RecipeDetails
        recipe={recipe.recipe} // Pass the full recipe object
        recipeId={recipeId}
        isEditing={false}
      />
      <RecipeMetrics metrics={metrics.metrics} recipeId={recipeId} />
      <IngredientsList
        ingredients={ingredients.ingredients} // Pass the ingredients data
        recipeId={recipeId}
        isEditing={false}
      />
    </div>
  );
};
export default ViewRecipe;
