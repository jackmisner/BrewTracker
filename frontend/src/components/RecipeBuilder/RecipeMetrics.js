import React, { useState } from "react";

function RecipeMetrics({ metrics, onCalculate, onScale }) {
  const [scaleVolume, setScaleVolume] = useState("");

  const formatGravity = (gravity) => {
    return gravity ? parseFloat(gravity).toFixed(3) : "1.000";
  };

  const formatAbv = (abv) => {
    return abv ? `${parseFloat(abv).toFixed(1)}%` : "0.0%";
  };

  const formatIbu = (ibu) => {
    return ibu ? Math.round(ibu).toString() : "0";
  };

  const formatSrm = (srm) => {
    return srm ? parseFloat(srm).toFixed(1) : "0.0";
  };
  const getSrmColor = (srm) => {
    if (!srm || srm <= 0) return "#FFE699";
    if (srm > 0 && srm <= 2) return "#FFE699";
    if (srm > 2 && srm <= 3) return "#FFCA5A";
    if (srm > 3 && srm <= 4) return "#FFBF42";
    if (srm > 4 && srm <= 6) return "#FBB123";
    if (srm > 6 && srm <= 8) return "#F39C00";
    if (srm > 8 && srm <= 10) return "#E58500";
    if (srm > 10 && srm <= 13) return "#CF6900";
    if (srm > 13 && srm <= 17) return "#BB5100";
    if (srm > 17 && srm <= 20) return "#A13700";
    if (srm > 20 && srm <= 24) return "#8E2900";
    if (srm > 24 && srm <= 29) return "#701400";
    if (srm > 29 && srm <= 35) return "#600903";
    return "#3D0708"; // for srm > 35
  };

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
          <div className="metric-label">Color</div>
          <div id="srm-display" className="metric-value">
            {formatSrm(metrics.srm)} SRM
          </div>
        </div>
        <div
          id="color-swatch"
          className="color-swatch"
          style={{ backgroundColor: getSrmColor(metrics.srm) }}
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
