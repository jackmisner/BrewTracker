import React from "react";

function IngredientsList({ ingredients, onRemove, isEditing }) {
  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Recipe Ingredients</h3>
        <p className="text-center py-4">No ingredients added yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Recipe Ingredients</h3>

      <div className="ingredients-table-container">
        <table className="ingredients-table">
          <thead>
            <tr>
              {isEditing && <th>Type</th>}
              <th>Ingredient</th>
              <th>Amount</th>
              <th>Use</th>
              <th>Time</th>
              {isEditing && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ingredient) => (
              <tr
                key={`${ingredient.ingredient_type}-${ingredient.id}`}
                id={`ingredient-row-${ingredient.id}`}
                className="ingredient-row"
              >
                {isEditing && (
                  <td className="ingredient-type">
                    {ingredient.ingredient_type}
                  </td>
                )}
                <td className="ingredient-name">
                  {ingredient.ingredient_name}
                </td>
                <td>
                  {ingredient.amount} {ingredient.unit}
                </td>
                <td>{ingredient.use || "-"}</td>
                <td>
                  {ingredient.time
                    ? `${ingredient.time} ${ingredient.time_unit || ""}`
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
