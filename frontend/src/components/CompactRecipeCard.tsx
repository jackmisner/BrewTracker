import React from "react";
import { useNavigate } from "react-router";
import { Recipe } from "../types";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../utils/formatUtils";

interface CompactRecipeCardProps {
  recipe: Recipe;
  showActionsInCard?: boolean;
}

const CompactRecipeCard: React.FC<CompactRecipeCardProps> = ({
  recipe,
  showActionsInCard = true,
}) => {
  const navigate = useNavigate();

  const handleView = (): void => {
    navigate(`/recipes/${recipe.recipe_id}`);
  };

  const handleEdit = (): void => {
    navigate(`/recipes/${recipe.recipe_id}/edit`);
  };

  const handleBrew = (): void => {
    navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`);
  };

  return (
    <div className="compact-recipe-card">
      <div className="compact-recipe-header">
        <div className="compact-recipe-info">
          <h3 className="compact-recipe-name">{recipe.name}</h3>
          <p className="compact-recipe-style">
            {recipe.style || "No style specified"}
          </p>
        </div>
        <div
          className="compact-color-swatch"
          style={{
            backgroundColor: getSrmColour(recipe.estimated_srm),
          }}
          title={`SRM: ${formatSrm(recipe.estimated_srm)}`}
        />
      </div>

      {/* Compact Metrics */}
      <div className="compact-recipe-metrics">
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatGravity(recipe.estimated_og)}
          </div>
          <div className="compact-metric-label">OG</div>
        </div>
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatAbv(recipe.estimated_abv)}
          </div>
          <div className="compact-metric-label">ABV</div>
        </div>
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatIbu(recipe.estimated_ibu)}
          </div>
          <div className="compact-metric-label">IBU</div>
        </div>
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatSrm(recipe.estimated_srm)}
          </div>
          <div className="compact-metric-label">SRM</div>
        </div>
      </div>

      {/* Actions */}
      {showActionsInCard && (
        <div className="compact-card-actions">
          <button onClick={handleView} className="compact-action-button view">
            View
          </button>
          <button onClick={handleEdit} className="compact-action-button edit">
            Edit
          </button>
          <button onClick={handleBrew} className="compact-action-button brew">
            Brew
          </button>
        </div>
      )}
    </div>
  );
};

export default CompactRecipeCard;
