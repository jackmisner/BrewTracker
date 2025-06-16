import React, { useMemo, useState, useRef, useEffect } from "react";
import { useUnits } from "../../contexts/UnitContext";
import { Services } from "../../services";

function IngredientsList({ ingredients, onRemove, onUpdate, isEditing }) {
  const { unitSystem, formatValue, convertForDisplay } = useUnits();

  // State for tracking which cell is being edited
  const [editingCell, setEditingCell] = useState({
    ingredientId: null,
    field: null,
  });
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef(null);

  // Sort ingredients using the centralized service method
  const sortedIngredients = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return [];
    return Services.ingredient.sortIngredients(ingredients);
  }, [ingredients]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell.ingredientId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell.ingredientId]);

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Recipe Ingredients</h3>
        <p className="text-center py-4">No ingredients added yet.</p>
      </div>
    );
  }

  // Start editing a cell
  const startEdit = (ingredientId, field, currentValue) => {
    if (!isEditing) return; // Only allow editing when in edit mode

    setEditingCell({ ingredientId, field });
    setEditValue(currentValue);
    setValidationError("");
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell({ ingredientId: null, field: null });
    setEditValue("");
    setValidationError("");
  };

  // Save the edited value
  const saveEdit = async () => {
    const { ingredientId, field } = editingCell;
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);

    if (!ingredient) {
      cancelEdit();
      return;
    }

    // Validate the new value
    const validation = validateField(field, editValue, ingredient);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    // Prepare updated ingredient
    const updatedIngredient = {
      ...ingredient,
      [field]: validation.value,
    };

    try {
      await onUpdate(ingredientId, updatedIngredient);
      cancelEdit();
    } catch (error) {
      setValidationError("Failed to update ingredient");
    }
  };

  // Validate field value based on type
  const validateField = (field, value, ingredient) => {
    const trimmedValue = typeof value === "string" ? value.trim() : value;

    switch (field) {
      case "amount":
        const amount = parseFloat(trimmedValue);
        if (isNaN(amount) || amount <= 0) {
          return { isValid: false, error: "Amount must be greater than 0" };
        }

        // Unit-specific validation
        if (
          ingredient.unit === "oz" &&
          amount > 10 &&
          ingredient.type === "hop"
        ) {
          return {
            isValid: false,
            error: "More than 10 oz seems high for hops",
          };
        }
        if (
          ingredient.unit === "g" &&
          amount > 300 &&
          ingredient.type === "hop"
        ) {
          return {
            isValid: false,
            error: "More than 300g seems high for hops",
          };
        }
        if (
          ingredient.unit === "kg" &&
          amount > 50 &&
          ingredient.type === "grain"
        ) {
          return {
            isValid: false,
            error: "More than 50kg seems unusually high",
          };
        }

        return { isValid: true, value: amount };

      case "time":
        if (!trimmedValue) {
          return { isValid: true, value: 0 };
        }
        const time = parseInt(trimmedValue);
        if (isNaN(time) || time < 0) {
          return { isValid: false, error: "Time must be 0 or greater" };
        }
        if (
          time > 120 &&
          ingredient.type === "hop" &&
          ingredient.use === "boil"
        ) {
          return {
            isValid: false,
            error: "Boil time over 120 minutes is unusual",
          };
        }
        return { isValid: true, value: time };

      case "alpha_acid":
        if (!trimmedValue) {
          return { isValid: false, error: "Alpha acid is required for hops" };
        }
        const alpha = parseFloat(trimmedValue);
        if (isNaN(alpha) || alpha <= 0) {
          return { isValid: false, error: "Alpha acid must be greater than 0" };
        }
        if (alpha > 25) {
          return {
            isValid: false,
            error: "Alpha acid over 25% seems unusually high",
          };
        }
        return { isValid: true, value: alpha };

      case "color":
        if (!trimmedValue) {
          return { isValid: true, value: null };
        }
        const color = parseFloat(trimmedValue);
        if (isNaN(color) || color < 0) {
          return { isValid: false, error: "Color must be 0 or greater" };
        }
        if (color > 600) {
          return {
            isValid: false,
            error: "Color over 600°L seems unusually high",
          };
        }
        return { isValid: true, value: color };

      case "use":
        const validUses = {
          hop: ["boil", "whirlpool", "dry-hop"],
          other: [
            "boil",
            "whirlpool",
            "fermentation",
            "secondary",
            "packaging",
            "mash",
          ],
        };
        const allowedUses = validUses[ingredient.type] || validUses.other;

        if (!allowedUses.includes(trimmedValue)) {
          return {
            isValid: false,
            error: `Use must be one of: ${allowedUses.join(", ")}`,
          };
        }
        return { isValid: true, value: trimmedValue };

      default:
        return { isValid: true, value: trimmedValue };
    }
  };

  // Handle key press in edit input
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Render editable cell
  const renderEditableCell = (
    ingredient,
    field,
    currentValue,
    displayValue
  ) => {
    const isEditing =
      editingCell.ingredientId === ingredient.id && editingCell.field === field;

    if (!isEditing) {
      return (
        <span
          className="editable-cell"
          onClick={() => startEdit(ingredient.id, field, currentValue)}
          title="Click to edit"
        >
          {displayValue}
        </span>
      );
    }

    // Render appropriate input based on field type
    if (field === "use") {
      const options =
        ingredient.type === "hop"
          ? ["boil", "whirlpool", "dry-hop"]
          : [
              "boil",
              "whirlpool",
              "fermentation",
              "secondary",
              "packaging",
              "mash",
            ];

      return (
        <div className="edit-cell-container">
          <select
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyPress}
            className="edit-cell-input"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() +
                  option.slice(1).replace("-", " ")}
              </option>
            ))}
          </select>
          {validationError && (
            <div className="edit-error">{validationError}</div>
          )}
        </div>
      );
    }

    const inputType = ["amount", "time", "alpha_acid", "color"].includes(field)
      ? "number"
      : "text";
    const step =
      field === "amount" ? "0.1" : field === "alpha_acid" ? "0.1" : "1";

    return (
      <div className="edit-cell-container">
        <input
          ref={inputRef}
          type={inputType}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyPress}
          step={step}
          min="0"
          className="edit-cell-input"
        />
        {validationError && <div className="edit-error">{validationError}</div>}
      </div>
    );
  };

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
      displayUnit = timeUnit === "minutes" ? "min" : timeUnit.slice(0, -1);
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
                  {isEditing ? (
                    renderEditableCell(
                      ingredient,
                      "amount",
                      ingredient.amount,
                      <strong>{formatIngredientAmount(ingredient)}</strong>
                    )
                  ) : (
                    <strong>{formatIngredientAmount(ingredient)}</strong>
                  )}
                </td>

                <td className="ingredient-use">
                  {isEditing
                    ? renderEditableCell(
                        ingredient,
                        "use",
                        ingredient.use,
                        formatUsage(ingredient)
                      )
                    : formatUsage(ingredient)}
                </td>

                <td className="ingredient-time">
                  {isEditing
                    ? renderEditableCell(
                        ingredient,
                        "time",
                        ingredient.time || "",
                        formatTime(ingredient)
                      )
                    : formatTime(ingredient)}
                </td>

                {isEditing && (
                  <td className="ingredient-details">
                    <div className="ingredient-details-container">
                      {ingredient.type === "hop" && (
                        <div className="detail-item">
                          <span className="detail-label">AA:</span>
                          {renderEditableCell(
                            ingredient,
                            "alpha_acid",
                            ingredient.alpha_acid || "",
                            <span className="detail-value">
                              {ingredient.alpha_acid || "-"}%
                            </span>
                          )}
                        </div>
                      )}
                      {ingredient.type === "grain" && (
                        <div className="detail-item">
                          <span className="detail-label">Color:</span>
                          {renderEditableCell(
                            ingredient,
                            "color",
                            ingredient.color || "",
                            <span className="detail-value">
                              {ingredient.color || "-"}°L
                            </span>
                          )}
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

      {isEditing && (
        <div className="editing-help">
          <small className="help-text">
            💡 Click on amounts, usage, time, or detail values to edit them
            directly. Press Enter to save, Escape to cancel.
          </small>
        </div>
      )}
    </div>
  );
}

export default IngredientsList;
