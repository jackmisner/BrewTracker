import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import ApiService from "../services/api";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
} from "../utils/formatUtils";
import { Recipe, BrewSession, ID } from "../types";
import "../styles/Dashboard.css";

interface DashboardStats {
  totalRecipes: number;
  activeFerments: number;
  completedBatches: number;
  avgRating: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [recentSessions, setRecentSessions] = useState<BrewSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalRecipes: 0,
    activeFerments: 0,
    completedBatches: 0,
    avgRating: "0",
  });

  useEffect(() => {
    const fetchDashboardData = async (): Promise<void> => {
      try {
        // Fetch all recipes and brew sessions using large page sizes to avoid pagination limits
        // Default API calls only return first 10 items due to pagination, affecting statistics accuracy
        const recipesResponse = await ApiService.recipes.getAll(1, 1000);
        const sessionsResponse = await ApiService.brewSessions.getAll(1, 1000);

        // Get recent items (last 5)
        const sortedRecipes = recipesResponse.data.recipes
          .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
          .slice(0, 5);

        const sortedSessions = sessionsResponse.data.brew_sessions
          .sort((a, b) => new Date(b.brew_date || '').getTime() - new Date(a.brew_date || '').getTime())
          .slice(0, 5);

        // Calculate dashboard stats
        const totalRecipes = recipesResponse.data.recipes.length;
        const activeFerments = sessionsResponse.data.brew_sessions.filter(
          (s) => s.status === "fermenting"
        ).length;
        const completedBatches = sessionsResponse.data.brew_sessions.filter(
          (s) => s.status === "completed"
        ).length;

        const ratedSessions = sessionsResponse.data.brew_sessions.filter(
          (s) => s.batch_rating && s.batch_rating > 0
        );
        const avgRating =
          ratedSessions.length > 0
            ? ratedSessions.reduce((sum, s) => sum + (s.batch_rating || 0), 0) /
              ratedSessions.length
            : 0;

        setRecentRecipes(sortedRecipes);
        setRecentSessions(sortedSessions);
        setDashboardStats({
          totalRecipes,
          activeFerments,
          completedBatches,
          avgRating: avgRating.toFixed(1),
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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

  const formatDate = (dateString: string | Date): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleNavigateToRecipe = (recipeId: ID): void => {
    navigate(`/recipes/${recipeId}`);
  };

  const handleNavigateToEditRecipe = (recipeId: ID): void => {
    navigate(`/recipes/${recipeId}/edit`);
  };

  const handleNavigateToBrewSession = (recipeId: ID): void => {
    navigate(`/brew-sessions/new?recipeId=${recipeId}`);
  };

  const handleNavigateToSession = (sessionId: ID): void => {
    navigate(`/brew-sessions/${sessionId}`);
  };

  const handleNavigateToEditSession = (sessionId: ID): void => {
    navigate(`/brew-sessions/${sessionId}/edit`);
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title"> Brewing Dashboard</h1>
        <p className="dashboard-subtitle">
          Welcome back! Here's what you've got brewing.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div data-testid="stat-card-total-recipes" className="stat-value">
            {dashboardStats.totalRecipes}
          </div>
          <div className="stat-label">Total Recipes</div>
        </div>

        <div className="stat-card">
          <div
            data-testid="stat-card-active-ferments"
            className="stat-value ferments"
          >
            {dashboardStats.activeFerments}
          </div>
          <div className="stat-label">Active Ferments</div>
        </div>

        <div className="stat-card">
          <div
            data-testid="stat-card-completed-batches"
            className="stat-value completed"
          >
            {dashboardStats.completedBatches}
          </div>
          <div className="stat-label">Completed Batches</div>
        </div>

        <div className="stat-card">
          <div data-testid="stat-card-avg-rating" className="stat-value rating">
            {parseFloat(dashboardStats.avgRating) > 0
              ? `${dashboardStats.avgRating}★`
              : "N/A"}
          </div>
          <div className="stat-label">Avg Rating</div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Recent Recipes */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Recent Recipes</h2>
            <button
              onClick={() => navigate("/recipes/new")}
              className="primary-button"
            >
              + New Recipe
            </button>
          </div>

          <div className="cards-container">
            {recentRecipes.length > 0 ? (
              recentRecipes.map((recipe) => (
                <div key={recipe.recipe_id} className="recipe-card">
                  <div className="recipe-card-header">
                    <div className="recipe-info">
                      <h3 className="recipe-name">{recipe.name}</h3>
                      <p className="recipe-style">{recipe.style}</p>
                    </div>
                    <div
                      className="color-swatch"
                      style={{
                        backgroundColor: getSrmColour(recipe.estimated_srm),
                      }}
                      title={`SRM: ${formatSrm(recipe.estimated_srm)}`}
                    ></div>
                  </div>

                  {/* Metrics */}
                  <div className="recipe-metrics">
                    <div className="metric">
                      <div className="metric-value">
                        {formatGravity(recipe.estimated_og)}
                      </div>
                      <div className="metric-label">OG</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {formatAbv(recipe.estimated_abv)}
                      </div>
                      <div className="metric-label">ABV</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {formatIbu(recipe.estimated_ibu)}
                      </div>
                      <div className="metric-label">IBU</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {formatSrm(recipe.estimated_srm)}
                      </div>
                      <div className="metric-label">SRM</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="card-actions">
                    <button
                      onClick={() => handleNavigateToRecipe(recipe.recipe_id)}
                      className="action-button view"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleNavigateToEditRecipe(recipe.recipe_id)}
                      className="action-button edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleNavigateToBrewSession(recipe.recipe_id)}
                      className="action-button brew"
                    >
                      Brew
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No recipes yet. Create your first recipe!</p>
                <button
                  onClick={() => navigate("/recipes/new")}
                  className="primary-button"
                >
                  Create Recipe
                </button>
              </div>
            )}
          </div>

          <div className="section-footer">
            <Link to="/recipes" className="view-all-link">
              View all recipes →
            </Link>
          </div>
        </div>

        {/* Recent Brew Sessions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">Recent Brew Sessions</h2>
          </div>

          <div className="cards-container">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <div key={session.session_id} className="session-card">
                  <div className="session-card-header">
                    <div className="session-info">
                      <h3 className="session-name">
                        {session.name ||
                          `Session #${session.session_id.toString().substring(0, 6)}`}
                      </h3>
                      <p className="session-date">
                        {formatDate(session.brew_date)}
                      </p>
                    </div>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: `${getStatusColor(session.status || "")}20`,
                        color: getStatusColor(session.status || ""),
                      }}
                    >
                      {(session.status || "").replace("-", " ")}
                    </span>
                  </div>

                  {/* Session Metrics */}
                  <div className="session-metrics">
                    <div className="metric">
                      <div className="metric-value">
                        {session.actual_og
                          ? formatGravity(session.actual_og)
                          : "TBD"}
                      </div>
                      <div className="metric-label">OG</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {session.actual_fg
                          ? formatGravity(session.actual_fg)
                          : "TBD"}
                      </div>
                      <div className="metric-label">FG</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {session.actual_abv
                          ? formatAbv(session.actual_abv)
                          : "TBD"}
                      </div>
                      <div className="metric-label">ABV</div>
                    </div>
                  </div>

                  {/* Rating for completed sessions */}
                  {session.batch_rating && (
                    <div className="session-rating">
                      <span className="rating-label">Rating:</span>
                      <div className="stars">
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
                    </div>
                  )}

                  {/* Actions */}
                  <div className="card-actions">
                    <button
                      onClick={() => handleNavigateToSession(session.session_id)}
                      className="action-button view"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleNavigateToEditSession(session.session_id)}
                      className="action-button edit"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No brew sessions recorded yet.</p>
                <button
                  onClick={() => navigate("/recipes")}
                  className="primary-button"
                >
                  Start Brewing
                </button>
              </div>
            )}
          </div>

          <div className="section-footer">
            <Link to="/brew-sessions" className="view-all-link">
              View all sessions →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;