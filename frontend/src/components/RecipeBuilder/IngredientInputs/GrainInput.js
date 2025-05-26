import React, { useState } from "react";

function GrainInput({ grains, onAdd, disabled = false }) {
  const [grainForm, setGrainForm] = useState({
    ingredient_id: "",
    color: "",
    amount: "",
    unit: "lb",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Create updated form data
    const updatedForm = {
      ...grainForm,
      [name]: value,
    };

    // If the ingredient_id changed, look up the lovibond value
    if (name === "ingredient_id" && value) {
      const selectedGrain = grains.find(
        (grain) => grain.ingredient_id === value
      );
      if (selectedGrain && selectedGrain.color) {
        updatedForm.color = selectedGrain.color;
      }
    }

    setGrainForm(updatedForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!grainForm.ingredient_id || !grainForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      // Call onAdd - metrics calculation is handled automatically by the service layer
      await onAdd(grainForm);

      // Reset form on successful add
      setGrainForm({
        ingredient_id: "",
        color: "",
        amount: "",
        unit: "lb",
      });
    } catch (error) {
      // Error handling is managed by the service layer and displayed by the parent component
      console.error("Failed to add grain:", error);
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">Fermentables</h3>

      <div className="grain-form">
        <div className="grain-inputs">
          <div className="grain-amount-container">
            <input
              type="number"
              id="grain-amount"
              name="amount"
              value={grainForm.amount}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="100"
              placeholder="Amount"
              className="grain-amount-input"
              disabled={disabled}
              required
            />
            <select
              id="grain-unit"
              name="unit"
              value={grainForm.unit}
              onChange={handleChange}
              className="grain-unit-select"
              disabled={disabled}
            >
              <option value="lb">lb</option>
              <option value="oz">oz</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
            </select>
          </div>

          <div className="grain-selector">
            <select
              id="grain-select"
              name="ingredient_id"
              value={grainForm.ingredient_id}
              onChange={handleChange}
              className="grain-select-control"
              disabled={disabled}
              required
            >
              <option value="">Select Grains</option>
              {grains.map((grain) => (
                <option key={grain.ingredient_id} value={grain.ingredient_id}>
                  {grain.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grain-lovibond-container">
            <input
              type="number"
              id="color"
              name="color"
              value={grainForm.color}
              onChange={handleChange}
              step="0.5"
              min="0"
              max="550"
              placeholder="Colour"
              className="grain-color-input"
              disabled={disabled}
            />
            <span className="grain-color-unit">°L</span>
          </div>

          <div className="grain-button-container">
            <button
              id="add-grain-btn"
              type="button"
              onClick={handleSubmit}
              className="grain-add-button btn-primary"
              disabled={
                disabled || !grainForm.ingredient_id || !grainForm.amount
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
          💡 Base malts (Pale, Pilsner) should make up 60-80% of your grain bill
        </small>
      </div>
    </div>
  );
}

export default GrainInput;
