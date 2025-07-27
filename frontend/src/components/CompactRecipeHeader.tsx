import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Recipe, ID } from "../types";
import ApiService from "../services/api";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../utils/formatUtils";

interface CompactRecipeHeaderProps {
  recipe: Recipe;
  onDelete?: (recipeId: ID) => void;
  showViewButton?: boolean;
  isPublicRecipe?: boolean;
  originalAuthor?: string;
}

interface VersionHistoryData {
  parent_recipe?: {
    recipe_id: ID;
    name: string;
    version: number;
  };
  child_versions?: Array<{
    recipe_id: ID;
    name: string;
    version: number;
  }>;
}

const CompactRecipeHeader: React.FC<CompactRecipeHeaderProps> = ({
  recipe,
  onDelete,
  showViewButton = true,
  isPublicRecipe = false,
  originalAuthor,
}) => {
  const navigate = useNavigate();
  const [versionHistory, setVersionHistory] =
    useState<VersionHistoryData | null>(null);
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const fetchVersionHistory = async (): Promise<void> => {
      if (
        !recipe.recipe_id ||
        ((!recipe.version || recipe.version <= 1) && !recipe.parent_recipe_id)
      ) {
        return; // No version history to fetch
      }

      try {
        const response = await ApiService.recipes.getVersionHistory(
          recipe.recipe_id
        );
        setVersionHistory(response.data as VersionHistoryData);
      } catch (err: any) {
        console.error("Error fetching version history:", err);
      }
    };

    fetchVersionHistory();
  }, [recipe.recipe_id, recipe.version, recipe.parent_recipe_id]);

  // Action handlers
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
        navigate(`/recipes/${(response.data as any).recipe_id}/edit`);
      }
    } catch (error: any) {
      console.error("Error cloning recipe:", error);
      alert(
        `Error cloning recipe: ${error.message || "Unknown error occurred"}`
      );
    } finally {
      setIsCloning(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete "${recipe.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await ApiService.recipes.delete(recipe.recipe_id);

      if (onDelete) {
        onDelete(recipe.recipe_id);
      } else {
        navigate("/recipes");
      }
    } catch (error: any) {
      console.error("Error deleting recipe:", error);
      alert(
        `Error deleting recipe: ${error.message || "Unknown error occurred"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="compact-recipe-header-container">
      <div className="compact-recipe-header-main">
        <div className="compact-recipe-header-info">
          <h1 className="compact-recipe-header-title">{recipe.name}</h1>
          {recipe.style && (
            <p className="compact-recipe-header-style">{recipe.style}</p>
          )}

          {/* Version History Information */}
          {(recipe.version && recipe.version > 1) ||
          recipe.parent_recipe_id ||
          versionHistory ? (
            <div className="compact-recipe-header-version-info">
              {versionHistory?.parent_recipe && (
                <div className="recipe-version-parent">
                  <span className="version-label">Based on:</span>
                  <Link
                    to={`/recipes/${versionHistory.parent_recipe.recipe_id}`}
                    className="parent-recipe-link"
                  >
                    {versionHistory.parent_recipe.name} (v
                    {versionHistory.parent_recipe.version})
                  </Link>
                </div>
              )}

              {recipe.version && recipe.version > 1 && (
                <div className="recipe-current-version">
                  <span className="version-badge">
                    Version {recipe.version}
                  </span>
                </div>
              )}

              {versionHistory?.child_versions &&
                versionHistory.child_versions.length > 0 && (
                  <div className="recipe-derived-versions">
                    <span className="version-label">Derived recipes:</span>
                    <div className="derived-recipes">
                      {versionHistory.child_versions.slice(0, 3).map((v) => (
                        <Link
                          key={v.recipe_id}
                          to={`/recipes/${v.recipe_id}`}
                          className="derived-recipe-link"
                        >
                          {v.name} (v{v.version})
                        </Link>
                      ))}
                      {versionHistory.child_versions.length > 3 && (
                        <span className="more-versions">
                          +{versionHistory.child_versions.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : null}
        </div>

        <div
          className="compact-recipe-header-swatch"
          style={{
            backgroundColor: getSrmColour(recipe.estimated_srm),
          }}
          title={`SRM: ${formatSrm(recipe.estimated_srm)}`}
        />
      </div>

      <div className="compact-recipe-header-metrics">
        <div className="compact-recipe-header-metric">
          <div className="compact-recipe-header-metric-value">
            {formatGravity(recipe.estimated_og)}
          </div>
          <div className="compact-recipe-header-metric-label">OG</div>
        </div>
        <div className="compact-recipe-header-metric">
          <div className="compact-recipe-header-metric-value">
            {formatGravity(recipe.estimated_fg)}
          </div>
          <div className="compact-recipe-header-metric-label">FG</div>
        </div>
        <div className="compact-recipe-header-metric">
          <div className="compact-recipe-header-metric-value">
            {formatAbv(recipe.estimated_abv)}
          </div>
          <div className="compact-recipe-header-metric-label">ABV</div>
        </div>
        <div className="compact-recipe-header-metric">
          <div className="compact-recipe-header-metric-value">
            {formatIbu(recipe.estimated_ibu)}
          </div>
          <div className="compact-recipe-header-metric-label">IBU</div>
        </div>
        <div className="compact-recipe-header-metric">
          <div className="compact-recipe-header-metric-value">
            {formatSrm(recipe.estimated_srm)}
          </div>
          <div className="compact-recipe-header-metric-label">SRM</div>
        </div>

        {/* Main Recipe Actions */}
        <div className="recipe-card-actions">
          {showViewButton && (
            <button
              className="recipe-card-button view-button"
              onClick={handleView}
            >
              View
            </button>
          )}

          {!isPublicRecipe && (
            <button
              className="recipe-card-button edit-button"
              onClick={handleEdit}
            >
              Edit
            </button>
          )}

          <button
            className="recipe-card-button clone-button"
            onClick={handleClone}
            disabled={isCloning}
          >
            {isCloning ? "Cloning..." : "Clone"}
          </button>
        </div>
      </div>

      {/* Delete Button - Positioned separately for safety */}
      {!isPublicRecipe && (
        <button
          className="compact-recipe-header-delete-button"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete Recipe"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      )}
    </div>
  );
};

export default CompactRecipeHeader;
