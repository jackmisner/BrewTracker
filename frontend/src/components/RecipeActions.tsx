import React, { useState } from "react";
import { useNavigate } from "react-router";
import ApiService from "../services/api";
import { Recipe, ID } from "../types";

interface RecipeActionsProps {
  recipe: Recipe;
  onDelete?: (recipeId: ID) => void;
  showViewButton?: boolean;
  compact?: boolean;
  refreshTrigger?: (() => void) | null;
  isPublicRecipe?: boolean;
  originalAuthor?: string;
}

const RecipeActions: React.FC<RecipeActionsProps> = ({
  recipe,
  onDelete,
  showViewButton = true,
  compact = false,
  refreshTrigger = null,
  isPublicRecipe = false,
  originalAuthor,
}) => {
  const navigate = useNavigate();
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleView = (): void => {
    navigate(`/recipes/${recipe.recipe_id}`);
  };

  const handleEdit = (): void => {
    navigate(`/recipes/${recipe.recipe_id}/edit`);
  };

  const handleClone = async (): Promise<void> => {
    setIsCloning(true);
    try {
      let response;

      if (isPublicRecipe && originalAuthor) {
        // For public recipes, clone with attribution
        response = await ApiService.recipes.clonePublic(
          recipe.recipe_id,
          originalAuthor
        );
      } else {
        // For own recipes, use regular clone (linked)
        response = await ApiService.recipes.clone(recipe.recipe_id);
      }

      if (response.status === 201) {
        const successMessage = isPublicRecipe
          ? `Recipe cloned successfully with attribution to ${originalAuthor}!`
          : `Recipe cloned successfully!`;
        alert(successMessage);

        // Call refreshTrigger if provided (used in RecipeCard)
        if (refreshTrigger) {
          refreshTrigger();
        }

        // Navigate to the new recipe
        navigate(`/recipes/${(response.data as any).recipe_id}/edit`);
      }
    } catch (error: any) {
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

  const handleDelete = async (): Promise<void> => {
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
      } catch (error: any) {
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

  const handleBrew = (): void => {
    // Navigate to create brew session page with recipe ID
    navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`);
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

      {!isPublicRecipe && (
        <button className={`${buttonClass} edit-button`} onClick={handleEdit}>
          {compact ? "Edit" : "Edit Recipe"}
        </button>
      )}

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

      {!isPublicRecipe && (
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
      )}

      <button className={`${buttonClass} brew-button`} onClick={handleBrew}>
        {compact ? "Brew" : "Brew This Recipe"}
      </button>
    </div>
  );
};

export default RecipeActions;
