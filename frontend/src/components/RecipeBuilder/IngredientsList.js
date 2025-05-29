import React, { useMemo } from "react";
import { Services } from "../../services";

function IngredientsList({ ingredients, onRemove, isEditing }) {
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

  return (
    <div className="card">
      <h3 className="card-title">Recipe Ingredients</h3>

      <div className="ingredients-table-container">
        <table className="ingredients-table">
          <thead>
            <tr>
              {isEditing && <th>Type</th>}
              {isEditing && <th>Grain Type</th>}
              <th>Ingredient</th>
              <th>Amount</th>
              <th>Use</th>
              <th>Time</th>
              {isEditing && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedIngredients.map((ingredient) => (
              <tr
                key={`${ingredient.type}-${ingredient.id}`}
                id={`ingredient-row-${ingredient.id}`}
                className="ingredient-row"
              >
                {isEditing && (
                  <td className="ingredient-type">{ingredient.type}</td>
                )}
                <td className="ingredient-subtype">
                  {mapGrainType(ingredient.grain_type)}
                </td>
                <td className="ingredient-name">{ingredient.name}</td>
                <td>
                  {ingredient.amount} {ingredient.unit}
                </td>
                <td>{ingredient.use || "-"}</td>
                <td>
                  {ingredient.time
                    ? `${ingredient.time} ${ingredient.time_unit || "min"}`
                    : "-"}
                </td>
                {isEditing && (
                  <td>
                    <button
                      type="button"
                      className="ingredient-action"
                      onClick={() => onRemove(ingredient.id)}
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
    </div>
  );
}

export default IngredientsList;
