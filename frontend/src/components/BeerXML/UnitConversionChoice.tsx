import React from "react";
import "@/styles/BeerXMLImportExport.css";

interface UnitConversionChoiceProps {
  recipeUnitSystem: string;
  userUnitSystem: string;
  recipeName: string;
  onImportAsIs: () => void;
  onConvertAndImport: () => void;
  onCancel: () => void;
  isConverting?: boolean;
}

const UnitConversionChoice: React.FC<UnitConversionChoiceProps> = ({
  recipeUnitSystem,
  userUnitSystem,
  recipeName,
  onImportAsIs,
  onConvertAndImport,
  onCancel,
  isConverting = false,
}) => {
  return (
    <div className="unit-conversion-choice-overlay">
      <div className="unit-conversion-choice-dialog">
        <h3>Unit System Mismatch</h3>

        <div className="unit-mismatch-info">
          <div className="info-icon">⚠️</div>
          <p>
            The recipe <strong>"{recipeName}"</strong> uses{" "}
            <strong>{recipeUnitSystem}</strong> units, but your preference is
            set to <strong>{userUnitSystem}</strong> units.
          </p>
        </div>

        <div className="conversion-choices">
          <div className="choice-card">
            <div className="choice-header">
              <span className="choice-icon">📋</span>
              <h4>Import as-is</h4>
            </div>
            <p className="choice-description">
              Keep the recipe in {recipeUnitSystem} units without any
              modifications.
            </p>
            <button
              onClick={onImportAsIs}
              className="btn btn-secondary"
              disabled={isConverting}
            >
              Import as {recipeUnitSystem}
            </button>
          </div>

          <div className="choice-card recommended">
            <div className="choice-header">
              <span className="choice-icon">✨</span>
              <h4>Convert + Normalize</h4>
              <span className="recommended-badge">Recommended</span>
            </div>
            <p className="choice-description">
              Convert to {userUnitSystem} units and normalize amounts to
              brewing-friendly increments (e.g., 1587g → 1.6kg, 3.858 lbs →
              3.875 lbs).
            </p>
            <button
              onClick={onConvertAndImport}
              className="btn btn-primary"
              disabled={isConverting}
            >
              {isConverting ? (
                <>
                  <span className="button-spinner"></span>
                  Converting...
                </>
              ) : (
                `Convert to ${userUnitSystem}`
              )}
            </button>
          </div>
        </div>

        <div className="dialog-actions">
          <button
            onClick={onCancel}
            className="btn btn-text"
            disabled={isConverting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitConversionChoice;
