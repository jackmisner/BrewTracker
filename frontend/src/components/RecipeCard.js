import RecipeMetrics from "./RecipeBuilder/RecipeMetrics";
import RecipeActions from "./RecipeActions";
import ApiService from "../services/api";
import { useEffect, useState } from "react";
// import { useNavigate } from "react-router";
import "../styles/RecipeCard.css";

const RecipeCard = ({ recipe, onDelete, refreshTrigger }) => {
  const formattedDate = new Date(recipe.created_at).toLocaleDateString();
  const [metrics, setMetrics] = useState({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await ApiService.recipes.calculateMetrics(
          recipe.recipe_id
        );

        setMetrics(response.data);
      } catch (error) {
        console.error("Error fetching metrics:", error);
      }
    };

    fetchMetrics();
  }, [recipe.recipe_id]);

  return (
    <div className="recipe-card">
      <div className="recipe-card-header">
        <h2 className="recipe-card-title">{recipe.name}</h2>
        <p className="recipe-card-style">{recipe.style}</p>
        {recipe.version > 1 && (
          <div className="recipe-card-version">Version: {recipe.version}</div>
        )}
        <p className="recipe-card-description">
          {recipe.description || "No description available."}
        </p>
      </div>

      <RecipeMetrics metrics={metrics} cardView={true} />

      <div className="recipe-card-footer">
        <span>Created on: {formattedDate}</span>
      </div>

      <RecipeActions
        recipe={recipe}
        compact={true}
        refreshTrigger={refreshTrigger}
        onDelete={onDelete}
        showViewButton={true}
      />
    </div>
  );
};

export default RecipeCard;
