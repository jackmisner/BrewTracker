import React from "react";
import { useUnits } from "../../contexts/UnitContext";
import { Link } from "react-router";

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
    convertForDisplay,
    convertForStorage,
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

    // Handle unit-specific conversions for batch size
    if (name === "batch_size" && newValue) {
      // Convert from display unit to storage unit (gallons)
      const converted = convertForStorage(
        newValue,
        unitSystem === "metric" ? "l" : "gal",
        "volume"
      );
      newValue = converted.value;
    }

    // Call onChange with field name and new value
    onChange(name, newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  // Convert batch size for display
  const displayBatchSize = recipe.batch_size
    ? convertForDisplay(recipe.batch_size, "gal", "volume")
    : {
        value: unitSystem === "metric" ? 19 : 5,
        unit: unitSystem === "metric" ? "l" : "gal",
      };

  // Get unit-specific properties
  const getBatchSizeProps = () => {
    if (unitSystem === "metric") {
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

  // Get typical batch size examples
  const getTypicalBatchExamples = () => {
    const sizes = getTypicalBatchSizes();
    return sizes.map((size) => size.label).join(", ");
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
          <input
            type="text"
            id="style"
            name="style"
            value={recipe.style || ""}
            onChange={handleChange}
            className="form-control"
            placeholder="e.g. American IPA, Stout, Wheat Beer"
            disabled={saving}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="batch_size">
              Batch Size ({batchSizeProps.unit}) *
              <span className="unit-indicator">
                Currently:{" "}
                {formatValue(
                  displayBatchSize.value,
                  displayBatchSize.unit,
                  "volume"
                )}
              </span>
            </label>
            <input
              type="number"
              id="batch_size"
              name="batch_size"
              value={displayBatchSize.value}
              onChange={handleChange}
              className="form-control"
              min={batchSizeProps.min}
              max={batchSizeProps.max}
              step={batchSizeProps.step}
              required
              disabled={saving}
              placeholder={batchSizeProps.placeholder}
            />
            <small className="form-help-text">{batchSizeProps.typical}</small>
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
              Using {getUnitSystemLabel()} units
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
