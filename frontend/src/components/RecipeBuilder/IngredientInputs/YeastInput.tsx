import React, { useState } from "react";
import { useUnits } from "../../../contexts/UnitContext";
import SearchableSelect from "../../SearchableSelect";
import AttenuationBadge from "../../AttenuationAnalytics/AttenuationBadge";
import { Ingredient, IngredientFormData } from "../../../types";
import { selectAllOnFocus, convertUnit } from "../../../utils/formatUtils";
import "../../../styles/SearchableSelect.css";
import "../../../styles/AttenuationAnalytics.css";

interface UnitOption {
  value: string;
  label: string;
  description: string;
}

interface YeastFormData {
  ingredient_id: string;
  amount: string;
  unit: string;
  selectedIngredient: Ingredient | null;
}

interface FormErrors {
  ingredient_id?: string | null;
  amount?: string | null;
  submit?: string | null;
}

interface YeastInputProps {
  yeasts: Ingredient[];
  onAdd: (data: IngredientFormData) => Promise<void>;
  disabled?: boolean;
}

interface YeastInfo {
  attenuation?: number;
  min_temperature?: number;
  max_temperature?: number;
  alcohol_tolerance?: number;
  manufacturer?: string;
  code?: string;
}

const YeastInput: React.FC<YeastInputProps> = ({
  yeasts,
  onAdd,
  disabled = false,
}) => {
  const { unitSystem, getPreferredUnit } = useUnits();

  const [yeastForm, setYeastForm] = useState<YeastFormData>({
    ingredient_id: "",
    amount: "",
    unit: getPreferredUnit("yeast") || "pkg", // Default to packages
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Get available units (yeast units are fairly universal)
  const getAvailableUnits = (): UnitOption[] => {
    return [
      { value: "pkg", label: "pkg", description: "Packages" },
      { value: "g", label: "g", description: "Grams" },
      { value: "ml", label: "ml", description: "Milliliters" },
    ];
  };

  // Custom Fuse.js options for yeast - precise matching since strain matters
  const yeastFuseOptions = {
    threshold: 0.2, // Very strict matching for yeast strains
    keys: [
      { name: "name", weight: 1.0 },
      { name: "manufacturer", weight: 0.8 },
      { name: "code", weight: 0.9 },
      { name: "description", weight: 0.4 },
    ],
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
    distance: 20, // Keep matches close to beginning
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setYeastForm(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear related errors when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  // Get default amount based on unit
  const getDefaultAmount = (): string => {
    switch (yeastForm.unit) {
      case "pkg":
        return "1";
      case "g":
        return "11";
      default:
        return "1";
    }
  };

  const handleYeastSelect = (selectedYeast: Ingredient | null): void => {
    if (selectedYeast) {
      setYeastForm(prev => ({
        ...prev,
        ingredient_id: selectedYeast.ingredient_id,
        amount: prev.amount || getDefaultAmount(), // Set default amount if empty
        selectedIngredient: selectedYeast,
      }));

      // Clear ingredient selection error
      if (errors.ingredient_id) {
        setErrors(prev => ({
          ...prev,
          ingredient_id: null,
        }));
      }
    } else {
      // Clear selection
      setYeastForm(prev => ({
        ...prev,
        ingredient_id: "",
        amount: "", // Clear amount when no ingredient selected
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!yeastForm.ingredient_id) {
      newErrors.ingredient_id = "Please select a yeast strain";
    }

    if (!yeastForm.amount || parseFloat(yeastForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation
    const amount = parseFloat(yeastForm.amount);
    if (yeastForm.unit === "pkg" && amount > 10) {
      newErrors.amount = "More than 10 packages is unusual - are you sure?";
    }

    if (yeastForm.unit === "g" && (amount < 5 || amount > 100)) {
      newErrors.amount = "Typical dry yeast: 5-15g. Liquid yeast: 10-50g";
    }

    if (yeastForm.unit === "ml" && (amount < 10 || amount > 500)) {
      newErrors.amount = "Typical liquid yeast volume: 35-125ml";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Additional confirmation for unusual amounts
    const amount = parseFloat(yeastForm.amount);
    if (yeastForm.unit === "pkg" && amount > 3) {
      const confirmed = window.confirm(
        `Using ${amount} packages of yeast is unusual for most batches. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      const formData: any = {
        ingredient_id: yeastForm.ingredient_id,
        amount: yeastForm.amount,
        unit: yeastForm.unit,
      };

      await onAdd(formData);

      // Reset form on successful add
      setYeastForm({
        ingredient_id: "",
        amount: "",
        unit: getPreferredUnit("yeast") || "pkg",
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error("Failed to add yeast:", error);
      setErrors({ submit: "Failed to add yeast. Please try again." });
    }
  };

  const getAmountPlaceholder = (): string => {
    switch (yeastForm.unit) {
      case "pkg":
        return "1";
      case "g":
        return "11";
      case "ml":
        return "125";
      default:
        return "1";
    }
  };

  const getAmountGuidance = (): string => {
    const batchSize = unitSystem === "metric" ? "19L" : "5 gal";

    switch (yeastForm.unit) {
      case "pkg":
        return `Typically 1-2 packages per ${batchSize} batch`;
      case "g":
        return "Dry yeast: ~11g/pkg, Liquid: varies by strain";
      case "ml":
        return "Liquid yeast: ~35-125ml per vial/smack pack";
      default:
        return "";
    }
  };

  const getBatchSizeGuidance = (): string => {
    if (unitSystem === "metric") {
      return "Most 19-23L batches need 1-2 packages";
    } else {
      return "Most 5-gallon batches need 1-2 packages";
    }
  };

  const getYeastTypeInfo = (yeast: Ingredient | null): string | null => {
    if (!yeast) return null;

    const yeastInfo = yeast as Ingredient & YeastInfo;
    const info: string[] = [];

    // Prefer improved attenuation estimate if available
    const attenuationValue =
      yeast?.improved_attenuation_estimate || yeastInfo.attenuation;
    if (attenuationValue) {
      const source = yeast?.improved_attenuation_estimate ? " (enhanced)" : "";
      info.push(`${attenuationValue}% attenuation${source}`);
    }

    if (yeastInfo.min_temperature && yeastInfo.max_temperature) {
      // Show temperature in user's preferred units
      if (unitSystem === "metric") {
        const minC = Math.round(
          convertUnit(yeastInfo.min_temperature, "f", "c").value
        );
        const maxC = Math.round(
          convertUnit(yeastInfo.max_temperature, "f", "c").value
        );
        info.push(`${minC}-${maxC}°C`);
      } else {
        info.push(
          `${yeastInfo.min_temperature}-${yeastInfo.max_temperature}°F`
        );
      }
    }

    if (yeastInfo.alcohol_tolerance) {
      info.push(`${yeastInfo.alcohol_tolerance}% alcohol tolerance`);
    }

    return info.length > 0 ? info.join(" • ") : null;
  };

  return (
    <div className="card">
      <h3 className="card-title">Yeast</h3>

      <form onSubmit={handleSubmit} className="ingredient-form">
        <div className="ingredient-inputs ingredient-inputs--yeast">
          {/* Amount Input */}
          <div className="amount-container">
            <input
              type="number"
              name="amount"
              value={yeastForm.amount}
              onChange={handleChange}
              onFocus={selectAllOnFocus}
              className={`amount-input ${errors.amount ? "error" : ""}`}
              placeholder={
                yeastForm.selectedIngredient ? "Amount" : getAmountPlaceholder()
              }
              step="0.5"
              min="0.5"
              max="20"
              disabled={disabled}
              required
              data-testid="yeast-amount-input"
            />
            <select
              name="unit"
              value={yeastForm.unit}
              onChange={handleChange}
              className="unit-select"
              disabled={disabled}
              data-testid="yeast-unit-select"
            >
              {getAvailableUnits().map(unit => (
                <option
                  key={unit.value}
                  value={unit.value}
                  title={unit.description}
                >
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          {/* Yeast Selector */}
          <div className="ingredient-selector">
            <SearchableSelect
              options={yeasts}
              onSelect={handleYeastSelect}
              placeholder="Search yeast (try: us-05, wyeast, safale)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              fuseOptions={yeastFuseOptions}
              maxResults={12}
              minQueryLength={2}
              resetTrigger={resetTrigger}
              ingredientType="yeast"
              unitSystem={unitSystem}
              data-testid="yeast-searchable-select"
            />
          </div>

          {/* Add Button */}
          <button
            type="submit"
            className="ingredient-add-button"
            disabled={disabled}
            data-testid="add-yeast-button"
          >
            {disabled ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Amount Guidance */}
        <div className="usage-description">
          <small className="guidance-text">{getAmountGuidance()}</small>
        </div>

        {/* Display selected yeast info */}
        {yeastForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="ingredient-info-header">
              <strong className="ingredient-name">
                {yeastForm.selectedIngredient.name}
              </strong>
              {(yeastForm.selectedIngredient as any).manufacturer && (
                <span className="ingredient-badge">
                  {(yeastForm.selectedIngredient as any).manufacturer}
                </span>
              )}
              {(yeastForm.selectedIngredient as any).code && (
                <span className="ingredient-badge">
                  {(yeastForm.selectedIngredient as any).code}
                </span>
              )}
            </div>

            {yeastForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {yeastForm.selectedIngredient.description}
              </p>
            )}

            {getYeastTypeInfo(yeastForm.selectedIngredient) && (
              <div className="yeast-specs">
                <small>{getYeastTypeInfo(yeastForm.selectedIngredient)}</small>
              </div>
            )}

            {/* Attenuation Analytics */}
            <AttenuationBadge
              ingredientId={yeastForm.selectedIngredient.ingredient_id}
              className="compact"
              showDetails={true}
            />
          </div>
        )}

        {/* Error Messages */}
        <div className="validation-errors" role="alert">
          {errors.amount && (
            <div className="error-message">{errors.amount}</div>
          )}
          {errors.ingredient_id && (
            <div className="error-message">{errors.ingredient_id}</div>
          )}
          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}
        </div>
      </form>

      {/* Help text with unit-specific guidance */}
      <div className="ingredient-help">
        <small className="help-text">
          💡 {getBatchSizeGuidance()} of dry yeast or 1 vial/smack pack of
          liquid yeast. Liquid yeast often provides more complex flavors.
        </small>
      </div>
    </div>
  );
};

export default YeastInput;
