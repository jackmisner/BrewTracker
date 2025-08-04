import React, { useState } from "react";
import { useUnits } from "../../contexts/UnitContext";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../../utils/formatUtils";
import { Recipe, RecipeMetrics as RecipeMetricsType } from "../../types";

interface RecipeMetricsProps {
  metrics: RecipeMetricsType;
  onScale?: (volume: number) => void;
  calculating?: boolean;
  recipe: Recipe;
  cardView?: boolean;
}

interface ScaleInputProps {
  placeholder: string;
  step: string;
  min: string;
  max: string;
  unit: string;
}

const RecipeMetrics: React.FC<RecipeMetricsProps> = ({
  metrics,
  onScale,
  calculating = false,
  recipe,
  cardView = false,
}) => {
  const { unitSystem, formatValue, convertForDisplay, convertUnit } =
    useUnits();
  const [scaleVolume, setScaleVolume] = useState<string>("");

  const getBalanceRatio = (): number => {
    if (metrics.ibu === 0) return 0;
    return metrics.ibu / ((metrics.og - 1) * 1000) / 2;
  };

  const getBalanceDescription = (): string => {
    const ratio = metrics.ibu / ((metrics.og - 1) * 1000);

    if (metrics.ibu === 0) return "Not calculated";
    if (ratio < 0.3) return "Very Malty";
    if (ratio < 0.6) return "Malty";
    if (ratio < 0.8) return "Balanced (Malt)";
    if (ratio < 1.2) return "Balanced";
    if (ratio < 1.5) return "Balanced (Hoppy)";
    if (ratio < 2.0) return "Hoppy";
    return "Very Hoppy";
  };

  const handleScaleSubmit = (): void => {
    if (
      scaleVolume &&
      !isNaN(Number(scaleVolume)) &&
      parseFloat(scaleVolume) > 0 &&
      onScale
    ) {
      const enteredUnit = unitSystem === "metric" ? "l" : "gal";
      const recipeUnit = recipe.batch_size_unit || "gal";

      let volumeForScaling = parseFloat(scaleVolume);

      // If entered unit differs from recipe's unit, convert it
      if (enteredUnit !== recipeUnit) {
        const converted = convertUnit(
          volumeForScaling,
          enteredUnit,
          recipeUnit
        );
        volumeForScaling = converted.value;
      }

      onScale(volumeForScaling);
      setScaleVolume(""); // Clear input after scaling
    }
  };

  const displayBatchSize = recipe?.batch_size
    ? convertForDisplay(
        recipe.batch_size,
        recipe.batch_size_unit || "gal", // Use recipe's unit, fallback to gallons
        "volume"
      )
    : null;

  // Use different class names for cardView
  const containerClass = cardView
    ? "card-metrics-container"
    : "metrics-container";

  const metricsGridClass = cardView ? "card-metrics-grid" : "metrics-grid";

  const colorDisplayClass = cardView ? "card-color-display" : "color-display";

  const balanceMeterContainerClass = cardView
    ? "card-balance-meter-container"
    : "balance-meter-container";

  // Get unit-specific placeholders and limits
  const getScaleInputProps = (): ScaleInputProps => {
    if (unitSystem === "metric") {
      return {
        placeholder: "New batch size (L)",
        step: "1",
        min: "1",
        max: "380",
        unit: "L",
      };
    } else {
      return {
        placeholder: "New batch size (gal)",
        step: "0.5",
        min: "0.5",
        max: "100",
        unit: "gal",
      };
    }
  };

  const scaleInputProps = getScaleInputProps();

  // Get current batch size display
  const getCurrentBatchDisplay = (): string => {
    if (!displayBatchSize) {
      return unitSystem === "metric" ? "19 L" : "5 gal";
    }
    return formatValue(displayBatchSize.value, displayBatchSize.unit, "volume");
  };

  // Get typical batch size examples
  const getTypicalBatchSizes = (): string => {
    if (unitSystem === "metric") {
      return "Typical: 10L (Small batch), 19L, 38L (Large batch)";
    } else {
      return "Typical: 2.5 gal, 5 gal, 10 gal";
    }
  };

  // Mash temperature adjustment helpers
  const getMashTemperatureAdjustment = () => {
    if (!recipe.mash_temperature) return null;

    // Convert to common unit (Fahrenheit) for baseline comparison
    let mash_temp_f = recipe.mash_temperature;
    if (recipe.mash_temp_unit === "C") {
      mash_temp_f = (recipe.mash_temperature * 9) / 5 + 32;
    }

    const baseline_temp_f = 152.0; // Research-backed baseline
    const temp_tolerance = 0.5;
    const temp_deviation = mash_temp_f - baseline_temp_f;

    // Only show adjustment if temperature differs from baseline
    if (Math.abs(temp_deviation) <= temp_tolerance) {
      return null;
    }

    return {
      deviation: temp_deviation,
      isHigher: temp_deviation > 0,
      isLower: temp_deviation < 0,
      displayTemp: recipe.mash_temperature,
      unit: recipe.mash_temp_unit || "F",
    };
  };

  const getTemperatureAdjustmentIcon = (adjustment: any) => {
    if (!adjustment) return null;

    if (adjustment.isLower) {
      return "↓"; // Down arrow for lower FG (higher fermentability)
    } else {
      return "↑"; // Up arrow for higher FG (lower fermentability)
    }
  };

  return (
    <div
      className={`${containerClass} ${
        calculating ? "metrics-updating" : "metrics-updated"
      }`}
    >
      {!cardView && (
        <div className="metrics-header">
          <h2 className="card-title">Recipe Metrics</h2>
          {calculating && (
            <div className="calculating-indicator">
              <span className="spinner"></span>
              <span>Calculating...</span>
            </div>
          )}
        </div>
      )}

      <div className={metricsGridClass}>
        <div className="metric-box">
          <div className="metric-label">Original Gravity</div>
          <div id="og-display" className="metric-value">
            {formatGravity(metrics.og)}
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">Final Gravity</div>
          <div id="fg-display" className="metric-value">
            {formatGravity(metrics.fg)}
            {(() => {
              const tempAdjustment = getMashTemperatureAdjustment();
              if (tempAdjustment) {
                return (
                  <span className="temperature-adjustment-indicator">
                    {getTemperatureAdjustmentIcon(tempAdjustment)}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">ABV</div>
          <div id="abv-display" className="metric-value">
            {formatAbv(metrics.abv)}
            {(() => {
              const tempAdjustment = getMashTemperatureAdjustment();
              if (tempAdjustment) {
                return (
                  <span className="temperature-adjustment-indicator">
                    {getTemperatureAdjustmentIcon(tempAdjustment) === "↑"
                      ? "↓"
                      : "↑"}
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">IBU</div>
          <div id="ibu-display" className="metric-value">
            {formatIbu(metrics.ibu)}
          </div>
        </div>
      </div>

      <div className={colorDisplayClass}>
        <div className="color-info">
          <div className="metric-label">Colour</div>
          <div id="srm-display" className="metric-value">
            {formatSrm(metrics.srm)} SRM
          </div>
        </div>
        <div
          id="color-swatch"
          className="color-swatch"
          style={{ backgroundColor: getSrmColour(metrics.srm) }}
          title={`SRM ${formatSrm(metrics.srm)}`}
        ></div>
      </div>

      <div className={balanceMeterContainerClass}>
        <div data-testid="balance-description" className="balance-labels">
          <span>Malty</span>
          <span>Balanced</span>
          <span>Hoppy</span>
        </div>
        <div className="balance-meter">
          <div
            id="balance-meter-progress"
            className="balance-meter-progress"
            style={{
              width: `${Math.min(getBalanceRatio() * 100, 100)}%`,
            }}
          ></div>
        </div>
        <div id="balance-description" className="balance-description">
          {getBalanceDescription()}
        </div>
      </div>

      {!cardView && (
        <>
          {/* Recipe scaling section - now fully unit-aware */}
          {onScale && recipe && (
            <div className="scaling-container">
              <h3 className="scaling-title">
                Recipe Scaling
                <span className="current-batch-size">
                  (Current: {getCurrentBatchDisplay()})
                </span>
              </h3>
              <div className="scaling-input-group">
                <input
                  type="number"
                  id="scale-volume"
                  name="scale-volume"
                  placeholder={scaleInputProps.placeholder}
                  step={scaleInputProps.step}
                  min={scaleInputProps.min}
                  max={scaleInputProps.max}
                  value={scaleVolume}
                  onChange={(e) => setScaleVolume(e.target.value)}
                  className="scaling-input"
                  disabled={calculating}
                />
                <button
                  id="scale-recipe-btn"
                  type="button"
                  onClick={handleScaleSubmit}
                  className="scaling-button"
                  disabled={calculating || !scaleVolume}
                >
                  {calculating ? "Scaling..." : "Scale"}
                </button>
              </div>
              <p className="scaling-help-text">
                Enter a new batch size to proportionally scale all ingredients
              </p>
              <p className="scaling-examples">
                <small>{getTypicalBatchSizes()}</small>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecipeMetrics;
