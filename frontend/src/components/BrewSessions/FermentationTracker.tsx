import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Services } from "../../services";
import { useUnits } from "../../contexts/UnitContext";
import GravityStabilizationAnalysis from "./GravityStabilizationAnalysis";
import DryHopTracker from "./DryHopTracker";
import { FermentationEntry, BrewSession, Recipe, ID } from "../../types";
import {
  formatGravity,
  formatAttenuation,

} from "../../utils/formatUtils";
import "../../styles/BrewSessions.css";

interface FermentationTrackerProps {
  sessionId: ID;
  recipeData?: Partial<Recipe>;
  sessionData?: Partial<BrewSession>;
  onUpdateSession?: (updateData: Partial<BrewSession>) => void;
}

interface FormData {
  gravity: string;
  temperature: string;
  ph: string;
  notes: string;
}

interface ChartData {
  date: string; // ISO date string for calculations
  displayDate: string; // Formatted date for chart display
  gravity: number | null;
  temperature: number | null;
  ph: number | null;
}

interface FermentationStatsWithDefaults {
  duration_days?: number;
  gravity_drop?: number;
  average_temperature?: number;
  current_attenuation?: number;
  projected_fg?: number;
  gravity?: {
    initial: number | null;
    current: number | null;
    drop: number | null;
    attenuation: number | null;
  };
  temperature?: {
    min: number | null;
    max: number | null;
    avg: number | null;
  };
  ph?: {
    min: number | null;
    max: number | null;
    avg: number | null;
    data: number[];
  };
}

