import React, { useMemo } from "react";

function IngredientsList({ ingredients, onRemove, isEditing }) {
  // Custom sorting function
  const sortIngredients = (ingredients) => {
    console.log('ingredients:', ingredients);
    // Define the type order
    const typeOrder = {
      grain: 1,
      hop: 2,
      yeast: 3,
    };

    // Define the use order for hops
    const hopUseOrder = {
      boil: 1,
      whirlpool: 2,
      "dry hop": 3,
    };

    // Create a copy of the ingredients array to avoid mutating the original
    return [...ingredients].sort((a, b) => {
      // First, sort by ingredient type according to the specified order

      const typeA = a.ingredient.type || '';
      const typeB = b.ingredient.type || '';
      
      // Get the order values, defaulting to a high number for unknown types
      const orderA = typeOrder[typeA] || 999;
      const orderB = typeOrder[typeB] || 999;
      
      // If types are different, sort by type order
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If types are the same, apply specific sorting logic for each type
      if (typeA === "grain") {
        // Group identical grains together
        if (a.ingredient_name !== b.ingredient_name) {
          return a.ingredient_name.localeCompare(b.ingredient_name);
        }
        return 0;
      } else if (typeA === "hop") {
        // Sort hops by use type (boil, whirlpool, dry hop)
        const useA = (a.use || "").toLowerCase();
        const useB = (b.use || "").toLowerCase();
        
        const useOrderA = hopUseOrder[useA] || 999;
        const useOrderB = hopUseOrder[useB] || 999;
        
        if (useOrderA !== useOrderB) {
          return useOrderA - useOrderB;
        }
        
        // For same use type, sort by time (higher first)
        const timeA = parseFloat(a.time) || 0;
        const timeB = parseFloat(b.time) || 0;
        
        return timeB - timeA; // Higher time first
      } else if (typeA === "yeast") {
        // Just sort yeast alphabetically if needed
        return a.ingredient_name.localeCompare(b.ingredient_name);
      }
      
      // Default case - sort by ID to maintain stable order
      return a.id - b.id;
    });
  };

  // Sort the ingredients using useMemo to only recalculate when ingredients change
  const sortedIngredients = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return [];
    return sortIngredients(ingredients);
  }, [ingredients]);

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
            {sortedIngredients.map((ingredient) => (
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