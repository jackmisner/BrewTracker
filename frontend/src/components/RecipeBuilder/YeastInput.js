import React, { useState } from "react";

function YeastInput({ yeasts, onAdd, onCalculate }) {
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
      return; // Basic validation
    }

    onAdd(yeastForm);

    // Reset form
    setYeastForm({
      ingredient_id: "",
      amount: "",
      unit: "pkg",
    });
  };
  return (
    <div className="card">
      <h3 className="card-title">Yeast</h3>

      <div className="ingredient-form">
        <div className="ingredient-inputs">
          <div>
            <select
              id="yeast-select"
              name="ingredient_id"
              value={yeastForm.ingredient_id}
              onChange={handleChange}
              className="input-control"
            >
              <option value="">Select Yeast</option>
              {yeasts.map((yeast) => (
                <option key={yeast.ingredient_id} value={yeast.ingredient_id}>
                  {yeast.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="input-group">
              <input
                type="number"
                name="amount"
                value={yeastForm.amount}
                onChange={handleChange}
                className="input-control"
                placeholder="Amount"
              />
              <select
                name="unit"
                value={yeastForm.unit}
                onChange={handleChange}
                className="input-control"
              >
                <option value="pkg">pkg</option>
              </select>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
            >
              Add Yeast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default YeastInput;
