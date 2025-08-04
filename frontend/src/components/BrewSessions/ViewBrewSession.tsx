import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Services } from "../../services";
import { invalidateBrewSessionCaches } from "../../services/CacheManager";
import FermentationTracker from "./FermentationTracker";
import GravityStabilizationAnalysis from "./GravityStabilizationAnalysis";
import { Recipe, BrewSession } from "../../types";
import {
  formatGravity,
  formatAbv,
  formatEfficiency,
  formatAttenuation,
  formatTemperature,
} from "../../utils/formatUtils";
import "../../styles/BrewSessions.css";

type BrewSessionStatus =
  | "planned"
  | "in-progress"
  | "fermenting"
  | "conditioning"
  | "completed"
  | "archived";
type ActiveTab = "details" | "fermentation" | "notes";

const ViewBrewSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<BrewSession | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError("");

        // Fetch the brew session using Services
        const sessionData =
          await Services.brewSession.fetchBrewSession(sessionId);
        console.log("Fetched brew session data:", sessionData);
        setSession(sessionData);

        // Fetch the related recipe if it exists
        if (sessionData.recipe_id) {
          try {
            const recipeData = await Services.recipe.fetchRecipe(
              sessionData.recipe_id
            );
            setRecipe(recipeData);
          } catch (recipeErr: any) {
            console.warn("Could not fetch associated recipe:", recipeErr);
            setRecipe(null);
          }
        }
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

    fetchSessionData();
  }, [sessionId, navigate]);

  const updateSessionStatus = async (
    newStatus: BrewSessionStatus
  ): Promise<void> => {
    if (!session || !sessionId) return;

    if (
      window.confirm(
        `Are you sure you want to update the status to "${newStatus}"?`
      )
    ) {
      try {
        setIsUpdating(true);
        setError("");

        // If moving to fermenting, set fermentation start date
        let additionalData: Partial<BrewSession> = {};
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

        const updatedSession = await Services.brewSession.updateBrewSession(
          sessionId,
          {
            name: session.name, // Include the existing name to avoid validation error
            status: newStatus,
            ...additionalData,
          }
        );

        setSession(updatedSession);

        // Invalidate caches to update all related components
        invalidateBrewSessionCaches.onUpdated({
          session_id: sessionId,
          recipe_id: updatedSession.recipe_id,
        });
      } catch (err: any) {
        console.error("Error updating brew session status:", err);
        setError(err.message || "Failed to update brew session status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!session || !sessionId) return;

    if (
      window.confirm(
        "Are you sure you want to delete this brew session? This action cannot be undone."
      )
    ) {
      try {
        setError("");

        // Store session data before deletion for cache invalidation
        const sessionDataForCache = {
          session_id: sessionId,
          recipe_id: session.recipe_id,
        };

        await Services.brewSession.deleteBrewSession(sessionId);

        // Invalidate caches to update all related components
        invalidateBrewSessionCaches.onDeleted(sessionDataForCache);

        navigate("/brew-sessions");
      } catch (err: any) {
        console.error("Error deleting brew session:", err);
        setError(err.message || "Failed to delete brew session");
      }
    }
  };

  const handleErrorDismiss = (): void => {
    setError("");
  };

  const handleCompletionSuggestion = async (): Promise<void> => {
    try {
      if (!session || session.status === "completed") {
        return;
      }

      // Get the latest gravity reading for final gravity
      const fermentationData = session.fermentation_data || [];
      const latestGravityEntry = [...fermentationData]
        .reverse()
        .find(entry => entry.gravity);

      if (!latestGravityEntry?.gravity) {
        setError("No gravity reading available to set as final gravity");
        return;
      }

      setIsUpdating(true);

      const updateData: Partial<BrewSession> = {
        status: "completed",
        actual_fg: latestGravityEntry.gravity,
        fermentation_end_date: new Date().toISOString().split("T")[0], // Today's date
      };

      // Calculate ABV if we have OG
      if (session.actual_og) {
        updateData.actual_abv =
          (session.actual_og - latestGravityEntry.gravity) * 131.25;
      }

      const updatedSession = await Services.brewSession.updateBrewSession(
        session.session_id,
        updateData
      );

      // Update local state
      setSession(updatedSession);

      // Clear any related caches
      invalidateBrewSessionCaches.onUpdated({
        sessionId: session.session_id,
        recipeId: session.recipe_id,
      });
    } catch (err: any) {
      console.error("Error updating session to completed:", err);
      setError("Failed to mark session as completed");
    } finally {
      setIsUpdating(false);
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

  if (!session || !sessionId) {
    return <div className="empty-message">Brew session not found</div>;
  }

  const getStatusBadgeClass = (status: string): string => {
    return `status-badge status-${status}`;
  };

  // Determine valid next statuses based on current status
  const getNextStatuses = (): BrewSessionStatus[] => {
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
    <div className="container">
      {error && (
        <div className="error-message" style={{ marginBottom: "1rem" }}>
          {error}
          <button
            onClick={handleErrorDismiss}
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

      <div className="brew-sessions-header">
        <h1 className="brew-session-title">
          {(session as any).displayName ||
            session.name ||
            `Brew Session #${sessionId.substring(0, 6)}`}
        </h1>
        <div className="brew-session-actions">
          <button
            onClick={() => navigate(`/brew-sessions/${sessionId}/edit`)}
            className="brew-session-action-button brew-session-edit-button"
            disabled={isUpdating}
          >
            Edit Session
          </button>
          <button
            onClick={handleDelete}
            className="brew-session-action-button brew-session-delete-button"
            disabled={isUpdating}
          >
            Delete Session
          </button>
        </div>
      </div>

      {/* Session status indicator and controls */}
      <div className="brew-session-controls">
        <div className="brew-session-status-container">
          <span className="brew-session-status-label">Status: </span>
          <span className={getStatusBadgeClass(session.status)}>
            {(session as any).formattedStatus ||
              session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        </div>

        {nextStatuses.length > 0 && (
          <div className="brew-session-update-status">
            <span className="brew-session-update-label">Update Status:</span>
            {nextStatuses.map(status => (
              <button
                key={status}
                onClick={() => updateSessionStatus(status)}
                disabled={isUpdating}
                className={`status-button status-${status}`}
              >
                {isUpdating
                  ? "Updating..."
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="brew-session-tab-container">
        <div className="brew-session-tabs">
          <button
            onClick={() => setActiveTab("details")}
            className={`brew-session-tab ${
              activeTab === "details" ? "active" : ""
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("fermentation")}
            className={`brew-session-tab ${
              activeTab === "fermentation" ? "active" : ""
            }`}
          >
            Fermentation Tracking
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`brew-session-tab ${
              activeTab === "notes" ? "active" : ""
            }`}
          >
            Notes & Analysis
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="brew-session-content">
        {activeTab === "details" && (
          <div>
            <h2 className="brew-session-section-title">Session Details</h2>

            {/* Recipe Information */}
            {recipe && (
              <div className="brew-session-section">
                <h3 className="section-title">Recipe</h3>
                <div className="brew-session-recipe">
                  <div className="brew-session-recipe-header">
                    <div>
                      <p className="brew-session-recipe-name">{recipe.name}</p>
                      {recipe.style && (
                        <p className="brew-session-recipe-style">
                          {recipe.style}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/recipes/${recipe.recipe_id}`)}
                      className="brew-session-recipe-link"
                    >
                      View Recipe
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Session dates */}
            <div className="brew-session-section">
              <h3 className="section-title">Timeline</h3>
              <div className="brew-session-timeline">
                <div className="brew-session-timeline-item">
                  <p className="brew-session-timeline-label">Brew Date:</p>
                  <p className="brew-session-timeline-date">
                    {session.brew_date
                      ? new Date(session.brew_date).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div className="brew-session-timeline-item">
                  <p className="brew-session-timeline-label">
                    Fermentation Start:
                  </p>
                  <p className="brew-session-timeline-date">
                    {session.fermentation_start_date
                      ? new Date(
                          session.fermentation_start_date
                        ).toLocaleDateString()
                      : "Not started"}
                  </p>
                </div>
                <div className="brew-session-timeline-item">
                  <p className="brew-session-timeline-label">
                    Fermentation End:
                  </p>
                  <p className="brew-session-timeline-date">
                    {session.fermentation_end_date
                      ? new Date(
                          session.fermentation_end_date
                        ).toLocaleDateString()
                      : "Not completed"}
                  </p>
                </div>
                <div className="brew-session-timeline-item">
                  <p className="brew-session-timeline-label">Packaging Date:</p>
                  <p className="brew-session-timeline-date">
                    {session.packaging_date
                      ? new Date(session.packaging_date).toLocaleDateString()
                      : "Not packaged"}
                  </p>
                </div>
              </div>
            </div>

            {/* Brew stats */}
            <div className="brew-session-section">
              <h3 className="section-title">Brew Metrics</h3>
              <div className="brew-session-metrics">
                <div className="brew-session-metric">
                  <p className="brew-session-metric-label">Original Gravity</p>
                  <p className="brew-session-metric-value">
                    {session.actual_og ? formatGravity(session.actual_og) : "-"}
                  </p>
                  {recipe && recipe.estimated_og && (
                    <p className="brew-session-metric-est">
                      Est: {formatGravity(recipe.estimated_og)}
                    </p>
                  )}
                </div>
                <div className="brew-session-metric">
                  <p className="brew-session-metric-label">Final Gravity</p>
                  <p className="brew-session-metric-value">
                    {session.actual_fg ? formatGravity(session.actual_fg) : "-"}
                  </p>
                  {recipe && recipe.estimated_fg && (
                    <p className="brew-session-metric-est">
                      Est: {formatGravity(recipe.estimated_fg)}
                    </p>
                  )}
                </div>
                <div className="brew-session-metric">
                  <p className="brew-session-metric-label">ABV</p>
                  <p className="brew-session-metric-value">
                    {session.actual_abv ? formatAbv(session.actual_abv) : "-"}
                  </p>
                  {recipe && recipe.estimated_abv && (
                    <p className="brew-session-metric-est">
                      Est: {formatAbv(recipe.estimated_abv)}
                    </p>
                  )}
                </div>
                <div className="brew-session-metric">
                  <p className="brew-session-metric-label">Efficiency</p>
                  <p className="brew-session-metric-value">
                    {session.actual_efficiency
                      ? formatEfficiency(session.actual_efficiency)
                      : "-"}
                  </p>
                  {recipe && recipe.efficiency && (
                    <p className="brew-session-metric-est">
                      Target: {formatEfficiency(recipe.efficiency)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Brew day measurements */}
            <div className="brew-session-section">
              <h3 className="section-title">Brew Day Notes</h3>
              {session.mash_temp && (
                <div className="brewing-data">
                  <div className="brewing-data-item">
                    <span className="brewing-data-label">
                      Mash Temperature:
                    </span>
                    <span className="brewing-data-value">
                      {formatTemperature(session.mash_temp, "f")}
                    </span>
                  </div>
                </div>
              )}
              {session.notes ? (
                <div className="brew-session-notes">
                  <p>{session.notes}</p>
                </div>
              ) : (
                <p className="empty-message">No brew day notes recorded.</p>
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
              ingredients: recipe?.ingredients, // Pass full ingredients for dry hop extraction
            }}
            sessionData={{
              status: session.status,
              actual_og: session.actual_og,
              actual_fg: session.actual_fg,
              dry_hop_additions: session.dry_hop_additions,
              fermentation_start_date: session.fermentation_start_date,
              fermentation_end_date: session.fermentation_end_date,
              packaging_date: session.packaging_date,
            }}
            onUpdateSession={async (
              updatedData: Partial<BrewSession> & { needsRefresh?: boolean }
            ) => {
              // If needsRefresh is true, refetch the entire session
              if (updatedData.needsRefresh) {
                try {
                  const freshSessionData =
                    await Services.brewSession.fetchBrewSession(sessionId);
                  setSession(freshSessionData);

                  // Invalidate caches
                  invalidateBrewSessionCaches.onUpdated({
                    session_id: sessionId,
                    recipe_id: freshSessionData.recipe_id,
                  });
                } catch (error) {
                  console.error("Error refreshing session data:", error);
                }
              } else {
                // Normal update path
                const updatedSession = { ...session, ...updatedData };
                setSession(updatedSession);

                // Invalidate caches when fermentation data is updated
                invalidateBrewSessionCaches.onUpdated({
                  session_id: sessionId,
                  recipe_id: updatedSession.recipe_id,
                });
              }
            }}
          />
        )}

        {activeTab === "notes" && (
          <div>
            <h2 className="brew-session-section-title">Notes & Analysis</h2>

            {/* Tasting notes */}
            <div className="brew-session-section">
              <h3 className="section-title">Tasting Notes</h3>
              {session.tasting_notes ? (
                <div className="brew-session-notes">
                  <p>{session.tasting_notes}</p>
                </div>
              ) : (
                <p className="empty-message">No tasting notes recorded yet.</p>
              )}
            </div>

            {/* Batch rating */}
            {session.batch_rating && (
              <div className="brew-session-section">
                <h3 className="section-title">Batch Rating</h3>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg
                      key={star}
                      className={`rating-star ${
                        star <= session.batch_rating! ? "filled" : ""
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="rating-text">
                    {session.batch_rating} out of 5
                  </span>
                </div>
              </div>
            )}

            {/* Attenuation analysis */}
            {session.actual_og && session.actual_fg && (
              <div className="brew-session-section">
                <h3 className="section-title">Attenuation Analysis</h3>
                <div className="fermentation-comparison">
                  {(() => {
                    const actualAttenuation =
                      ((session.actual_og - session.actual_fg) /
                        (session.actual_og - 1.0)) *
                      100;
                    let estimatedAttenuation: number | null = null;
                    if (recipe && recipe.estimated_og && recipe.estimated_fg) {
                      estimatedAttenuation =
                        ((recipe.estimated_og - recipe.estimated_fg) /
                          (recipe.estimated_og - 1.0)) *
                        100;
                    }

                    return (
                      <div>
                        <div className="fermentation-stat-row">
                          <span className="fermentation-stat-label">
                            Actual Attenuation:
                          </span>
                          <span className="fermentation-stat-value">
                            {formatAttenuation(actualAttenuation)}
                          </span>
                        </div>
                        {estimatedAttenuation !== null && (
                          <div className="fermentation-stat-row">
                            <span className="fermentation-stat-label">
                              Estimated Attenuation:
                            </span>
                            <span className="fermentation-stat-value">
                              {formatAttenuation(estimatedAttenuation)}
                            </span>
                          </div>
                        )}
                        {estimatedAttenuation !== null && (
                          <p className="fermentation-analysis">
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

            {/* Advanced Gravity Analysis */}
            {session.fermentation_data &&
              session.fermentation_data.length >= 3 &&
              session.status === "fermenting" && (
                <div className="brew-session-section">
                  <h3 className="section-title">
                    Fermentation Completion Analysis
                  </h3>
                  <GravityStabilizationAnalysis
                    sessionId={session.session_id}
                    onSuggestCompletion={handleCompletionSuggestion}
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewBrewSession;
