import React, { useState } from "react";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../../utils/recipeCalculations";

function RecipeMetrics({ metrics, onCalculate, onScale }) {
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
    }
  };

  return (
    <div className="metrics-container">
      <h2 className="card-title">Recipe Metrics</h2>

      <div className="metrics-grid">
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

      <div className="color-display">
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
        ></div>
      </div>

      <div className="balance-meter-container">
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

      <div className="scaling-container">
        <h3 className="scaling-title">Recipe Scaling</h3>
        <div className="scaling-input-group">
          <input
            type="number"
            id="scale-volume"
            name="scale-volume"
            placeholder="New batch size"
            step="0.1"
            min="0.1"
            value={scaleVolume}
            onChange={(e) => setScaleVolume(e.target.value)}
            className="scaling-input"
          />
          <button
            id="scale-recipe-btn"
            type="button"
            onClick={handleScaleSubmit}
            className="scaling-button"
          >
            Scale
          </button>
        </div>
      </div>

      <button
        id="calculate-recipe-btn"
        type="button"
        onClick={onCalculate}
        className="calculate-button mt-6"
      >
        Calculate Recipe
      </button>
    </div>
  );
}

export default RecipeMetrics;
