import React from "react";
import { useNavigate } from "react-router";
import { Recipe } from "../types";

interface CompactRecipeCardProps {
  recipe: Recipe;
}

const CompactRecipeCard: React.FC<CompactRecipeCardProps> = ({ recipe }) => {
  const navigate = useNavigate();

  // Helper functions from Dashboard
  const formatGravity = (gravity?: number): string => {
    if (!gravity || gravity <= 1) return "1.000";
    return gravity.toFixed(3);
  };

  const formatAbv = (abv?: number): string => {
    if (!abv) return "0.0%";
    return `${abv.toFixed(1)}%`;
  };

  const formatIbu = (ibu?: number): string => {
    if (!ibu) return "0";
    return Math.round(ibu).toString();
  };

  const formatSrm = (srm?: number): string => {
    if (!srm) return "0";
    return Math.round(srm).toString();
  };

  const getSrmColour = (srm?: number): string => {
    if (!srm || srm <= 0) return "#F6F3D2";
    
    // SRM to RGB color mapping (simplified)
    const srmColors: Record<number, string> = {
      1: "#F6F3D2", 2: "#F5F2C7", 3: "#F4F1BC", 4: "#F3F0B1",
      5: "#F2EFA6", 6: "#F1EE9B", 7: "#F0ED90", 8: "#EFEC85",
      9: "#EEEB7A", 10: "#EDEA6F", 11: "#ECE964", 12: "#EBE859",
      13: "#EAE74E", 14: "#E9E643", 15: "#E8E538", 16: "#E7E42D",
      17: "#E6E322", 18: "#E5E217", 19: "#E4E10C", 20: "#E3E001"
    };
    
    if (srm >= 20) return "#8B4513"; // Dark brown for high SRM
    return srmColors[Math.round(srm)] || "#F6F3D2";
  };

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
          <p className="compact-recipe-style">{recipe.style || "No style specified"}</p>
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
      <div className="compact-card-actions">
        <button
          onClick={handleView}
          className="compact-action-button view"
        >
          View
        </button>
        <button
          onClick={handleEdit}
          className="compact-action-button edit"
        >
          Edit
        </button>
        <button
          onClick={handleBrew}
          className="compact-action-button brew"
        >
          Brew
        </button>
      </div>
    </div>
  );
};

export default CompactRecipeCard;