const FermentationTracker: React.FC<FermentationTrackerProps> = ({
  sessionId,
  recipeData = {},
  sessionData = {},
  onUpdateSession,
}) => {
  const { unitSystem } = useUnits();
  const [fermentationData, setFermentationData] = useState<FermentationEntry[]>(
    []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<FermentationStatsWithDefaults | null>(
    null
  );
  const [formData, setFormData] = useState<FormData>({
    gravity: "",
    temperature: "",
    ph: "",
    notes: "",
  });
  const [showForm, setShowForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [initialOGSet, setInitialOGSet] = useState<boolean>(false);

  // Fetch fermentation data
  const fetchFermentationData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(""); // Clear any existing errors

      // Fetch fermentation data entries
      const fermentationData = await Services.brewSession.getFermentationData(
        sessionId
      );
      setFermentationData(fermentationData);

      // Fetch fermentation statistics
      try {
        const statsData = await Services.brewSession.getFermentationStats(
          sessionId
        );
        if (statsData) {
          setStats(statsData);
        } else {
          setStats({
            duration_days: 0,
            gravity_drop: 0,
            average_temperature: 0,
            current_attenuation: 0,
            projected_fg: 0,
            gravity: {
              initial: null,
              current: null,
              drop: null,
              attenuation: null,
            },
            temperature: {
              min: null,
              max: null,
              avg: null,
            },
            ph: {
              min: null,
              max: null,
              avg: null,
              data: [],
            },
          });
        }
      } catch (statsErr) {
        console.warn("Error fetching fermentation stats:", statsErr);
        // Don't set error for stats failure, just use default empty stats
        setStats({
          duration_days: 0,
          gravity_drop: 0,
          average_temperature: 0,
          current_attenuation: 0,
          projected_fg: 0,
          gravity: {
            initial: null,
            current: null,
            drop: null,
            attenuation: null,
          },
          temperature: { min: null, max: null, avg: null },
          ph: { min: null, max: null, avg: null, data: [] },
        });
      }
    } catch (err: any) {
      console.error("Error fetching fermentation data:", err);

      // Only set error for critical failures that prevent data loading
      if (err.response?.status === 404) {
        setError("Brew session not found.");
        setFermentationData([]);
        setStats(null);
      } else if (err.response?.status === 403) {
        setError("Access denied to fermentation data.");
        setFermentationData([]);
        setStats(null);
      } else {
        // For other errors, try to continue with empty data but don't block UI
        console.warn("Non-critical error fetching fermentation data:", err);
        setFermentationData([]);
        setStats(null);
        // Clear any existing errors since we can still show empty state
        setError("");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchFermentationData();
  }, [sessionId, fetchFermentationData]);

  // Set initial OG reading if session has actual_og but no fermentation data
  useEffect(() => {
    if (
      !loading && // Only trigger after loading is complete - FIXES RACE CONDITION
      !initialOGSet &&
      fermentationData.length === 0 &&
      sessionData.actual_og &&
      sessionData.status === "fermenting"
    ) {
      setFormData((prev) => ({
        ...prev,
        gravity: sessionData.actual_og!.toString(),
      }));
      setShowForm(true);
      setInitialOGSet(true);
    }
  }, [fermentationData, sessionData, initialOGSet, loading]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    try {
      setSubmitting(true);

      // Format data for submission (no temperature conversion - backend will handle storage)
      const entry = {
        gravity: formData.gravity ? parseFloat(formData.gravity) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        ph: formData.ph ? parseFloat(formData.ph) : undefined,
        notes: formData.notes || undefined,
        entry_date: new Date().toISOString(),
      };

      // Submit data
      await Services.brewSession.addFermentationEntry(sessionId, entry, unitSystem);

      // Update the brew session if this is the first gravity reading
      if (fermentationData.length === 0 && entry.gravity) {
        // If this is the first entry and the session doesn't have an OG, update it
        if (!sessionData.actual_og) {
          const sessionUpdateData: Partial<BrewSession> = {
            actual_og: entry.gravity,
          };

          await Services.brewSession.updateBrewSession(
            sessionId,
            sessionUpdateData
          );

          // Notify parent component of the update
          if (onUpdateSession) {
            onUpdateSession(sessionUpdateData);
          }
        }
      }

      // Note: Gravity stabilization is now handled by the intelligent analysis component
      // which provides more sophisticated detection and user confirmation

      // Reset form
      setFormData({
        gravity: "",
        temperature: "",
        ph: "",
        notes: "",
      });

      // Refresh data
      fetchFermentationData();

      // Hide form after submit
      setShowForm(false);
    } catch (err: any) {
      console.error("Error adding fermentation entry:", err);
      setError("Failed to add fermentation entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        await Services.brewSession.deleteFermentationEntry(sessionId, index);
        fetchFermentationData(); // Refresh data
      } catch (err: any) {
        console.error("Error deleting fermentation entry:", err);
        setError("Failed to delete fermentation entry");
      }
    }
  };

  const handleAcceptCompletionSuggestion = async (): Promise<void> => {
    try {
      if (!sessionData || sessionData.status === "completed") {
        return;
      }

      // Get the latest gravity reading for final gravity
      const latestGravityEntry = [...fermentationData]
        .reverse()
        .find((entry) => entry.gravity);

      if (!latestGravityEntry?.gravity) {
        setError("No gravity reading available to set as final gravity");
        return;
      }

      const updateData: Partial<BrewSession> = {
        status: "completed",
        actual_fg: latestGravityEntry.gravity,
        fermentation_end_date: new Date().toISOString().split("T")[0], // Today's date
      };

      // Calculate ABV if we have OG
      if (sessionData.actual_og) {
        updateData.actual_abv =
          (sessionData.actual_og - latestGravityEntry.gravity) * 131.25;
      }

      await Services.brewSession.updateBrewSession(sessionId, updateData);

      // Notify parent component of the update
      if (onUpdateSession) {
        onUpdateSession(updateData);
      }

      // Refresh data to reflect changes
      fetchFermentationData();
    } catch (err: any) {
      console.error("Error updating session to completed:", err);
      setError("Failed to mark session as completed");
    }
  };

  // Format data for the chart
  const formatChartData = (): ChartData[] => {
    if (!fermentationData || fermentationData.length === 0) {
      return [];
    }

    return fermentationData.map((entry) => ({
      date: entry.entry_date, // Keep ISO date for calculations
      displayDate: new Date(entry.entry_date).toLocaleDateString(), // Formatted for display
      gravity: entry.gravity || null,
      temperature: entry.temperature || null,
      ph: entry.ph || null,
    }));
  };

  const chartData = formatChartData();

  // Calculate gravity domain for chart Y-axis
  const calculateGravityDomain = (): [number, number] => {
    // Get the actual OG from session data, fallback to recipe estimate, then to highest gravity reading
    let actualOG = sessionData?.actual_og || recipeData?.estimated_og;
    
    // If we have gravity readings, use the highest one as potential OG
    if (!actualOG && chartData && chartData.length > 0) {
      const gravityValues = chartData
        .map(entry => entry.gravity)
        .filter((gravity): gravity is number => gravity !== null);
      
      if (gravityValues.length > 0) {
        actualOG = Math.max(...gravityValues);
      }
    }

    // Set domain based on OG: 1.000 to OG + 10 gravity points (0.010)
    if (actualOG) {
      return [1.000, actualOG + 0.010];
    }

    // Fallback if no OG data available
    return [1.000, 1.100];
  };

  const gravityDomain = calculateGravityDomain();

  // Calculate fermentation rate (daily gravity drop)
  const calculateFermentationRate = (): { dailyRate: number | null; analysis: string } => {
    if (!chartData || chartData.length < 2) {
      return { dailyRate: null, analysis: "Need at least 2 readings to calculate rate" };
    }

    const validEntries = chartData.filter(entry => entry.gravity !== null);
    if (validEntries.length < 2) {
      return { dailyRate: null, analysis: "Need at least 2 gravity readings" };
    }

    try {
      // Sort by date to ensure proper calculation (using ISO date string)
      const sortedEntries = [...validEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Calculate rate between last two readings
      const latest = sortedEntries[sortedEntries.length - 1];
      const previous = sortedEntries[sortedEntries.length - 2];
      
      const latestDate = new Date(latest.date);
      const previousDate = new Date(previous.date);
      
      // Validate dates
      if (isNaN(latestDate.getTime()) || isNaN(previousDate.getTime())) {
        return { dailyRate: null, analysis: "Invalid date format in readings" };
      }
      
      const gravityDrop = (previous.gravity! - latest.gravity!);
      const timeDiff = latestDate.getTime() - previousDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 0) {
        return { dailyRate: null, analysis: "Readings taken on same day or invalid date order" };
      }

      const dailyRate = gravityDrop / daysDiff;
      
      // Validate the result
      if (isNaN(dailyRate)) {
        return { dailyRate: null, analysis: "Error calculating fermentation rate" };
      }
      
      // Provide analysis
      let analysis = "";
      if (dailyRate > 0.008) {
        analysis = "Very fast fermentation";
      } else if (dailyRate > 0.004) {
        analysis = "Active fermentation";
      } else if (dailyRate > 0.001) {
        analysis = "Slow fermentation";
      } else if (dailyRate > 0) {
        analysis = "Very slow fermentation";
      } else {
        analysis = "Fermentation may have stalled";
      }

      return { dailyRate, analysis };
    } catch (error) {
      console.error("Error calculating fermentation rate:", error);
      return { dailyRate: null, analysis: "Error calculating fermentation rate" };
    }
  };

  const fermentationRate = calculateFermentationRate();

  // Calculate fermentation phase markers
  const calculatePhaseMarkers = (): Array<{ date: string; phase: string; label: string; color: string }> => {
    const markers: Array<{ date: string; phase: string; label: string; color: string }> = [];
    
    // Add fermentation start marker
    if (sessionData?.fermentation_start_date) {
      markers.push({
        date: sessionData.fermentation_start_date,
        phase: "start",
        label: "Fermentation Start",
        color: "#28a745"
      });
    }
    
    // Add dry hop markers from the session data
    if (sessionData?.dry_hop_additions && sessionData.dry_hop_additions.length > 0) {
      sessionData.dry_hop_additions.forEach((addition) => {
        markers.push({
          date: addition.addition_date,
          phase: "dry_hop_add",
          label: `Dry Hop: ${addition.hop_name}`,
          color: "#ffc107"
        });
        
        // Add removal marker if present
        if (addition.removal_date) {
          markers.push({
            date: addition.removal_date,
            phase: "dry_hop_remove",
            label: `Remove: ${addition.hop_name}`,
            color: "#fd7e14"
          });
        }
      });
    }
    
    // Add fermentation end marker
    if (sessionData?.fermentation_end_date) {
      markers.push({
        date: sessionData.fermentation_end_date,
        phase: "end",
        label: "Fermentation End",
        color: "#dc3545"
      });
    }
    
    // Add packaging marker
    if (sessionData?.packaging_date) {
      markers.push({
        date: sessionData.packaging_date,
        phase: "packaging",
        label: "Packaging",
        color: "#6f42c1"
      });
    }
    
    return markers.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const phaseMarkers = calculatePhaseMarkers();

  // Calculate attenuation if possible
  const calculateAttenuation = (): string | null => {
    if (fermentationData.length < 2) {
      return null;
    }

    // Get first and last gravity readings
    const firstReading = fermentationData.find((entry) => entry.gravity);
    const lastReading = [...fermentationData]
      .reverse()
      .find((entry) => entry.gravity);

    if (!firstReading || !lastReading || firstReading === lastReading) {
      return null;
    }

    const attenuation =
      ((firstReading.gravity! - lastReading.gravity!) /
        (firstReading.gravity! - 1.0)) *
      100;
    return formatAttenuation(attenuation).replace("%", ""); // Remove % since it's added separately
  };

  const attenuation = calculateAttenuation();

  return (
    <div className="fermentation-tracker">
      <div className="fermentation-header">
        <h2 className="fermentation-title">Fermentation Tracking</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? "Cancel" : "Add Entry"}
        </button>
      </div>

      {/* Form for adding new fermentation data */}
      {showForm && (
        <div className="fermentation-form">
          <h3 className="fermentation-form-title">New Fermentation Reading</h3>
          <form onSubmit={handleSubmit}>
            <div className="fermentation-form-grid">
              <div className="fermentation-input-group">
                <label htmlFor="gravity" className="fermentation-input-label">
                  Gravity
                </label>
                <input
                  type="number"
                  step="0.001"
                  id="gravity"
                  name="gravity"
                  placeholder="e.g. 1.050"
                  value={formData.gravity}
                  onChange={handleChange}
                  className="fermentation-input"
                />
              </div>
              <div className="fermentation-input-group">
                <label
                  htmlFor="temperature"
                  className="fermentation-input-label"
                >
                  Temperature ({unitSystem === "metric" ? "°C" : "°F"})
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="temperature"
                  name="temperature"
                  placeholder={unitSystem === "metric" ? "e.g. 20.0" : "e.g. 68.5"}
                  value={formData.temperature}
                  onChange={handleChange}
                  className="fermentation-input"
                />
              </div>
              <div className="fermentation-input-group">
                <label htmlFor="ph" className="fermentation-input-label">
                  pH (optional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="ph"
                  name="ph"
                  placeholder="e.g. 4.5"
                  value={formData.ph}
                  onChange={handleChange}
                  className="fermentation-input"
                />
              </div>
            </div>
            <div className="fermentation-input-group">
              <label htmlFor="notes" className="fermentation-input-label">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Any observations about the fermentation"
                value={formData.notes}
                onChange={handleChange}
                className="fermentation-textarea"
              />
            </div>
            <div className="fermentation-form-actions">
              <button
                type="submit"
                disabled={submitting}
                className="fermentation-submit-button"
              >
                {submitting ? "Saving..." : "Save Reading"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-message">Loading fermentation data...</div>
      ) : (
        <>
          {/* Fermentation stats summary - only show if we have stats */}
          {stats && (
            <div className="fermentation-stats">
              <div className="fermentation-stat-card">
                <h3 className="fermentation-stat-title">Gravity</h3>
                {stats.gravity?.initial && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Initial:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(stats.gravity.initial)}
                    </span>
                  </div>
                )}
                {stats.gravity?.current && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Current:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(stats.gravity.current)}
                    </span>
                  </div>
                )}
                {stats.gravity?.drop && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Drop:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(stats.gravity.drop)}
                    </span>
                  </div>
                )}
                {stats.gravity?.attenuation && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">
                      Attenuation:
                    </span>
                    <span className="fermentation-stat-value">
                      {formatAttenuation(stats.gravity.attenuation)}
                    </span>
                  </div>
                )}
              </div>

              <div className="fermentation-stat-card">
                <h3 className="fermentation-stat-title">Temperature</h3>
                {stats.temperature?.min !== null &&
                  stats.temperature?.min !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Min:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(stats.temperature.min)}°{unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
                {stats.temperature?.max !== null &&
                  stats.temperature?.max !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Max:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(stats.temperature.max)}°{unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
                {stats.temperature?.avg !== null &&
                  stats.temperature?.avg !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Avg:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(stats.temperature.avg)}°{unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
              </div>

              {stats.ph?.data && stats.ph.data.length > 0 && (
                <div className="fermentation-stat-card">
                  <h3 className="fermentation-stat-title">pH</h3>
                  {stats.ph?.min !== null && stats.ph?.min !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Min:</span>
                      <span className="fermentation-stat-value">
                        {stats.ph.min.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {stats.ph?.max !== null && stats.ph?.max !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Max:</span>
                      <span className="fermentation-stat-value">
                        {stats.ph.max.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {stats.ph?.avg !== null && stats.ph?.avg !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Avg:</span>
                      <span className="fermentation-stat-value">
                        {stats.ph.avg.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Fermentation Rate Card */}
              {fermentationRate.dailyRate !== null && (
                <div className="fermentation-stat-card">
                  <h3 className="fermentation-stat-title">Fermentation Rate</h3>
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Daily Drop:</span>
                    <span className="fermentation-stat-value">
                      {(fermentationRate.dailyRate * 1000).toFixed(1)} pts/day
                    </span>
                  </div>
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Status:</span>
                    <span className="fermentation-stat-value">
                      {fermentationRate.analysis}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gravity Stabilization Analysis - only show if we have enough data and session is not completed */}
          {fermentationData.length >= 3 &&
            sessionData?.status !== "completed" &&
            sessionData?.status === "fermenting" && (
              <div className="brew-session-section">
                <GravityStabilizationAnalysis
                  sessionId={sessionId}
                  onSuggestCompletion={handleAcceptCompletionSuggestion}
                />
              </div>
            )}

          {/* Expected vs actual visualization */}
          {recipeData.estimated_og && recipeData.estimated_fg && (
            <div className="brew-session-section">
              <h3 className="section-title">
                Expected vs. Actual Fermentation
              </h3>
              <div className="fermentation-comparison">
                <div className="fermentation-comparison-row">
                  <div className="fermentation-comparison-col">
                    <span className="fermentation-comparison-label">
                      Expected OG
                    </span>
                    <div className="fermentation-comparison-value">
                      {formatGravity(recipeData.estimated_og)}
                    </div>
                  </div>
                  <div className="fermentation-comparison-col">
                    <span className="fermentation-comparison-label">
                      Expected FG
                    </span>
                    <div className="fermentation-comparison-value">
                      {formatGravity(recipeData.estimated_fg)}
                    </div>
                  </div>
                  <div className="fermentation-comparison-col">
                    <span className="fermentation-comparison-label">
                      Expected Attenuation
                    </span>
                    <div className="fermentation-comparison-value">
                      {(
                        ((recipeData.estimated_og - recipeData.estimated_fg) /
                          (recipeData.estimated_og - 1.0)) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>

                {/* Actual readings */}
                {fermentationData.length > 0 && (
                  <div className="fermentation-comparison-row">
                    <div className="fermentation-comparison-col">
                      <span className="fermentation-comparison-label">
                        Actual OG
                      </span>
                      <div className="fermentation-comparison-value">
                        {fermentationData[0].gravity
                          ? formatGravity(fermentationData[0].gravity)
                          : "-"}
                      </div>
                    </div>
                    <div className="fermentation-comparison-col">
                      <span className="fermentation-comparison-label">
                        Current Gravity
                      </span>
                      <div className="fermentation-comparison-value">
                        {fermentationData[fermentationData.length - 1].gravity
                          ? formatGravity(
                              fermentationData[fermentationData.length - 1]
                                .gravity!
                            )
                          : "-"}
                      </div>
                    </div>
                    <div className="fermentation-comparison-col">
                      <span className="fermentation-comparison-label">
                        Current Attenuation
                      </span>
                      <div className="fermentation-comparison-value">
                        {attenuation ? `${attenuation}%` : "-"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chart visualization - only show if we have data */}
          {chartData && chartData.length > 0 && (
            <div className="brew-session-section">
              <h3 className="section-title">Fermentation Progress</h3>
              <div className="fermentation-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" />
                    <YAxis yAxisId="gravity" domain={gravityDomain} />
                    <YAxis
                      yAxisId="temp"
                      orientation="right"
                      domain={["auto", "auto"]}
                    />
                    <Tooltip />
                    <Legend />
                    
                    {/* Target FG Reference Line */}
                    {recipeData.estimated_fg && chartData && chartData.length > 0 && (
                      <ReferenceLine
                        y={recipeData.estimated_fg}
                        yAxisId="gravity"
                        stroke="#ff7300"
                        strokeDasharray="5 5"
                        label={{ value: `Target FG: ${formatGravity(recipeData.estimated_fg)}`, position: "right" }}
                      />
                    )}
                    
                    {/* Fermentation Phase Markers */}
                    {chartData && chartData.length > 0 && phaseMarkers && phaseMarkers.length > 0 && phaseMarkers.map((marker, index) => {
                      // Convert marker date to display format to match chart data
                      const displayDate = new Date(marker.date).toLocaleDateString();
                      return (
                        <ReferenceLine
                          key={`phase-${index}`}
                          x={displayDate}
                          yAxisId="gravity"
                          stroke={marker.color}
                          strokeDasharray="3 3"
                          strokeWidth={2}
                          label={{
                            value: marker.label,
                            position: "top",
                            offset: 5,
                            style: { fontSize: "12px", fill: marker.color, fontWeight: "bold" }
                          }}
                        />
                      );
                    })}
                    
                    <Line
                      yAxisId="gravity"
                      type="monotone"
                      dataKey="gravity"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                      name="Gravity"
                    />
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temperature"
                      stroke="#82ca9d"
                      name={`Temperature (${unitSystem === "metric" ? "°C" : "°F"})`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Fermentation Phase Timeline */}
          {phaseMarkers.length > 0 && (
            <div className="brew-session-section">
              <h3 className="section-title">Fermentation Timeline</h3>
              <div className="fermentation-timeline">
                {phaseMarkers.map((marker, index) => (
                  <div key={`timeline-${index}`} className="timeline-item">
                    <div 
                      className="timeline-marker" 
                      style={{ backgroundColor: marker.color }}
                    ></div>
                    <div className="timeline-content">
                      <div className="timeline-date">
                        {new Date(marker.date).toLocaleDateString()} {new Date(marker.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="timeline-label">{marker.label}</div>
                      {marker.phase === "dry_hop_add" && sessionData?.dry_hop_additions && (
                        <div className="timeline-details">
                          {(() => {
                            const addition = sessionData.dry_hop_additions.find(
                              (add) => add.addition_date === marker.date
                            );
                            return addition ? `${addition.amount} ${addition.amount_unit} - ${addition.hop_type || 'Pellet'}` : '';
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="brew-session-section">
            <h3 className="section-title">Fermentation Data Log</h3>
            {error && (
              <div className="error-message" style={{ marginBottom: "1rem" }}>
                {error}
              </div>
            )}
            {(() => {
              return fermentationData.length === 0;
            })() ? (
              <div className="empty-message">
                <p>No fermentation data recorded yet.</p>
                <p>
                  Use the "Add Entry" button above to start tracking your
                  fermentation progress.
                </p>
              </div>
            ) : (
              <div className="fermentation-table-responsive">
                <table className="fermentation-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Gravity</th>
                      <th>Temperature</th>
                      <th>pH</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fermentationData.map((entry, index) => (
                      <tr key={index}>
                        <td>
                          {new Date(entry.entry_date).toLocaleDateString()}{" "}
                          {new Date(entry.entry_date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          {entry.gravity ? formatGravity(entry.gravity) : "-"}
                        </td>
                        <td>
                          {entry.temperature
                            ? `${Math.round(entry.temperature)}°${unitSystem === "metric" ? "C" : "F"}`
                            : "-"}
                        </td>
                        <td>{entry.ph ? entry.ph.toFixed(1) : "-"}</td>
                        <td>{entry.notes || "-"}</td>
                        <td>
                          <button
                            onClick={() => handleDelete(index)}
                            className="fermentation-delete-button"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dry Hop Tracking */}
          <DryHopTracker 
            sessionId={sessionId}
            recipeData={recipeData}
            onSessionUpdate={onUpdateSession}
          />
        </>
      )}
    </div>
  );
};

export default FermentationTracker;
