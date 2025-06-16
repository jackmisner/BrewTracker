import React, { useState } from "react";
import { useUnits } from "../../../contexts/UnitContext";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function YeastInput({ yeasts, onAdd, disabled = false }) {
  const { unitSystem, getPreferredUnit } = useUnits();

  const [yeastForm, setYeastForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: getPreferredUnit("yeast") || "pkg", // Default to packages
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});
  const [resetTrigger, setResetTrigger] = useState(0);

  // Get available units (yeast units are fairly universal)
  const getAvailableUnits = () => {
    return [
      { value: "pkg", label: "pkg", description: "Packages" },
      { value: "g", label: "g", description: "Grams" },
      { value: "ml", label: "ml", description: "Milliliters" },
    ];
  };

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
        unit: getPreferredUnit("yeast") || "pkg",
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to add yeast:", error);
      setErrors({ submit: "Failed to add yeast. Please try again." });
    }
  };

  const getAmountPlaceholder = () => {
    switch (yeastForm.unit) {
      case "pkg":
        return "1";
      case "g":
        return "11";
      case "ml":
        return "125";
      default:
        return "1";
    }
  };

  const getAmountGuidance = () => {
    const batchSize = unitSystem === "metric" ? "19L" : "5 gal";

    switch (yeastForm.unit) {
      case "pkg":
        return `Typically 1-2 packages per ${batchSize} batch`;
      case "g":
        return "Dry yeast: ~11g/pkg, Liquid: varies by strain";
      case "ml":
        return "Liquid yeast: ~35-125ml per vial/smack pack";
      default:
        return "";
    }
  };

  const getBatchSizeGuidance = () => {
    if (unitSystem === "metric") {
      return "Most 19-23L batches need 1-2 packages";
    } else {
      return "Most 5-gallon batches need 1-2 packages";
    }
  };

  const getYeastTypeInfo = (yeast) => {
    if (!yeast) return null;

    const info = [];

    if (yeast.attenuation) {
      info.push(`${yeast.attenuation}% attenuation`);
    }

    if (yeast.min_temperature && yeast.max_temperature) {
      // Show temperature in user's preferred units
      if (unitSystem === "metric") {
        const minC = Math.round(((yeast.min_temperature - 32) * 5) / 9);
        const maxC = Math.round(((yeast.max_temperature - 32) * 5) / 9);
        info.push(`${minC}-${maxC}°C`);
      } else {
        info.push(`${yeast.min_temperature}-${yeast.max_temperature}°F`);
      }
    }

    if (yeast.alcohol_tolerance) {
      info.push(`${yeast.alcohol_tolerance}% alcohol tolerance`);
    }

    return info.length > 0 ? info.join(" • ") : null;
  };

  return (
    <div className="card">
      <h3 className="card-title">Yeast</h3>

      <form onSubmit={handleSubmit} className="ingredient-form">
        <div className="ingredient-inputs ingredient-inputs--yeast">
          {/* Amount Input */}
          <div className="amount-container">
            <input
              type="number"
              name="amount"
              value={yeastForm.amount}
              onChange={handleChange}
              className={`amount-input ${errors.amount ? "error" : ""}`}
              placeholder={getAmountPlaceholder()}
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
              className="unit-select"
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

          {/* Yeast Selector */}
          <div className="ingredient-selector">
            <SearchableSelect
              options={yeasts}
              onSelect={handleYeastSelect}
              placeholder="Search yeast (try: us-05, wyeast, safale)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              fuseOptions={yeastFuseOptions}
              maxResults={12}
              minQueryLength={2}
              resetTrigger={resetTrigger}
            />
          </div>

          {/* Add Button */}
          <button
            type="submit"
            className="ingredient-add-button"
            disabled={disabled}
          >
            {disabled ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Amount Guidance */}
        <div className="usage-description">
          <small className="guidance-text">{getAmountGuidance()}</small>
        </div>

        {/* Display selected yeast info */}
        {yeastForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="ingredient-info-header">
              <strong className="ingredient-name">
                {yeastForm.selectedIngredient.name}
              </strong>
              {yeastForm.selectedIngredient.manufacturer && (
                <span className="ingredient-badge">
                  {yeastForm.selectedIngredient.manufacturer}
                </span>
              )}
              {yeastForm.selectedIngredient.code && (
                <span className="ingredient-badge">
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

        {/* Error Messages */}
        <div className="validation-errors" role="alert">
          {errors.amount && (
            <div className="error-message">{errors.amount}</div>
          )}
          {errors.ingredient_id && (
            <div className="error-message">{errors.ingredient_id}</div>
          )}
          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}
        </div>
      </form>

      {/* Help text with unit-specific guidance */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 {getBatchSizeGuidance()} of dry yeast or 1 vial/smack pack of
          liquid yeast. Liquid yeast often provides more complex flavors.
        </small>
      </div>
    </div>
  );
}

export default YeastInput;
