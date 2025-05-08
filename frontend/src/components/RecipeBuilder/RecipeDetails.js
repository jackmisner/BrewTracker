import React from "react";

function RecipeDetails({ recipe, onChange, onSubmit, onCancel, isEditing }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({
      ...recipe,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  return (
    <form id="recipe-form" onSubmit={onSubmit} className="card">
      <h2 className="card-title">Recipe Details</h2>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Recipe Name*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={recipe.name}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="style" className="form-label">
            Style
          </label>
          <input
            type="text"
            id="style"
            name="style"
            value={recipe.style}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label htmlFor="batch_size" className="form-label">
            Batch Size (gallons)*
          </label>
          <input
            type="number"
            id="batch_size"
            name="batch_size"
            value={recipe.batch_size}
            onChange={handleChange}
            step="0.1"
            min="0.1"
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="boil_time" className="form-label">
            Boil Time (minutes)
          </label>
          <input
            type="number"
            id="boil_time"
            name="boil_time"
            value={recipe.boil_time}
            onChange={handleChange}
            step="5"
            min="0"
            className="form-control"
          />
        </div>
      </div>

      <div className="form-group mb-6">
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={recipe.description}
          onChange={handleChange}
          rows="3"
          className="form-control form-textarea"
        ></textarea>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="efficiency" className="form-label">
            Efficiency (%)
          </label>
          <input
            type="number"
            id="efficiency"
            name="efficiency"
            value={recipe.efficiency}
            onChange={handleChange}
            step="1"
            min="0"
            max="100"
            className="form-control"
          />
        </div>

        <div className="form-check">
          <input
            type="checkbox"
            id="is_public"
            name="is_public"
            checked={recipe.is_public}
            onChange={handleChange}
            className="form-check-input"
          />
          <label htmlFor="is_public" className="form-label mb-0">
            Make Recipe Public
          </label>
        </div>
      </div>

      <div className="form-group mb-6">
        <label htmlFor="notes" className="form-label">
          Brewer's Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={recipe.notes}
          onChange={handleChange}
          rows="3"
          className="form-control form-textarea"
        ></textarea>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn btn-default">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditing ? "Update Recipe" : "Create Recipe"}
        </button>
      </div>
    </form>
  );
}

export default RecipeDetails;
