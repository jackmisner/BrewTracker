import React, { useReducer, useEffect, useCallback, useRef } from "react";
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
import { formatGravity, formatAttenuation } from "../../utils/formatUtils";
import {
  fermentationReducer,
  createInitialFermentationState,
  FormData,
  validateField,
} from "../../reducers";
import "../../styles/BrewSessions.css";

interface FermentationTrackerProps {
  sessionId: ID;
  recipeData?: Partial<Recipe>;
  sessionData?: Partial<BrewSession>;
  onUpdateSession?: (
    updateData: Partial<BrewSession> & { needsRefresh?: boolean }
  ) => void;
}

interface ChartData {
  date: string; // ISO date string for calculations
  displayDate: string; // Formatted date for chart display
  gravity: number | null;
  temperature: number | null;
  ph: number | null;
}

const FermentationTracker: React.FC<FermentationTrackerProps> = ({
  sessionId,
  recipeData = {},
  sessionData = {},
  onUpdateSession,
}) => {
  const { unitSystem } = useUnits();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Initialize state with reducer
  const [state, dispatch] = useReducer(
    fermentationReducer,
    createInitialFermentationState()
  );

  // Focus input when editing starts
  useEffect(() => {
    if (state.editing.isEditing && inputRef.current) {
      inputRef.current.focus();
      // Only call select() on input elements that support it
      if (
        inputRef.current instanceof HTMLInputElement &&
        typeof inputRef.current.select === "function"
      ) {
        inputRef.current.select();
      }
    }
  }, [state.editing.isEditing]);

  // Fetch fermentation data
  const fetchFermentationData = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'LOAD_START' });

      // Fetch fermentation data entries
      const fermentationData = await Services.brewSession.getFermentationData(
        sessionId
      );

      // Fetch fermentation statistics
      let statsData = null;
      try {
        statsData = await Services.brewSession.getFermentationStats(sessionId);
      } catch (statsErr) {
        console.warn("Error fetching fermentation stats:", statsErr);
        // Don't fail the entire load for stats errors
      }

      dispatch({ 
        type: 'LOAD_SUCCESS', 
        payload: { data: fermentationData, stats: statsData } 
      });
    } catch (err: any) {
      console.error("Error fetching fermentation data:", err);

      // Only set error for critical failures that prevent data loading
      if (err.response?.status === 404) {
        dispatch({ type: 'LOAD_ERROR', payload: "Brew session not found." });
      } else if (err.response?.status === 403) {
        dispatch({ type: 'LOAD_ERROR', payload: "Access denied to fermentation data." });
      } else {
        // For other errors, try to continue with empty data but don't block UI
        console.warn("Non-critical error fetching fermentation data:", err);
        dispatch({ 
          type: 'LOAD_SUCCESS', 
          payload: { data: [], stats: null } 
        });
      }
    }
  }, [sessionId]);

  useEffect(() => {
    fetchFermentationData();
  }, [sessionId, fetchFermentationData]);

  // Set initial OG reading if session has actual_og but no fermentation data
  useEffect(() => {
    if (
      !state.loading && // Only trigger after loading is complete
      !state.initialOGSet &&
      state.fermentationData.length === 0 &&
      sessionData.actual_og &&
      sessionData.status === "fermenting"
    ) {
      dispatch({ type: 'SET_INITIAL_OG', payload: sessionData.actual_og.toString() });
    }
  }, [state.fermentationData, sessionData, state.initialOGSet, state.loading]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    dispatch({ 
      type: 'UPDATE_FORM_FIELD', 
      payload: { field: name as keyof FormData, value } 
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    try {
      dispatch({ type: 'SUBMIT_START' });

      // Format data for submission
      const entry = {
        gravity: state.formData.gravity ? parseFloat(state.formData.gravity) : undefined,
        temperature: state.formData.temperature
          ? parseFloat(state.formData.temperature)
          : undefined,
        ph: state.formData.ph ? parseFloat(state.formData.ph) : undefined,
        notes: state.formData.notes || undefined,
        entry_date: new Date().toISOString(),
      };

      // Submit data
      await Services.brewSession.addFermentationEntry(
        sessionId,
        entry,
        unitSystem
      );

      // Update the brew session if this is the first gravity reading
      if (state.fermentationData.length === 0 && entry.gravity) {
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

      // Refresh data
      await fetchFermentationData();
      dispatch({ type: 'RESET_FORM' });
    } catch (err: any) {
      console.error("Error adding fermentation entry:", err);
      dispatch({ type: 'SUBMIT_ERROR', payload: "Failed to add fermentation entry" });
    }
  };

  const handleDelete = async (index: number): Promise<void> => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        await Services.brewSession.deleteFermentationEntry(sessionId, index);
        await fetchFermentationData(); // Refresh data
      } catch (err: any) {
        console.error("Error deleting fermentation entry:", err);
        dispatch({ type: 'DELETE_ENTRY_ERROR', payload: "Failed to delete fermentation entry" });
      }
    }
  };

  const handleAcceptCompletionSuggestion = async (): Promise<void> => {
    try {
      if (!sessionData || sessionData.status === "completed") {
        return;
      }

      // Get the latest gravity reading for final gravity
      const latestGravityEntry = [...state.fermentationData]
        .reverse()
        .find((entry) => entry.gravity);

      if (!latestGravityEntry?.gravity) {
        dispatch({ type: 'SET_ERROR', payload: "No gravity reading available to set as final gravity" });
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

      // Notify parent component of the update with refresh flag
      if (onUpdateSession) {
        onUpdateSession({ ...updateData, needsRefresh: true });
      }

      // Refresh fermentation data to reflect changes
      await fetchFermentationData();
    } catch (err: any) {
      console.error("Error updating session to completed:", err);
      dispatch({ type: 'SET_ERROR', payload: "Failed to mark session as completed" });
    }
  };

  // Start editing a cell
  const startEdit = (
    entryIndex: number,
    field: string,
    currentValue: any
  ): void => {
    let editValue = currentValue?.toString() || "";
    
    // Special handling for date and time fields
    if (field === "entry_date" && currentValue) {
      editValue = currentValue.split('T')[0];
    } else if (field === "entry_time" && currentValue) {
      const date = new Date(currentValue);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      editValue = `${hours}:${minutes}`;
    }
    
    dispatch({ 
      type: 'START_EDIT', 
      payload: { 
        entryIndex, 
        field, 
        value: editValue, 
        originalValue: editValue 
      } 
    });
  };

  // Cancel editing
  const cancelEdit = (): void => {
    dispatch({ type: 'CANCEL_EDIT' });
  };

  // Save the edited value
  const saveEdit = async (): Promise<void> => {
    const { entryIndex, field } = state.editing;
    if (entryIndex === null || !field) return;

    // Check if the value actually changed
    if (state.editing.value === state.editing.originalValue) {
      cancelEdit();
      return;
    }

    const entry = state.fermentationData[entryIndex];
    if (!entry) {
      cancelEdit();
      return;
    }

    // Validate the new value
    const validation = validateField(field, state.editing.value, unitSystem);
    if (!validation.isValid) {
      dispatch({ type: 'VALIDATE_EDIT', payload: validation.error || "Invalid value" });
      return;
    }

    // Prepare updated entry
    let updatedEntry: Partial<FermentationEntry> = { ...entry };

    // Special handling for date and time fields
    if (field === "entry_date" || field === "entry_time") {
      const currentISOString = entry.entry_date;
      
      if (field === "entry_date") {
        const timeOnly = currentISOString.split('T')[1];
        const newISOString = `${validation.value}T${timeOnly}`;
        updatedEntry.entry_date = newISOString;
      } else if (field === "entry_time") {
        const [hours, minutes] = validation.value.split(':').map(Number);
        const dateOnly = currentISOString.split('T')[0];
        const newISOString = `${dateOnly}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
        updatedEntry.entry_date = newISOString;
      }
    } else {
      updatedEntry[field as keyof FermentationEntry] = validation.value;
    }

    try {
      await Services.brewSession.updateFermentationEntry(
        sessionId,
        entryIndex,
        updatedEntry,
        unitSystem
      );
      await fetchFermentationData(); // Refresh data
      dispatch({ type: 'CANCEL_EDIT' });
    } catch (error) {
      dispatch({ type: 'SAVE_EDIT_ERROR', payload: "Failed to update fermentation entry" });
    }
  };

  // Handle key press in edit input
  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Handle blur event (when user clicks away from input)
  const handleBlur = (): void => {
    // Only attempt to save if the value actually changed
    if (state.editing.value !== state.editing.originalValue) {
      saveEdit();
    } else {
      // If no changes, just cancel editing
      cancelEdit();
    }
  };

  // Render editable cell
  const renderEditableCell = (
    entryIndex: number,
    field: string,
    currentValue: any,
    displayValue: React.ReactNode
  ): React.ReactNode => {
    const isEditingThisCell =
      state.editing.entryIndex === entryIndex &&
      state.editing.field === field;

    if (!isEditingThisCell) {
      return (
        <span
          className="editable-cell"
          onClick={() => startEdit(entryIndex, field, currentValue)}
          title="Click to edit"
        >
          {displayValue}
        </span>
      );
    }

    // Render appropriate input based on field type
    if (field === "notes") {
      return (
        <div className="edit-cell-container">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={state.editing.value}
            onChange={(e) => dispatch({ type: 'UPDATE_EDIT_VALUE', payload: e.target.value })}
            onBlur={handleBlur}
            onKeyDown={handleKeyPress}
            className="edit-cell-input edit-cell-textarea"
            placeholder="Enter notes..."
            rows={2}
          />
          {state.editing.validationError && (
            <div className="edit-error">{state.editing.validationError}</div>
          )}
        </div>
      );
    }

    let inputType = "text";
    let step = "0.001";
    let placeholder = "";
    
    if (["gravity", "temperature", "ph"].includes(field)) {
      inputType = "number";
    } else if (field === "entry_date") {
      inputType = "date";
    } else if (field === "entry_time") {
      inputType = "time";
    }
    
    if (field === "gravity") {
      step = "0.001";
      placeholder = "e.g. 1.050";
    } else if (field === "temperature") {
      step = "0.1";
      placeholder = unitSystem === "metric" ? "e.g. 20.0" : "e.g. 68.5";
    } else if (field === "ph") {
      step = "0.1";
      placeholder = "e.g. 4.2";
    } else if (field === "entry_date") {
      placeholder = "YYYY-MM-DD";
    } else if (field === "entry_time") {
      placeholder = "HH:MM";
    }

    return (
      <div className="edit-cell-container">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          value={state.editing.value}
          onChange={(e) => dispatch({ type: 'UPDATE_EDIT_VALUE', payload: e.target.value })}
          onBlur={handleBlur}
          onKeyDown={handleKeyPress}
          step={inputType === "time" ? "60" : step}
          placeholder={placeholder}
          className="edit-cell-input"
        />
        {state.editing.validationError && (
          <div className="edit-error">{state.editing.validationError}</div>
        )}
      </div>
    );
  };

  // Format data for the chart
  const formatChartData = (): ChartData[] => {
    if (!state.fermentationData || state.fermentationData.length === 0) {
      return [];
    }

    return state.fermentationData.map((entry) => ({
      date: entry.entry_date,
      displayDate: new Date(entry.entry_date).toLocaleDateString(),
      gravity: entry.gravity || null,
      temperature: entry.temperature || null,
      ph: entry.ph || null,
    }));
  };

  const chartData = formatChartData();

  // Calculate gravity domain for chart Y-axis
  const calculateGravityDomain = (): [number, number] => {
    let actualOG = sessionData?.actual_og || recipeData?.estimated_og;

    if (!actualOG && chartData && chartData.length > 0) {
      const gravityValues = chartData
        .map((entry) => entry.gravity)
        .filter((gravity): gravity is number => gravity !== null);

      if (gravityValues.length > 0) {
        actualOG = Math.max(...gravityValues);
      }
    }

    if (actualOG) {
      return [1.0, actualOG + 0.01];
    }

    return [1.0, 1.1];
  };

  const gravityDomain = calculateGravityDomain();

  // Calculate fermentation rate with session status awareness
  const calculateFermentationRate = (): {
    dailyRate: number | null;
    analysis: string;
  } => {
    if (!chartData || chartData.length < 2) {
      return {
        dailyRate: null,
        analysis: "Need at least 2 readings to calculate rate",
      };
    }

    const validEntries = chartData.filter((entry) => entry.gravity !== null);
    if (validEntries.length < 2) {
      return { dailyRate: null, analysis: "Need at least 2 gravity readings" };
    }

    const isCompleted = sessionData?.status === "completed";

    try {
      const sortedEntries = [...validEntries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const latest = sortedEntries[sortedEntries.length - 1];
      const previous = sortedEntries[sortedEntries.length - 2];

      const latestDate = new Date(latest.date);
      const previousDate = new Date(previous.date);

      if (isNaN(latestDate.getTime()) || isNaN(previousDate.getTime())) {
        return { dailyRate: null, analysis: "Invalid date format in readings" };
      }

      const gravityDrop = previous.gravity! - latest.gravity!;
      const timeDiff = latestDate.getTime() - previousDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      if (daysDiff <= 0) {
        return {
          dailyRate: null,
          analysis: "Readings taken on same day or invalid date order",
        };
      }

      const dailyRate = gravityDrop / daysDiff;

      if (isNaN(dailyRate)) {
        return {
          dailyRate: null,
          analysis: "Error calculating fermentation rate",
        };
      }

      let analysis = "";

      if (isCompleted) {
        if (dailyRate > 0.004) {
          analysis = "Fermentation completed successfully";
        } else if (dailyRate > 0.001) {
          analysis = "Fermentation completed at steady pace";
        } else {
          analysis = "Fermentation completed (final gravity stable)";
        }
      } else {
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
      }

      return { dailyRate, analysis };
    } catch (error) {
      console.error("Error calculating fermentation rate:", error);
      return {
        dailyRate: null,
        analysis: "Error calculating fermentation rate",
      };
    }
  };

  const fermentationRate = calculateFermentationRate();

  // Calculate fermentation phase markers
  const calculatePhaseMarkers = (): Array<{
    date: string;
    phase: string;
    label: string;
    color: string;
  }> => {
    const markers: Array<{
      date: string;
      phase: string;
      label: string;
      color: string;
    }> = [];

    // Add fermentation start marker
    if (sessionData?.fermentation_start_date) {
      markers.push({
        date: sessionData.fermentation_start_date,
        phase: "start",
        label: "🧪 Fermentation Start",
        color: "#28a745",
      });
    }

    // Add dry hop markers from the session data
    if (
      sessionData?.dry_hop_additions &&
      sessionData.dry_hop_additions.length > 0
    ) {
      sessionData.dry_hop_additions.forEach((addition) => {
        markers.push({
          date: addition.addition_date,
          phase: "dry_hop_add",
          label: `🌿 Add ${addition.hop_name}`,
          color: "#ffc107",
        });

        // Add removal marker if present
        if (addition.removal_date) {
          markers.push({
            date: addition.removal_date,
            phase: "dry_hop_remove",
            label: `🗑️ Remove ${addition.hop_name}`,
            color: "#fd7e14",
          });
        }
      });
    }

    // Add fermentation end marker
    if (sessionData?.fermentation_end_date) {
      markers.push({
        date: sessionData.fermentation_end_date,
        phase: "end",
        label: "🏁 Fermentation Complete",
        color: "#dc3545",
      });
    }

    // Add packaging marker
    if (sessionData?.packaging_date) {
      markers.push({
        date: sessionData.packaging_date,
        phase: "packaging",
        label: "📦 Packaged",
        color: "#6f42c1",
      });
    }

    return markers.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const phaseMarkers = calculatePhaseMarkers();

  // Calculate attenuation if possible
  const calculateAttenuation = (): string | null => {
    if (state.fermentationData.length < 2) {
      return null;
    }

    const firstReading = state.fermentationData.find((entry) => entry.gravity);
    const lastReading = [...state.fermentationData]
      .reverse()
      .find((entry) => entry.gravity);

    if (!firstReading || !lastReading || firstReading === lastReading) {
      return null;
    }

    const attenuation =
      ((firstReading.gravity! - lastReading.gravity!) /
        (firstReading.gravity! - 1.0)) *
      100;
    return formatAttenuation(attenuation).replace("%", "");
  };

  const attenuation = calculateAttenuation();

  return (
    <div className="fermentation-tracker">
      <div className="fermentation-header">
        <h2 className="fermentation-title">Fermentation Tracking</h2>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FORM' })}
          className="btn btn-primary"
        >
          {state.showForm ? "Cancel" : "Add Entry"}
        </button>
      </div>

      {/* Form for adding new fermentation data */}
      {state.showForm && (
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
                  value={state.formData.gravity}
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
                  placeholder={
                    unitSystem === "metric" ? "e.g. 20.0" : "e.g. 68.5"
                  }
                  value={state.formData.temperature}
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
                  value={state.formData.ph}
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
                value={state.formData.notes}
                onChange={handleChange}
                className="fermentation-textarea"
              />
            </div>
            <div className="fermentation-form-actions">
              <button
                type="submit"
                disabled={state.submitting}
                className="fermentation-submit-button"
              >
                {state.submitting ? "Saving..." : "Save Reading"}
              </button>
            </div>
          </form>
        </div>
      )}

      {state.loading ? (
        <div className="loading-message">Loading fermentation data...</div>
      ) : (
        <>
          {/* Fermentation stats summary */}
          {state.stats && (
            <div className="fermentation-stats">
              <div className="fermentation-stat-card">
                <h3 className="fermentation-stat-title">Gravity</h3>
                {state.stats.gravity?.initial && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Initial:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(state.stats.gravity.initial)}
                    </span>
                  </div>
                )}
                {state.stats.gravity?.current && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Current:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(state.stats.gravity.current)}
                    </span>
                  </div>
                )}
                {state.stats.gravity?.drop && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">Drop:</span>
                    <span className="fermentation-stat-value">
                      {formatGravity(state.stats.gravity.drop)}
                    </span>
                  </div>
                )}
                {state.stats.gravity?.attenuation && (
                  <div className="fermentation-stat-row">
                    <span className="fermentation-stat-label">
                      Attenuation:
                    </span>
                    <span className="fermentation-stat-value">
                      {formatAttenuation(state.stats.gravity.attenuation)}
                    </span>
                  </div>
                )}
              </div>

              <div className="fermentation-stat-card">
                <h3 className="fermentation-stat-title">Temperature</h3>
                {state.stats.temperature?.min !== null &&
                  state.stats.temperature?.min !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Min:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(state.stats.temperature.min)}°
                        {unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
                {state.stats.temperature?.max !== null &&
                  state.stats.temperature?.max !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Max:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(state.stats.temperature.max)}°
                        {unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
                {state.stats.temperature?.avg !== null &&
                  state.stats.temperature?.avg !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Avg:</span>
                      <span className="fermentation-stat-value">
                        {Math.round(state.stats.temperature.avg)}°
                        {unitSystem === "metric" ? "C" : "F"}
                      </span>
                    </div>
                  )}
              </div>

              {state.stats.ph?.data && state.stats.ph.data.length > 0 && (
                <div className="fermentation-stat-card">
                  <h3 className="fermentation-stat-title">pH</h3>
                  {state.stats.ph?.min !== null && state.stats.ph?.min !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Min:</span>
                      <span className="fermentation-stat-value">
                        {state.stats.ph.min.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {state.stats.ph?.max !== null && state.stats.ph?.max !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Max:</span>
                      <span className="fermentation-stat-value">
                        {state.stats.ph.max.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {state.stats.ph?.avg !== null && state.stats.ph?.avg !== undefined && (
                    <div className="fermentation-stat-row">
                      <span className="fermentation-stat-label">Avg:</span>
                      <span className="fermentation-stat-value">
                        {state.stats.ph.avg.toFixed(1)}
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

          {/* Gravity Stabilization Analysis */}
          {state.fermentationData.length >= 3 &&
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
                {state.fermentationData.length > 0 && (
                  <div className="fermentation-comparison-row">
                    <div className="fermentation-comparison-col">
                      <span className="fermentation-comparison-label">
                        Actual OG
                      </span>
                      <div className="fermentation-comparison-value">
                        {state.fermentationData[0].gravity
                          ? formatGravity(state.fermentationData[0].gravity)
                          : "-"}
                      </div>
                    </div>
                    <div className="fermentation-comparison-col">
                      <span className="fermentation-comparison-label">
                        Current Gravity
                      </span>
                      <div className="fermentation-comparison-value">
                        {state.fermentationData[state.fermentationData.length - 1].gravity
                          ? formatGravity(
                              state.fermentationData[state.fermentationData.length - 1]
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

          {/* Chart visualization */}
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
                    <YAxis
                      yAxisId="ph"
                      orientation="right"
                      domain={[0, 14]}
                      hide={true}
                    />
                    <Tooltip />
                    <Legend />

                    {/* Expected FG Reference Line */}
                    {recipeData.estimated_fg &&
                      chartData &&
                      chartData.length > 0 &&
                      (() => {
                        const CustomFGLabel = (props: any) => {
                          const { viewBox } = props;
                          if (!viewBox) return null;

                          const { x, y } = viewBox;

                          return (
                            <text
                              x={x + 20}
                              y={y - 10}
                              fill="#ff7300"
                              fontSize="12"
                              fontWeight="bold"
                              textAnchor="start"
                              dominantBaseline="middle"
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.8)",
                                padding: "2px 4px",
                                borderRadius: "3px",
                              }}
                            >
                              {`Expected FG: ${formatGravity(
                                recipeData.estimated_fg
                              )}`}
                            </text>
                          );
                        };

                        return (
                          <ReferenceLine
                            y={recipeData.estimated_fg}
                            yAxisId="gravity"
                            stroke="#ff7300"
                            strokeDasharray="5 5"
                            label={<CustomFGLabel />}
                          />
                        );
                      })()}

                    {/* Fermentation Phase Markers */}
                    {chartData &&
                      chartData.length > 0 &&
                      phaseMarkers &&
                      phaseMarkers.length > 0 &&
                      phaseMarkers.map((marker, index) => {
                        const displayDate = new Date(
                          marker.date
                        ).toLocaleDateString();
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
                              offset: 10,
                              style: {
                                fontSize: "14px",
                                fill: marker.color,
                                fontWeight: "bold",
                                backgroundColor: "rgba(255, 255, 255, 0.8)",
                                padding: "2px 4px",
                                borderRadius: "3px",
                                border: `1px solid ${marker.color}`,
                              },
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
                      name={`Temperature (${
                        unitSystem === "metric" ? "°C" : "°F"
                      })`}
                    />
                    <Line
                      yAxisId="ph"
                      type="monotone"
                      dataKey="ph"
                      stroke="#ff6b6b"
                      name="pH"
                      strokeDasharray="2 2"
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
              <div className="fermentation-timeline-horizontal">
                <div className="timeline-track">
                  {phaseMarkers.map((marker, index) => (
                    <div key={`timeline-${index}`} className="timeline-event">
                      <div
                        className="timeline-event-marker"
                        style={{ backgroundColor: marker.color }}
                        title={marker.label}
                      ></div>
                      <div className="timeline-event-content">
                        <div className="timeline-event-date">
                          {(() => {
                            if (
                              marker.phase === "start" ||
                              marker.phase === "end" ||
                              marker.phase === "packaging"
                            ) {
                              if (/^\d{4}-\d{2}-\d{2}$/.test(marker.date)) {
                                const [year, month, day] =
                                  marker.date.split("-");
                                return new Date(
                                  parseInt(year),
                                  parseInt(month) - 1,
                                  parseInt(day)
                                ).toLocaleDateString();
                              } else {
                                const date = new Date(marker.date);
                                return date.toLocaleDateString();
                              }
                            } else {
                              const date = new Date(marker.date);
                              return (
                                date.toLocaleDateString() +
                                " " +
                                date.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              );
                            }
                          })()}
                        </div>
                        <div className="timeline-event-label">
                          {marker.label}
                        </div>
                        {marker.phase === "dry_hop_add" &&
                          sessionData?.dry_hop_additions && (
                            <div className="timeline-event-details">
                              {(() => {
                                const addition =
                                  sessionData.dry_hop_additions.find(
                                    (add) => add.addition_date === marker.date
                                  );
                                return addition
                                  ? `${addition.amount} ${addition.amount_unit}`
                                  : "";
                              })()}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="brew-session-section">
            <h3 className="section-title">Fermentation Data Log</h3>
            {state.error && (
              <div className="error-message" style={{ marginBottom: "1rem" }}>
                {state.error}
              </div>
            )}
            <div className="editing-help" style={{ marginBottom: "1rem" }}>
              <small className="help-text">
                💡 <strong>Click to edit:</strong> Date, Time, Gravity, Temperature, pH, and Notes are editable. 
                Press Enter to save, Escape to cancel.
              </small>
            </div>
            {state.fermentationData.length === 0 ? (
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
                      <th>Date</th>
                      <th>Time</th>
                      <th>Gravity</th>
                      <th>Temperature</th>
                      <th>pH</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.fermentationData.map((entry, index) => (
                      <tr key={index}>
                        <td>
                          {renderEditableCell(
                            index,
                            "entry_date",
                            entry.entry_date,
                            new Date(entry.entry_date).toLocaleDateString()
                          )}
                        </td>
                        <td>
                          {renderEditableCell(
                            index,
                            "entry_time",
                            entry.entry_date,
                            new Date(entry.entry_date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          )}
                        </td>
                        <td>
                          {renderEditableCell(
                            index,
                            "gravity",
                            entry.gravity,
                            entry.gravity ? formatGravity(entry.gravity) : "-"
                          )}
                        </td>
                        <td>
                          {renderEditableCell(
                            index,
                            "temperature",
                            entry.temperature,
                            entry.temperature
                              ? `${Math.round(entry.temperature)}°${
                                  unitSystem === "metric" ? "C" : "F"
                                }`
                              : "-"
                          )}
                        </td>
                        <td>
                          {renderEditableCell(
                            index,
                            "ph",
                            entry.ph,
                            entry.ph ? entry.ph.toFixed(1) : "-"
                          )}
                        </td>
                        <td>
                          {renderEditableCell(
                            index,
                            "notes",
                            entry.notes,
                            entry.notes || "-"
                          )}
                        </td>
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

// Add CSS for editable cells
const styles = `
  .editable-cell {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    min-height: 20px;
    display: inline-block;
    min-width: 40px;
  }

  .editable-cell:hover {
    background-color: #f0f8ff;
    border: 1px dashed #007bff;
  }

  .edit-cell-container {
    position: relative;
    min-width: 80px;
  }

  .edit-cell-input {
    width: 100%;
    padding: 4px 6px;
    border: 2px solid #007bff;
    border-radius: 4px;
    font-size: 14px;
    background-color: #fff;
    box-sizing: border-box;
  }

  .edit-cell-input:focus {
    outline: none;
    border-color: #0056b3;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }

  .edit-cell-textarea {
    resize: vertical;
    min-height: 40px;
    font-family: inherit;
  }

  .edit-error {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    font-size: 12px;
    color: #dc3545;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 3px;
    padding: 2px 4px;
    margin-top: 2px;
    z-index: 1000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default FermentationTracker;