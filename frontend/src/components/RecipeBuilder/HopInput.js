import { useState } from "react";

function HopInput({ hops, onAdd, onCalculate }) {
  const [hopForm, setHopForm] = useState({
    ingredient_id: "",
    amount: "",
    alpha_acid: "",
    unit: "oz",
    use: "boil",
    time: "",
    time_unit: "minutes",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Create updated form data
    const updatedForm = {
      ...hopForm,
      [name]: value,
    };

    // If the ingredient_id changed, look up the alpha_acid value
    if (name === "ingredient_id" && value) {
      const selectedHop = hops.find((hop) => hop.ingredient_id === value);
      if (selectedHop && selectedHop.alpha_acid) {
        updatedForm.alpha_acid = selectedHop.alpha_acid;
      }
    }

    setHopForm(updatedForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hopForm.ingredient_id || !hopForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }
    onAdd(hopForm);

    setHopForm({
      ingredient_id: "",
      amount: "",
      alpha_acid: "",
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
        <div className="ingredient-inputs hop-inputs">
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
          <div className="alpha-acid-container">
            <input
              type="number"
              id="alpha-acid"
              name="alpha_acid"
              value={hopForm.alpha_acid}
              onChange={handleChange}
              step="0.1"
              placeholder="Alpha Acid"
              className="input-control"
            />
            <span className="alpha-acid-unit">%AA</span>
          </div>
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

          <div className="hop-time-container">
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

          <div>
            <button
              id="add-hop-btn"
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
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
