import React, { useState } from "react";
import { useNavigate } from "react-router";
import ApiService from "../services/api";

const RecipeActions = ({
  recipe,
  onDelete,
  showViewButton = true,
  compact = false,
  refreshTrigger = null,
}) => {
  const navigate = useNavigate();
  const [isCloning, setIsCloning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleView = () => {
    navigate(`/recipes/${recipe.recipe_id}`);
  };

  const handleEdit = () => {
    navigate(`/recipes/${recipe.recipe_id}/edit`);
  };

  const handleClone = async () => {
    setIsCloning(true);
    try {
      const response = await ApiService.recipes.clone(recipe.recipe_id);

      if (response.status === 201) {
        alert(`Recipe cloned successfully!`);

        // Call refreshTrigger if provided (used in RecipeCard)
        if (refreshTrigger) {
          refreshTrigger();
        }

        // Navigate to the new recipe
        navigate(`/recipes/${response.data.recipe_id}/edit`);
      }
    } catch (error) {
      console.error("Error cloning recipe:", error);
      alert(
        `Failed to clone recipe: ${
          error.response?.data?.error || error.message || "Unknown error"
        }`
      );
    } finally {
      setIsCloning(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
      setIsDeleting(true);
      try {
        await ApiService.recipes.delete(recipe.recipe_id);
        if (onDelete) {
          onDelete(recipe.recipe_id);
        }
        // If we're on the view page, navigate back to recipes list
        if (!compact) {
          navigate("/recipes");
        }
      } catch (error) {
        console.error("Error deleting recipe:", error);
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

  const handleBrew = () => {
    alert("Brewing functionality not implemented yet.");
  };

  // Define classes based on compact mode
  const containerClass = compact
    ? "recipe-card-actions"
    : "recipe-view-actions";

  const buttonClass = compact ? "recipe-card-button" : "recipe-action-button";

  return (
    <div className={containerClass}>
      {showViewButton && (
        <button className={`${buttonClass} view-button`} onClick={handleView}>
          {compact ? "View" : "View Recipe"}
        </button>
      )}

      <button className={`${buttonClass} edit-button`} onClick={handleEdit}>
        {compact ? "Edit" : "Edit Recipe"}
      </button>

      <button
        className={`${buttonClass} clone-button`}
        onClick={handleClone}
        disabled={isCloning}
      >
        {isCloning
          ? compact
            ? "Cloning..."
            : "Cloning Recipe..."
          : compact
          ? "Clone"
          : "Clone Recipe"}
      </button>

      <button
        className={`${buttonClass} delete-button`}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting
          ? compact
            ? "Deleting..."
            : "Deleting Recipe..."
          : compact
          ? "Delete"
          : "Delete Recipe"}
      </button>

      {/* Conditionally render Brew button - can be controlled by a prop if needed */}
      <button className={`${buttonClass} brew-button`} onClick={handleBrew}>
        {compact ? "Brew" : "Brew This Recipe"}
      </button>
    </div>
  );
};

export default RecipeActions;
