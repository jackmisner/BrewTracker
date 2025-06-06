import RecipeMetrics from "./RecipeBuilder/RecipeMetrics";
import RecipeActions from "./RecipeActions";
import ApiService from "../services/api";
import BrewSessionService from "../services/BrewSessionService";
import CacheManager from "../services/CacheManager";
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import "../styles/RecipeCard.css";

const RecipeCard = ({ recipe, onDelete, refreshTrigger }) => {
  const navigate = useNavigate();
  const formattedDate = new Date(recipe.created_at).toLocaleDateString();
  const [metrics, setMetrics] = useState({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });
  const [brewingSummary, setBrewingSummary] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  // Force refresh function for brew session data
  const refreshBrewingData = useCallback(
    async (forceRefresh = false) => {
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
        setSessionError(err.message);
        setBrewingSummary(null);
      } finally {
        setSessionsLoading(false);
      }
    },
    [recipe.recipe_id]
  );

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = (data) => {
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
    const fetchMetrics = async () => {
      try {
        const response = await ApiService.recipes.calculateMetrics(
          recipe.recipe_id
        );
        setMetrics(response.data);
      } catch (error) {
        console.error("Error fetching metrics:", error);
      }
    };

    fetchMetrics();
  }, [recipe.recipe_id]);

  useEffect(() => {
    refreshBrewingData();
  }, [refreshBrewingData, refreshTrigger]);

  const formatDate = (dateObj) => {
    if (!dateObj) return "Unknown";
    return dateObj.toLocaleDateString();
  };

  const getRelevantSession = () => {
    return brewingSummary?.mostRelevant || null;
  };

  const handleViewSession = async (sessionId) => {
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
        {recipe.version > 1 && (
          <div className="recipe-card-version">Version: {recipe.version}</div>
        )}
        <p className="recipe-card-description">
          {recipe.description || "No description available."}
        </p>
      </div>

      <RecipeMetrics metrics={metrics} cardView={true} />

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
                        color: relevantSession.statusColor,
                        fontWeight: "600",
                      }}
                    >
                      {relevantSession.formattedStatus}
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
        refreshTrigger={refreshTrigger}
        onDelete={onDelete}
        showViewButton={true}
        showBrewButton={false} // Hide the brew button since we handle it above
      />
    </div>
  );
};

export default RecipeCard;
