import React from "react";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
} from "@/utils/formatUtils";

interface StyleRange {
  minimum?: { value: number };
  maximum?: { value: number };
  min?: number;
  max?: number;
}

interface StyleRangeIndicatorProps {
  metricType: "og" | "fg" | "abv" | "ibu" | "srm";
  currentValue: number;
  styleRange: StyleRange;
  label: string;
  unit?: string;
}

const StyleRangeIndicator: React.FC<StyleRangeIndicatorProps> = ({
  metricType,
  currentValue,
  styleRange,
  label,
  unit = "",
}) => {
  // Extract min and max from style range (handle both formats)
  const minValue = styleRange?.minimum?.value ?? styleRange?.min;
  const maxValue = styleRange?.maximum?.value ?? styleRange?.max;

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
  const formatValue = (value: number): string => {
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
  const getIndicatorColor = (): string => {
    if (isInRange) {
      return "#10b981"; // Green
    } else {
      return "#ef4444"; // Red
    }
  };

  const getRangeBarColor = (): string => {
    if (isInRange) {
      return "#d1fae5"; // Light green
    } else {
      return "#fee2e2"; // Light red
    }
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
              backgroundColor: getIndicatorColor(),
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
    </div>
  );
};

export default StyleRangeIndicator;
