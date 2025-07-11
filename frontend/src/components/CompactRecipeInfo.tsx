import React from "react";
import { Recipe } from "../types";
import { formatEfficiency } from "../utils/formatUtils";

interface CompactRecipeInfoProps {
  recipe: Recipe;
}


const CompactRecipeInfo: React.FC<CompactRecipeInfoProps> = ({ recipe }) => {

  return (
    <div className="compact-recipe-info-panel">
      <h3 className="compact-recipe-info-title">Recipe Details</h3>
      
      <div className="compact-recipe-info-grid">
        <div className="compact-recipe-info-item">
          <span className="compact-recipe-info-label">Batch Size</span>
          <span className="compact-recipe-info-value">
            {recipe.batch_size} {recipe.batch_size_unit}
          </span>
        </div>
        
        {recipe.boil_time && (
          <div className="compact-recipe-info-item">
            <span className="compact-recipe-info-label">Boil Time</span>
            <span className="compact-recipe-info-value">
              {recipe.boil_time} min
            </span>
          </div>
        )}
        
        {recipe.efficiency && (
          <div className="compact-recipe-info-item">
            <span className="compact-recipe-info-label">Efficiency</span>
            <span className="compact-recipe-info-value">
              {formatEfficiency(recipe.efficiency)}
            </span>
          </div>
        )}
        
        {recipe.created_at && (
          <div className="compact-recipe-info-item">
            <span className="compact-recipe-info-label">Created</span>
            <span className="compact-recipe-info-value">
              {new Date(recipe.created_at).toLocaleDateString()}
            </span>
          </div>
        )}
        
      </div>
      
      {recipe.description && (
        <div className="compact-recipe-description">
          {recipe.description}
        </div>
      )}
    </div>
  );
};

export default CompactRecipeInfo;