import React, { useState } from "react";

function GrainInput({ grains, onAdd, onCalculate }) {
  const [grainForm, setGrainForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "lb",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGrainForm({
      ...grainForm,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!grainForm.ingredient_id || !grainForm.amount) {
      alert("Please fill in all required fields.");
      return; // Basic validation
    }

    await onAdd(grainForm);
    await onCalculate();
    // Reset form
    setGrainForm({
      ingredient_id: "",
      amount: "",
      unit: "lb",
    });
  };

  return (
    <div className="card">
      <h3 className="card-title">Fermentables</h3>

      <div className="ingredient-form">
        <div className="ingredient-inputs">
          <div>
            <select
              id="grain-select"
              name="ingredient_id"
              value={grainForm.ingredient_id}
              onChange={handleChange}
              className="input-control"
            >
              <option value="">Select Grains</option>
              {grains.map((grain) => (
                <option key={grain.ingredient_id} value={grain.ingredient_id}>
                  {grain.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="input-group">
              <input
                type="number"
                id="grain-amount"
                name="amount"
                value={grainForm.amount}
                onChange={handleChange}
                step="0.1"
                min="0"
                placeholder="Amount"
                className="input-control"
              />
              <select
                id="grain-unit"
                name="unit"
                value={grainForm.unit}
                onChange={handleChange}
                className="input-addon"
              >
                <option value="lb">lb</option>
                <option value="oz">oz</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
              </select>
            </div>
          </div>

          <div>
            <button
              id="add-grain-btn"
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-full"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GrainInput;
