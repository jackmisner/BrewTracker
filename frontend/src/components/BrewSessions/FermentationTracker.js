import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ApiService from "../../services/api";

const FermentationTracker = ({
  sessionId,
  recipeData = {},
  sessionData = {},
  onUpdateSession,
}) => {
  const [fermentationData, setFermentationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState({
    gravity: "",
    temperature: "",
    ph: "",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialOGSet, setInitialOGSet] = useState(false);

  // Fetch fermentation data
  const fetchFermentationData = async () => {
    try {
      setLoading(true);

      // Fetch fermentation data entries
      const response = await ApiService.brewSessions.getFermentationData(
        sessionId
      );
      setFermentationData(response.data);

      // Fetch fermentation statistics
      const statsResponse = await ApiService.brewSessions.getFermentationStats(
        sessionId
      );
      if (statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (err) {
      console.error("Error fetching fermentation data:", err);
      setError("Failed to load fermentation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFermentationData();
  }, [sessionId]);

  // Set initial OG reading if session has actual_og but no fermentation data
  useEffect(() => {
    if (
      !initialOGSet &&
      fermentationData.length === 0 &&
      sessionData.actual_og &&
      sessionData.status === "fermenting"
    ) {
      setFormData((prev) => ({
        ...prev,
        gravity: sessionData.actual_og,
      }));
      setShowForm(true);
      setInitialOGSet(true);
    }
  }, [fermentationData, sessionData, initialOGSet]);

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

      // Format data for submission
      const entry = {
        gravity: formData.gravity ? parseFloat(formData.gravity) : null,
        temperature: formData.temperature
          ? parseFloat(formData.temperature)
          : null,
        ph: formData.ph ? parseFloat(formData.ph) : null,
        notes: formData.notes || null,
        entry_date: new Date().toISOString(),
      };

      // Submit data
      const response = await ApiService.brewSessions.addFermentationEntry(
        sessionId,
        entry
      );

      // Update the brew session if this is the first gravity reading
      if (fermentationData.length === 0 && entry.gravity) {
        // If this is the first entry and the session doesn't have an OG, update it
        if (!sessionData.actual_og) {
          const sessionUpdateData = {
            actual_og: entry.gravity,
          };

          await ApiService.brewSessions.update(sessionId, sessionUpdateData);

          // Notify parent component of the update
          if (onUpdateSession) {
            onUpdateSession(sessionUpdateData);
          }
        }
      }

      // If status is fermenting and this entry has a lower gravity than the OG,
      // it might be the FG if it's stabilized
      if (
        sessionData.status === "fermenting" &&
        entry.gravity &&
        sessionData.actual_og &&
        entry.gravity < sessionData.actual_og &&
        !sessionData.actual_fg
      ) {
        // Check if gravity has stabilized (two readings within 0.001)
        if (fermentationData.length > 0) {
          const lastEntry = fermentationData[fermentationData.length - 1];
          if (
            lastEntry.gravity &&
            Math.abs(lastEntry.gravity - entry.gravity) <= 0.001
          ) {
            const sessionUpdateData = {
              actual_fg: entry.gravity,
              actual_abv: (sessionData.actual_og - entry.gravity) * 131.25,
            };

            await ApiService.brewSessions.update(sessionId, sessionUpdateData);

            // Notify parent component of the update
            if (onUpdateSession) {
              onUpdateSession(sessionUpdateData);
            }
          }
        }
      }

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
    } catch (err) {
      console.error("Error adding fermentation entry:", err);
      setError("Failed to add fermentation entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (index) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      try {
        await ApiService.brewSessions.deleteFermentationEntry(sessionId, index);
        fetchFermentationData(); // Refresh data
      } catch (err) {
        console.error("Error deleting fermentation entry:", err);
        setError("Failed to delete fermentation entry");
      }
    }
  };

  // Format data for the chart
  const formatChartData = () => {
    if (!fermentationData || fermentationData.length === 0) {
      return [];
    }

    return fermentationData.map((entry) => ({
      date: new Date(entry.entry_date).toLocaleDateString(),
      gravity: entry.gravity,
      temperature: entry.temperature,
      ph: entry.ph,
    }));
  };

  const chartData = formatChartData();

  // Calculate attenuation if possible
  const calculateAttenuation = () => {
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
      ((firstReading.gravity - lastReading.gravity) /
        (firstReading.gravity - 1.0)) *
      100;
    return attenuation.toFixed(1);
  };

  const attenuation = calculateAttenuation();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Fermentation Tracking</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
        >
          {showForm ? "Cancel" : "Add Entry"}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Form for adding new fermentation data */}
      {showForm && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-medium mb-3">New Fermentation Reading</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label
                  htmlFor="gravity"
                  className="block text-gray-700 font-medium mb-1"
                >
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="temperature"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Temperature (°F)
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="temperature"
                  name="temperature"
                  placeholder="e.g. 68.5"
                  value={formData.temperature}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label
                  htmlFor="ph"
                  className="block text-gray-700 font-medium mb-1"
                >
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label
                htmlFor="notes"
                className="block text-gray-700 font-medium mb-1"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows="2"
                placeholder="Any observations about the fermentation"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
              ></textarea>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:bg-gray-400"
              >
                {submitting ? "Saving..." : "Save Reading"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">Loading fermentation data...</div>
      ) : (
        <>
          {/* Fermentation stats summary */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-md font-medium mb-2">Gravity</h3>
                {stats.gravity.initial && (
                  <p className="mb-1">
                    <span className="text-gray-600">Initial:</span>{" "}
                    <span className="font-medium">
                      {stats.gravity.initial.toFixed(3)}
                    </span>
                  </p>
                )}
                {stats.gravity.current && (
                  <p className="mb-1">
                    <span className="text-gray-600">Current:</span>{" "}
                    <span className="font-medium">
                      {stats.gravity.current.toFixed(3)}
                    </span>
                  </p>
                )}
                {stats.gravity.drop && (
                  <p className="mb-1">
                    <span className="text-gray-600">Drop:</span>{" "}
                    <span className="font-medium">
                      {stats.gravity.drop.toFixed(3)}
                    </span>
                  </p>
                )}
                {stats.gravity.attenuation && (
                  <p className="mb-1">
                    <span className="text-gray-600">Attenuation:</span>{" "}
                    <span className="font-medium">
                      {stats.gravity.attenuation.toFixed(1)}%
                    </span>
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-md font-medium mb-2">Temperature</h3>
                {stats.temperature.min !== null && (
                  <p className="mb-1">
                    <span className="text-gray-600">Min:</span>{" "}
                    <span className="font-medium">
                      {stats.temperature.min.toFixed(1)}°F
                    </span>
                  </p>
                )}
                {stats.temperature.max !== null && (
                  <p className="mb-1">
                    <span className="text-gray-600">Max:</span>{" "}
                    <span className="font-medium">
                      {stats.temperature.max.toFixed(1)}°F
                    </span>
                  </p>
                )}
                {stats.temperature.avg !== null && (
                  <p className="mb-1">
                    <span className="text-gray-600">Avg:</span>{" "}
                    <span className="font-medium">
                      {stats.temperature.avg.toFixed(1)}°F
                    </span>
                  </p>
                )}
              </div>

              {stats.ph.data.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-md font-medium mb-2">pH</h3>
                  {stats.ph.min !== null && (
                    <p className="mb-1">
                      <span className="text-gray-600">Min:</span>{" "}
                      <span className="font-medium">
                        {stats.ph.min.toFixed(1)}
                      </span>
                    </p>
                  )}
                  {stats.ph.max !== null && (
                    <p className="mb-1">
                      <span className="text-gray-600">Max:</span>{" "}
                      <span className="font-medium">
                        {stats.ph.max.toFixed(1)}
                      </span>
                    </p>
                  )}
                  {stats.ph.avg !== null && (
                    <p className="mb-1">
                      <span className="text-gray-600">Avg:</span>{" "}
                      <span className="font-medium">
                        {stats.ph.avg.toFixed(1)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expected vs actual visualization */}
          {recipeData.estimated_og && recipeData.estimated_fg && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">
                Expected vs. Actual Fermentation
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Expected OG</p>
                    <p className="font-medium">
                      {recipeData.estimated_og.toFixed(3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Expected FG</p>
                    <p className="font-medium">
                      {recipeData.estimated_fg.toFixed(3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">
                      Expected Attenuation
                    </p>
                    <p className="font-medium">
                      {(
                        ((recipeData.estimated_og - recipeData.estimated_fg) /
                          (recipeData.estimated_og - 1.0)) *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                </div>

                {/* Actual readings */}
                {fermentationData.length > 0 && (
                  <div className="flex justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Actual OG</p>
                      <p className="font-medium">
                        {fermentationData[0].gravity
                          ? fermentationData[0].gravity.toFixed(3)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Current Gravity</p>
                      <p className="font-medium">
                        {fermentationData[fermentationData.length - 1].gravity
                          ? fermentationData[
                              fermentationData.length - 1
                            ].gravity.toFixed(3)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">
                        Current Attenuation
                      </p>
                      <p className="font-medium">
                        {attenuation ? `${attenuation}%` : "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chart visualization */}
          {chartData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">
                Fermentation Progress
              </h3>
              <div
                className="bg-white border border-gray-200 rounded-lg p-4"
                style={{ height: "400px" }}
              >
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
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="gravity" domain={["auto", "auto"]} />
                    <YAxis
                      yAxisId="temp"
                      orientation="right"
                      domain={["auto", "auto"]}
                    />
                    <Tooltip />
                    <Legend />
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
                      name="Temperature (°F)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div>
            <h3 className="text-lg font-medium mb-3">Fermentation Data Log</h3>
            {fermentationData.length === 0 ? (
              <p className="text-gray-500 italic">
                No fermentation data recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gravity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Temperature
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        pH
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fermentationData.map((entry, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(entry.entry_date).toLocaleDateString()}{" "}
                          {new Date(entry.entry_date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.gravity ? entry.gravity.toFixed(3) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.temperature
                            ? `${entry.temperature.toFixed(1)}°F`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {entry.ph ? entry.ph.toFixed(1) : "-"}
                        </td>
                        <td className="px-6 py-4">{entry.notes || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(index)}
                            className="text-red-600 hover:text-red-900"
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
        </>
      )}
    </div>
  );
};

export default FermentationTracker;
