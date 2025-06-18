import React from "react";
import { useUnits } from "../../contexts/UnitContext";
import { Link } from "react-router";
import BeerStyleSelector from "./BeerStyles/BeerStyleSelector";

function RecipeDetails({
  recipe,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  saving,
  canSave,
  hasUnsavedChanges,
}) {
  const {
    unitSystem,
    formatValue,
    getUnitSystemLabel,
    getUnitSystemIcon,
    getTypicalBatchSizes,
  } = useUnits();

  if (!recipe) {
    return <div>Loading recipe details...</div>;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    let newValue;
    if (type === "checkbox") {
      newValue = checked;
    } else if (type === "number") {
      newValue = parseFloat(value) || "";
    } else {
      newValue = value;
    }

    // Call onChange with field name and new value
    onChange(name, newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  // Use the recipe's stored batch size and unit - don't convert
  const displayBatchSize =
    recipe.batch_size || (unitSystem === "metric" ? 19 : 5);
  const batchSizeUnit =
    recipe.batch_size_unit || (unitSystem === "metric" ? "l" : "gal");

  // Determine if recipe was created in metric or imperial
  const recipeUnitSystem = batchSizeUnit === "l" ? "metric" : "imperial";

  // Get unit-specific properties based on the recipe's original unit system
  const getBatchSizeProps = () => {
    if (batchSizeUnit === "l") {
      return {
        unit: "liters",
        abbrev: "L",
        min: "1",
        max: "380",
        step: "1",
        placeholder: "19",
        typical: "Typical homebrew batch: 19-23 L",
      };
    } else {
      return {
        unit: "gallons",
        abbrev: "gal",
        min: "0.5",
        max: "100",
        step: "0.5",
        placeholder: "5",
        typical: "Typical homebrew batch: 5 gal",
      };
    }
  };

  const batchSizeProps = getBatchSizeProps();

  // Get efficiency guidance based on common practices
  const getEfficiencyGuidance = () => {
    return "Typical efficiency: 70-80% for all-grain, 85-90% for extract";
  };

  // Get boil time guidance
  const getBoilTimeGuidance = () => {
    return "Standard boil: 60 min, Short boil: 30 min, Extended: 90-120 min";
  };

  return (
    <div className="recipe-details card">
      <h2 className="card-title">
        {isEditing ? "Recipe Details" : "New Recipe Details"}

        {hasUnsavedChanges && (
          <span className="unsaved-indicator" title="Unsaved changes">
            *
          </span>
        )}
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Recipe Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={recipe.name}
            onChange={handleChange}
            className="form-control"
            required
            placeholder="Enter recipe name"
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="style">Beer Style</label>
          <BeerStyleSelector
            value={recipe.style || ""}
            onChange={(styleName) => onChange("style", styleName)}
            placeholder="Select or search beer style (optional)"
            disabled={saving}
          />
          <small className="form-help-text">
            Select a recognized beer style or enter a custom style name
          </small>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="batch_size">
              Batch Size ({batchSizeProps.unit}) *
              <span className="unit-indicator">
                {displayBatchSize} {batchSizeUnit.toUpperCase()}
              </span>
            </label>
            <input
              type="number"
              id="batch_size"
              name="batch_size"
              value={displayBatchSize}
              onChange={(e) => {
                // Update both batch size and unit
                handleChange(e);
                // Also update the batch_size_unit if needed
                if (!recipe.batch_size_unit) {
                  onChange("batch_size_unit", batchSizeUnit);
                }
              }}
              className="form-control"
              min={batchSizeProps.min}
              max={batchSizeProps.max}
              step={batchSizeProps.step}
              required
              disabled={saving}
              placeholder={batchSizeProps.placeholder}
            />
            <small className="form-help-text">
              {batchSizeProps.typical}
              {isEditing && (
                <span className="recipe-unit-info">
                  {" "}
                  • Recipe created in {recipeUnitSystem} units
                </span>
              )}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="boil_time">Boil Time (minutes)</label>
            <input
              type="number"
              id="boil_time"
              name="boil_time"
              value={recipe.boil_time || ""}
              onChange={handleChange}
              className="form-control"
              min="15"
              max="180"
              step="15"
              placeholder="60"
              disabled={saving}
            />
            <small className="form-help-text">{getBoilTimeGuidance()}</small>
          </div>

          <div className="form-group">
            <label htmlFor="efficiency">Mash Efficiency (%)</label>
            <input
              type="number"
              id="efficiency"
              name="efficiency"
              value={recipe.efficiency || ""}
              onChange={handleChange}
              className="form-control"
              min="50"
              max="95"
              step="1"
              placeholder="75"
              disabled={saving}
            />
            <small className="form-help-text">{getEfficiencyGuidance()}</small>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={recipe.description || ""}
            onChange={handleChange}
            className="form-control form-textarea"
            rows="3"
            placeholder="Describe your recipe, inspiration, or other relevant details"
            disabled={saving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="notes">Brewing Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={recipe.notes || ""}
            onChange={handleChange}
            className="form-control form-textarea"
            rows="3"
            placeholder="Special instructions, tips, or modifications"
            disabled={saving}
          />
        </div>
        <div className="form-check">
          <input
            type="checkbox"
            id="is_public"
            name="is_public"
            checked={recipe.is_public || false}
            onChange={handleChange}
            className="form-check-input"
            disabled={saving}
          />
          <label className="form-check-label" htmlFor="is_public">
            Make Recipe Public
            {recipe.is_public && (
              <div>
                <small className="form-help-text">
                  Other users will be able to view and clone this recipe
                </small>
              </div>
            )}
          </label>
        </div>
        {/* Enhanced Unit System Indicator */}
        <div className="unit-system-indicator">
          <div className="unit-system-info">
            <span className="unit-system-icon">{getUnitSystemIcon()}</span>
            <span className="unit-system-text">
              Your preference: {getUnitSystemLabel()} units
            </span>
            <span className="unit-system-details">
              ({unitSystem === "metric" ? "L, °C, kg, g" : "gal, °F, lb, oz"})
            </span>
          </div>
          <div className="unit-system-actions">
            <Link to="/settings" className="unit-settings-link">
              Change in Settings
            </Link>
          </div>
          {recipeUnitSystem !== unitSystem && (
            <div className="unit-system-warning">
              <small className="warning-text">
                ⚠️ This recipe was created in {recipeUnitSystem} units.
                Ingredients will be displayed in your preferred units (
                {unitSystem}).
              </small>
            </div>
          )}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={`btn btn-primary ${!canSave ? "btn-disabled" : ""}`}
            disabled={!canSave || saving}
            title={!canSave ? "Add at least one ingredient to save" : ""}
          >
            {saving ? (
              <>
                <span className="button-spinner"></span>
                Saving...
              </>
            ) : (
              `${isEditing ? "Update" : "Save"} Recipe`
            )}
          </button>
        </div>
        {/* Recipe validation info */}
        {!canSave && (
          <div className="validation-info">
            <small className="validation-message">
              💡 Add at least one grain and yeast to save your recipe
            </small>
          </div>
        )}
      </form>
    </div>
  );
}

export default RecipeDetails;
