import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../../services/api";
import FermentationTracker from "./FermentationTracker";

const ViewBrewSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);

        // Fetch the brew session
        const sessionResponse = await ApiService.brewSessions.getById(
          sessionId
        );
        setSession(sessionResponse.data);

        // Fetch the related recipe
        if (sessionResponse.data.recipe_id) {
          const recipeResponse = await ApiService.recipes.getById(
            sessionResponse.data.recipe_id
          );
          setRecipe(recipeResponse.data);
        }
      } catch (err) {
        console.error("Error fetching brew session:", err);
        setError("Failed to load brew session data");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  const updateSessionStatus = async (newStatus) => {
    if (
      confirm(`Are you sure you want to update the status to "${newStatus}"?`)
    ) {
      try {
        setIsUpdating(true);

        // If moving to fermenting, set fermentation start date
        let additionalData = {};
        if (newStatus === "fermenting" && !session.fermentation_start_date) {
          additionalData.fermentation_start_date = new Date()
            .toISOString()
            .split("T")[0];
        }
        // If moving to conditioning or completed, set fermentation end date
        else if (
          (newStatus === "conditioning" || newStatus === "completed") &&
          !session.fermentation_end_date
        ) {
          additionalData.fermentation_end_date = new Date()
            .toISOString()
            .split("T")[0];
        }
        // If moving to completed, set packaging date
        if (newStatus === "completed" && !session.packaging_date) {
          additionalData.packaging_date = new Date()
            .toISOString()
            .split("T")[0];
        }

        const response = await ApiService.brewSessions.update(sessionId, {
          status: newStatus,
          ...additionalData,
        });

        setSession(response.data);
      } catch (err) {
        console.error("Error updating brew session status:", err);
        alert("Failed to update brew session status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleDelete = async () => {
    if (
      confirm(
        "Are you sure you want to delete this brew session? This action cannot be undone."
      )
    ) {
      try {
        await ApiService.brewSessions.delete(sessionId);
        navigate("/brew-sessions");
      } catch (err) {
        console.error("Error deleting brew session:", err);
        alert("Failed to delete brew session");
      }
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

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "planned":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800";
      case "fermenting":
        return "bg-purple-100 text-purple-800";
      case "conditioning":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-green-500 text-white";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Determine valid next statuses based on current status
  const getNextStatuses = () => {
    switch (session.status) {
      case "planned":
        return ["in-progress"];
      case "in-progress":
        return ["fermenting"];
      case "fermenting":
        return ["conditioning", "completed"];
      case "conditioning":
        return ["completed"];
      case "completed":
        return ["archived"];
      case "archived":
        return [];
      default:
        return [];
    }
  };

  const nextStatuses = getNextStatuses();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {session.name || `Brew Session #${sessionId.substring(0, 6)}`}
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate(`/brew-sessions/${sessionId}/edit`)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Edit Session
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Delete Session
          </button>
        </div>
      </div>

      {/* Session status indicator and controls */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-700 font-semibold">Status: </span>
            <span
              className={`ml-2 px-3 py-1 rounded-full text-sm ${getStatusBadgeClass(
                session.status
              )}`}
            >
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
          </div>

          {nextStatuses.length > 0 && (
            <div className="flex items-center">
              <span className="text-gray-700 mr-2">Update Status:</span>
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => updateSessionStatus(status)}
                  disabled={isUpdating}
                  className={`ml-2 px-3 py-1 rounded text-sm ${getStatusBadgeClass(
                    status
                  )} hover:opacity-80`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6">
        <nav className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-2 px-4 text-center ${
              activeTab === "details"
                ? "border-b-2 border-amber-500 font-medium text-amber-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("fermentation")}
            className={`py-2 px-4 text-center ${
              activeTab === "fermentation"
                ? "border-b-2 border-amber-500 font-medium text-amber-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Fermentation Tracking
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`py-2 px-4 text-center ${
              activeTab === "notes"
                ? "border-b-2 border-amber-500 font-medium text-amber-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Notes & Analysis
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white p-6 rounded-lg shadow">
        {activeTab === "details" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Session Details</h2>

            {/* Recipe Information */}
            {recipe && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Recipe</h3>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{recipe.name}</p>
                      {recipe.style && (
                        <p className="text-sm text-gray-600">{recipe.style}</p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/recipes/${recipe.recipe_id}`)}
                      className="text-amber-600 hover:text-amber-800 text-sm"
                    >
                      View Recipe
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Session dates */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Brew Date:</p>
                  <p className="font-medium">
                    {new Date(session.brew_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Fermentation Start:</p>
                  <p className="font-medium">
                    {session.fermentation_start_date
                      ? new Date(
                          session.fermentation_start_date
                        ).toLocaleDateString()
                      : "Not started"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Fermentation End:</p>
                  <p className="font-medium">
                    {session.fermentation_end_date
                      ? new Date(
                          session.fermentation_end_date
                        ).toLocaleDateString()
                      : "Not completed"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Packaging Date:</p>
                  <p className="font-medium">
                    {session.packaging_date
                      ? new Date(session.packaging_date).toLocaleDateString()
                      : "Not packaged"}
                  </p>
                </div>
              </div>
            </div>

            {/* Brew stats */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Brew Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-sm">Original Gravity</p>
                  <p className="text-xl font-medium">
                    {session.actual_og ? session.actual_og.toFixed(3) : "-"}
                  </p>
                  {recipe && recipe.estimated_og && (
                    <p className="text-xs text-gray-500">
                      Est: {recipe.estimated_og.toFixed(3)}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-sm">Final Gravity</p>
                  <p className="text-xl font-medium">
                    {session.actual_fg ? session.actual_fg.toFixed(3) : "-"}
                  </p>
                  {recipe && recipe.estimated_fg && (
                    <p className="text-xs text-gray-500">
                      Est: {recipe.estimated_fg.toFixed(3)}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-sm">ABV</p>
                  <p className="text-xl font-medium">
                    {session.actual_abv
                      ? `${session.actual_abv.toFixed(1)}%`
                      : "-"}
                  </p>
                  {recipe && recipe.estimated_abv && (
                    <p className="text-xs text-gray-500">
                      Est: {recipe.estimated_abv.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-600 text-sm">Efficiency</p>
                  <p className="text-xl font-medium">
                    {session.actual_efficiency
                      ? `${session.actual_efficiency.toFixed(1)}%`
                      : "-"}
                  </p>
                  {recipe && recipe.efficiency && (
                    <p className="text-xs text-gray-500">
                      Target: {recipe.efficiency.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Brew day measurements */}
            <div>
              <h3 className="text-lg font-medium mb-2">Brew Day Notes</h3>
              {session.mash_temp && (
                <div className="mb-2">
                  <span className="text-gray-600">Mash Temperature:</span>{" "}
                  <span className="font-medium">{session.mash_temp}°F</span>
                </div>
              )}
              {session.notes ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p>{session.notes}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">
                  No brew day notes recorded.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "fermentation" && (
          <FermentationTracker
            sessionId={sessionId}
            recipeData={{
              estimated_og: recipe?.estimated_og,
              estimated_fg: recipe?.estimated_fg,
            }}
            sessionData={{
              status: session.status,
              actual_og: session.actual_og,
              actual_fg: session.actual_fg,
            }}
            onUpdateSession={(updatedData) => {
              setSession({ ...session, ...updatedData });
            }}
          />
        )}

        {activeTab === "notes" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Notes & Analysis</h2>

            {/* Tasting notes */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Tasting Notes</h3>
              {session.tasting_notes ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p>{session.tasting_notes}</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">
                  No tasting notes recorded yet.
                </p>
              )}
            </div>

            {/* Batch rating */}
            {session.batch_rating && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Batch Rating</h3>
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-6 h-6 ${
                        star <= session.batch_rating
                          ? "text-yellow-500"
                          : "text-gray-300"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-2 text-gray-700">
                    {session.batch_rating} out of 5
                  </span>
                </div>
              </div>
            )}

            {/* Attenuation analysis */}
            {session.actual_og && session.actual_fg && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">
                  Attenuation Analysis
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {(() => {
                    const actualAttenuation =
                      ((session.actual_og - session.actual_fg) /
                        (session.actual_og - 1.0)) *
                      100;
                    let estimatedAttenuation = null;
                    if (recipe && recipe.estimated_og && recipe.estimated_fg) {
                      estimatedAttenuation =
                        ((recipe.estimated_og - recipe.estimated_fg) /
                          (recipe.estimated_og - 1.0)) *
                        100;
                    }

                    return (
                      <div>
                        <p className="mb-1">
                          <span className="font-medium">
                            Actual Attenuation:
                          </span>{" "}
                          {actualAttenuation.toFixed(1)}%
                        </p>
                        {estimatedAttenuation !== null && (
                          <p className="mb-1">
                            <span className="font-medium">
                              Estimated Attenuation:
                            </span>{" "}
                            {estimatedAttenuation.toFixed(1)}%
                          </p>
                        )}
                        {estimatedAttenuation !== null && (
                          <p className="mt-2 text-sm">
                            {actualAttenuation > estimatedAttenuation + 5
                              ? "Your yeast performed better than expected with higher attenuation."
                              : actualAttenuation < estimatedAttenuation - 5
                              ? "Your yeast had lower attenuation than expected."
                              : "Your yeast performed close to expected attenuation."}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewBrewSession;
