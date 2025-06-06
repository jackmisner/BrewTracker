import React, { useState } from "react";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function HopInput({ hops, onAdd, disabled = false }) {
  const [hopForm, setHopForm] = useState({
    ingredient_id: "",
    amount: "",
    alpha_acid: "",
    unit: "oz",
    use: "boil",
    time: "",
    time_unit: "minutes",
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});
  const [resetTrigger, setResetTrigger] = useState(0);
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

    if (parseFloat(hopForm.amount) > 10) {
      newErrors.amount = "Amount seems unusually high for hops";
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
        unit: "oz",
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

  return (
    <div className="card mt-6">
      <h3 className="card-title">Hops</h3>

      <form onSubmit={handleSubmit} className="hop-form">
        <div className="hop-inputs">
          {/* Amount Input */}
          <div className="hop-amount-container">
            <input
              type="number"
              id="hop-amount"
              name="amount"
              value={hopForm.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="10"
              placeholder="Amount"
              className={`hop-amount-input ${errors.amount ? "error" : ""}`}
              disabled={disabled}
              required
            />
            <select
              id="hop-unit"
              name="unit"
              value={hopForm.unit}
              onChange={handleChange}
              className="hop-unit-select"
              disabled={disabled}
            >
              <option value="oz">oz</option>
              <option value="g">g</option>
            </select>
            {errors.amount && (
              <div className="error-message">{errors.amount}</div>
            )}
          </div>

          {/* Hop Selector */}
          <div className="hop-selector">
            <SearchableSelect
              options={hops}
              onSelect={handleHopSelect}
              placeholder="Search hops (try: cascade, citrus, american)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              className={`hop-select-control ${
                errors.ingredient_id ? "error" : ""
              }`}
              fuseOptions={hopFuseOptions}
              maxResults={15}
              minQueryLength={1}
              resetTrigger={resetTrigger}
            />
            {errors.ingredient_id && (
              <div className="error-message">{errors.ingredient_id}</div>
            )}
          </div>

          {/* Alpha Acid Input */}
          <div className="hop-alpha-container">
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
              className={`hop-alpha-input ${errors.alpha_acid ? "error" : ""}`}
              disabled={disabled}
              required
            />
            <span className="hop-alpha-unit">%AA</span>
            {errors.alpha_acid && (
              <div className="error-message">{errors.alpha_acid}</div>
            )}
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
              className={`hop-time-input ${errors.time ? "error" : ""}`}
              disabled={disabled}
            />
            <select
              id="hop-time-unit"
              name="time_unit"
              value={hopForm.time_unit}
              onChange={handleChange}
              className="hop-time-unit-select"
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
              className="hop-use-select"
              disabled={disabled}
            >
              <option value="boil">Boil</option>
              <option value="whirlpool">Whirlpool</option>
              <option value="dry-hop">Dry Hop</option>
            </select>
            {errors.time && (
              <div data-testid="time-error-message" className="error-message">
                {errors.time}
              </div>
            )}
          </div>

          {/* Add Button */}
          <div className="hop-button-container">
            <button
              id="add-hop-btn"
              type="submit"
              className="hop-add-button btn-primary"
              disabled={disabled}
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Usage Description */}
        {hopForm.use && (
          <div className="hop-usage-description">
            <small>{getUsageDescription()}</small>
          </div>
        )}

        {/* Display selected ingredient info */}
        {hopForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <strong>{hopForm.selectedIngredient.name}</strong>
            {hopForm.selectedIngredient.origin && (
              <span className="hop-origin-badge">
                {hopForm.selectedIngredient.origin}
              </span>
            )}
            {hopForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {hopForm.selectedIngredient.description}
              </p>
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
          💡 Boil hops add bitterness, aroma hops (whirlpool/dry hop) add flavor
          and aroma. Try advanced search: "cascade | centennial" or "citrus"
        </small>
      </div>
    </div>
  );
}

export default HopInput;
