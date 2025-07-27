import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Services } from "../services";
import ApiService from "../services/api";
import CompactRecipeHeader from "../components/CompactRecipeHeader";
import CompactRecipeInfo from "../components/CompactRecipeInfo";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import RecipeActions from "../components/RecipeActions";
import {
  Recipe,
  RecipeIngredient,
  BrewSession,
  BrewSessionSummary,
  ID,
  User,
} from "../types";
import {
  formatGravity,
  formatAbv,
  formatEfficiency,
  formatPercentage,
} from "../utils/formatUtils";
import "../styles/ViewRecipe.css";
import "../styles/CompactComponents.css";

interface BrewingStats {
  averageOG?: number;
  averageABV?: number;
  averageEfficiency?: number;
  consistency?: {
    abv: number;
  };
}

interface ProcessedBrewSession extends BrewSession {
  displayName: string;
  statusColor: string;
  formattedStatus: string;
  duration?: number;
}

const ViewRecipe: React.FC = () => {
  const { recipeId } = useParams<{ recipeId: ID }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [brewSessions, setBrewSessions] = useState<ProcessedBrewSession[]>([]);
  const [brewingSummary, setBrewingSummary] =
    useState<BrewSessionSummary | null>(null);
  const [brewingStats, setBrewingStats] = useState<BrewingStats | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);

  // Fetch current user profile to determine ownership
  useEffect(() => {
    const fetchCurrentUser = async (): Promise<void> => {
      try {
        setUserLoading(true);
        const response = await ApiService.auth.getProfile();
        setCurrentUser(response.data as unknown as User);
      } catch (err: any) {
        console.error("Error fetching current user:", err);
        // Don't set error state - this is not critical for viewing recipes
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchRecipe = async (): Promise<void> => {
      if (!recipeId) return;

      try {
        setLoading(true);
        const recipeData = await Services.recipe.fetchRecipe(recipeId);
        setRecipe(recipeData);
        setIngredients(recipeData?.ingredients || []);
      } catch (err: any) {
        console.error("Error fetching recipe:", err);
        setError(err.message || "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId]);

  useEffect(() => {
    const fetchBrewData = async (): Promise<void> => {
      if (!recipeId) return;

      try {
        setSessionsLoading(true);

        // Fetch sessions, summary, and stats in parallel
        const [sessions, summary, stats] = await Promise.all([
          Services.brewSession.getBrewSessionsForRecipe(recipeId),
          Services.brewSession.getBrewSessionSummary(recipeId),
          Services.brewSession.getBrewingStats(recipeId),
        ]);

        setBrewSessions(sessions as ProcessedBrewSession[]);
        setBrewingSummary(summary);
        setBrewingStats(stats as BrewingStats);
      } catch (err: any) {
        console.error("Error fetching brew data:", err);
        // Don't set error state for sessions - just log it
        setBrewSessions([]);
        setBrewingSummary(null);
        setBrewingStats(null);
      } finally {
        setSessionsLoading(false);
      }
    };

    if (recipeId) {
      fetchBrewData();
    }
  }, [recipeId]);

  if (loading || userLoading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  if (!recipe) {
    return <div className="text-center py-10">Recipe not found</div>;
  }

  // Determine if current user owns this recipe
  // Only show edit/delete if we have both user and recipe data, and they match
  const isRecipeOwner = Boolean(
    currentUser && 
    recipe && 
    currentUser.user_id && 
    recipe.user_id && 
    String(currentUser.user_id) === String(recipe.user_id)
  );
  
  // For public recipes or when we can't determine ownership, treat as public
  const isPublicRecipe = !isRecipeOwner;

  return (
    <div className="view-recipe-container">
      <CompactRecipeHeader 
        recipe={recipe} 
        showViewButton={false} 
        isPublicRecipe={isPublicRecipe}
        originalAuthor={recipe.username || (isPublicRecipe ? "Recipe Author" : "Unknown")}
      />

      <div className="view-recipe-content">
        <div className="view-recipe-top-section">
          <div className="view-recipe-details">
            <CompactRecipeInfo recipe={recipe} />

            {recipe.notes && (
              <div className="compact-recipe-notes">
                <h3 className="compact-recipe-info-title">Brewing Notes</h3>
                <p className="compact-recipe-description">{recipe.notes}</p>
              </div>
            )}
          </div>

          <div className="view-recipe-brew-sessions">
            {/* Enhanced Brew Sessions Section */}
            <div className="recipe-section">
              <div className="section-header">
                <div className="section-title-container">
                  <h2 className="section-title">Brew Sessions</h2>
                  {brewingSummary && brewingSummary.total > 0 && (
                    <div className="brewing-summary">
                      <span className="summary-stat">
                        {brewingSummary.total} total
                      </span>
                      {brewingSummary.active > 0 && (
                        <span className="summary-stat active">
                          {brewingSummary.active} active
                        </span>
                      )}
                      {brewingSummary.completed > 0 && (
                        <span className="summary-stat completed">
                          {brewingSummary.completed} completed
                        </span>
                      )}
                      {brewingSummary.averageRating && (
                        <span className="summary-stat rating">
                          {brewingSummary.averageRating.toFixed(1)}★ avg
                        </span>
                      )}
                      {brewingSummary.successRate && (
                        <span className="summary-stat success">
                          {formatPercentage(brewingSummary.successRate, 0)}{" "}
                          success
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {sessionsLoading ? (
                <p>Loading brew sessions...</p>
              ) : brewSessions.length === 0 ? (
                <div className="empty-state">
                  <p>No brew sessions recorded for this recipe yet.</p>
                  <button
                    onClick={() =>
                      navigate(
                        `/brew-sessions/new?recipeId=${recipe.recipe_id}`
                      )
                    }
                    className="btn btn-primary"
                  >
                    Start Your First Brew Session
                  </button>
                </div>
              ) : (
                <>
                  {/* Brewing Statistics Overview - Only show for multiple sessions */}
                  {brewingStats && brewSessions.length > 1 && (
                    <div className="brewing-stats-overview">
                      <h3 className="stats-title">Brewing Performance</h3>
                      <div className="stats-grid">
                        <div className="stat-item">
                          <span className="stat-label">Avg OG:</span>
                          <span className="stat-value">
                            {brewingStats.averageOG
                              ? formatGravity(brewingStats.averageOG)
                              : "-"}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg ABV:</span>
                          <span className="stat-value">
                            {brewingStats.averageABV
                              ? formatAbv(brewingStats.averageABV)
                              : "-"}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Avg Efficiency:</span>
                          <span className="stat-value">
                            {brewingStats.averageEfficiency
                              ? formatEfficiency(brewingStats.averageEfficiency)
                              : "-"}
                          </span>
                        </div>
                        {brewingStats.consistency && (
                          <div className="stat-item">
                            <span className="stat-label">Consistency:</span>
                            <span className="stat-value">
                              {brewingStats.consistency.abv < 0.5
                                ? "High"
                                : brewingStats.consistency.abv < 1.0
                                ? "Medium"
                                : "Low"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sessions List */}
                  <div className="brew-sessions-list">
                    {brewSessions.map((session) => (
                      <div
                        key={session.session_id}
                        className="brew-session-item"
                      >
                        <div className="session-info">
                          <div className="session-header">
                            <h4 className="session-name">
                              {session.displayName}
                            </h4>
                            <span
                              className="session-status-badge"
                              style={{
                                backgroundColor: `${session.statusColor}20`,
                                color: session.statusColor,
                              }}
                            >
                              {session.formattedStatus}
                            </span>
                          </div>

                          <div className="session-details">
                            <span className="session-date">
                              Brewed:{" "}
                              {session.brew_date
                                ? new Date(
                                    session.brew_date
                                  ).toLocaleDateString()
                                : "Unknown"}
                            </span>

                            {session.duration && (
                              <span className="session-duration">
                                Duration: {session.duration} days
                              </span>
                            )}

                            <div className="session-metrics">
                              {session.actual_og && (
                                <span className="metric">
                                  OG: {formatGravity(session.actual_og)}
                                </span>
                              )}
                              {session.actual_fg && (
                                <span className="metric">
                                  FG: {formatGravity(session.actual_fg)}
                                </span>
                              )}
                              {session.actual_abv && (
                                <span className="metric">
                                  ABV: {formatAbv(session.actual_abv)}
                                </span>
                              )}
                              {session.actual_efficiency && (
                                <span className="metric">
                                  Eff:{" "}
                                  {formatEfficiency(session.actual_efficiency)}
                                </span>
                              )}
                            </div>

                            {session.batch_rating && (
                              <div className="session-rating">
                                <span>Rating: </span>
                                {[...Array(5)].map((_, i) => (
                                  <span
                                    key={i}
                                    className={`star ${
                                      i < (session.batch_rating || 0)
                                        ? "filled"
                                        : ""
                                    }`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="session-actions">
                          <button
                            onClick={() =>
                              navigate(`/brew-sessions/${session.session_id}`)
                            }
                            className="btn btn-secondary"
                          >
                            View Session
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add session button when sessions exist */}
                  <div className="new-session-action">
                    <button
                      onClick={() =>
                        navigate(
                          `/brew-sessions/new?recipeId=${recipe.recipe_id}`
                        )
                      }
                      className="btn btn-primary"
                    >
                      + New Session
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="view-recipe-ingredients-section">
          <IngredientsList
            ingredients={ingredients}
            onRemove={() => {}}
            onUpdate={async () => {}}
            isEditing={false}
          />
        </div>

        <div className="view-recipe-actions">
          <RecipeActions 
            recipe={recipe} 
            showViewButton={false} 
            isPublicRecipe={isPublicRecipe}
            originalAuthor={recipe.username}
          />
        </div>
      </div>
    </div>
  );
};

export default ViewRecipe;
