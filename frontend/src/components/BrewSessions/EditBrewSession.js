import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../../services/api";
import "../../styles/BrewSessions.css";

const EditBrewSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    status: "",
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
    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await ApiService.brewSessions.getById(sessionId);
        setSession(response.data);

        // Populate form with session data
        const sessionData = response.data;

        // Helper function to safely format date or return empty string for form display
        const formatDateForForm = (dateString) => {
          return dateString ? dateString.split("T")[0] : "";
        };

        setFormData({
          name: sessionData.name || "",
          status: sessionData.status || "planned",
          brew_date: formatDateForForm(sessionData.brew_date),
          mash_temp: sessionData.mash_temp || "",
          actual_og: sessionData.actual_og || "",
          actual_fg: sessionData.actual_fg || "",
          actual_abv: sessionData.actual_abv || "",
          actual_efficiency: sessionData.actual_efficiency || "",
          // Only set fermentation_start_date if it exists, otherwise leave empty for form
          fermentation_start_date: formatDateForForm(
            sessionData.fermentation_start_date
          ),
          fermentation_end_date: formatDateForForm(
            sessionData.fermentation_end_date
          ),
          packaging_date: formatDateForForm(sessionData.packaging_date),
          tasting_notes: sessionData.tasting_notes || "",
          batch_rating: sessionData.batch_rating || "",
        });
      } catch (err) {
        console.error("Error fetching brew session:", err);
        setError("Failed to load brew session data");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      // Prepare data for submission
      const data = { ...formData };

      // Convert numeric fields from string to number
      const numericFields = [
        "mash_temp",
        "actual_og",
        "actual_fg",
        "actual_abv",
        "actual_efficiency",
        "batch_rating",
      ];
      numericFields.forEach((field) => {
        if (data[field]) {
          data[field] = parseFloat(data[field]);
        } else {
          delete data[field]; // Remove empty fields to avoid setting them to null/0
        }
      });

      // Handle date fields - remove empty strings to avoid validation errors
      const dateFields = [
        "brew_date",
        "fermentation_start_date",
        "fermentation_end_date",
        "packaging_date",
      ];
      dateFields.forEach((field) => {
        if (!data[field] || data[field] === "") {
          delete data[field]; // Remove empty date fields
        }
      });

      // Submit update
      console.log("update data:", data);
      await ApiService.brewSessions.update(sessionId, data);

      // Navigate back to session view
      navigate(`/brew-sessions/${sessionId}`);
    } catch (err) {
      console.error("Error updating brew session:", err);
      setError(
        `Failed to update brew session: ${
          err.response?.data?.error || err.message || "Unknown error"
        }`
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-message">Loading brew session...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!session) {
    return <div className="empty-message">Brew session not found</div>;
  }

  return (
    <div className="container">
      <h1 className="page-title">Edit Brew Session</h1>

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
              rows="4"
              value={formData.tasting_notes}
              onChange={handleChange}
              className="brew-session-form-control brew-session-form-textarea"
            ></textarea>
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
