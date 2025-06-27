import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import RecipeService from "../services/RecipeService";
import BrewSessionService from "../services/BrewSessionService";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import RecipeVersionHistory from "../components/RecipeBuilder/RecipeVersionHistory";
import RecipeActions from "../components/RecipeActions";
import { Recipe, RecipeIngredient, BrewSession, BrewSessionSummary, ID } from "../types";
import "../styles/ViewRecipe.css";

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

interface GroupedIngredients {
  [key: string]: RecipeIngredient[];
}

const ViewRecipe: React.FC = () => {
  const { recipeId } = useParams<{ recipeId: ID }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [brewSessions, setBrewSessions] = useState<ProcessedBrewSession[]>([]);
  const [brewingSummary, setBrewingSummary] = useState<BrewSessionSummary | null>(null);
  const [brewingStats, setBrewingStats] = useState<BrewingStats | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchRecipe = async (): Promise<void> => {
      if (!recipeId) return;
      
      try {
        setLoading(true);
        const recipeData = await RecipeService.fetchRecipe(recipeId);
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
          BrewSessionService.getBrewSessionsForRecipe(recipeId),
          BrewSessionService.getBrewSessionSummary(recipeId),
          BrewSessionService.getBrewingStats(recipeId),
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

  if (loading) {
    return <div className="text-center py-10">Loading recipe...</div>;
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

  // Group ingredients by type
  const groupedIngredients: GroupedIngredients = ingredients.reduce((acc, ingredient) => {
    const type = ingredient.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(ingredient);
    return acc;
  }, {} as GroupedIngredients);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="recipe-header">
        <h1 className="recipe-title">{recipe.name}</h1>
        {recipe.style && <p className="recipe-style">{recipe.style}</p>}
        {recipe.version && recipe.version > 1 && (
          <div className="recipe-version-badge">Version: {recipe.version}</div>
        )}
      </div>

      <RecipeActions recipe={recipe} showViewButton={false} />

      <div className="recipe-content">
        <div className="recipe-details">
          <div className="recipe-section">
            <h2 className="section-title">Recipe Details</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Batch Size:</span>
                <span className="detail-value">
                  {recipe.batch_size} gallons
                </span>
              </div>
              {recipe.boil_time && (
                <div className="detail-item">
                  <span className="detail-label">Boil Time:</span>
                  <span className="detail-value">
                    {recipe.boil_time} minutes
                  </span>
                </div>
              )}
              {recipe.efficiency && (
                <div className="detail-item">
                  <span className="detail-label">Efficiency:</span>
                  <span className="detail-value">{recipe.efficiency}%</span>
                </div>
              )}
            </div>
          </div>

          {recipe.description && (
            <div className="recipe-section">
              <h2 className="section-title">Description</h2>
              <p className="recipe-description">{recipe.description}</p>
            </div>
          )}

          <div className="recipe-section">
            <h2 className="section-title">Recipe Metrics</h2>
            <RecipeMetrics
              metrics={{
                og: recipe.estimated_og || 1.0,
                fg: recipe.estimated_fg || 1.0,
                abv: recipe.estimated_abv || 0,
                ibu: recipe.estimated_ibu || 0,
                srm: recipe.estimated_srm || 0,
              }}
              recipe={recipe}
              onScale={() => {}}
            />
          </div>

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
                        {brewingSummary.successRate.toFixed(0)}% success
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() =>
                  navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`)
                }
                className="btn btn-primary"
                style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}
              >
                + New Session
              </button>
            </div>

            {sessionsLoading ? (
              <p>Loading brew sessions...</p>
            ) : brewSessions.length === 0 ? (
              <div className="empty-state">
                <p>No brew sessions recorded for this recipe yet.</p>
                <button
                  onClick={() =>
                    navigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`)
                  }
                  className="btn btn-primary"
                >
                  Start Your First Brew Session
                </button>
              </div>
            ) : (
              <>
                {/* Brewing Statistics Overview */}
                {brewingStats && (
                  <div className="brewing-stats-overview">
                    <h3 className="stats-title">Brewing Performance</h3>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Avg OG:</span>
                        <span className="stat-value">
                          {brewingStats.averageOG
                            ? brewingStats.averageOG.toFixed(3)
                            : "-"}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Avg ABV:</span>
                        <span className="stat-value">
                          {brewingStats.averageABV
                            ? `${brewingStats.averageABV.toFixed(1)}%`
                            : "-"}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Avg Efficiency:</span>
                        <span className="stat-value">
                          {brewingStats.averageEfficiency
                            ? `${brewingStats.averageEfficiency.toFixed(1)}%`
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
                    <div key={session.session_id} className="brew-session-item">
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
                              ? new Date(session.brew_date).toLocaleDateString()
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
                                OG: {session.actual_og.toFixed(3)}
                              </span>
                            )}
                            {session.actual_fg && (
                              <span className="metric">
                                FG: {session.actual_fg.toFixed(3)}
                              </span>
                            )}
                            {session.actual_abv && (
                              <span className="metric">
                                ABV: {session.actual_abv.toFixed(1)}%
                              </span>
                            )}
                            {session.actual_efficiency && (
                              <span className="metric">
                                Eff: {session.actual_efficiency.toFixed(1)}%
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
                                    i < (session.batch_rating || 0) ? "filled" : ""
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
              </>
            )}
          </div>

          <div className="recipe-section">
            <h2 className="section-title">Ingredients</h2>
            {Object.keys(groupedIngredients).length === 0 ? (
              <p>No ingredients added to this recipe.</p>
            ) : (
              Object.entries(groupedIngredients).map(([type, items]) => (
                <div key={type} className="ingredient-group">
                  <h3 className="ingredient-type-title">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </h3>
                  <table className="ingredients-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Amount</th>
                        <th>Use</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ingredient, index) => (
                        <tr key={index}>
                          <td className="ingredient-name">{ingredient.name}</td>
                          <td>
                            {ingredient.amount} {ingredient.unit}
                          </td>
                          <td>{ingredient.use || "-"}</td>
                          <td>
                            {ingredient.time ? `${ingredient.time} min` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>

          {recipe.notes && (
            <div className="recipe-section">
              <h2 className="section-title">Brewing Notes</h2>
              <p className="recipe-notes">{recipe.notes}</p>
            </div>
          )}

          {/* Version History */}
          {((recipe.version && recipe.version > 1) || recipe.parent_recipe_id) && (
            <RecipeVersionHistory
              recipeId={recipe.recipe_id}
              version={recipe.version}
              parentRecipeId={recipe.parent_recipe_id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewRecipe;