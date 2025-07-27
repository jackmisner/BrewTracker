import React, { useState } from "react";
import { useUnits } from "../../../contexts/UnitContext";
import SearchableSelect from "../../SearchableSelect";
import { Ingredient, IngredientFormData } from "../../../types";
import { selectAllOnFocus } from "../../../utils/formatUtils";
import "../../../styles/SearchableSelect.css";

interface UnitOption {
  value: string;
  label: string;
  description: string;
}

interface UsageOption {
  value: string;
  label: string;
  description: string;
}

interface OtherFormData {
  ingredient_id: string;
  amount: string;
  unit: string;
  use: string;
  time: string;
  selectedIngredient: Ingredient | null;
}

interface FormErrors {
  ingredient_id?: string | null;
  amount?: string | null;
  submit?: string | null;
}

interface OtherInputProps {
  others: Ingredient[];
  onAdd: (data: IngredientFormData) => Promise<void>;
  disabled?: boolean;
}

const OtherInput: React.FC<OtherInputProps> = ({
  others,
  onAdd,
  disabled = false,
}) => {
  const { unitSystem, getPreferredUnit } = useUnits();

  const [otherForm, setOtherForm] = useState<OtherFormData>({
    ingredient_id: "",
    amount: "",
    unit: getPreferredUnit("other") || (unitSystem === "metric" ? "g" : "oz"),
    use: "boil",
    time: "",
    selectedIngredient: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Get available units based on unit system preference
  const getAvailableUnits = (): UnitOption[] => {
    if (unitSystem === "metric") {
      return [
        { value: "g", label: "g", description: "Grams" },
        { value: "kg", label: "kg", description: "Kilograms" },
        { value: "ml", label: "ml", description: "Milliliters" },
        { value: "l", label: "l", description: "Liters" },
        { value: "tsp", label: "tsp", description: "Teaspoons" },
        { value: "tbsp", label: "tbsp", description: "Tablespoons" },
        { value: "each", label: "each", description: "Individual items" },
        // Keep imperial options available for metric users
        { value: "oz", label: "oz", description: "Ounces" },
        { value: "cup", label: "cup", description: "Cups" },
      ];
    } else {
      return [
        { value: "oz", label: "oz", description: "Ounces" },
        { value: "lb", label: "lb", description: "Pounds" },
        { value: "tsp", label: "tsp", description: "Teaspoons" },
        { value: "tbsp", label: "tbsp", description: "Tablespoons" },
        { value: "cup", label: "cup", description: "Cups" },
        { value: "ml", label: "ml", description: "Milliliters" },
        { value: "each", label: "each", description: "Individual items" },
        // Keep metric options available for imperial users
        { value: "g", label: "g", description: "Grams" },
        { value: "kg", label: "kg", description: "Kilograms" },
        { value: "l", label: "l", description: "Liters" },
      ];
    }
  };

  // Custom Fuse.js options for other ingredients - flexible matching
  const otherFuseOptions = {
    threshold: 0.5, // More lenient since "other" ingredients vary widely
    keys: [
      { name: "name", weight: 1.0 },
      { name: "description", weight: 0.6 },
      { name: "type", weight: 0.4 },
    ],
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    useExtendedSearch: true, // Allow flexible searches
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setOtherForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear related errors when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  // Get default amount based on unit
  const getDefaultAmount = (): string => {
    const unit = otherForm.unit;
    switch (unit) {
      case "g":
        return "5";
      case "kg":
        return "0.5";
      case "oz":
        return "0.5";
      case "lb":
        return "1";
      default:
        return "5";
    }
  };

  const handleOtherSelect = (selectedOther: Ingredient | null): void => {
    if (selectedOther) {
      setOtherForm((prev) => ({
        ...prev,
        ingredient_id: selectedOther.ingredient_id,
        amount: prev.amount || getDefaultAmount(), // Set default amount if empty
        selectedIngredient: selectedOther,
      }));

      // Clear ingredient selection error
      if (errors.ingredient_id) {
        setErrors((prev) => ({
          ...prev,
          ingredient_id: null,
        }));
      }
    } else {
      // Clear selection
      setOtherForm((prev) => ({
        ...prev,
        ingredient_id: "",
        amount: "", // Clear amount when no ingredient selected
        selectedIngredient: null,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!otherForm.ingredient_id) {
      newErrors.ingredient_id = "Please select an ingredient";
    }

    if (!otherForm.amount || parseFloat(otherForm.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    // Unit-specific validation (more lenient for "other" ingredients)
    const amount = parseFloat(otherForm.amount);

    if (otherForm.unit === "oz" && amount > 16) {
      newErrors.amount = "More than 1 pound seems high - double check amount";
    }

    if (otherForm.unit === "lb" && amount > 5) {
      newErrors.amount = "More than 5 pounds of adjunct seems unusual";
    }

    if (otherForm.unit === "g" && amount > 500) {
      newErrors.amount = "More than 500g seems high for most additives";
    }

    if (otherForm.unit === "kg" && amount > 2) {
      newErrors.amount = "More than 2kg seems high for most additives";
    }

    if (
      (otherForm.unit === "tsp" || otherForm.unit === "tbsp") &&
      amount > 10
    ) {
      newErrors.amount = "Large amounts of spices/nutrients - double check";
    }

    if (otherForm.unit === "l" && amount > 2) {
      newErrors.amount = "More than 2 liters seems high for most additives";
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

    try {
      const formData: any = {
        ingredient_id: otherForm.ingredient_id,
        amount: otherForm.amount,
        unit: otherForm.unit,
        use: otherForm.use,
        time: otherForm.time ? parseInt(otherForm.time) : undefined,
      };

      await onAdd(formData);

      // Reset form on successful add
      setOtherForm({
        ingredient_id: "",
        amount: "",
        unit:
          getPreferredUnit("other") || (unitSystem === "metric" ? "g" : "oz"),
        use: "boil",
        time: "",
        selectedIngredient: null,
      });

      setErrors({});
      setResetTrigger((prev) => prev + 1);
    } catch (error: any) {
      console.error("Failed to add other ingredient:", error);
      setErrors({ submit: "Failed to add ingredient. Please try again." });
    }
  };

  const getUsageOptions = (): UsageOption[] => {
    return [
      { value: "boil", label: "Boil", description: "Added during the boil" },
      {
        value: "whirlpool",
        label: "Whirlpool",
        description: "Added at end of boil",
      },
      {
        value: "fermentation",
        label: "Fermentation",
        description: "Added during fermentation",
      },
      {
        value: "secondary",
        label: "Secondary",
        description: "Added to secondary fermenter",
      },
      {
        value: "packaging",
        label: "Packaging",
        description: "Added when bottling/kegging",
      },
      { value: "mash", label: "Mash", description: "Added to mash tun" },
    ];
  };

  const getIngredientCategory = (
    ingredient: Ingredient | null
  ): string | null => {
    if (!ingredient) return null;

    const name = ingredient.name.toLowerCase();
    const desc = (ingredient.description || "").toLowerCase();

    if (name.includes("nutrient") || desc.includes("nutrient")) {
      return "Yeast Nutrient";
    }
    if (
      name.includes("irish moss") ||
      name.includes("whirlfloc") ||
      desc.includes("clarif")
    ) {
      return "Clarifying Agent";
    }
    if (
      name.includes("gypsum") ||
      name.includes("calcium") ||
      desc.includes("water")
    ) {
      return "Water Chemistry";
    }
    if (
      name.includes("sugar") ||
      name.includes("honey") ||
      name.includes("syrup")
    ) {
      return "Fermentable Sugar";
    }
    if (
      desc.includes("spice") ||
      desc.includes("fruit") ||
      desc.includes("flavor")
    ) {
      return "Flavoring";
    }

    return "Other";
  };

  const getAmountGuidance = (): string => {
    const category = getIngredientCategory(otherForm.selectedIngredient);
    const batchSize = unitSystem === "metric" ? "19L" : "5 gallons";

    switch (category) {
      case "Yeast Nutrient":
        return unitSystem === "metric"
          ? `Typical: 2-3g per ${batchSize}`
          : `Typical: 1/2 tsp per ${batchSize}`;
      case "Clarifying Agent":
        return unitSystem === "metric"
          ? `Irish Moss: 2-3g per ${batchSize}, Whirlfloc: 1 tablet per ${batchSize}`
          : `Irish Moss: 1 tsp per ${batchSize}, Whirlfloc: 1 tablet per ${batchSize}`;
      case "Water Chemistry":
        return "Small amounts - follow water calculator recommendations";
      case "Fermentable Sugar":
        return unitSystem === "metric"
          ? `450g sugar ≈ 46 gravity points in ${batchSize}`
          : `1 lb sugar ≈ 46 gravity points in ${batchSize}`;
      default:
        return "Amount varies by ingredient type";
    }
  };

  const getAmountPlaceholder = (): string => {
    const unit = otherForm.unit;
    switch (unit) {
      case "g":
        return "5";
      case "kg":
        return "0.5";
      case "oz":
        return "0.5";
      case "lb":
        return "1";
      case "tsp":
        return "0.5";
      case "tbsp":
        return "1";
      case "ml":
        return "15";
      case "l":
        return "0.5";
      case "cup":
        return "0.25";
      case "each":
        return "1";
      default:
        return "1";
    }
  };

  return (
    <div className="card mt-6">
      <h3 className="card-title">Other Ingredients</h3>

      <form onSubmit={handleSubmit} className="ingredient-form">
        <div className="ingredient-inputs ingredient-inputs--adjunct">
          {/* Amount Input */}
          <div className="amount-container">
            <input
              type="number"
              name="amount"
              value={otherForm.amount}
              onChange={handleChange}
              onFocus={selectAllOnFocus}
              placeholder={
                otherForm.selectedIngredient ? "Amount" : getAmountPlaceholder()
              }
              className="amount-input"
              step="0.1"
              min="0"
              disabled={disabled}
              required
              data-testid="other-amount-input"
            />
            <select
              name="unit"
              value={otherForm.unit}
              onChange={handleChange}
              className="unit-select"
              disabled={disabled}
              data-testid="other-unit-select"
            >
              {getAvailableUnits().map((unit) => (
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

          {/* Other Ingredient Selector */}
          <div className="ingredient-selector">
            <SearchableSelect
              options={others}
              onSelect={handleOtherSelect}
              placeholder="Search additives (nutrients, clarifiers, sugars)..."
              searchKey="name"
              displayKey="name"
              valueKey="ingredient_id"
              disabled={disabled}
              fuseOptions={otherFuseOptions}
              maxResults={15}
              minQueryLength={1}
              resetTrigger={resetTrigger}
              data-testid="other-searchable-select"
            />
          </div>

          {/* Usage Selection */}
          <div className="adjunct-use-container">
            <select
              name="use"
              value={otherForm.use}
              onChange={handleChange}
              className="adjunct-use-select"
              disabled={disabled}
            >
              {getUsageOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Time Input */}
          <div className="adjunct-time-container">
            <input
              type="number"
              name="time"
              value={otherForm.time}
              onChange={handleChange}
              onFocus={selectAllOnFocus}
              placeholder="Time (min)"
              className="adjunct-time-input"
              min="0"
              disabled={disabled}
            />
          </div>

          {/* Add Button */}
          <button
            type="submit"
            className="ingredient-add-button"
            disabled={disabled}
            data-testid="add-other-button"
          >
            {disabled ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Amount Guidance */}
        {otherForm.selectedIngredient && (
          <div className="usage-description">
            <small className="guidance-text">{getAmountGuidance()}</small>
          </div>
        )}

        {/* Display selected ingredient info */}
        {otherForm.selectedIngredient && (
          <div className="selected-ingredient-info">
            <div className="ingredient-info-header">
              <strong className="ingredient-name">
                {otherForm.selectedIngredient.name}
              </strong>
              {getIngredientCategory(otherForm.selectedIngredient) && (
                <span className="ingredient-badge">
                  {getIngredientCategory(otherForm.selectedIngredient)}
                </span>
              )}
            </div>

            {otherForm.selectedIngredient.description && (
              <p className="ingredient-description">
                {otherForm.selectedIngredient.description}
              </p>
            )}

            {/* Usage description */}
            <div className="usage-description">
              <small className="guidance-text">
                <strong>Usage:</strong> Added during{" "}
                {otherForm.use === "boil"
                  ? "the boil"
                  : otherForm.use.replace("-", " ")}
              </small>
            </div>
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
          💡 For yeast nutrients, clarifying agents, water chemistry additions,
          sugars, spices, and other brewing additives. Use small amounts - a
          little goes a long way!
        </small>
      </div>
    </div>
  );
};

export default OtherInput;
