import React, { useState } from "react";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../../utils/formatUtils";

function RecipeMetrics({
  metrics,
  onScale,
  calculating = false,
  recipe,
  cardView = false,
}) {
  const [scaleVolume, setScaleVolume] = useState("");

  const getBalanceRatio = () => {
    if (metrics.ibu === 0) return 0;
    return metrics.ibu / ((metrics.og - 1) * 1000) / 2;
  };

  const getBalanceDescription = () => {
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

  const handleScaleSubmit = () => {
    if (scaleVolume && !isNaN(scaleVolume) && parseFloat(scaleVolume) > 0) {
      onScale(parseFloat(scaleVolume));
      setScaleVolume(""); // Clear input after scaling
    }
  };

  // Use different class names for cardView
  const containerClass = cardView
    ? "card-metrics-container"
    : "metrics-container";

  const metricsGridClass = cardView ? "card-metrics-grid" : "metrics-grid";

  const colorDisplayClass = cardView ? "card-color-display" : "color-display";

  const balanceMeterContainerClass = cardView
    ? "card-balance-meter-container"
    : "balance-meter-container";

  return (
    <div className={containerClass}>
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
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">ABV</div>
          <div id="abv-display" className="metric-value">
            {formatAbv(metrics.abv)}
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
        <div className="balance-labels">
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
          {/* Recipe scaling section */}
          {onScale && recipe && (
            <div className="scaling-container">
              <h3 className="scaling-title">
                Recipe Scaling
                <span className="current-batch-size">
                  (Current: {recipe.batch_size} gal)
                </span>
              </h3>
              <div className="scaling-input-group">
                <input
                  type="number"
                  id="scale-volume"
                  name="scale-volume"
                  placeholder="New batch size"
                  step="0.5"
                  min="0.5"
                  max="100"
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
            </div>
          )}

          {/* Recipe analysis section */}
          <div className="metrics-analysis">
            <h3 className="analysis-title">Recipe Analysis</h3>

            <div className="analysis-item">
              <span className="analysis-label">Strength:</span>
              <span className="analysis-value">
                {metrics.abv < 3.5
                  ? "Session"
                  : metrics.abv < 5.5
                  ? "Standard"
                  : metrics.abv < 8
                  ? "Strong"
                  : "Very Strong"}{" "}
                ({formatAbv(metrics.abv)})
              </span>
            </div>

            <div className="analysis-item">
              <span className="analysis-label">Bitterness:</span>
              <span className="analysis-value">
                {metrics.ibu < 15
                  ? "Low"
                  : metrics.ibu < 30
                  ? "Moderate"
                  : metrics.ibu < 50
                  ? "High"
                  : "Very High"}{" "}
                ({formatIbu(metrics.ibu)} IBU)
              </span>
            </div>

            <div className="analysis-item">
              <span className="analysis-label">Color:</span>
              <span className="analysis-value">
                {metrics.srm < 4
                  ? "Pale"
                  : metrics.srm < 8
                  ? "Gold"
                  : metrics.srm < 15
                  ? "Amber"
                  : metrics.srm < 25
                  ? "Brown"
                  : "Dark"}{" "}
                ({formatSrm(metrics.srm)} SRM)
              </span>
            </div>

            {/* Attenuation info if we have both OG and FG */}
            {metrics.og > 1.01 && metrics.fg > 1.0 && (
              <div className="analysis-item">
                <span className="analysis-label">Attenuation:</span>
                <span className="analysis-value">
                  {(
                    ((metrics.og - metrics.fg) / (metrics.og - 1.0)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RecipeMetrics;
