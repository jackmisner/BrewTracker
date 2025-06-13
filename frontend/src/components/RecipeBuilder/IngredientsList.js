import React, { useMemo } from "react";
import { useUnits } from "../../contexts/UnitContext";
import { Services } from "../../services";

function IngredientsList({ ingredients, onRemove, isEditing }) {
  const { unitSystem, formatValue, convertForDisplay } = useUnits();

  // Sort ingredients using the centralized service method
  const sortedIngredients = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return [];
    return Services.ingredient.sortIngredients(ingredients);
  }, [ingredients]);

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Recipe Ingredients</h3>
        <p className="text-center py-4">No ingredients added yet.</p>
      </div>
    );
  }

  const mapGrainType = (type) => {
    if (!type) return "Unknown";
    switch (type) {
      case "base_malt":
        return "Base Malt";
      case "specialty_malt":
        return "Specialty Malt";
      case "adjunct_grain":
        return "Adjunct";
      case "caramel_crystal":
        return "Caramel/Crystal";
      case "roasted":
        return "Roasted";
      case "smoked":
        return "Smoked";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Format ingredient amount with unit-aware display
  const formatIngredientAmount = (ingredient) => {
    const amount = parseFloat(ingredient.amount);
    const unit = ingredient.unit;

    if (isNaN(amount)) return "0 " + unit;

    // Determine measurement type for proper formatting
    let measurementType = "weight";
    if (ingredient.type === "hop") {
      measurementType = "hop_weight";
    } else if (ingredient.type === "other" || ingredient.type === "adjunct") {
      measurementType = "other";
    }

    // For most ingredients, just format as-is since they're already in user's preferred units
    // But we can still use formatValue for consistent decimal places
    return formatValue(amount, unit, measurementType);
  };

  // Format time display with appropriate units
  const formatTime = (ingredient) => {
    if (!ingredient.time) return "-";

    const time = parseInt(ingredient.time);
    const timeUnit = ingredient.time_unit || "min";

    if (time === 0) return "-";

    // Singular/plural handling
    let displayUnit = timeUnit;
    if (time === 1) {
      displayUnit = timeUnit === "minutes" ? "min" : timeUnit.slice(0, -1); // Remove 's'
    } else {
      displayUnit = timeUnit === "minutes" ? "min" : timeUnit;
    }

    return `${time} ${displayUnit}`;
  };

  // Get usage display text
  const formatUsage = (ingredient) => {
    if (!ingredient.use) return "-";

    const use = ingredient.use.toLowerCase();
    switch (use) {
      case "dry-hop":
        return "Dry Hop";
      case "whirlpool":
        return "Whirlpool";
      case "boil":
        return "Boil";
      case "fermentation":
        return "Fermentation";
      case "secondary":
        return "Secondary";
      case "packaging":
        return "Packaging";
      case "mash":
        return "Mash";
      default:
        return ingredient.use.charAt(0).toUpperCase() + ingredient.use.slice(1);
    }
  };

  // Get row styling based on ingredient type
  const getRowClass = (ingredient) => {
    let baseClass = "ingredient-row";

    // Add type-specific classes for styling
    if (ingredient.type === "grain") {
      baseClass += " grain-row";
      if (ingredient.grain_type === "base_malt") {
        baseClass += " base-malt-row";
      }
    } else if (ingredient.type === "hop") {
      baseClass += " hop-row";
      if (ingredient.use === "dry-hop") {
        baseClass += " dry-hop-row";
      }
    } else if (ingredient.type === "yeast") {
      baseClass += " yeast-row";
    } else {
      baseClass += " other-row";
    }

    return baseClass;
  };

  return (
    <div className="card">
      <h3 className="card-title">
        Recipe Ingredients
        <span className="ingredient-count">({sortedIngredients.length})</span>
        <span className="unit-system-badge">
          {unitSystem === "metric" ? "🌍 Metric" : "🇺🇸 Imperial"}
        </span>
      </h3>

      <div className="ingredients-table-container">
        <table className="ingredients-table">
          <thead>
            <tr>
              {isEditing && <th>Type</th>}
              <th>Ingredient</th>
              <th>Amount</th>
              <th>Use</th>
              <th>Time</th>
              {isEditing && <th>Details</th>}
              {isEditing && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedIngredients.map((ingredient) => (
              <tr
                key={`${ingredient.type}-${ingredient.id}`}
                id={`ingredient-row-${ingredient.id}`}
                className={getRowClass(ingredient)}
              >
                {isEditing && (
                  <td className="ingredient-type">
                    <span className={`type-badge ${ingredient.type}-badge`}>
                      {ingredient.type}
                    </span>
                  </td>
                )}

                <td className="ingredient-name">
                  <div className="ingredient-name-container">
                    <strong>{ingredient.name}</strong>
                    {ingredient.type === "grain" && ingredient.grain_type && (
                      <div className="ingredient-subtype">
                        {mapGrainType(ingredient.grain_type)}
                      </div>
                    )}
                    {ingredient.type === "hop" && ingredient.origin && (
                      <div className="ingredient-origin">
                        {ingredient.origin}
                      </div>
                    )}
                    {ingredient.type === "yeast" && ingredient.manufacturer && (
                      <div className="ingredient-manufacturer">
                        {ingredient.manufacturer}
                      </div>
                    )}
                  </div>
                </td>

                <td className="ingredient-amount">
                  <strong>{formatIngredientAmount(ingredient)}</strong>
                </td>

                <td className="ingredient-use">{formatUsage(ingredient)}</td>

                <td className="ingredient-time">{formatTime(ingredient)}</td>

                {isEditing && (
                  <td className="ingredient-details">
                    <div className="ingredient-details-container">
                      {ingredient.type === "hop" && ingredient.alpha_acid && (
                        <div className="detail-item">
                          <span className="detail-label">AA:</span>
                          <span className="detail-value">
                            {ingredient.alpha_acid}%
                          </span>
                        </div>
                      )}
                      {ingredient.type === "grain" && ingredient.color && (
                        <div className="detail-item">
                          <span className="detail-label">Color:</span>
                          <span className="detail-value">
                            {ingredient.color}°L
                          </span>
                        </div>
                      )}
                      {ingredient.type === "yeast" &&
                        ingredient.attenuation && (
                          <div className="detail-item">
                            <span className="detail-label">Attenuation:</span>
                            <span className="detail-value">
                              {ingredient.attenuation}%
                            </span>
                          </div>
                        )}
                    </div>
                  </td>
                )}

                {isEditing && (
                  <td className="ingredient-actions">
                    <button
                      type="button"
                      className="ingredient-action remove-action"
                      onClick={() => onRemove(ingredient.id)}
                      title="Remove ingredient"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary information */}
      <div className="ingredients-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Grains:</span>
            <span className="stat-value">
              {sortedIngredients.filter((i) => i.type === "grain").length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Hops:</span>
            <span className="stat-value">
              {sortedIngredients.filter((i) => i.type === "hop").length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Yeast:</span>
            <span className="stat-value">
              {sortedIngredients.filter((i) => i.type === "yeast").length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Other:</span>
            <span className="stat-value">
              {
                sortedIngredients.filter(
                  (i) => i.type === "other" || i.type === "adjunct"
                ).length
              }
            </span>
          </div>
        </div>

        {/* Brewing process summary */}
        <div className="process-summary">
          {sortedIngredients.some((i) => i.use === "mash") && (
            <span className="process-step">Mash</span>
          )}
          {sortedIngredients.some((i) => i.use === "boil") && (
            <span className="process-step">Boil</span>
          )}
          {sortedIngredients.some((i) => i.use === "whirlpool") && (
            <span className="process-step">Whirlpool</span>
          )}
          {sortedIngredients.some((i) => i.use === "fermentation") && (
            <span className="process-step">Fermentation</span>
          )}
          {sortedIngredients.some((i) => i.use === "dry-hop") && (
            <span className="process-step">Dry Hop</span>
          )}
          {sortedIngredients.some((i) => i.use === "packaging") && (
            <span className="process-step">Packaging</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default IngredientsList;
