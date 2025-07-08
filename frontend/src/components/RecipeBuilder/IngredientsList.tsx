import React, { useMemo, useState, useRef, useEffect } from "react";
import { useUnits } from "../../contexts/UnitContext";
import { Services } from "../../services";
import AttenuationBadge from "../AttenuationAnalytics/AttenuationBadge";
import { RecipeIngredient, IngredientType } from "../../types";
import { formatTime as formatTimeUtil } from "../../utils/formatUtils";
import "../../styles/AttenuationAnalytics.css";

interface IngredientsListProps {
  ingredients: RecipeIngredient[];
  onRemove: (ingredientId: string) => void;
  onUpdate: (ingredientId: string, updatedIngredient: RecipeIngredient) => Promise<void>;
  isEditing: boolean;
  compact?: boolean;
}

interface EditingCell {
  ingredientId: string | null;
  field: string | null;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  value?: any;
}

const IngredientsList: React.FC<IngredientsListProps> = ({ 
  ingredients, 
  onRemove, 
  onUpdate, 
  isEditing,
  compact = false
}) => {
  const { formatValue } = useUnits();

  // State for tracking which cell is being edited
  const [editingCell, setEditingCell] = useState<EditingCell>({
    ingredientId: null,
    field: null,
  });
  const [editValue, setEditValue] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Sort ingredients using the centralized service method
  const sortedIngredients = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return [];
    return Services.ingredient.sortIngredients(ingredients);
  }, [ingredients]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell.ingredientId && inputRef.current) {
      inputRef.current.focus();
      // Only call select() on input elements that support it
      if (inputRef.current instanceof HTMLInputElement && typeof inputRef.current.select === "function") {
        inputRef.current.select();
      }
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

  // Determine if a field should be editable for a given ingredient type
  const isFieldEditable = (ingredientType: IngredientType, field: string): boolean => {
    const editableFields: Record<IngredientType | "adjunct", string[]> = {
      grain: ["amount", "color"],
      hop: ["amount", "use", "time", "alpha_acid"],
      yeast: ["amount"],
      other: ["amount", "use", "time"],
      adjunct: ["amount", "use", "time"], // Support legacy adjunct type
    };

    return editableFields[ingredientType]?.includes(field) || false;
  };

  // Start editing a cell
  const startEdit = (ingredientId: string, field: string, currentValue: any): void => {
    if (!isEditing || !ingredientId) return; // Only allow editing when in edit mode and ID exists

    // Find the ingredient to check if field is editable
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    if (!ingredient || !isFieldEditable(ingredient.type, field)) {
      return; // Don't start editing if field isn't editable for this ingredient type
    }

    setEditingCell({ ingredientId, field });
    setEditValue(currentValue?.toString() || "");
    setValidationError("");
  };

  // Cancel editing
  const cancelEdit = (): void => {
    setEditingCell({ ingredientId: null, field: null });
    setEditValue("");
    setValidationError("");
  };

  // Save the edited value
  const saveEdit = async (): Promise<void> => {
    const { ingredientId, field } = editingCell;
    if (!ingredientId || !field) return;
    
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);

    if (!ingredient) {
      cancelEdit();
      return;
    }

    // Validate the new value
    const validation = validateField(field, editValue, ingredient);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid value");
      return;
    }

    // Prepare updated ingredient
    const updatedIngredient: RecipeIngredient = {
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
  const validateField = (field: string, value: string, ingredient: RecipeIngredient): ValidationResult => {
    // Check if this field should be editable for this ingredient type
    if (!isFieldEditable(ingredient.type, field)) {
      return {
        isValid: false,
        error: `${field} is not editable for ${ingredient.type} ingredients`,
      };
    }

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
        const validUses: Record<string, string[]> = {
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
  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Render editable cell
  const renderEditableCell = (
    ingredient: RecipeIngredient,
    field: string,
    currentValue: any,
    displayValue: React.ReactNode
  ): React.ReactNode => {
    const isEditingThisCell =
      editingCell.ingredientId === ingredient.id && editingCell.field === field && ingredient.id;
    const fieldIsEditable = isFieldEditable(ingredient.type, field);

    if (!isEditingThisCell) {
      if (!fieldIsEditable) {
        // Return non-editable display for fields that shouldn't be editable
        return <span className="non-editable-cell">{displayValue}</span>;
      }

      return (
        <span
          className="editable-cell"
          onClick={() => ingredient.id && startEdit(ingredient.id, field, currentValue)}
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
            ref={inputRef as React.RefObject<HTMLSelectElement>}
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
          ref={inputRef as React.RefObject<HTMLInputElement>}
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

  const mapGrainType = (type: string): string => {
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
  const formatIngredientAmount = (ingredient: RecipeIngredient): string => {
    const amount = parseFloat(ingredient.amount.toString());
    const unit = ingredient.unit;

    if (isNaN(amount)) return "0 " + unit;

    // Determine measurement type for proper formatting
    let measurementType = "weight";
    if (ingredient.type === "hop") {
      measurementType = "hop_weight";
    } else if (ingredient.type === "other" ) {
      measurementType = "other";
    }

    return formatValue(amount, unit, measurementType as any);
  };

  // Format time display with appropriate units
  const formatTime = (ingredient: RecipeIngredient): string => {
    if (!ingredient.time) return "-";

    const time = parseInt(ingredient.time.toString());
    if (time === 0) return "-";

    // Use the utility function to format time with smart conversion to days/hours
    return formatTimeUtil(time);
  };

  // Get usage display text
  const formatUsage = (ingredient: RecipeIngredient): string => {
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
  const getRowClass = (ingredient: RecipeIngredient): string => {
    let baseClass = "ingredient-row";

    if (ingredient.type === "grain") {
      baseClass += " grain-row";
      if ((ingredient as any).grain_type === "base_malt") {
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

  // Group ingredients by type for compact display
  const groupedIngredients: { [key: string]: RecipeIngredient[] } = sortedIngredients.reduce((acc, ingredient) => {
    const type = ingredient.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(ingredient);
    return acc;
  }, {} as { [key: string]: RecipeIngredient[] });

  // Render ingredients in compact card format
  const renderCompactIngredients = () => {
    return (
      <div className={compact ? "ingredients-compact-container" : "card"}>
        <h3 className="card-title">Recipe Ingredients</h3>
        
        <div className="ingredients-compact-grid">
          {Object.entries(groupedIngredients).map(([type, items]) => (
            <div key={type} className="ingredient-type-section">
              <h4 className="ingredient-type-title">
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </h4>
              <div className="ingredient-cards">
                {items.map((ingredient) => (
                  <div
                    key={`${ingredient.type}-${ingredient.id}`}
                    className={`ingredient-card ${getRowClass(ingredient)}`}
                  >
                    <div className="ingredient-card-header">
                      <div className="ingredient-card-name">
                        <strong>{ingredient.name}</strong>
                        {ingredient.type === "grain" && (ingredient as any).grain_type && (
                          <span className="ingredient-subtype">
                            {mapGrainType((ingredient as any).grain_type)}
                          </span>
                        )}
                        {ingredient.type === "hop" && (ingredient as any).origin && (
                          <span className="ingredient-origin">
                            {(ingredient as any).origin}
                          </span>
                        )}
                        {ingredient.type === "yeast" && (ingredient as any).manufacturer && (
                          <span className="ingredient-manufacturer">
                            {(ingredient as any).manufacturer}
                          </span>
                        )}
                      </div>
                      <div className="ingredient-card-amount">
                        <strong>{formatIngredientAmount(ingredient)}</strong>
                      </div>
                    </div>
                    
                    <div className="ingredient-card-details">
                      <div className="ingredient-card-info">
                        <span className="ingredient-detail">
                          <strong>Use:</strong> {formatUsage(ingredient)}
                        </span>
                        <span className="ingredient-detail">
                          <strong>Time:</strong> {formatTime(ingredient)}
                        </span>
                      </div>
                      
                      {ingredient.type === "hop" && (ingredient as any).alpha_acid && (
                        <div className="ingredient-card-spec">
                          <span className="spec-label">AA:</span>
                          <span className="spec-value">{(ingredient as any).alpha_acid}%</span>
                        </div>
                      )}
                      
                      {ingredient.type === "grain" && (ingredient as any).color && (
                        <div className="ingredient-card-spec">
                          <span className="spec-label">Color:</span>
                          <span className="spec-value">{(ingredient as any).color}°L</span>
                        </div>
                      )}
                      
                      {ingredient.type === "yeast" && (
                        <div className="ingredient-card-yeast">
                          {(ingredient.improved_attenuation_estimate || ingredient.attenuation) && (
                            <div className="yeast-attenuation">
                              <span className="spec-label">
                                {ingredient.improved_attenuation_estimate ? "Enhanced Att:" : "Base Att:"}
                              </span>
                              <span className="spec-value">
                                {ingredient.improved_attenuation_estimate || ingredient.attenuation}%
                                {ingredient.improved_attenuation_estimate && (
                                  <span className="enhanced-indicator" title="Based on real-world fermentation data">📊</span>
                                )}
                              </span>
                            </div>
                          )}
                          <AttenuationBadge 
                            ingredientId={ingredient.ingredient_id}
                            className="compact"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Return compact view if compact prop is true
  if (compact) {
    if (!ingredients || ingredients.length === 0) {
      return (
        <div className="ingredients-compact-container">
          <h3 className="card-title">Recipe Ingredients</h3>
          <p className="text-center py-4">No ingredients added yet.</p>
        </div>
      );
    }
    return renderCompactIngredients();
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
                    <span className={`type-badge ${ingredient.type}`}>
                      {ingredient.type}
                    </span>
                  </td>
                )}

                <td className="ingredient-name">
                  <div className="ingredient-name-container">
                    <strong>{ingredient.name}</strong>
                    {ingredient.type === "grain" && (ingredient as any).grain_type && (
                      <div className="ingredient-subtype">
                        {mapGrainType((ingredient as any).grain_type)}
                      </div>
                    )}
                    {ingredient.type === "hop" && (ingredient as any).origin && (
                      <div className="ingredient-origin">
                        {(ingredient as any).origin}
                      </div>
                    )}
                    {ingredient.type === "yeast" && (ingredient as any).manufacturer && (
                      <div className="ingredient-manufacturer">
                        {(ingredient as any).manufacturer}
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
                  {isEditing && isFieldEditable(ingredient.type, "use") ? (
                    renderEditableCell(
                      ingredient,
                      "use",
                      ingredient.use,
                      formatUsage(ingredient)
                    )
                  ) : (
                    <span className="non-editable-cell">
                      {formatUsage(ingredient)}
                    </span>
                  )}
                </td>

                <td className="ingredient-time">
                  {isEditing && isFieldEditable(ingredient.type, "time") ? (
                    renderEditableCell(
                      ingredient,
                      "time",
                      ingredient.time || "",
                      formatTime(ingredient)
                    )
                  ) : (
                    <span className="non-editable-cell">
                      {formatTime(ingredient)}
                    </span>
                  )}
                </td>

                {isEditing && (
                  <td className="ingredient-details">
                    <div className="ingredient-details-container">
                      {ingredient.type === "hop" && (
                        <div className="detail-item">
                          <span className="detail-label">AA:</span>
                          {isFieldEditable(ingredient.type, "alpha_acid") ? (
                            renderEditableCell(
                              ingredient,
                              "alpha_acid",
                              (ingredient as any).alpha_acid || "",
                              <span className="detail-value">
                                {(ingredient as any).alpha_acid || "-"}%
                              </span>
                            )
                          ) : (
                            <span className="detail-value">
                              {(ingredient as any).alpha_acid || "-"}%
                            </span>
                          )}
                        </div>
                      )}
                      {ingredient.type === "grain" && (
                        <div className="detail-item">
                          <span className="detail-label">Color:</span>
                          {isFieldEditable(ingredient.type, "color") ? (
                            renderEditableCell(
                              ingredient,
                              "color",
                              (ingredient as any).color || "",
                              <span className="detail-value">
                                {(ingredient as any).color || "-"}°L
                              </span>
                            )
                          ) : (
                            <span className="detail-value">
                              {(ingredient as any).color || "-"}°L
                            </span>
                          )}
                        </div>
                      )}
                      {ingredient.type === "yeast" && (
                        <div className="detail-item yeast-attenuation">
                          {(ingredient.improved_attenuation_estimate || ingredient.attenuation) && (
                            <div className="traditional-attenuation">
                              <span className="detail-label">
                                {ingredient.improved_attenuation_estimate ? "Enhanced Attenuation:" : "Base Attenuation:"}
                              </span>
                              <span className="detail-value">
                                {ingredient.improved_attenuation_estimate || ingredient.attenuation}%
                                {ingredient.improved_attenuation_estimate && (
                                  <span className="enhanced-indicator" title="Based on real-world fermentation data">📊</span>
                                )}
                              </span>
                            </div>
                          )}
                          <AttenuationBadge 
                            ingredientId={ingredient.ingredient_id}
                            className="compact"
                          />
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
                      onClick={() => ingredient.id && onRemove(ingredient.id)}
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
            💡 <strong>Editable fields:</strong> Grains (amount, color) • Hops
            (amount, use, time, alpha acid) • Yeast (amount) • Other (amount,
            use, time)
            <br />
            Press Enter to save, Escape to cancel.
          </small>
        </div>
      )}
    </div>
  );
};

export default IngredientsList;