import React, { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import ApiService from "../services/api";
import { ingredientServiceInstance } from "../services";
import "../styles/IngredientManager.css";

const IngredientManager = () => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "grain",
    description: "",
    // Grain-specific fields
    grain_type: "",
    potential: "",
    color: "",
    // Hop-specific fields
    alpha_acid: "",
    // Yeast-specific fields
    attenuation: "",
    manufacturer: "",
    code: "",
    alcohol_tolerance: "",
    min_temperature: "",
    max_temperature: "",
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingIngredients, setExistingIngredients] = useState([]);
  const [groupedIngredients, setGroupedIngredients] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredResults, setFilteredResults] = useState({});

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    const allIngredients = Object.values(groupedIngredients).flat();

    if (allIngredients.length === 0) return null;

    return new Fuse(allIngredients, {
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.6 },
        { name: "manufacturer", weight: 0.4 },
        { name: "type", weight: 0.3 },
        { name: "grain_type", weight: 0.3 },
      ],
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 50,
      minMatchCharLength: 1,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      useExtendedSearch: false,
    });
  }, [groupedIngredients]);

  // Load and group existing ingredients
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const response = await ApiService.ingredients.getAll();
        const ingredients = Array.isArray(response.data)
          ? response.data
          : response.data.ingredients || [];

        setExistingIngredients(ingredients);

        // Use the IngredientService to group ingredients by type
        const grouped =
          ingredientServiceInstance.groupIngredientsByType(ingredients);
        setGroupedIngredients(grouped);

        // Initialize filtered results with all grouped ingredients
        setFilteredResults(grouped);
      } catch (err) {
        console.error("Error loading ingredients:", err);
        setError("Failed to load existing ingredients");
      }
    };
    loadIngredients();
  }, []);

  // Handle search with fuzzy matching
  useEffect(() => {
    if (!searchQuery.trim()) {
      // No search query - show all grouped ingredients
      setFilteredResults(groupedIngredients);
      return;
    }

    if (!fuse) {
      // Fuse not ready yet
      setFilteredResults({});
      return;
    }

    // Perform fuzzy search
    const searchResults = fuse.search(searchQuery);

    // Group the search results by type
    const groupedResults = {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
    };

    searchResults.forEach((result) => {
      const ingredient = result.item;
      const type = ingredient.type === "adjunct" ? "other" : ingredient.type;

      if (groupedResults[type]) {
        groupedResults[type].push({
          ...ingredient,
          searchScore: result.score,
          searchMatches: result.matches || [],
        });
      }
    });

    setFilteredResults(groupedResults);
  }, [searchQuery, fuse, groupedIngredients]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear messages when user starts typing
    if (error) setError("");
    if (success) setSuccess("");
  };

  // Handle ingredient type change
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setFormData((prev) => ({
      ...prev,
      type: newType,
      // Clear type-specific fields when switching types
      grain_type: "",
      potential: "",
      color: "",
      alpha_acid: "",
      attenuation: "",
      manufacturer: "",
      code: "",
      alcohol_tolerance: "",
      min_temperature: "",
      max_temperature: "",
    }));
  };

  // Validate form
  const validateForm = () => {
    const errors = [];

    if (!formData.name.trim()) {
      errors.push("Ingredient name is required");
    }

    // Type-specific validation
    if (formData.type === "grain") {
      if (
        formData.potential &&
        (parseFloat(formData.potential) < 20 ||
          parseFloat(formData.potential) > 50)
      ) {
        errors.push(
          "Grain potential should be between 20 (1.020) and 50 (1.050)"
        );
      }
      if (
        formData.color &&
        (parseFloat(formData.color) < 0 || parseFloat(formData.color) > 600)
      ) {
        errors.push("Grain color should be between 0 and 600°L");
      }
    }

    if (formData.type === "hop") {
      if (
        formData.alpha_acid &&
        (parseFloat(formData.alpha_acid) <= 0 ||
          parseFloat(formData.alpha_acid) > 25)
      ) {
        errors.push("Alpha acid should be between 0.1% and 25%");
      }
    }

    if (formData.type === "yeast") {
      if (
        formData.attenuation &&
        (parseFloat(formData.attenuation) <= 0 ||
          parseFloat(formData.attenuation) > 100)
      ) {
        errors.push("Attenuation should be between 1% and 100%");
      }
      if (
        formData.alcohol_tolerance &&
        (parseFloat(formData.alcohol_tolerance) <= 0 ||
          parseFloat(formData.alcohol_tolerance) > 20)
      ) {
        errors.push("Alcohol tolerance should be between 0% and 20%");
      }
      if (formData.min_temperature && formData.max_temperature) {
        if (
          parseFloat(formData.min_temperature) >=
          parseFloat(formData.max_temperature)
        ) {
          errors.push(
            "Minimum temperature must be less than maximum temperature"
          );
        }
      }
    }

    return errors;
  };

  // Handle form submission
  const handleSubmit = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Prepare data for submission (remove empty fields)
      const submissionData = Object.entries(formData).reduce(
        (acc, [key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            // Convert numeric fields
            if (
              [
                "potential",
                "color",
                "alpha_acid",
                "attenuation",
                "alcohol_tolerance",
                "min_temperature",
                "max_temperature",
              ].includes(key)
            ) {
              acc[key] = parseFloat(value);
            } else {
              acc[key] = value;
            }
          }
          return acc;
        },
        {}
      );

      await ApiService.ingredients.create(submissionData);

      setSuccess(`${formData.name} has been added successfully!`);

      // Refresh the ingredients list
      const updatedResponse = await ApiService.ingredients.getAll();
      const ingredients = Array.isArray(updatedResponse.data)
        ? updatedResponse.data
        : updatedResponse.data.ingredients || [];

      setExistingIngredients(ingredients);

      // Re-group ingredients using the service
      const grouped =
        ingredientServiceInstance.groupIngredientsByType(ingredients);
      setGroupedIngredients(grouped);
      setFilteredResults(grouped);

      // Reset form
      setFormData({
        name: "",
        type: "grain",
        description: "",
        grain_type: "",
        potential: "",
        color: "",
        alpha_acid: "",
        attenuation: "",
        manufacturer: "",
        code: "",
        alcohol_tolerance: "",
        min_temperature: "",
        max_temperature: "",
      });
    } catch (err) {
      console.error("Error creating ingredient:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to create ingredient. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      name: "",
      type: "grain",
      description: "",
      grain_type: "",
      potential: "",
      color: "",
      alpha_acid: "",
      attenuation: "",
      manufacturer: "",
      code: "",
      alcohol_tolerance: "",
      min_temperature: "",
      max_temperature: "",
    });
    setError("");
    setSuccess("");
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // Highlight search matches in text
  const highlightMatches = (text, matches = [], searchTerm = "") => {
    if (!matches.length || !searchTerm) return text;

    // Simple approach: highlight the search query if it appears
    const searchTerms = searchTerm
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    let highlightedText = text;

    searchTerms.forEach((term) => {
      const regex = new RegExp(
        `(\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="search-highlight">$1</mark>'
      );
    });

    return highlightedText;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "grain":
        return "#8B4513";
      case "hop":
        return "#228B22";
      case "yeast":
        return "#DAA520";
      case "other":
      case "adjunct":
        return "#6B6B6B";
      default:
        return "#000";
    }
  };

  const getTypeDisplayName = (type) => {
    switch (type) {
      case "grain":
        return "Grains & Fermentables";
      case "hop":
        return "Hops";
      case "yeast":
        return "Yeast";
      case "other":
        return "Other/Adjuncts";
      default:
        return type;
    }
  };

  // Calculate total counts for display
  const totalCount = existingIngredients.length;
  const filteredCount = Object.values(filteredResults).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const showingFiltered = searchQuery.trim() !== "";

  return (
    <div className="ingredient-manager-container">
      {/* Header */}
      <div className="ingredient-manager-header">
        <h1 className="page-title">Ingredient Manager</h1>
      </div>

      <div className="ingredient-manager-layout">
        {/* Add New Ingredient Form */}
        <div className="card ingredient-form-card">
          <h2 className="card-title">Add New Ingredient</h2>

          {/* Messages */}
          {error && <div className="alert alert-error">{error}</div>}

          {success && <div className="alert alert-success">{success}</div>}

          <div className="ingredient-form">
            {/* Basic Information */}
            <div className="form-group">
              <label className="form-label">Ingredient Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ingredient Type *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleTypeChange}
                className="form-select"
              >
                <option value="grain">Grain/Fermentable</option>
                <option value="hop">Hop</option>
                <option value="yeast">Yeast</option>
                <option value="other">Other/Adjunct</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Optional description of the ingredient..."
                rows={3}
                className="form-textarea"
              />
            </div>

            {/* Type-specific fields */}
            {formData.type === "grain" && (
              <div className="type-specific-fields grain-fields">
                <h3 className="section-title">Grain Properties</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Grain Type</label>
                    <select
                      name="grain_type"
                      value={formData.grain_type}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="">Select type...</option>
                      <option value="base_malt">Base Malt</option>
                      <option value="specialty_malt">Specialty Malt</option>
                      <option value="caramel_crystal">Caramel/Crystal</option>
                      <option value="roasted">Roasted</option>
                      <option value="smoked">Smoked</option>
                      <option value="adjunct_grain">Adjunct</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Color (°Lovibond)</label>
                    <input
                      type="number"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      step="0.5"
                      min="0"
                      max="600"
                      placeholder="e.g., 2.5"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Potential (SG)</label>
                    <input
                      type="number"
                      name="potential"
                      value={formData.potential}
                      onChange={handleChange}
                      step="1"
                      min="1"
                      max="100"
                      placeholder="e.g., 37"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.type === "hop" && (
              <div className="type-specific-fields hop-fields">
                <h3 className="section-title">Hop Properties</h3>

                <div className="form-group">
                  <label className="form-label">Alpha Acid (%)</label>
                  <input
                    type="number"
                    name="alpha_acid"
                    value={formData.alpha_acid}
                    onChange={handleChange}
                    step="0.1"
                    min="0.1"
                    max="25"
                    placeholder="e.g., 5.5"
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {formData.type === "yeast" && (
              <div className="type-specific-fields yeast-fields">
                <h3 className="section-title">Yeast Properties</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Manufacturer</label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      placeholder="e.g., Wyeast, White Labs"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Code/Number</label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., 1056, WLP001"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Attenuation (%)</label>
                    <input
                      type="number"
                      name="attenuation"
                      value={formData.attenuation}
                      onChange={handleChange}
                      step="1"
                      min="1"
                      max="100"
                      placeholder="e.g., 75"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Alcohol Tolerance (%)</label>
                    <input
                      type="number"
                      name="alcohol_tolerance"
                      value={formData.alcohol_tolerance}
                      onChange={handleChange}
                      step="0.5"
                      min="0"
                      max="20"
                      placeholder="e.g., 12"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Min Temperature (°F)</label>
                    <input
                      type="number"
                      name="min_temperature"
                      value={formData.min_temperature}
                      onChange={handleChange}
                      step="1"
                      min="50"
                      max="100"
                      placeholder="e.g., 60"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Max Temperature (°F)</label>
                    <input
                      type="number"
                      name="max_temperature"
                      value={formData.max_temperature}
                      onChange={handleChange}
                      step="1"
                      min="50"
                      max="100"
                      placeholder="e.g., 72"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button onClick={handleReset} className="btn btn-secondary">
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? (
                  <>
                    <span className="button-spinner"></span>
                    Adding...
                  </>
                ) : (
                  "Add Ingredient"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Ingredients List with Fuzzy Search */}
        <div className="card ingredients-list-card">
          <div className="card-header">
            <h2 className="card-title">Existing Ingredients</h2>
            <div className="ingredient-count">
              {showingFiltered ? (
                <>
                  Showing {filteredCount} of {totalCount} ingredients
                  {searchQuery && (
                    <span className="search-term">
                      {" "}
                      matching "{searchQuery}"
                    </span>
                  )}
                </>
              ) : (
                <>{totalCount} ingredients total</>
              )}
            </div>
          </div>

          {/* Enhanced Search Input */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="Search ingredients by name, description, manufacturer, type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input search-input"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="search-clear-button"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="search-help">
                Fuzzy search enabled - try partial matches or typos
              </div>
            )}
          </div>

          {/* Grouped Ingredients Display */}
          <div className="ingredients-list">
            {Object.keys(filteredResults).length === 0 ||
            Object.values(filteredResults).every((arr) => arr.length === 0) ? (
              <div className="empty-state">
                {totalCount === 0
                  ? "No ingredients in database yet."
                  : searchQuery
                  ? `No ingredients match your search for "${searchQuery}".`
                  : "No ingredients to display."}
              </div>
            ) : (
              <div className="ingredient-items">
                {Object.entries(filteredResults)
                  .filter(([_, ingredients]) => ingredients.length > 0)
                  .map(([type, ingredients]) => (
                    <div key={type} className="ingredient-type-section">
                      {/* Type Header */}
                      <div
                        className="ingredient-type-header"
                        style={{ borderBottomColor: getTypeColor(type) }}
                      >
                        <h3
                          className="ingredient-type-title"
                          style={{ color: getTypeColor(type) }}
                        >
                          {getTypeDisplayName(type)}
                          <span className="ingredient-type-count">
                            ({ingredients.length})
                          </span>
                        </h3>
                      </div>

                      {/* Ingredients in this type */}
                      <div className="ingredient-type-items">
                        {ingredients.map((ingredient) => (
                          <div
                            key={ingredient.ingredient_id}
                            className={`ingredient-item ${
                              searchQuery && ingredient.searchScore
                                ? "highlighted"
                                : ""
                            }`}
                            style={{
                              borderLeftColor: getTypeColor(ingredient.type),
                              backgroundColor:
                                searchQuery && ingredient.searchScore
                                  ? `rgba(${getTypeColor(ingredient.type)
                                      .replace("#", "")
                                      .match(/.{2}/g)
                                      .map((hex) => parseInt(hex, 16))
                                      .join(", ")}, 0.05)`
                                  : undefined,
                            }}
                          >
                            <div className="ingredient-content">
                              <div className="ingredient-header">
                                <h4
                                  className="ingredient-name"
                                  dangerouslySetInnerHTML={{
                                    __html: highlightMatches(
                                      ingredient.name,
                                      ingredient.searchMatches,
                                      searchQuery
                                    ),
                                  }}
                                />
                                <div className="ingredient-badges">
                                  <span
                                    className={`type-badge ${ingredient.type}`}
                                  >
                                    {ingredient.type}
                                  </span>
                                  {ingredient.grain_type && (
                                    <span className="grain-type-badge">
                                      {ingredient.grain_type.replace("_", " ")}
                                    </span>
                                  )}
                                  {searchQuery && ingredient.searchScore && (
                                    <span className="search-score-badge">
                                      Match:{" "}
                                      {Math.round(
                                        (1 - ingredient.searchScore) * 100
                                      )}
                                      %
                                    </span>
                                  )}
                                </div>
                              </div>
                              {ingredient.description && (
                                <p
                                  className="ingredient-description"
                                  dangerouslySetInnerHTML={{
                                    __html: highlightMatches(
                                      ingredient.description,
                                      ingredient.searchMatches,
                                      searchQuery
                                    ),
                                  }}
                                />
                              )}
                              <div className="ingredient-details">
                                {ingredient.alpha_acid && (
                                  <span>AA: {ingredient.alpha_acid}%</span>
                                )}
                                {ingredient.color && (
                                  <span>Color: {ingredient.color}°L</span>
                                )}
                                {ingredient.potential && (
                                  <span>
                                    Potential:
                                    {String(" " + ingredient.potential)} ppg
                                    (points per pound per gallon)
                                  </span>
                                )}
                                {ingredient.attenuation && (
                                  <span>
                                    Attenuation: {ingredient.attenuation}%
                                  </span>
                                )}
                                {ingredient.manufacturer && (
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: `Mfg: ${highlightMatches(
                                        ingredient.manufacturer,
                                        ingredient.searchMatches,
                                        searchQuery
                                      )}`,
                                    }}
                                  />
                                )}
                                {ingredient.code && (
                                  <span>Code: {ingredient.code}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngredientManager;
