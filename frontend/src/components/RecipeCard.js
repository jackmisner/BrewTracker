import RecipeMetrics from "./RecipeBuilder/RecipeMetrics";
import ApiService from "../services/api";
import { useEffect, useState } from "react";
const RecipeCard = ({ recipe }) => {

    const formattedDate = new Date(recipe.created_at).toLocaleDateString();

    const [metrics, setMetrics] = useState({});

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await ApiService.recipes.calculateMetrics(recipe.recipe_id);
                setMetrics(response.data.metrics);
            } catch (error) {
                console.error("Error fetching metrics:", error);
            }
        };

        fetchMetrics();
        }, [recipe.recipe_id]);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold">{recipe.name}</h2>
      <p className="text-gray-600">{recipe.style}</p>
        <p className="text-sm text-gray-500">
            {recipe.description || "No description available."}
        </p>
        <RecipeMetrics metrics={metrics} recipeId={recipe.recipe_id} />
      <p className="text-sm text-gray-500">
        Created on: {formattedDate}
      </p>
    </div>
  );
}
export default RecipeCard;