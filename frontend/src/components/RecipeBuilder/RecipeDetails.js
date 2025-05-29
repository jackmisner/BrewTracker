import React from "react";

function RecipeDetails({
  recipe,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  saving,
  canSave,
  hasUnsavedChanges,
}) {
  if (!recipe) {
    return <div>Loading recipe details...</div>;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Handle different input types
    const newValue =
      type === "checkbox"
        ? checked
        : type === "number"
        ? parseFloat(value) || ""
        : value;

    // Call onChange with field name and new value
    onChange(name, newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="recipe-details card">
      <h2 className="card-title">
        {isEditing ? "Recipe Details" : "New Recipe Details"}
        {hasUnsavedChanges && (
          <span className="unsaved-indicator" title="Unsaved changes">
            *
          </span>
        )}
      </h2>

      <form onSubmit={handleSubmit}>
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
            placeholder="Enter recipe name"
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="style">Beer Style</label>
          <input
            type="text"
            id="style"
            name="style"
            value={recipe.style || ""}
            onChange={handleChange}
            className="form-control"
            placeholder="e.g. American IPA, Stout, Wheat Beer"
            disabled={saving}
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
              max="100"
              step="0.5"
              required
              disabled={saving}
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
              min="15"
              max="180"
              step="15"
              placeholder="60"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="efficiency">Mash Efficiency (%)</label>
            <input
              type="number"
              id="efficiency"
              name="efficiency"
              value={recipe.efficiency || ""}
              onChange={handleChange}
              className="form-control"
              min="50"
              max="95"
              step="1"
              placeholder="75"
              disabled={saving}
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
            className="form-control form-textarea"
            rows="3"
            placeholder="Describe your recipe, inspiration, or other relevant details"
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Brewing Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={recipe.notes || ""}
            onChange={handleChange}
            className="form-control form-textarea"
            rows="3"
            placeholder="Special instructions, tips, or modifications"
            disabled={saving}
          />
        </div>

        <div className="form-check">
          <input
            type="checkbox"
            id="is_public"
            name="is_public"
            checked={recipe.is_public || false}
            onChange={handleChange}
            className="form-check-input"
            disabled={saving}
          />
          <label className="form-check-label" htmlFor="is_public">
            Make Recipe Public
            {recipe.is_public && (
              <div>
                <small className="form-help-text">
                  Other users will be able to view and clone this recipe
                </small>
              </div>
            )}
          </label>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={`btn btn-primary ${!canSave ? "btn-disabled" : ""}`}
            disabled={!canSave || saving}
            title={!canSave ? "Add at least one ingredient to save" : ""}
          >
            {saving ? (
              <>
                <span className="button-spinner"></span>
                Saving...
              </>
            ) : (
              `${isEditing ? "Update" : "Save"} Recipe`
            )}
          </button>
        </div>

        {/* Recipe validation info */}
        {!canSave && (
          <div className="validation-info">
            <small className="validation-message">
              💡 Add at least one grain and yeast to save your recipe
            </small>
          </div>
        )}
      </form>
    </div>
  );
}

export default RecipeDetails;
