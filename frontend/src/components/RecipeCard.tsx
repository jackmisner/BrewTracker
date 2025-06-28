import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import RecipeMetrics from "./RecipeBuilder/RecipeMetrics";
import RecipeActions from "./RecipeActions";
import ApiService from "../services/api";
import BrewSessionService from "../services/BrewSessionService";
import CacheManager from "../services/CacheManager";
import { Recipe, RecipeMetrics as RecipeMetricsType, BrewSessionSummary, BrewSession, ID } from "../types";
import "../styles/RecipeCard.css";

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: (recipeId: ID) => void;
  refreshTrigger?: number;
}

interface CacheInvalidationData {
  recipe_id?: ID;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onDelete, refreshTrigger }) => {
  const navigate = useNavigate();
  const formattedDate = new Date(recipe.created_at || '').toLocaleDateString();

  // Helper functions for brew session display
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      planned: "#3b82f6",
      "in-progress": "#f59e0b",
      fermenting: "#8b5cf6",
      conditioning: "#10b981",
      completed: "#059669",
      archived: "#6b7280",
    };
    return colors[status] || "#6b7280";
  };

  const getFormattedStatus = (status: string): string => {
    return status.replace("-", " ").toUpperCase();
  };
  
  const [metrics, setMetrics] = useState<RecipeMetricsType>({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });
  
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [brewingSummary, setBrewingSummary] = useState<BrewSessionSummary | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Force refresh function for brew session data
  const refreshBrewingData = useCallback(
    async (forceRefresh: boolean = false): Promise<void> => {
      try {
        setSessionsLoading(true);
        setSessionError(null);
        const summary = await BrewSessionService.getBrewSessionSummary(
          recipe.recipe_id,
          forceRefresh
        );
        setBrewingSummary(summary);
      } catch (err) {
        console.error("Error fetching brewing summary:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setSessionError(errorMessage);
        setBrewingSummary(null);
      } finally {
        setSessionsLoading(false);
      }
    },
    [recipe.recipe_id]
  );

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = (data?: CacheInvalidationData): void => {
      // Refresh if this recipe is affected
      if (!data || data.recipe_id === recipe.recipe_id) {
        refreshBrewingData(true);
      }
    };

    // Register for all brew session events
    CacheManager.addEventListener(
      "brew-session-created",
      handleCacheInvalidation
    );
    CacheManager.addEventListener(
      "brew-session-updated",
      handleCacheInvalidation
    );
    CacheManager.addEventListener(
      "brew-session-deleted",
      handleCacheInvalidation
    );
    CacheManager.addEventListener("recipe-refresh", handleCacheInvalidation);

    // Cleanup listeners on unmount
    return () => {
      CacheManager.removeEventListener(
        "brew-session-created",
        handleCacheInvalidation
      );
      CacheManager.removeEventListener(
        "brew-session-updated",
        handleCacheInvalidation
      );
      CacheManager.removeEventListener(
        "brew-session-deleted",
        handleCacheInvalidation
      );
      CacheManager.removeEventListener(
        "recipe-refresh",
        handleCacheInvalidation
      );
    };
  }, [recipe.recipe_id, refreshBrewingData]);

  useEffect(() => {
    const fetchMetrics = async (): Promise<void> => {
      try {
        setMetricsLoading(true);
        setMetricsError(null);

        // Validate recipe ID
        if (!recipe.recipe_id) {
          throw new Error("Invalid recipe ID");
        }

        const response = await ApiService.recipes.calculateMetrics(
          recipe.recipe_id
        );

        // Validate response structure
        if (!response || !response.data) {
          throw new Error("Invalid metrics response");
        }

        // Use the metrics from the response, with fallbacks
        const metricsData = response.data.data || response.data || {};
        const newMetrics: RecipeMetricsType = {
          og:
            metricsData?.og ||
            (metricsData as any)?.avg_og ||
            recipe.estimated_og ||
            1.0,
          fg:
            metricsData?.fg ||
            (metricsData as any)?.avg_fg ||
            recipe.estimated_fg ||
            1.0,
          abv:
            metricsData?.abv ||
            (metricsData as any)?.avg_abv ||
            recipe.estimated_abv ||
            0.0,
          ibu: metricsData?.ibu || recipe.estimated_ibu || 0,
          srm: metricsData?.srm || recipe.estimated_srm || 0,
        };

        setMetrics(newMetrics);
      } catch (error) {
        console.error("Error fetching metrics:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setMetricsError(errorMessage);

        // Fall back to recipe's estimated metrics if available
        if (
          recipe.estimated_og ||
          recipe.estimated_fg ||
          recipe.estimated_abv
        ) {
          setMetrics({
            og: recipe.estimated_og || 1.0,
            fg: recipe.estimated_fg || 1.0,
            abv: recipe.estimated_abv || 0.0,
            ibu: recipe.estimated_ibu || 0,
            srm: recipe.estimated_srm || 0,
          });
        }
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [
    recipe.recipe_id,
    recipe.estimated_og,
    recipe.estimated_fg,
    recipe.estimated_abv,
    recipe.estimated_ibu,
    recipe.estimated_srm,
  ]);

  useEffect(() => {
    refreshBrewingData();
  }, [refreshBrewingData, refreshTrigger]);

  const formatDate = (dateObj: Date | string | null | undefined): string => {
    if (!dateObj) return "Unknown";
    if (typeof dateObj === "string") {
      return new Date(dateObj).toLocaleDateString();
    }
    return dateObj.toLocaleDateString();
  };

  const getRelevantSession = (): BrewSession | null => {
    return brewingSummary?.mostRelevant || null;
  };

  const handleViewSession = async (sessionId: ID): Promise<void> => {
    try {
      await BrewSessionService.safeNavigateToSession(sessionId, navigate);
    } catch (error) {
      console.error("Session navigation failed:", error);
      setSessionError("This session no longer exists");
      // Force refresh the data to update the UI
      await refreshBrewingData(true);
    }
  };

  const relevantSession = getRelevantSession();

  return (
    <div className="recipe-card">
      <div className="recipe-card-header">
        <h2 className="recipe-card-title">{recipe.name}</h2>
        <p className="recipe-card-style">{recipe.style}</p>
        {recipe.version && recipe.version > 1 && (
          <div className="recipe-card-version">Version: {recipe.version}</div>
        )}
        <p className="recipe-card-description">
          {recipe.description || "No description available."}
        </p>
      </div>

      {/* Enhanced Metrics Display with Error Handling */}
      <div className="recipe-card-metrics">
        {metricsLoading ? (
          <div className="metrics-loading">
            <span className="loading-text">Loading metrics...</span>
          </div>
        ) : metricsError ? (
          <div className="metrics-error">
            <span className="error-text">Metrics unavailable</span>
            <small className="error-detail">{metricsError}</small>
          </div>
        ) : (
          <RecipeMetrics 
            metrics={metrics} 
            cardView={true} 
            onScale={() => {}} 
            recipe={recipe} 
          />
        )}
      </div>

      {/* Enhanced Brew Sessions Info */}
      <div className="recipe-card-brewing">
        {sessionsLoading ? (
          <div className="brewing-status">
            <span className="loading-text">Loading sessions...</span>
          </div>
        ) : sessionError ? (
          <div className="brewing-status">
            <div className="session-error">
              <span className="error-text">{sessionError}</span>
              <button
                onClick={() => refreshBrewingData(true)}
                data-testid="refresh-button"
                className="recipe-card-button refresh-button"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : brewingSummary && brewingSummary.total > 0 ? (
          <div className="brewing-status">
            <div className="session-summary">
              <div className="session-info">
                <div className="session-stats">
                  <span className="session-count">
                    {brewingSummary.total} session
                    {brewingSummary.total !== 1 ? "s" : ""}
                  </span>
                  {brewingSummary.active > 0 && (
                    <span className="active-indicator">
                      {brewingSummary.active} active
                    </span>
                  )}
                  {brewingSummary.averageRating && (
                    <span className="rating-indicator">
                      {brewingSummary.averageRating.toFixed(1)}★
                    </span>
                  )}
                </div>

                {relevantSession && (
                  <div className="latest-session">
                    <span className="session-label">
                      {brewingSummary.active > 0 ? "Latest:" : "Last brewed:"}
                    </span>
                    <span
                      className="session-status"
                      style={{
                        color: getStatusColor(relevantSession.status || ""),
                        fontWeight: "600",
                      }}
                    >
                      {getFormattedStatus(relevantSession.status || "")}
                    </span>
                    <span className="session-date">
                      {formatDate(relevantSession.brew_date)}
                    </span>

                    {relevantSession.actual_abv && (
                      <div className="session-metrics">
                        <span className="metric-item">
                          ABV: {relevantSession.actual_abv.toFixed(1)}%
                        </span>
                        {relevantSession.batch_rating && (
                          <span className="metric-item">
                            {relevantSession.batch_rating}★
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="brewing-actions">
              {relevantSession && (
                <button
                  onClick={() => handleViewSession(relevantSession.session_id)}
                  className="recipe-card-button session-button"
                >
                  View Latest
                </button>
              )}
              <button
                onClick={() =>
                  navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`)
                }
                className="recipe-card-button brew-button"
              >
                Brew Again
              </button>
            </div>
          </div>
        ) : (
          <div className="brewing-status">
            <div className="no-sessions">
              <span className="no-sessions-text">Not brewed yet</span>
              <span className="encouragement">Ready to try this recipe?</span>
            </div>
            <button
              onClick={() =>
                navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`)
              }
              className="recipe-card-button brew-button primary"
            >
              Start Brewing
            </button>
          </div>
        )}
      </div>

      <div className="recipe-card-footer">
        <span>Created on: {formattedDate}</span>
      </div>

      <RecipeActions
        recipe={recipe}
        compact={true}
        refreshTrigger={null}
        onDelete={onDelete}
        showViewButton={true}
      />
    </div>
  );
};

export default RecipeCard;