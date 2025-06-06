import React, { useState } from "react";
import SearchableSelect from "../../SearchableSelect";
import "../../../styles/SearchableSelect.css";

function OtherInput({ others, onAdd, disabled = false }) {
  const [otherForm, setOtherForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "oz",
    use: "boil",
    time: "",
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState({});
  const [resetTrigger, setResetTrigger] = useState(0);
  // Custom Fuse.js options for other ingredients - flexible matching
  const otherFuseOptions = {
    threshold: 0.5, // More lenient since "other" ingredients vary widely
    keys: [
      { name: "name", weight: 1.0 },
      { name: "description", weight: 0.6 },
      { name: "type", weight: 0.4 },
    ],
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    useExtendedSearch: true, // Allow flexible searches
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOtherForm((prev) => ({
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

  const handleOtherSelect = (selectedOther) => {
    if (selectedOther) {
      setOtherForm((prev) => ({
        ...prev,
        ingredient_id: selectedOther.ingredient_id,
        selectedIngredient: selectedOther,
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
      setOtherForm((prev) => ({
        ...prev,
        ingredient_id: "",
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!otherForm.ingredient_id) {
      newErrors.ingredient_id = "Please select an ingredient";
    }

    if (!otherForm.amount || parseFloat(otherForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation (more lenient for "other" ingredients)
    const amount = parseFloat(otherForm.amount);

    if (otherForm.unit === "oz" && amount > 16) {
      newErrors.amount = "More than 1 pound seems high - double check amount";
    }

    if (otherForm.unit === "lb" && amount > 5) {
      newErrors.amount = "More than 5 pounds of adjunct seems unusual";
    }

    if (otherForm.unit === "g" && amount > 500) {
      newErrors.amount = "More than 500g seems high for most additives";
    }

    if (
      (otherForm.unit === "tsp" || otherForm.unit === "tbsp") &&
      amount > 10
    ) {
      newErrors.amount = "Large amounts of spices/nutrients - double check";
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
        ingredient_id: otherForm.ingredient_id,
        amount: otherForm.amount,
        unit: otherForm.unit,
        use: otherForm.use,
        time: otherForm.time || undefined,
      };

      await onAdd(formData);

      // Reset form on successful add
      setOtherForm({
        ingredient_id: "",
        amount: "",
        unit: "oz",
        use: "boil",
        time: "",
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to add other ingredient:", error);
      setErrors({ submit: "Failed to add ingredient. Please try again." });
    }
  };

  const getUsageOptions = () => {
    return [
      { value: "boil", label: "Boil", description: "Added during the boil" },
      {
        value: "whirlpool",
        label: "Whirlpool",
        description: "Added at end of boil",
      },
      {
        value: "fermentation",
        label: "Fermentation",
        description: "Added during fermentation",
      },
      {
        value: "secondary",
        label: "Secondary",
        description: "Added to secondary fermenter",
      },
      {
        value: "packaging",
        label: "Packaging",
        description: "Added when bottling/kegging",
      },
      { value: "mash", label: "Mash", description: "Added to mash tun" },
    ];
  };

  const getIngredientCategory = (ingredient) => {
    if (!ingredient) return null;

    const name = ingredient.name.toLowerCase();
    const desc = (ingredient.description || "").toLowerCase();

    if (name.includes("nutrient") || desc.includes("nutrient")) {
      return "Yeast Nutrient";
    }
    if (
      name.includes("irish moss") ||
      name.includes("whirlfloc") ||
      desc.includes("clarif")
    ) {
      return "Clarifying Agent";
    }
    if (
      name.includes("gypsum") ||
      name.includes("calcium") ||
      desc.includes("water")
    ) {
      return "Water Chemistry";
    }
    if (
      name.includes("sugar") ||
      name.includes("honey") ||
      name.includes("syrup")
    ) {
      return "Fermentable Sugar";
    }
    if (
      desc.includes("spice") ||
      desc.includes("fruit") ||
      desc.includes("flavor")
    ) {
      return "Flavoring";
    }

    return "Other";
  };

  const getAmountGuidance = () => {
    const category = getIngredientCategory(otherForm.selectedIngredient);

    switch (category) {
      case "Yeast Nutrient":
        return "Typical: 1/2 tsp per 5 gallons";
      case "Clarifying Agent":
        return "Irish Moss: 1 tsp/5 gal, Whirlfloc: 1 tablet/5 gal";
      case "Water Chemistry":
        return "Small amounts - follow water calculator recommendations";
      case "Fermentable Sugar":
        return "1 lb sugar ≈ 46 gravity points in 5 gallons";
      default:
        return "Amount varies by ingredient type";
    }
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Other Ingredients</h3>

      <form onSubmit={handleSubmit} className="other-form">
        <div className="other-inputs">
          {/* Amount Input */}
          <div className="other-amount-container">
            <input
              type="number"
              name="amount"
              value={otherForm.amount}
              onChange={handleChange}
              placeholder="Amount"
              className={`other-amount-input ${errors.amount ? "error" : ""}`}
              step="0.1"
              min="0"
              disabled={disabled}
              required
            />
            <select
              name="unit"
              value={otherForm.unit}
              onChange={handleChange}
              className="other-unit-select"
              disabled={disabled}
            >
              <option value="oz">oz</option>
              <option value="g">g</option>
              <option value="lb">lb</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
              <option value="cup">cup</option>
              <option value="each">each</option>
            </select>
            {errors.amount && (
              <div className="error-message">{errors.amount}</div>
            )}
          </div>

          {/* Other Ingredient Selector */}
          <div className="other-selector">
            <SearchableSelect
              options={others}
              onSelect={handleOtherSelect}
              placeholder="Search additives (nutrients, clarifiers, sugars)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              className={`other-select-control ${
                errors.ingredient_id ? "error" : ""
              }`}
              fuseOptions={otherFuseOptions}
              maxResults={15}
              minQueryLength={1}
              resetTrigger={resetTrigger}
            />
            {errors.ingredient_id && (
              <div className="error-message">{errors.ingredient_id}</div>
            )}
          </div>

          {/* Usage Selection */}
          <div className="other-use-container">
            <select
              name="use"
              value={otherForm.use}
              onChange={handleChange}
              className="other-use-select"
              disabled={disabled}
            >
              {getUsageOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Time Input */}
          <div className="other-time-container">
            <input
              type="number"
              name="time"
              value={otherForm.time}
              onChange={handleChange}
              placeholder="Time (min)"
              className="other-time-input"
              min="0"
              disabled={disabled}
            />
          </div>

          {/* Add Button */}
          <div className="other-button-container">
            <button
              type="submit"
              className="other-add-button btn-primary"
              disabled={
                disabled || !otherForm.ingredient_id || !otherForm.amount
              }
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Amount Guidance */}
        {otherForm.selectedIngredient && (
          <div className="other-guidance">
            <small className="guidance-text">{getAmountGuidance()}</small>
          </div>
        )}

        {/* Display selected ingredient info */}
        {otherForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="other-header">
              <strong>{otherForm.selectedIngredient.name}</strong>
              {getIngredientCategory(otherForm.selectedIngredient) && (
                <span className="other-category-badge">
                  {getIngredientCategory(otherForm.selectedIngredient)}
                </span>
              )}
            </div>

            {otherForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {otherForm.selectedIngredient.description}
              </p>
            )}

            {/* Usage description */}
            <div className="usage-description">
              <small>
                <strong>Usage:</strong>{" "}
                {
                  getUsageOptions().find((opt) => opt.value === otherForm.use)
                    ?.description
                }
              </small>
            </div>
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
          💡 For yeast nutrients, clarifying agents, water chemistry additions,
          sugars, spices, and other brewing additives. Use small amounts - a
          little goes a long way!
        </small>
      </div>
    </div>
  );
}

export default OtherInput;
