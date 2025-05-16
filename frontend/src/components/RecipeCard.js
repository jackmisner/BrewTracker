import RecipeMetrics from "./RecipeBuilder/RecipeMetrics";
import ApiService from "../services/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import "./RecipeCard.css";

const RecipeCard = ({ recipe, onDelete }) => {
  // console.log("recipe:", recipe);
  const navigate = useNavigate();
  const formattedDate = new Date(recipe.created_at).toLocaleDateString();
  const [metrics, setMetrics] = useState({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const viewRecipe = () => {
    navigate(`/recipes/${recipe.recipe_id}`);
  };

  const editRecipe = () => {
    // Navigate to the edit page (which uses RecipeBuilder component)
    navigate(`/recipes/${recipe.recipe_id}/edit`);
  };

  const deleteRecipe = async () => {
    if (window.confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
      setIsDeleting(true);
      try {
        await ApiService.recipes.delete(recipe.recipe_id);

        // Call the onDelete callback to refresh the parent component
        if (onDelete) {
          onDelete(recipe.recipe_id);
        }
      } catch (error) {
        console.error("Error deleting recipe:", error);
        // More detailed error logging
        if (error.response) {
          // Server responded with an error status code
          console.error("Error response data:", error.response.data);
          console.error("Error response status:", error.response.status);
        } else if (error.request) {
          // Request was made but no response received
          console.error("No response received from server");
        } else {
          // Something else caused the error
          console.error("Error message:", error.message);
        }
        alert(
          `Failed to delete recipe: ${
            error.response?.data?.error || error.message || "Unknown error"
          }`
        );
      } finally {
        setIsDeleting(false);
      }
    }
  };

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
        <p className="recipe-card-description">
          {recipe.description || "No description available."}
        </p>
      </div>

      <RecipeMetrics metrics={metrics} cardView={true} />

      <div className="recipe-card-footer">
        <span>Created on: {formattedDate}</span>
      </div>

      <div className="recipe-card-actions">
        <button className="recipe-card-button" onClick={viewRecipe}>
          View
        </button>
        <button className="recipe-card-button" onClick={editRecipe}>
          Edit
        </button>
        <button
          className="recipe-card-button"
          onClick={deleteRecipe}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
};

export default RecipeCard;
