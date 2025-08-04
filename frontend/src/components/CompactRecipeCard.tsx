import React from "react";
import { Recipe, ID } from "../types";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../utils/formatUtils";
import RecipeActions from "./RecipeActions";

interface CompactRecipeCardProps {
  recipe: Recipe;
  showActionsInCard?: boolean;
  isPublicRecipe?: boolean;
  originalAuthor?: string;
  onDelete?: (recipeId: ID) => void;
  refreshTrigger?: (() => void) | null;
  isDashboardVariant?: boolean;
}

const CompactRecipeCard: React.FC<CompactRecipeCardProps> = ({
  recipe,
  showActionsInCard = true,
  isPublicRecipe = false,
  originalAuthor,
  onDelete,
  refreshTrigger = null,
  isDashboardVariant = false,
}) => {
  return (
    <div className="compact-recipe-card">
      <div className="compact-recipe-header">
        <div className="compact-recipe-info">
          <h3 className="compact-recipe-name">{recipe.name}</h3>
          <p className="compact-recipe-style">
            {recipe.style || "No style specified"}
          </p>
        </div>
        {!isDashboardVariant && (
          <div className="compact-metric-SRM">
            <div className="compact-metric-value">
              {formatSrm(recipe.estimated_srm)}
            </div>
            <div className="compact-metric-label">SRM</div>
          </div>
        )}
        <div
          className="compact-color-swatch"
          style={{
            backgroundColor: getSrmColour(recipe.estimated_srm),
          }}
          title={`SRM: ${formatSrm(recipe.estimated_srm)}`}
        />
      </div>

      {/* Compact Metrics */}
      <div
        className={`compact-recipe-metrics ${
          isDashboardVariant ? "dashboard-variant" : ""
        }`}
      >
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatGravity(recipe.estimated_og)}
          </div>
          <div className="compact-metric-label">OG</div>
        </div>
        <div className="compact-metric">
          <div className="compact-metric-value">
            {formatGravity(recipe.estimated_fg)}
          </div>
          <div className="compact-metric-label">FG</div>
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
        {isDashboardVariant && (
          <div className="compact-metric">
            <div className="compact-metric-value">
              {formatSrm(recipe.estimated_srm)}
            </div>
            <div className="compact-metric-label">SRM</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActionsInCard && (
        <RecipeActions
          recipe={recipe}
          onDelete={onDelete}
          refreshTrigger={refreshTrigger}
          showViewButton={true}
          compact={true}
          isPublicRecipe={isPublicRecipe}
          originalAuthor={originalAuthor}
        />
      )}
    </div>
  );
};

export default CompactRecipeCard;
