import { useState } from "react";

function HopInput({ hops, onAdd, disabled = false }) {
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

    // If use changed to dry hop, set time unit to days
    if (name === "use" && value === "dry-hop") {
      updatedForm.time_unit = "days";
      updatedForm.time = updatedForm.time || "7"; // Default to 7 days
    } else if (name === "use" && value === "boil") {
      updatedForm.time_unit = "minutes";
      if (updatedForm.time === "7") updatedForm.time = ""; // Clear days default
    }

    setHopForm(updatedForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hopForm.ingredient_id || !hopForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }

    // Validate hop-specific requirements
    if (
      hopForm.use === "boil" &&
      (!hopForm.time || parseInt(hopForm.time) < 0)
    ) {
      alert("Boil time is required for boil additions.");
      return;
    }

    try {
      await onAdd(hopForm);

      // Reset form on successful add
      setHopForm({
        ingredient_id: "",
        amount: "",
        alpha_acid: "",
        unit: "oz",
        use: "boil",
        time: "",
        time_unit: "minutes",
      });
    } catch (error) {
      console.error("Failed to add hop:", error);
    }
  };

  // Get placeholder text for time input based on use
  const getTimePlaceholder = () => {
    switch (hopForm.use) {
      case "boil":
        return "60";
      case "whirlpool":
        return "20";
      case "dry-hop":
        return "7";
      default:
        return "0";
    }
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Hops</h3>

      <div className="hop-form">
        <div className="hop-inputs">
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
              className="hop-amount-input"
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
          </div>

          <div className="hop-selector">
            <select
              id="hop-select"
              name="ingredient_id"
              value={hopForm.ingredient_id}
              onChange={handleChange}
              className="hop-select-control"
              disabled={disabled}
              required
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

          <div className="hop-alpha-container">
            <input
              type="number"
              id="alpha-acid"
              name="alpha_acid"
              value={hopForm.alpha_acid}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="25"
              placeholder="Alpha Acid"
              className="hop-alpha-input"
              disabled={disabled}
            />
            <span className="hop-alpha-unit">%AA</span>
          </div>

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
              className="hop-time-input"
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
          </div>

          <div className="hop-button-container">
            <button
              id="add-hop-btn"
              type="button"
              onClick={handleSubmit}
              className="hop-add-button btn-primary"
              disabled={disabled || !hopForm.ingredient_id || !hopForm.amount}
            >
              {disabled ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 Boil hops add bitterness, aroma hops (whirlpool/dry hop) add flavor
          and aroma
        </small>
      </div>
    </div>
  );
}

export default HopInput;
