import React, { useState } from "react";

function AdjunctInput({ adjuncts, onAdd, onCalculate }) {
  const [adjunctForm, setAdjunctForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "oz",
    use: "boil",
    time: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAdjunctForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!adjunctForm.ingredient_id || !adjunctForm.amount) {
      alert("Please fill in all required fields.");
      return;
    }
    onAdd(adjunctForm);

    setAdjunctForm({
      ingredient_id: "",
      amount: "",
      unit: "oz",
      use: "boil",
      time: "",
    });
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Adjuncts</h3>

      <div className="ingredient-form">
        <div className="adjunct-inputs">
          <div>
            <select
              id="adjunct-select"
              name="ingredient_id"
              value={adjunctForm.ingredient_id}
              onChange={handleChange}
              className="input-control"
            >
              <option value="">Select Adjunct</option>
              {adjuncts.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="input-group">
              <input
                type="number"
                name="amount"
                value={adjunctForm.amount}
                onChange={handleChange}
                placeholder="Amount"
                className="input-control"
              />
              <select
                name="unit"
                value={adjunctForm.unit}
                onChange={handleChange}
                className="input-control"
              >
                <option value="oz">oz</option>
                <option value="g">g</option>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
            >
              Add Adjunct
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AdjunctInput;
