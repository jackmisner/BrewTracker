import React from "react";
import { UnitSystem } from "@/types/units";
import "@/styles/BeerXMLImportExport.css";

interface UnitConversionChoiceProps {
  userUnitSystem: UnitSystem | null;
  onImportAsMetric: () => void;
  onImportAsImperial: () => void;
  onCancel: () => void;
  isConverting?: boolean;
  // Keep these for backwards compatibility but mark as optional
  recipeUnitSystem?: UnitSystem | null;
  recipeName?: string;
}

const UnitConversionChoice: React.FC<UnitConversionChoiceProps> = ({
  userUnitSystem,
  onImportAsMetric,
  onImportAsImperial,
  onCancel,
  isConverting = false,
}) => {
  // Guard against null values (shouldn't happen, but be defensive)
  if (!userUnitSystem) {
    console.error("UnitConversionChoice called with null user unit system");
    onCancel();
    return null;
  }

  return (
    <div
      className="unit-conversion-choice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-conversion-dialog-title"
      aria-describedby="unit-conversion-dialog-description"
    >
      <div className="unit-conversion-choice-dialog">
        <h3 id="unit-conversion-dialog-title">Choose Import Units</h3>

        <div
          className="unit-mismatch-info"
          id="unit-conversion-dialog-description"
        >
          <div className="info-icon" aria-hidden="true">
            📏
          </div>
          <p>
            BeerXML files use metric units by default. Choose which system you'd
            like to use in BrewTracker.
          </p>
        </div>

        <div className="conversion-choices">
          <div
            className={`choice-card ${userUnitSystem === "metric" ? "recommended" : ""}`}
          >
            <div className="choice-header">
              <span className="choice-icon" aria-hidden="true">
                📐
              </span>
              <h4>Metric (kg, L, °C)</h4>
              {userUnitSystem === "metric" && (
                <span className="recommended-badge">Your Preference</span>
              )}
            </div>
            <p className="choice-description">
              Import recipe using metric units. Recommended if you brew using
              metric measurements.
            </p>
            <button
              onClick={onImportAsMetric}
              className={`btn ${userUnitSystem === "metric" ? "btn-primary" : "btn-secondary"}`}
              disabled={isConverting}
              aria-label="Import recipe in metric units"
            >
              {isConverting ? (
                <>
                  <span className="button-spinner" aria-hidden="true"></span>
                  Converting...
                </>
              ) : (
                "Import as Metric"
              )}
            </button>
          </div>

          <div
            className={`choice-card ${userUnitSystem === "imperial" ? "recommended" : ""}`}
          >
            <div className="choice-header">
              <span className="choice-icon" aria-hidden="true">
                📊
              </span>
              <h4>Imperial (lbs, gal, °F)</h4>
              {userUnitSystem === "imperial" && (
                <span className="recommended-badge">Your Preference</span>
              )}
            </div>
            <p className="choice-description">
              Convert recipe to imperial units with brewing-friendly rounding.
              Recommended if you brew using imperial measurements.
            </p>
            <button
              onClick={onImportAsImperial}
              className={`btn ${userUnitSystem === "imperial" ? "btn-primary" : "btn-secondary"}`}
              disabled={isConverting}
              aria-label="Convert recipe to imperial units"
            >
              {isConverting ? (
                <>
                  <span className="button-spinner" aria-hidden="true"></span>
                  Converting...
                </>
              ) : (
                "Import as Imperial"
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
