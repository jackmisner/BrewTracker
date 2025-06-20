import React from "react";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../../../utils/formatUtils";

function StyleRangeIndicator({
  metricType,
  currentValue,
  styleRange,
  label,
  unit = "",
  showColorSwatch = false,
}) {
  // Extract min and max from style range
  const minValue = styleRange?.minimum?.value;
  const maxValue = styleRange?.maximum?.value;

  // Return early if we don't have valid range data
  if (!minValue || !maxValue || minValue >= maxValue) {
    return null;
  }

  // Determine if current value is in range
  const isInRange = currentValue >= minValue && currentValue <= maxValue;

  // Calculate position percentage (can go beyond 0-100% for out-of-range values)
  const range = maxValue - minValue;
  const position = ((currentValue - minValue) / range) * 100;

  // Clamp position for visual display (but keep original for calculations)
  const clampedPosition = Math.max(0, Math.min(100, position));

  // Format values based on metric type
  const formatValue = (value) => {
    switch (metricType) {
      case "og":
      case "fg":
        return formatGravity(value);
      case "abv":
        return formatAbv(value);
      case "ibu":
        return formatIbu(value);
      case "srm":
        return formatSrm(value);
      default:
        return value.toFixed(1);
    }
  };

  // Get appropriate colors based on whether value is in range
  const getIndicatorColor = () => {
    if (isInRange) {
      return "#10b981"; // Green
    } else {
      return "#ef4444"; // Red
    }
  };

  const getRangeBarColor = () => {
    if (isInRange) {
      return "#d1fae5"; // Light green
    } else {
      return "#fee2e2"; // Light red
    }
  };

  // Special handling for SRM color display
  const getCurrentSrmColor = () => {
    if (metricType === "srm") {
      return getSrmColour(currentValue);
    }
    return getIndicatorColor();
  };

  return (
    <div className="style-range-indicator">
      <div className="range-header">
        <span className="range-label">{label}</span>
        <div className="range-values">
          <span
            className="current-value"
            style={{ color: getIndicatorColor() }}
          >
            {formatValue(currentValue)}
          </span>
          <span className="target-range">
            ({formatValue(minValue)} - {formatValue(maxValue)}
            {unit})
          </span>
        </div>
      </div>

      <div className="range-bar-container">
        {/* Range bar background */}
        <div
          className="range-bar-track"
          style={{ backgroundColor: getRangeBarColor() }}
        >
          {/* Valid range section */}
          <div className="range-bar-valid-section" />

          {/* Current value indicator */}
          <div
            className="range-bar-indicator"
            style={{
              left: `${clampedPosition}%`,
              backgroundColor:
                metricType === "srm"
                  ? getCurrentSrmColor()
                  : getIndicatorColor(),
              borderColor: isInRange ? "#10b981" : "#ef4444",
            }}
          >
            {/* Show arrow if value is out of bounds */}
            {position < 0 && <div className="out-of-bounds-arrow left">←</div>}
            {position > 100 && (
              <div className="out-of-bounds-arrow right">→</div>
            )}
          </div>
        </div>

        {/* Range labels */}
        <div className="range-labels">
          <span className="range-min">{formatValue(minValue)}</span>
          <span className="range-max">{formatValue(maxValue)}</span>
        </div>
      </div>

      {/* Status indicator */}
      <div
        className={`range-status ${isInRange ? "in-range" : "out-of-range"}`}
      >
        <span className="status-icon">{isInRange ? "✓" : "✗"}</span>
        <span className="status-text">
          {isInRange
            ? "Within style guidelines"
            : position < 0
            ? `${Math.abs(position).toFixed(1)}% below minimum`
            : position > 100
            ? `${(position - 100).toFixed(1)}% above maximum`
            : "Out of range"}
        </span>
      </div>

      {/* Optional color swatch for SRM */}
      {showColorSwatch && metricType === "srm" && (
        <div className="srm-color-comparison">
          <div className="color-swatch-container">
            <div
              className="color-swatch current"
              style={{ backgroundColor: getCurrentSrmColor() }}
              title={`Current: ${formatValue(currentValue)} SRM`}
            />
            <span className="swatch-label">Current</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StyleRangeIndicator;
