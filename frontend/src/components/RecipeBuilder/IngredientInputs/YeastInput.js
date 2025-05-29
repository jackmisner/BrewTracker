import React, { useState } from "react";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function YeastInput({ yeasts, onAdd, disabled = false }) {
  const [yeastForm, setYeastForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "pkg",
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});

  // Custom Fuse.js options for yeast - precise matching since strain matters
  const yeastFuseOptions = {
    threshold: 0.2, // Very strict matching for yeast strains
    keys: [
      { name: "name", weight: 1.0 },
      { name: "manufacturer", weight: 0.8 },
      { name: "code", weight: 0.9 },
      { name: "description", weight: 0.4 },
    ],
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
    distance: 20, // Keep matches close to beginning
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setYeastForm((prev) => ({
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

  const handleYeastSelect = (selectedYeast) => {
    if (selectedYeast) {
      setYeastForm((prev) => ({
        ...prev,
        ingredient_id: selectedYeast.ingredient_id,
        selectedIngredient: selectedYeast,
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
      setYeastForm((prev) => ({
        ...prev,
        ingredient_id: "",
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!yeastForm.ingredient_id) {
      newErrors.ingredient_id = "Please select a yeast strain";
    }

    if (!yeastForm.amount || parseFloat(yeastForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation
    const amount = parseFloat(yeastForm.amount);
    if (yeastForm.unit === "pkg" && amount > 10) {
      newErrors.amount = "More than 10 packages is unusual - are you sure?";
    }

    if (yeastForm.unit === "g" && (amount < 5 || amount > 100)) {
      newErrors.amount = "Typical dry yeast: 5-15g. Liquid yeast: 10-50g";
    }

    if (yeastForm.unit === "ml" && (amount < 10 || amount > 500)) {
      newErrors.amount = "Typical liquid yeast volume: 35-125ml";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Additional confirmation for unusual amounts
    const amount = parseFloat(yeastForm.amount);
    if (yeastForm.unit === "pkg" && amount > 3) {
      const confirmed = window.confirm(
        `Using ${amount} packages of yeast is unusual for most batches. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      const formData = {
        ingredient_id: yeastForm.ingredient_id,
        amount: yeastForm.amount,
        unit: yeastForm.unit,
      };

      await onAdd(formData);

      // Reset form on successful add
      setYeastForm({
        ingredient_id: "",
        amount: "",
        unit: "pkg",
        selectedIngredient: null,
      });

      setErrors({});
    } catch (error) {
      console.error("Failed to add yeast:", error);
      setErrors({ submit: "Failed to add yeast. Please try again." });
    }
  };

  const getAmountGuidance = () => {
    switch (yeastForm.unit) {
      case "pkg":
        return "Typically 1-2 packages for 5 gallons";
      case "g":
        return "Dry yeast: ~11g/pkg, Liquid: varies";
      case "ml":
        return "Liquid yeast: ~35-125ml per vial/smack pack";
      default:
        return "";
    }
  };

  const getYeastTypeInfo = (yeast) => {
    if (!yeast) return null;

    const info = [];

    if (yeast.attenuation) {
      info.push(`${yeast.attenuation}% attenuation`);
    }

    if (yeast.min_temperature && yeast.max_temperature) {
      info.push(`${yeast.min_temperature}-${yeast.max_temperature}°F`);
    }

    if (yeast.alcohol_tolerance) {
      info.push(`${yeast.alcohol_tolerance}% alcohol tolerance`);
    }

    return info.length > 0 ? info.join(" • ") : null;
  };

  return (
    <div className="card">
      <h3 className="card-title">Yeast</h3>

      <form onSubmit={handleSubmit} className="yeast-form">
        <div className="yeast-inputs">
          {/* Amount Input */}
          <div className="yeast-amount-container">
            <input
              type="number"
              name="amount"
              value={yeastForm.amount}
              onChange={handleChange}
              className={`yeast-amount-input ${errors.amount ? "error" : ""}`}
              placeholder="Amount"
              step="0.5"
              min="0.5"
              max="20"
              disabled={disabled}
              required
            />
            <select
              name="unit"
              value={yeastForm.unit}
              onChange={handleChange}
              className="yeast-unit-select"
              disabled={disabled}
            >
              <option value="pkg">pkg</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
            {errors.amount && (
              <div className="error-message">{errors.amount}</div>
            )}
          </div>

          {/* Yeast Selector */}
          <div className="yeast-selector">
            <SearchableSelect
              options={yeasts}
              onSelect={handleYeastSelect}
              placeholder="Search yeast (try: us-05, wyeast, safale)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              className={`yeast-select-control ${
                errors.ingredient_id ? "error" : ""
              }`}
              fuseOptions={yeastFuseOptions}
              maxResults={12}
              minQueryLength={2}
            />
            {errors.ingredient_id && (
              <div className="error-message">{errors.ingredient_id}</div>
            )}
          </div>

          {/* Add Button */}
          <div className="yeast-button-container">
            <button
              type="submit"
              className="yeast-add-button btn-primary"
              disabled={
                disabled || !yeastForm.ingredient_id || !yeastForm.amount
              }
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Amount Guidance */}
        <div className="yeast-guidance">
          <small className="guidance-text">{getAmountGuidance()}</small>
        </div>

        {/* Display selected yeast info */}
        {yeastForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="yeast-header">
              <strong>{yeastForm.selectedIngredient.name}</strong>
              {yeastForm.selectedIngredient.manufacturer && (
                <span className="yeast-manufacturer-badge">
                  {yeastForm.selectedIngredient.manufacturer}
                </span>
              )}
              {yeastForm.selectedIngredient.code && (
                <span className="yeast-code-badge">
                  {yeastForm.selectedIngredient.code}
                </span>
              )}
            </div>

            {yeastForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {yeastForm.selectedIngredient.description}
              </p>
            )}

            {getYeastTypeInfo(yeastForm.selectedIngredient) && (
              <div className="yeast-specs">
                <small>{getYeastTypeInfo(yeastForm.selectedIngredient)}</small>
              </div>
            )}
          </div>
        )}

        {/* Submit Error */}
        {errors.submit && (
          <div className="error-message submit-error">{errors.submit}</div>
        )}
      </form>

      {/* Help text */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 Most 5-gallon batches need 1-2 packages of dry yeast or 1
          vial/smack pack of liquid yeast. Liquid yeast often provides more
          complex flavors.
        </small>
      </div>
    </div>
  );
}

export default YeastInput;
