import React from "react";

function RecipeDetails({
  recipe,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  saving,
}) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Handle different input types
    const newValue =
      type === "checkbox"
        ? checked
        : type === "number"
          ? parseFloat(value)
          : value;

    onChange({
      ...recipe,
      [name]: newValue,
    });
  };

  return (
    <div className="recipe-details card">
      <h2 className="card-title">
        {isEditing ? "Edit Recipe Details" : "Recipe Details"}
      </h2>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="name">Recipe Name *</label>
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
          <label htmlFor="style">Style</label>
          <input
            type="text"
            id="style"
            name="style"
            value={recipe.style || ""}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="batch_size">Batch Size (gallons) *</label>
            <input
              type="number"
              id="batch_size"
              name="batch_size"
              value={recipe.batch_size}
              onChange={handleChange}
              className="form-control"
              min="0.5"
              step="0.5"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="boil_time">Boil Time (minutes)</label>
            <input
              type="number"
              id="boil_time"
              name="boil_time"
              value={recipe.boil_time || ""}
              onChange={handleChange}
              className="form-control"
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="efficiency">Efficiency (%)</label>
            <input
              type="number"
              id="efficiency"
              name="efficiency"
              value={recipe.efficiency || ""}
              onChange={handleChange}
              className="form-control"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={recipe.description || ""}
            onChange={handleChange}
            className="form-control"
            rows="3"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Brewing Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={recipe.notes || ""}
            onChange={handleChange}
            className="form-control"
            rows="3"
          />
        </div>

        <div className="form-check mb-4">
          <input
            type="checkbox"
            id="is_public"
            name="is_public"
            checked={recipe.is_public || false}
            onChange={handleChange}
            className="form-check-input"
          />
          <label className="form-check-label" htmlFor="is_public">
            Make Recipe Public
          </label>
        </div>

        <div className="form-buttons">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update Recipe" : "Save Recipe"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default RecipeDetails;
