import React, { useState } from "react";
import { useUnits } from "../../../contexts/UnitContext";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function HopInput({ hops, onAdd, disabled = false }) {
  const { unitSystem, getPreferredUnit } = useUnits();

  const [hopForm, setHopForm] = useState({
    ingredient_id: "",
    amount: "",
    alpha_acid: "",
    unit: getPreferredUnit("hop_weight"), // Dynamic based on user preference
    use: "boil",
    time: "",
    time_unit: "minutes",
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});
  const [resetTrigger, setResetTrigger] = useState(0);

  // Get available units based on unit system
  const getAvailableUnits = () => {
    if (unitSystem === "metric") {
      return [
        { value: "g", label: "g", description: "Grams" },
        { value: "oz", label: "oz", description: "Ounces" }, // Keep oz as option for metric users
      ];
    } else {
      return [
        { value: "oz", label: "oz", description: "Ounces" },
        { value: "g", label: "g", description: "Grams" }, // Keep g as option for imperial users
      ];
    }
  };

  // Custom Fuse.js options for hops - fuzzy matching for varieties
  const hopFuseOptions = {
    threshold: 0.4, // More forgiving for hop varieties
    keys: [
      { name: "name", weight: 1.0 },
      { name: "description", weight: 0.5 },
      { name: "origin", weight: 0.3 },
    ],
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    useExtendedSearch: true, // Allow OR searches like "cascade | centennial"
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Create updated form data
    let updatedForm = {
      ...hopForm,
      [name]: value,
    };

    // If use changed, adjust time defaults and units
    if (name === "use") {
      if (value === "dry-hop") {
        updatedForm.time_unit = "days";
        updatedForm.time = updatedForm.time || "3"; // Default to 3 days
      } else if (value === "boil") {
        updatedForm.time_unit = "minutes";
        if (updatedForm.time === "3") updatedForm.time = ""; // Clear days default
      } else if (value === "whirlpool") {
        updatedForm.time_unit = "minutes";
        updatedForm.time = updatedForm.time || "15"; // Default to 15 minutes
      }
    }

    setHopForm(updatedForm);

    // Clear related errors when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleHopSelect = (selectedHop) => {
    if (selectedHop) {
      setHopForm((prev) => ({
        ...prev,
        ingredient_id: selectedHop.ingredient_id,
        alpha_acid: selectedHop.alpha_acid || "",
        selectedIngredient: selectedHop,
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
      setHopForm((prev) => ({
        ...prev,
        ingredient_id: "",
        alpha_acid: "",
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!hopForm.ingredient_id) {
      newErrors.ingredient_id = "Please select a hop variety";
    }

    if (!hopForm.amount || parseFloat(hopForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation
    const amount = parseFloat(hopForm.amount);
    const unit = hopForm.unit;

    if (unit === "oz" && amount > 10) {
      newErrors.amount = "More than 10 oz seems unusually high for hops";
    } else if (unit === "g" && amount > 300) {
      newErrors.amount = "More than 300g seems unusually high for hops";
    }

    if (!hopForm.alpha_acid || parseFloat(hopForm.alpha_acid) <= 0) {
      newErrors.alpha_acid = "Alpha acid percentage is required";
    }

    if (parseFloat(hopForm.alpha_acid) > 25) {
      newErrors.alpha_acid = "Alpha acid percentage seems unusually high";
    }

    // Validate time based on use
    if (
      hopForm.use === "boil" &&
      (!hopForm.time || parseInt(hopForm.time) < 0)
    ) {
      newErrors.time = "Boil time is required for boil additions";
    }

    if (
      hopForm.use === "dry-hop" &&
      (!hopForm.time || parseInt(hopForm.time) <= 0)
    ) {
      newErrors.time = "Dry hop time must be greater than 0";
    }

    if (
      hopForm.time &&
      parseInt(hopForm.time) > 120 &&
      hopForm.time_unit === "minutes"
    ) {
      newErrors.time = "Boil time over 120 minutes is unusual";
    }

    if (
      hopForm.time &&
      parseInt(hopForm.time) > 21 &&
      hopForm.time_unit === "days"
    ) {
      newErrors.time = "Dry hop time over 21 days is unusual";
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
        ingredient_id: hopForm.ingredient_id,
        amount: hopForm.amount,
        unit: hopForm.unit,
        alpha_acid: hopForm.alpha_acid,
        use: hopForm.use,
        time: hopForm.time,
        time_unit: hopForm.time_unit,
      };

      await onAdd(formData);

      // Reset form on successful add
      setHopForm({
        ingredient_id: "",
        amount: "",
        alpha_acid: "",
        unit: getPreferredUnit("hop_weight"),
        use: "boil",
        time: "",
        time_unit: "minutes",
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to add hop:", error);
      setErrors({ submit: "Failed to add hop. Please try again." });
    }
  };

  // Get placeholder text for time input based on use
  const getTimePlaceholder = () => {
    switch (hopForm.use) {
      case "boil":
        return "60";
      case "whirlpool":
        return "15";
      case "dry-hop":
        return "3";
      default:
        return "0";
    }
  };

  // Get usage description
  const getUsageDescription = () => {
    switch (hopForm.use) {
      case "boil":
        return "Adds bitterness. Longer boil = more bitter.";
      case "whirlpool":
        return "Adds flavor and aroma with some bitterness.";
      case "dry-hop":
        return "Adds aroma and flavor with no bitterness.";
      default:
        return "";
    }
  };

  const getAmountPlaceholder = () => {
    return hopForm.unit === "oz" ? "1.0" : "28";
  };

  const getAmountGuidance = () => {
    if (unitSystem === "metric") {
      return "Bittering hops: 14-56g, Aroma hops: 14-28g per 19L batch";
    } else {
      return "Bittering hops: 0.5-2.0 oz, Aroma hops: 0.5-1.0 oz per 5 gal batch";
    }
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Hops</h3>

      <form onSubmit={handleSubmit} className="ingredient-form">
        <div className="ingredient-inputs ingredient-inputs--hop">
          {/* Amount Input */}
          <div className="amount-container">
            <input
              type="number"
              id="hop-amount"
              name="amount"
              value={hopForm.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              max={hopForm.unit === "oz" ? "10" : "300"}
              placeholder={getAmountPlaceholder()}
              className={`amount-input ${errors.amount ? "error" : ""}`}
              disabled={disabled}
              required
            />
            <select
              id="hop-unit"
              name="unit"
              value={hopForm.unit}
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

          {/* Hop Selector */}
          <div className="ingredient-selector">
            <SearchableSelect
              options={hops}
              onSelect={handleHopSelect}
              placeholder="Search hops (try: cascade, citrus, american)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              fuseOptions={hopFuseOptions}
              maxResults={15}
              minQueryLength={1}
              resetTrigger={resetTrigger}
            />
          </div>

          {/* Alpha Acid Input */}
          <div className="alpha-input-container">
            <input
              type="number"
              id="hop-alpha-acid"
              name="alpha_acid"
              value={hopForm.alpha_acid}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="25"
              placeholder="Alpha"
              className={`alpha-input ${errors.alpha_acid ? "error" : ""}`}
              disabled={disabled}
              required
            />
            <span className="alpha-unit">%AA</span>
          </div>

          {/* Time and Usage Controls */}
          <div className="hop-time-container">
            <input
              type="number"
              id="hop-time"
              name="time"
              value={hopForm.time}
              onChange={handleChange}
              step="1"
              min="0"
              placeholder={getTimePlaceholder()}
              className={`time-input ${errors.time ? "error" : ""}`}
              disabled={disabled}
            />
            <select
              id="hop-time-unit"
              name="time_unit"
              value={hopForm.time_unit}
              onChange={handleChange}
              className="time-unit-select"
              disabled={disabled}
            >
              <option value="minutes">min</option>
              <option value="days">days</option>
            </select>
            <select
              id="hop-use"
              name="use"
              value={hopForm.use}
              onChange={handleChange}
              className="use-select"
              disabled={disabled}
            >
              <option value="boil">Boil</option>
              <option value="whirlpool">Whirlpool</option>
              <option value="dry-hop">Dry Hop</option>
            </select>
          </div>

          {/* Add Button */}
          <button
            id="add-hop-btn"
            type="submit"
            className="ingredient-add-button"
            disabled={disabled}
          >
            {disabled ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Usage Description */}
        {hopForm.use && (
          <div className="usage-description">
            <small className="guidance-text">{getUsageDescription()}</small>
          </div>
        )}

        {/* Display selected ingredient info */}
        {hopForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="ingredient-info-header">
              <strong className="ingredient-name">
                {hopForm.selectedIngredient.name}
              </strong>
              {hopForm.selectedIngredient.origin && (
                <span className="ingredient-badge">
                  {hopForm.selectedIngredient.origin}
                </span>
              )}
            </div>
            {hopForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {hopForm.selectedIngredient.description}
              </p>
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
          {errors.alpha_acid && (
            <div className="error-message">{errors.alpha_acid}</div>
          )}
          {errors.time && (
            <div data-testid="time-error-message" className="error-message">
              {errors.time}
            </div>
          )}
          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}
        </div>
      </form>

      {/* Help text with unit-specific guidance */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 {getAmountGuidance()}. Boil hops add bitterness, aroma hops
          (whirlpool/dry hop) add flavor and aroma. Try advanced search:
          "cascade | centennial" or "citrus"
        </small>
      </div>
    </div>
  );
}

export default HopInput;
