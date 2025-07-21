import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Services } from "../../services";
import { invalidateBrewSessionCaches } from "../../services/CacheManager";
import {
  BrewSession,
  BrewSessionStatus,
  UpdateBrewSessionFormData,
} from "../../types";
import "../../styles/BrewSessions.css";

interface EditBrewSessionFormData {
  name: string;
  status: BrewSessionStatus;
  brew_date: string;
  mash_temp: string;
  actual_og: string;
  actual_fg: string;
  actual_abv: string;
  actual_efficiency: string;
  fermentation_start_date: string;
  fermentation_end_date: string;
  packaging_date: string;
  tasting_notes: string;
  batch_rating: string;
}

const EditBrewSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<BrewSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<EditBrewSessionFormData>({
    name: "",
    status: "planned",
    brew_date: "",
    mash_temp: "",
    actual_og: "",
    actual_fg: "",
    actual_abv: "",
    actual_efficiency: "",
    fermentation_start_date: "",
    fermentation_end_date: "",
    packaging_date: "",
    tasting_notes: "",
    batch_rating: "",
  });

  useEffect(() => {
    const fetchSession = async (): Promise<void> => {
      if (!sessionId) {
        setError("Session ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const sessionData = await Services.brewSession.fetchBrewSession(
          sessionId
        );
        setSession(sessionData);

        // Helper function to safely format date or return empty string for form display
        const formatDateForForm = (dateString?: string): string => {
          if (!dateString) return "";
          const date = new Date(dateString);
          return date.toISOString().split("T")[0];
        };

        setFormData({
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
        });
      } catch (err: any) {
        console.error("Error fetching brew session:", err);
        setError(err.message || "Failed to load brew session data");

        // If session doesn't exist, navigate back after a short delay
        if (
          err.message?.includes("not found") ||
          err.response?.status === 404
        ) {
          setTimeout(() => navigate("/brew-sessions"), 2000);
        }
      } finally {
        setLoading(false);
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
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!sessionId) {
      setError("Session ID is required");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      // Prepare data for submission - convert to proper types and filter out empty values
      const data: UpdateBrewSessionFormData = {
        status: formData.status, // Status is always required
      };

      // Only include non-empty string fields
      if (formData.name?.trim()) {
        data.name = formData.name;
      }
      if (formData.brew_date?.trim()) {
        data.brew_date = formData.brew_date;
      }
      if (formData.tasting_notes?.trim()) {
        data.tasting_notes = formData.tasting_notes;
      }

      // Convert numeric fields from string to number (only if not empty)
      if (formData.mash_temp?.trim()) {
        data.mash_temp = parseFloat(formData.mash_temp);
      }
      if (formData.actual_og?.trim()) {
        data.actual_og = parseFloat(formData.actual_og);
      }
      if (formData.actual_fg?.trim()) {
        data.actual_fg = parseFloat(formData.actual_fg);
      }
      if (formData.actual_abv?.trim()) {
        data.actual_abv = parseFloat(formData.actual_abv);
      }
      if (formData.actual_efficiency?.trim()) {
        data.actual_efficiency = parseFloat(formData.actual_efficiency);
      }
      if (formData.batch_rating?.trim()) {
        data.batch_rating = parseInt(formData.batch_rating);
      }

      // Handle date fields (only if not empty)
      if (formData.fermentation_start_date?.trim()) {
        data.fermentation_start_date = formData.fermentation_start_date;
      }
      if (formData.fermentation_end_date?.trim()) {
        data.fermentation_end_date = formData.fermentation_end_date;
      }
      if (formData.packaging_date?.trim()) {
        data.packaging_date = formData.packaging_date;
      }

      // Submit update using BrewSessionService
      const updatedSession = await Services.brewSession.updateBrewSession(
        sessionId,
        data
      );
      setSession(updatedSession);

      // Invalidate caches to update all related components
      invalidateBrewSessionCaches.onUpdated({
        session_id: sessionId,
        recipe_id: updatedSession.recipe_id,
      });

      // Navigate back to session view
      navigate(`/brew-sessions/${sessionId}`);
    } catch (err: any) {
      console.error("Error updating brew session:", err);
      setError(
        err.message ||
          `Failed to update brew session: ${
            err.response?.data?.error || "Unknown error"
          }`
      );
    } finally {
      setSubmitting(false);
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
            onClick={() => setError("")}
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
                Mash Temperature (°F)
              </label>
              <input
                type="number"
                step="0.1"
                id="mash_temp"
                name="mash_temp"
                value={formData.mash_temp}
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
                  value={formData.actual_og}
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
                  value={formData.actual_fg}
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
                  value={formData.actual_abv}
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
                  value={formData.actual_efficiency}
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
                  value={formData.fermentation_start_date}
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
                  value={formData.fermentation_end_date}
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
                  value={formData.packaging_date}
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
              value={formData.tasting_notes}
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
              value={formData.batch_rating}
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
