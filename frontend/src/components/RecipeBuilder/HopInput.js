import React, { useState } from "react";

function HopInput({ hops, onAdd }) {
  const [hopForm, setHopForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "oz",
    use: "boil",
    time: "",
    time_unit: "minutes",
  });
  const handleChange = (e) => {
    const { name, value } = e.target;
    setHopForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hopForm.ingredient_id || !hopForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }
    onAdd(hopForm);
    setHopForm({
      ingredient_id: "",
      amount: "",
      unit: "oz",
      use: "boil",
      time: "",
      time_unit: "minutes",
    });
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Hops</h3>

      <div className="ingredient-form">
        <div className="hop-inputs">
          <div>
            <select
              id="hop-select"
              name="ingredient_id"
              value={hopForm.ingredient_id}
              onChange={handleChange}
              className="input-control"
            >
              <option value="">Select Hop</option>
              {hops.map((ingredient) => (
                <option
                  key={ingredient.ingredient_id}
                  value={ingredient.ingredient_id}
                >
                  {ingredient.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="input-group">
              <input
                type="number"
                id="hop-amount"
                name="amount"
                value={hopForm.amount}
                onChange={handleChange}
                step="0.1"
                min="0"
                placeholder="Amount"
                className="input-control"
              />
              <select
                id="hop-unit"
                name="unit"
                value={hopForm.unit}
                onChange={handleChange}
                className="input-addon"
              >
                <option value="oz">oz</option>
                <option value="g">g</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex">
              <input
                type="number"
                id="hop-time"
                name="time"
                value={hopForm.time}
                onChange={handleChange}
                step="0.1"
                min="0"
                placeholder="Time"
                className="input-control"
              />
              <select
                id="hop-time-unit"
                name="time_unit"
                value={hopForm.time_unit}
                onChange={handleChange}
                className="input-control"
              >
                <option value="minutes">minutes</option>
                <option value="days">days</option>
              </select>
              <select
                id="hop-use"
                name="use"
                value={hopForm.use}
                onChange={handleChange}
                className="input-control"
              >
                <option value="boil">Boil</option>
                <option value="whirlpool">Whirlpool</option>
                <option value="dry-hop">Dry Hop</option>
              </select>
            </div>
          </div>
          <div>
            <button
              id="add-hop-btn"
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
export default HopInput;
