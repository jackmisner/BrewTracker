import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import ApiService from "../services/api";
// Format utilities are now handled by individual components
import { Recipe, BrewSession, ID } from "../types";
import CompactRecipeCard from "../components/CompactRecipeCard";
import CompactBrewSessionCard from "../components/CompactBrewSessionCard";
import "../styles/Dashboard.css";
import "../styles/AllRecipes.css"; // For CompactBrewSessionCard styles

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
          .sort(
            (a, b) =>
              new Date(b.created_at || "").getTime() -
              new Date(a.created_at || "").getTime()
          )
          .slice(0, 5);

        const sortedSessions = sessionsResponse.data.brew_sessions
          .sort(
            (a, b) =>
              new Date(b.brew_date || "").getTime() -
              new Date(a.brew_date || "").getTime()
          )
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
                <CompactRecipeCard
                  key={recipe.recipe_id}
                  recipe={recipe}
                  showActionsInCard={true}
                  isPublicRecipe={false}
                  isDashboardVariant={true}
                  onDelete={(recipeId) => {
                    // Handle recipe deletion - refresh the dashboard data
                    setRecentRecipes((prev) =>
                      prev.filter((r) => r.recipe_id !== recipeId)
                    );
                  }}
                  refreshTrigger={() => {
                    // Refresh dashboard data when needed
                    window.location.reload();
                  }}
                />
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
                <CompactBrewSessionCard
                  key={session.session_id}
                  session={session}
                  onView={(sessionId) => handleNavigateToSession(sessionId)}
                  onEdit={(sessionId) => handleNavigateToEditSession(sessionId)}
                />
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
