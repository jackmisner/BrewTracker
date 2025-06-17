import React, { useState, useEffect } from "react";
import ApiService from "../services/api";

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
  const [searchQuery, setSearchQuery] = useState("");

  // Load existing ingredients for reference
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const response = await ApiService.ingredients.getAll();
        const ingredients = Array.isArray(response.data)
          ? response.data
          : response.data.ingredients || [];

        setExistingIngredients(ingredients);
      } catch (err) {
        console.error("Error loading ingredients:", err);
        setError("Failed to load existing ingredients");
      }
    };
    loadIngredients();
  }, []);

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

      const newIngredient = {
        ingredient_id: Date.now().toString(),
        ...submissionData,
        created_at: new Date().toISOString(),
      };
      setExistingIngredients((prev) => [...prev, newIngredient]);

      const updatedResponse = await ApiService.ingredients.getAll();
      const ingredients = Array.isArray(updatedResponse.data)
        ? updatedResponse.data
        : updatedResponse.data.ingredients || [];
      setExistingIngredients(ingredients);

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

  // Filter existing ingredients for display
  const filteredIngredients = existingIngredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ing.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeColor = (type) => {
    switch (type) {
      case "grain":
        return "#8B4513";
      case "hop":
        return "#228B22";
      case "yeast":
        return "#DAA520";
      case "other":
        return "#6B6B6B";
      default:
        return "#000";
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "16px",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    padding: "12px 24px",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    border: "none",
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: "2.5rem",
            fontWeight: "bold",
          }}
        >
          Ingredient Manager
        </h1>
        <p style={{ color: "#666", margin: 0 }}>
          Add new ingredients to your database for use in recipes
        </p>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}
      >
        {/* Add New Ingredient Form */}
        <div
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            height: "fit-content",
          }}
        >
          <h2
            style={{
              margin: "0 0 20px 0",
              fontSize: "1.5rem",
              fontWeight: "600",
            }}
          >
            Add New Ingredient
          </h2>

          {/* Messages */}
          {error && (
            <div
              style={{
                padding: "12px",
                marginBottom: "20px",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "12px",
                marginBottom: "20px",
                background: "#dcfce7",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                color: "#16a34a",
              }}
            >
              {success}
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Basic Information */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Ingredient Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Ingredient Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleTypeChange}
                style={inputStyle}
              >
                <option value="grain">Grain/Fermentable</option>
                <option value="hop">Hop</option>
                <option value="yeast">Yeast</option>
                <option value="other">Other/Adjunct</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Optional description of the ingredient..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            {/* Type-specific fields */}
            {formData.type === "grain" && (
              <div
                style={{
                  padding: "20px",
                  background: "#f9fafb",
                  borderRadius: "8px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 15px 0",
                    fontSize: "1.1rem",
                    color: "#8B4513",
                  }}
                >
                  Grain Properties
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Grain Type
                    </label>
                    <select
                      name="grain_type"
                      value={formData.grain_type}
                      onChange={handleChange}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
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

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Color (°Lovibond)
                    </label>
                    <input
                      type="number"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      step="0.5"
                      min="0"
                      max="600"
                      placeholder="e.g., 2.5"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Potential (SG)
                    </label>
                    <input
                      type="number"
                      name="potential"
                      value={formData.potential}
                      onChange={handleChange}
                      step="0.001"
                      min="1.000"
                      max="1.100"
                      placeholder="e.g., 1.037"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.type === "hop" && (
              <div
                style={{
                  padding: "20px",
                  background: "#f0f9f0",
                  borderRadius: "8px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 15px 0",
                    fontSize: "1.1rem",
                    color: "#228B22",
                  }}
                >
                  Hop Properties
                </h3>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "500",
                    }}
                  >
                    Alpha Acid (%)
                  </label>
                  <input
                    type="number"
                    name="alpha_acid"
                    value={formData.alpha_acid}
                    onChange={handleChange}
                    step="0.1"
                    min="0.1"
                    max="25"
                    placeholder="e.g., 5.5"
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}

            {formData.type === "yeast" && (
              <div
                style={{
                  padding: "20px",
                  background: "#fffbeb",
                  borderRadius: "8px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 15px 0",
                    fontSize: "1.1rem",
                    color: "#DAA520",
                  }}
                >
                  Yeast Properties
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "15px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      placeholder="e.g., Wyeast, White Labs"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Code/Number
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., 1056, WLP001"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Attenuation (%)
                    </label>
                    <input
                      type="number"
                      name="attenuation"
                      value={formData.attenuation}
                      onChange={handleChange}
                      step="1"
                      min="1"
                      max="100"
                      placeholder="e.g., 75"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Alcohol Tolerance (%)
                    </label>
                    <input
                      type="number"
                      name="alcohol_tolerance"
                      value={formData.alcohol_tolerance}
                      onChange={handleChange}
                      step="0.5"
                      min="0"
                      max="20"
                      placeholder="e.g., 12"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Min Temperature (°F)
                    </label>
                    <input
                      type="number"
                      name="min_temperature"
                      value={formData.min_temperature}
                      onChange={handleChange}
                      step="1"
                      min="50"
                      max="100"
                      placeholder="e.g., 60"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "500",
                      }}
                    >
                      Max Temperature (°F)
                    </label>
                    <input
                      type="number"
                      name="max_temperature"
                      value={formData.max_temperature}
                      onChange={handleChange}
                      step="1"
                      min="50"
                      max="100"
                      placeholder="e.g., 72"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                onClick={handleReset}
                style={{
                  ...buttonStyle,
                  background: "white",
                  border: "1px solid #d1d5db",
                  color: "#374151",
                }}
              >
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  ...buttonStyle,
                  background: loading ? "#9ca3af" : "#2563eb",
                  color: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Adding..." : "Add Ingredient"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Ingredients List */}
        <div
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
              Existing Ingredients ({existingIngredients.length})
            </h2>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {filteredIngredients.length === 0 ? (
              <p
                style={{ textAlign: "center", color: "#666", padding: "20px" }}
              >
                {existingIngredients.length === 0
                  ? "No ingredients in database yet."
                  : "No ingredients match your search."}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {filteredIngredients.map((ingredient) => (
                  <div
                    key={ingredient.ingredient_id}
                    style={{
                      padding: "15px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      borderLeft: `4px solid ${getTypeColor(ingredient.type)}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: "0 0 5px 0", fontWeight: "600" }}>
                          {ingredient.name}
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "8px",
                          }}
                        >
                          <span
                            style={{
                              padding: "2px 8px",
                              background: getTypeColor(ingredient.type),
                              color: "white",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            {ingredient.type}
                          </span>
                          {ingredient.grain_type && (
                            <span
                              style={{
                                padding: "2px 8px",
                                background: "#f3f4f6",
                                color: "#374151",
                                borderRadius: "12px",
                                fontSize: "12px",
                              }}
                            >
                              {ingredient.grain_type.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        {ingredient.description && (
                          <p
                            style={{
                              margin: "5px 0",
                              fontSize: "14px",
                              color: "#666",
                              lineHeight: "1.4",
                            }}
                          >
                            {ingredient.description}
                          </p>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: "15px",
                            fontSize: "13px",
                            color: "#666",
                            marginTop: "8px",
                          }}
                        >
                          {ingredient.alpha_acid && (
                            <span>AA: {ingredient.alpha_acid}%</span>
                          )}
                          {ingredient.color && (
                            <span>Color: {ingredient.color}°L</span>
                          )}
                          {ingredient.attenuation && (
                            <span>Attenuation: {ingredient.attenuation}%</span>
                          )}
                          {ingredient.manufacturer && (
                            <span>Mfg: {ingredient.manufacturer}</span>
                          )}
                        </div>
                      </div>
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
