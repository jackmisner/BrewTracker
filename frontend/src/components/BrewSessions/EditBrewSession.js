import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../../services/api";

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
        setFormData({
          name: sessionData.name || "",
          status: sessionData.status || "planned",
          brew_date: sessionData.brew_date
            ? sessionData.brew_date.split("T")[0]
            : "",
          mash_temp: sessionData.mash_temp || "",
          actual_og: sessionData.actual_og || "",
          actual_fg: sessionData.actual_fg || "",
          actual_abv: sessionData.actual_abv || "",
          actual_efficiency: sessionData.actual_efficiency || "",
          fermentation_start_date: sessionData.fermentation_start_date
            ? sessionData.fermentation_start_date.split("T")[0]
            : "",
          fermentation_end_date: sessionData.fermentation_end_date
            ? sessionData.fermentation_end_date.split("T")[0]
            : "",
          packaging_date: sessionData.packaging_date
            ? sessionData.packaging_date.split("T")[0]
            : "",
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

      // Submit update
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
    return <div className="text-center py-10">Loading brew session...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  if (!session) {
    return <div className="text-center py-10">Brew session not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Edit Brew Session</h1>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Basic Information
            </h2>

            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-gray-700 font-medium mb-2"
              >
                Session Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="status"
                className="block text-gray-700 font-medium mb-2"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
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

            <div className="mb-4">
              <label
                htmlFor="brew_date"
                className="block text-gray-700 font-medium mb-2"
              >
                Brew Date
              </label>
              <input
                type="date"
                id="brew_date"
                name="brew_date"
                value={formData.brew_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="mash_temp"
                className="block text-gray-700 font-medium mb-2"
              >
                Mash Temperature (°F)
              </label>
              <input
                type="number"
                step="0.1"
                id="mash_temp"
                name="mash_temp"
                value={formData.mash_temp}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Metrics and Timeline */}
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Metrics and Timeline
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="actual_og"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Original Gravity
                </label>
                <input
                  type="number"
                  step="0.001"
                  id="actual_og"
                  name="actual_og"
                  value={formData.actual_og}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="actual_fg"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Final Gravity
                </label>
                <input
                  type="number"
                  step="0.001"
                  id="actual_fg"
                  name="actual_fg"
                  value={formData.actual_fg}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="actual_abv"
                  className="block text-gray-700 font-medium mb-2"
                >
                  ABV (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="actual_abv"
                  name="actual_abv"
                  value={formData.actual_abv}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="actual_efficiency"
                  className="block text-gray-700 font-medium mb-2"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label
                  htmlFor="fermentation_start_date"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Fermentation Start Date
                </label>
                <input
                  type="date"
                  id="fermentation_start_date"
                  name="fermentation_start_date"
                  value={formData.fermentation_start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="fermentation_end_date"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Fermentation End Date
                </label>
                <input
                  type="date"
                  id="fermentation_end_date"
                  name="fermentation_end_date"
                  value={formData.fermentation_end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="packaging_date"
                  className="block text-gray-700 font-medium mb-2"
                >
                  Packaging Date
                </label>
                <input
                  type="date"
                  id="packaging_date"
                  name="packaging_date"
                  value={formData.packaging_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tasting Notes and Rating */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">
            Tasting and Evaluation
          </h2>

          <div className="mb-4">
            <label
              htmlFor="tasting_notes"
              className="block text-gray-700 font-medium mb-2"
            >
              Tasting Notes
            </label>
            <textarea
              id="tasting_notes"
              name="tasting_notes"
              rows="4"
              value={formData.tasting_notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
            ></textarea>
          </div>

          <div className="mb-4">
            <label
              htmlFor="batch_rating"
              className="block text-gray-700 font-medium mb-2"
            >
              Batch Rating (1-5)
            </label>
            <select
              id="batch_rating"
              name="batch_rating"
              value={formData.batch_rating}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/brew-sessions/${sessionId}`)}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2 hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:bg-gray-400"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBrewSession;
