import React, { useState } from "react";

function YeastInput({ yeasts, onAdd, disabled = false }) {
  const [yeastForm, setYeastForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "pkg",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setYeastForm({
      ...yeastForm,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!yeastForm.ingredient_id || !yeastForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }

    // Validate amount based on unit
    const amount = parseFloat(yeastForm.amount);
    if (yeastForm.unit === "pkg" && amount > 10) {
      const confirm = window.confirm(
        "Using more than 10 packages of yeast is unusual. Are you sure?"
      );
      if (!confirm) return;
    }

    try {
      await onAdd(yeastForm);

      // Reset form on successful add
      setYeastForm({
        ingredient_id: "",
        amount: "",
        unit: "pkg",
      });
    } catch (error) {
      console.error("Failed to add yeast:", error);
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Yeast</h3>

      <div className="yeast-form">
        <div className="yeast-inputs">
          <div className="yeast-amount-container">
            <input
              type="number"
              name="amount"
              value={yeastForm.amount}
              onChange={handleChange}
              className="yeast-amount-input"
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
          </div>

          <div className="yeast-selector">
            <select
              id="yeast-select"
              name="ingredient_id"
              value={yeastForm.ingredient_id}
              onChange={handleChange}
              className="yeast-select-control"
              disabled={disabled}
              required
            >
              <option value="">Select Yeast</option>
              {yeasts.map((yeast) => (
                <option key={yeast.ingredient_id} value={yeast.ingredient_id}>
                  {yeast.name}
                  {yeast.manufacturer && ` (${yeast.manufacturer})`}
                </option>
              ))}
            </select>
          </div>

          <div className="yeast-button-container">
            <button
              type="button"
              className="yeast-add-button btn-primary"
              onClick={handleSubmit}
              disabled={
                disabled || !yeastForm.ingredient_id || !yeastForm.amount
              }
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 Most 5-gallon batches need 1-2 packages of dry yeast or 1
          vial/smack pack of liquid yeast
        </small>
      </div>
    </div>
  );
}

export default YeastInput;
