import React, { useState } from "react";
import { useUnits } from "../../../contexts/UnitContext";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function FermentableInput({ grains, onAdd, disabled = false }) {
  const { unitSystem, getPreferredUnit } = useUnits();

  const [fermentableForm, setFermentableForm] = useState({
    ingredient_id: "",
    color: "",
    amount: "",
    unit: getPreferredUnit("weight"), // Dynamic based on user preference
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});
  const [resetTrigger, setResetTrigger] = useState(0);

  // Get available units based on unit system
  const getAvailableUnits = () => {
    if (unitSystem === "metric") {
      return [
        { value: "kg", label: "kg", description: "Kilograms" },
        { value: "g", label: "g", description: "Grams" },
      ];
    } else {
      return [
        { value: "lb", label: "lb", description: "Pounds" },
        { value: "oz", label: "oz", description: "Ounces" },
      ];
    }
  };

  // Custom Fuse.js options for fermentables - more strict matching
  const fermentableFuseOptions = {
    threshold: 0.3,
    keys: [
      { name: "name", weight: 1.0 },
      { name: "description", weight: 0.4 },
      { name: "grain_type", weight: 0.6 },
    ],
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFermentableForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear related errors when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleFermentableSelect = (selectedFermentable) => {
    if (selectedFermentable) {
      setFermentableForm((prev) => ({
        ...prev,
        ingredient_id: selectedFermentable.ingredient_id,
        color: selectedFermentable.color || "",
        selectedIngredient: selectedFermentable,
      }));

      // Clear ingredient selection error
      if (errors.ingredient_id) {
        setErrors((prev) => ({
          ...prev,
          ingredient_id: null,
        }));
      }
    } else {
      // Clear selection
      setFermentableForm((prev) => ({
        ...prev,
        ingredient_id: "",
        color: "",
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!fermentableForm.ingredient_id) {
      newErrors.ingredient_id = "Please select a fermentable";
    }

    if (!fermentableForm.amount || parseFloat(fermentableForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation
    const amount = parseFloat(fermentableForm.amount);
    const unit = fermentableForm.unit;

    if (unitSystem === "metric") {
      if (unit === "kg" && amount > 50) {
        newErrors.amount = "More than 50kg seems unusually high";
      } else if (unit === "g" && amount > 50000) {
        newErrors.amount = "More than 50kg seems unusually high";
      }
    } else {
      if (unit === "lb" && amount > 100) {
        newErrors.amount = "More than 100 pounds seems unusually high";
      } else if (unit === "oz" && amount > 1600) {
        newErrors.amount = "More than 100 pounds seems unusually high";
      }
    }

    if (
      fermentableForm.color &&
      (parseFloat(fermentableForm.color) < 0 ||
        parseFloat(fermentableForm.color) > 600)
    ) {
      newErrors.color = "Color should be between 0-600 Lovibond";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const formData = {
        ingredient_id: fermentableForm.ingredient_id,
        amount: fermentableForm.amount,
        unit: fermentableForm.unit,
        color: fermentableForm.color || undefined,
      };

      await onAdd(formData);

      // Reset form on successful add
      setFermentableForm({
        ingredient_id: "",
        color: "",
        amount: "",
        unit: getPreferredUnit("weight"),
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to add fermentable:", error);
      setErrors({ submit: "Failed to add fermentable. Please try again." });
    }
  };

  const getColorPreview = () => {
    const colorValue = parseFloat(fermentableForm.color);
    if (!colorValue || colorValue <= 0) return null;

    // Simple SRM to color mapping for preview
    let backgroundColor = "#FFE699"; // Default pale
    if (colorValue <= 2) backgroundColor = "#FFE699";
    else if (colorValue <= 3) backgroundColor = "#FFCA5A";
    else if (colorValue <= 6) backgroundColor = "#FBB123";
    else if (colorValue <= 10) backgroundColor = "#F39C00";
    else if (colorValue <= 20) backgroundColor = "#D37600";
    else if (colorValue <= 40) backgroundColor = "#B54C00";
    else backgroundColor = "#8D4000";

    return (
      <div
        className="color-preview-swatch"
        style={{
          backgroundColor,
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          border: "2px solid white",
          boxShadow: "0 0 0 1px #e5e7eb",
          marginLeft: "8px",
        }}
        title={`~${colorValue}°L`}
      />
    );
  };

  const getAmountPlaceholder = () => {
    if (unitSystem === "metric") {
      return fermentableForm.unit === "kg" ? "1" : "1000";
    } else {
      return fermentableForm.unit === "lb" ? "1" : "16";
    }
  };

  const getAmountGuidance = () => {
    if (unitSystem === "metric") {
      return "Base malts: 2-6 kg, Specialty malts: 100-500g";
    } else {
      return "Base malts: 4-12 lb, Specialty malts: 4-32 oz";
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Fermentables</h3>

      <form onSubmit={handleSubmit} className="fermentable-form">
        <div className="fermentable-inputs">
          {/* Amount Input */}
          <div className="fermentable-amount-container">
            <input
              type="number"
              id="fermentable-amount"
              name="amount"
              value={fermentableForm.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              max={unitSystem === "metric" ? "50000" : "1600"}
              placeholder={getAmountPlaceholder()}
              className={`fermentable-amount-input ${
                errors.amount ? "error" : ""
              }`}
              disabled={disabled}
              required
            />
            <select
              id="fermentable-unit"
              name="unit"
              value={fermentableForm.unit}
              onChange={handleChange}
              className="fermentable-unit-select"
              disabled={disabled}
            >
              {getAvailableUnits().map((unit) => (
                <option
                  key={unit.value}
                  value={unit.value}
                  title={unit.description}
                >
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fermentable Selector with reset trigger */}
          <div className="fermentable-selector">
            <SearchableSelect
              options={grains}
              onSelect={handleFermentableSelect}
              placeholder="Search fermentables (malt, grain, sugar)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              className={`fermentable-select-control ${
                errors.ingredient_id ? "error" : ""
              }`}
              fuseOptions={fermentableFuseOptions}
              maxResults={100}
              minQueryLength={1}
              resetTrigger={resetTrigger}
            />
          </div>

          {/* Color Input with Preview */}
          <div className="fermentable-color-container">
            <div className="color-input-wrapper">
              <input
                type="number"
                id="fermentable-color"
                name="color"
                value={fermentableForm.color}
                onChange={handleChange}
                step="0.5"
                min="0"
                max="600"
                placeholder="Color"
                className={`fermentable-color-input ${
                  errors.color ? "error" : ""
                }`}
                disabled={disabled}
              />
              <span className="fermentable-color-unit">°L</span>
              {getColorPreview()}
            </div>
          </div>

          {/* Add Button */}
          <div className="fermentable-button-container">
            <button
              id="add-fermentable-btn"
              type="submit"
              className="fermentable-add-button btn-primary"
              disabled={disabled}
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Display selected ingredient info */}
        {fermentableForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <strong>{fermentableForm.selectedIngredient.name}</strong>
            {fermentableForm.selectedIngredient.grain_type && (
              <span className="grain-type-badge">
                {fermentableForm.selectedIngredient.grain_type.replace(
                  "_",
                  " "
                )}
              </span>
            )}
            {fermentableForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {fermentableForm.selectedIngredient.description}
              </p>
            )}
          </div>
        )}

        {/* Submit Error */}
        {errors.submit && (
          <div className="error-message submit-error">{errors.submit}</div>
        )}
        <div className="validation-errors" role="alert">
          {errors.amount && (
            <div className="error-message">{errors.amount}</div>
          )}
          {errors.ingredient_id && (
            <div className="error-message">{errors.ingredient_id}</div>
          )}
          {errors.color && <div className="error-message">{errors.color}</div>}
        </div>
      </form>

      {/* Help text with unit-specific guidance */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 {getAmountGuidance()}. Base malts (Pale, Pilsner) typically make up
          60-80% of your grain bill.
        </small>
      </div>
    </div>
  );
}

export default FermentableInput;
