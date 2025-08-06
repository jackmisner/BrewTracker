import React, { useReducer, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Services } from "@/services";
import { invalidateBrewSessionCaches } from "@/services/CacheManager";
import { useUnits } from "@/contexts/UnitContext";
import { UpdateBrewSessionFormData } from "@/types";
// BrewSession and BrewSessionStatus types used in state interface
import {
  brewSessionReducer,
  createInitialBrewSessionState,
  type EditBrewSessionFormData,
} from "@/reducers";
import "@/styles/BrewSessions.css";

// Interface now imported from reducer

const EditBrewSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { unitSystem } = useUnits();

  // Initialize reducer
  const [state, dispatch] = useReducer(
    brewSessionReducer,
    createInitialBrewSessionState("edit")
  );

  // Destructure state for cleaner access
  const { session, loading, error, submitting, formData } = state;

  useEffect(() => {
    const fetchSession = async (): Promise<void> => {
      if (!sessionId) {
        dispatch({ type: "FETCH_ERROR", payload: "Session ID is required" });
        return;
      }

      try {
        dispatch({ type: "FETCH_START" });

        const sessionData =
          await Services.brewSession.fetchBrewSession(sessionId);
        dispatch({ type: "FETCH_SUCCESS", payload: { session: sessionData } });

        // Helper function to safely format date or return empty string for form display
        const formatDateForForm = (dateString?: string): string => {
          if (!dateString) return "";
          const date = new Date(dateString);
          return date.toISOString().split("T")[0];
        };

        dispatch({
          type: "SET_FORM_DATA",
          payload: {
            name: sessionData.name || "",
            status: sessionData.status || "planned",
            brew_date: formatDateForForm(sessionData.brew_date),
            mash_temp: sessionData.mash_temp?.toString() || "",
            actual_og: sessionData.actual_og?.toString() || "",
            actual_fg: sessionData.actual_fg?.toString() || "",
            actual_abv: sessionData.actual_abv?.toString() || "",
            actual_efficiency: sessionData.actual_efficiency?.toString() || "",
            fermentation_start_date: formatDateForForm(
              sessionData.fermentation_start_date
            ),
            fermentation_end_date: formatDateForForm(
              sessionData.fermentation_end_date
            ),
            packaging_date: formatDateForForm(sessionData.packaging_date),
            tasting_notes: sessionData.tasting_notes || "",
            batch_rating: sessionData.batch_rating?.toString() || "",
          },
        });
      } catch (err: any) {
        console.error("Error fetching brew session:", err);
        dispatch({
          type: "FETCH_ERROR",
          payload: err.message || "Failed to load brew session data",
        });

        // If session doesn't exist, navigate back after a short delay
        if (
          err.message?.includes("not found") ||
          err.response?.status === 404
        ) {
          setTimeout(() => navigate("/brew-sessions"), 2000);
        }
      }
    };

    fetchSession();
  }, [sessionId, navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ): void => {
    const { name, value } = e.target;
    dispatch({
      type: "UPDATE_FORM_FIELD",
      payload: { field: name, value },
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!sessionId) {
      dispatch({ type: "SET_ERROR", payload: "Session ID is required" });
      return;
    }

    try {
      dispatch({ type: "SUBMIT_START" });

      // Prepare data for submission - convert to proper types and filter out empty values
      const editFormData = formData as EditBrewSessionFormData;
      const data: UpdateBrewSessionFormData = {
        status: editFormData.status, // Status is always required
      };

      // Only include non-empty string fields
      if (editFormData.name?.trim()) {
        data.name = editFormData.name;
      }
      if (editFormData.brew_date?.trim()) {
        data.brew_date = editFormData.brew_date;
      }
      if (editFormData.tasting_notes?.trim()) {
        data.tasting_notes = editFormData.tasting_notes;
      }

      // Convert numeric fields from string to number (only if not empty)
      if (editFormData.mash_temp?.trim()) {
        data.mash_temp = parseFloat(editFormData.mash_temp);
      }
      if (editFormData.actual_og?.trim()) {
        data.actual_og = parseFloat(editFormData.actual_og);
      }
      if (editFormData.actual_fg?.trim()) {
        data.actual_fg = parseFloat(editFormData.actual_fg);
      }
      if (editFormData.actual_abv?.trim()) {
        data.actual_abv = parseFloat(editFormData.actual_abv);
      }
      if (editFormData.actual_efficiency?.trim()) {
        data.actual_efficiency = parseFloat(editFormData.actual_efficiency);
      }
      if (editFormData.batch_rating?.trim()) {
        data.batch_rating = parseInt(editFormData.batch_rating);
      }

      // Handle date fields (only if not empty)
      if (editFormData.fermentation_start_date?.trim()) {
        data.fermentation_start_date = editFormData.fermentation_start_date;
      }
      if (editFormData.fermentation_end_date?.trim()) {
        data.fermentation_end_date = editFormData.fermentation_end_date;
      }
      if (editFormData.packaging_date?.trim()) {
        data.packaging_date = editFormData.packaging_date;
      }

      // Submit update using BrewSessionService
      const updatedSession = await Services.brewSession.updateBrewSession(
        sessionId,
        data
      );
      dispatch({ type: "SET_SESSION", payload: updatedSession });

      // Invalidate caches to update all related components
      invalidateBrewSessionCaches.onUpdated({
        session_id: sessionId,
        recipe_id: updatedSession.recipe_id,
      });

      // Navigate back to session view
      navigate(`/brew-sessions/${sessionId}`);
    } catch (err: any) {
      console.error("Error updating brew session:", err);
      dispatch({
        type: "SUBMIT_ERROR",
        payload:
          err.message ||
          `Failed to update brew session: ${
            err.response?.data?.error || "Unknown error"
          }`,
      });
    }
  };

  if (loading) {
    return <div className="loading-message">Loading brew session...</div>;
  }

  if (error && !session) {
    return (
      <div className="error-message">
        {error}
        {error.includes("not found") && (
          <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            Redirecting to brew sessions list...
          </p>
        )}
      </div>
    );
  }

  if (!session) {
    return <div className="empty-message">Brew session not found</div>;
  }

  return (
    <div className="container">
      <h1 className="page-title">Edit Brew Session</h1>

      {error && (
        <div className="error-message" style={{ marginBottom: "1rem" }}>
          {error}
          <button
            onClick={() => dispatch({ type: "CLEAR_ERROR" })}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              marginLeft: "10px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="brew-session-form">
        <div className="brew-session-grid">
          {/* Basic Information */}
          <div>
            <h2 className="section-title">Basic Information</h2>

            <div className="brew-session-form-group">
              <label htmlFor="name" className="brew-session-form-label">
                Session Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="brew-session-form-control"
                disabled={submitting}
              />
            </div>

            <div className="brew-session-form-group">
              <label htmlFor="status" className="brew-session-form-label">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="brew-session-form-control"
                required
                disabled={submitting}
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="fermenting">Fermenting</option>
                <option value="conditioning">Conditioning</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="brew-session-form-group">
              <label htmlFor="brew_date" className="brew-session-form-label">
                Brew Date
              </label>
              <input
                type="date"
                id="brew_date"
                name="brew_date"
                value={formData.brew_date}
                onChange={handleChange}
                className="brew-session-form-control"
                disabled={submitting}
              />
            </div>

            <div className="brew-session-form-group">
              <label htmlFor="mash_temp" className="brew-session-form-label">
                Mash Temperature (°{unitSystem === "metric" ? "C" : "F"})
              </label>
              <input
                type="number"
                step="0.1"
                id="mash_temp"
                name="mash_temp"
                value={(formData as EditBrewSessionFormData).mash_temp}
                onChange={handleChange}
                className="brew-session-form-control"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Metrics and Timeline */}
          <div>
            <h2 className="section-title">Metrics and Timeline</h2>

            <div className="brew-session-grid">
              <div>
                <label htmlFor="actual_og" className="brew-session-form-label">
                  Original Gravity
                </label>
                <input
                  type="number"
                  step="0.001"
                  id="actual_og"
                  name="actual_og"
                  value={(formData as EditBrewSessionFormData).actual_og}
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="actual_fg" className="brew-session-form-label">
                  Final Gravity
                </label>
                <input
                  type="number"
                  step="0.001"
                  id="actual_fg"
                  name="actual_fg"
                  value={(formData as EditBrewSessionFormData).actual_fg}
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="brew-session-grid">
              <div>
                <label htmlFor="actual_abv" className="brew-session-form-label">
                  ABV (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="actual_abv"
                  name="actual_abv"
                  value={(formData as EditBrewSessionFormData).actual_abv}
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
              <div>
                <label
                  htmlFor="actual_efficiency"
                  className="brew-session-form-label"
                >
                  Efficiency (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="actual_efficiency"
                  name="actual_efficiency"
                  value={
                    (formData as EditBrewSessionFormData).actual_efficiency
                  }
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <div className="brew-session-form-group">
                <label
                  htmlFor="fermentation_start_date"
                  className="brew-session-form-label"
                >
                  Fermentation Start Date
                </label>
                <input
                  type="date"
                  id="fermentation_start_date"
                  name="fermentation_start_date"
                  value={
                    (formData as EditBrewSessionFormData)
                      .fermentation_start_date
                  }
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
              <div className="brew-session-form-group">
                <label
                  htmlFor="fermentation_end_date"
                  className="brew-session-form-label"
                >
                  Fermentation End Date
                </label>
                <input
                  type="date"
                  id="fermentation_end_date"
                  name="fermentation_end_date"
                  value={
                    (formData as EditBrewSessionFormData).fermentation_end_date
                  }
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
              <div className="brew-session-form-group">
                <label
                  htmlFor="packaging_date"
                  className="brew-session-form-label"
                >
                  Packaging Date
                </label>
                <input
                  type="date"
                  id="packaging_date"
                  name="packaging_date"
                  value={(formData as EditBrewSessionFormData).packaging_date}
                  onChange={handleChange}
                  className="brew-session-form-control"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tasting Notes and Rating */}
        <div>
          <h2 className="section-title">Tasting and Evaluation</h2>

          <div className="brew-session-form-group">
            <label htmlFor="tasting_notes" className="brew-session-form-label">
              Tasting Notes
            </label>
            <textarea
              id="tasting_notes"
              name="tasting_notes"
              rows={4}
              value={(formData as EditBrewSessionFormData).tasting_notes}
              onChange={handleChange}
              className="brew-session-form-control brew-session-form-textarea"
              disabled={submitting}
            />
          </div>

          <div className="brew-session-form-group">
            <label htmlFor="batch_rating" className="brew-session-form-label">
              Batch Rating (1-5)
            </label>
            <select
              id="batch_rating"
              name="batch_rating"
              value={(formData as EditBrewSessionFormData).batch_rating}
              onChange={handleChange}
              className="brew-session-form-control"
              disabled={submitting}
            >
              <option value="">Select Rating</option>
              <option value="1">1 - Poor</option>
              <option value="2">2 - Fair</option>
              <option value="3">3 - Good</option>
              <option value="4">4 - Very Good</option>
              <option value="5">5 - Excellent</option>
            </select>
          </div>
        </div>

        <div className="brew-session-form-actions">
          <button
            type="button"
            onClick={() => navigate(`/brew-sessions/${sessionId}`)}
            className="brew-session-form-button brew-session-cancel-button"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="brew-session-form-button brew-session-submit-button"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBrewSession;
