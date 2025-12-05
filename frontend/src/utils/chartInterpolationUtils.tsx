/**
 * Chart Data Interpolation Utilities
 * Provides functions to interpolate missing data points in fermentation tracking charts
 * for continuous line visualization while preserving data integrity.
 */
export interface ChartDataPoint {
  date: string; // ISO date string for calculations
  displayDate: string; // Formatted date for chart display
  gravity: number | null;
  temperature: number | null;
  ph: number | null;
  isInterpolated?: boolean; // Flag to indicate interpolated data points
}

interface PayloadEntry {
  value: number | null | undefined;
  name?: string;
  color?: string;
  dataKey?: string;
  payload?: ChartDataPoint;
}

// Custom tooltip props type matching Recharts TooltipContentProps
interface CustomTooltipProps {
  active?: boolean;
  payload?: readonly PayloadEntry[]; // Use PayloadEntry[] to match Recharts ReadonlyArray<any>
  label?: string | number;
  coordinate?: { x: number; y: number };
  [key: string]: any; // Allow additional properties from Recharts
}

/**
 * Linear interpolation between two values
 */
function linearInterpolate(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number
): number {
  if (x1 === x0) return y0; // Avoid division by zero
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * Find the next valid data point for a specific metric
 */
function findNextValidPoint(
  data: ChartDataPoint[],
  startIndex: number,
  metric: keyof Pick<ChartDataPoint, "gravity" | "temperature" | "ph">
): { index: number; value: number } | null {
  for (let i = startIndex; i < data.length; i++) {
    const value = data[i][metric];
    if (value !== null && value !== undefined) {
      return { index: i, value };
    }
  }
  return null;
}

/**
 * Find the previous valid data point for a specific metric
 */
function findPreviousValidPoint(
  data: ChartDataPoint[],
  startIndex: number,
  metric: keyof Pick<ChartDataPoint, "gravity" | "temperature" | "ph">
): { index: number; value: number } | null {
  for (let i = startIndex; i >= 0; i--) {
    const value = data[i][metric];
    if (value !== null && value !== undefined) {
      return { index: i, value };
    }
  }
  return null;
}

/**
 * Interpolate missing values for a specific metric between two known data points
 */
function interpolateMetric(
  data: ChartDataPoint[],
  metric: keyof Pick<ChartDataPoint, "gravity" | "temperature" | "ph">
): ChartDataPoint[] {
  const result = [...data];

  for (let i = 0; i < result.length; i++) {
    const currentValue = result[i][metric];

    // Skip if value is already present
    if (currentValue !== null && currentValue !== undefined) {
      continue;
    }

    // Find previous and next valid points
    const prevPoint = findPreviousValidPoint(result, i - 1, metric);
    const nextPoint = findNextValidPoint(result, i + 1, metric);

    // If we have both previous and next points, interpolate
    if (prevPoint && nextPoint) {
      const prevTime = new Date(result[prevPoint.index].date).getTime();
      const nextTime = new Date(result[nextPoint.index].date).getTime();
      const currentTime = new Date(result[i].date).getTime();

      const interpolatedValue = linearInterpolate(
        prevTime,
        prevPoint.value,
        nextTime,
        nextPoint.value,
        currentTime
      );

      result[i] = {
        ...result[i],
        [metric]: interpolatedValue,
        isInterpolated: true,
      };
    }
    // If we only have a previous point, use forward fill for boundary handling
    else if (prevPoint && !nextPoint) {
      result[i] = {
        ...result[i],
        [metric]: prevPoint.value,
        isInterpolated: true,
      };
    }
    // If we only have a next point, use backward fill for boundary handling
    else if (!prevPoint && nextPoint) {
      result[i] = {
        ...result[i],
        [metric]: nextPoint.value,
        isInterpolated: true,
      };
    }
    // If no valid points are found, leave as null
  }

  return result;
}

/**
 * Apply interpolation to chart data for all metrics
 */
export function interpolateChartData(data: ChartDataPoint[]): ChartDataPoint[] {
  if (!data || data.length === 0) {
    return data;
  }

  // Sort data by date to ensure proper interpolation
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Apply interpolation for each metric independently
  let result = interpolateMetric(sortedData, "gravity");
  result = interpolateMetric(result, "temperature");
  result = interpolateMetric(result, "ph");

  return result;
}

/**
 * Get raw chart data without interpolation (original behavior)
 */
export function getRawChartData(data: ChartDataPoint[]): ChartDataPoint[] {
  return data.map(point => ({
    ...point,
    isInterpolated: false,
  }));
}

/**
 * Check if any data point in the dataset has interpolated values
 */
export function hasInterpolatedData(data: ChartDataPoint[]): boolean {
  return data.some(point => point.isInterpolated === true);
}

/**
 * Get statistics about interpolated data
 */
export function getInterpolationStats(
  originalData: ChartDataPoint[],
  interpolatedData: ChartDataPoint[]
): {
  totalPoints: number;
  interpolatedPoints: number;
  interpolatedGravity: number;
  interpolatedTemperature: number;
  interpolatedPh: number;
} {
  const stats = {
    totalPoints: interpolatedData.length,
    interpolatedPoints: 0,
    interpolatedGravity: 0,
    interpolatedTemperature: 0,
    interpolatedPh: 0,
  };

  interpolatedData.forEach((point, index) => {
    if (point.isInterpolated) {
      stats.interpolatedPoints++;

      const originalPoint = originalData[index];
      if (originalPoint && originalPoint.date === point.date) {
        if (
          (originalPoint.gravity === null ||
            originalPoint.gravity === undefined) &&
          point.gravity !== null
        ) {
          stats.interpolatedGravity++;
        }
        if (
          (originalPoint.temperature === null ||
            originalPoint.temperature === undefined) &&
          point.temperature !== null
        ) {
          stats.interpolatedTemperature++;
        }
        if (
          (originalPoint.ph === null || originalPoint.ph === undefined) &&
          point.ph !== null
        ) {
          stats.interpolatedPh++;
        }
      }
    }
  });

  return stats;
}

/**
 * Create custom dot component for Recharts to show interpolated vs actual data
 * Note: Currently simplified to avoid type complexity with Recharts
 */
export function createCustomDot(_metric: string) {
  // For now, return undefined to use default dots
  // This can be enhanced later with proper Recharts typing
  return undefined;
}

function isValidMetric(key: unknown): key is "gravity" | "temperature" | "ph" {
  return key === "gravity" || key === "temperature" || key === "ph";
}

function formatMetricValue(
  dataKey: "gravity" | "temperature" | "ph",
  value: number
): string {
  switch (dataKey) {
    case "gravity":
      return value.toFixed(3);
    case "temperature":
      return Math.round(value).toString();
    case "ph":
      return value.toFixed(1);
  }
}

/**
 * Enhanced tooltip component that shows interpolated data indicators
 */
export const CustomTooltip = (props: CustomTooltipProps) => {
  const { active, payload, label } = props;

  if (!active || !payload || !payload.length) {
    return null;
  }

  // Type assertion for the payload data structure
  // Each entry in payload corresponds to a different series (gravity, temp, ph)
  // but they all share the same underlying data point
  const data = payload[0]?.payload;
  const isInterpolated = data?.isInterpolated ?? false;

  return (
    <div
      className="custom-tooltip"
      style={{
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        borderRadius: "4px",
        padding: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <p className="label" style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {label}
        {isInterpolated && (
          <span
            style={{
              color: "#888",
              fontSize: "12px",
              marginLeft: "8px",
              fontStyle: "italic",
            }}
          >
            {" "}
            (Contains estimated values)
          </span>
        )}
      </p>

      {payload.map((entry: PayloadEntry, index: number) => {
        // Safely extract properties from entry
        const value = entry?.value;
        const name = entry?.name || "";
        const color = entry?.color || "#000";
        const dataKey = entry?.dataKey;

        // Only process known metrics
        if (!isValidMetric(dataKey)) {
          return null;
        }

        if (value === null || value === undefined) {
          return null;
        }

        const isMetricInterpolated =
          data?.isInterpolated &&
          (dataKey === "gravity" ||
            dataKey === "temperature" ||
            dataKey === "ph");

        const formattedValue = formatMetricValue(dataKey, value);

        return (
          <p
            key={index}
            style={{
              color: color,
              margin: "4px 0",
              fontSize: "14px",
            }}
          >
            {`${name}: ${formattedValue}`}
            {isMetricInterpolated && (
              <span
                style={{
                  color: "#888",
                  fontSize: "11px",
                  marginLeft: "4px",
                  fontStyle: "italic",
                }}
              >
                {" "}
                *
              </span>
            )}
          </p>
        );
      })}

      {isInterpolated && (
        <p
          style={{
            fontSize: "11px",
            color: "#888",
            marginTop: "8px",
            fontStyle: "italic",
          }}
        >
          * Estimated value
        </p>
      )}
    </div>
  );
};

/**
 * Legacy function wrapper for backward compatibility
 */
export function createCustomTooltip() {
  return CustomTooltip;
}
