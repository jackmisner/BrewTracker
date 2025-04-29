import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ApiService from "../services/api";

function Dashboard() {
  const [recentRecipes, setRecentRecipes] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch recipes and brew sessions
        const recipesResponse = await ApiService.recipes.getAll();
        const sessionsResponse = await ApiService.brewSessions.getAll();

        // Get recent items
        const sortedRecipes = recipesResponse.data.recipes
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        const sortedSessions = sessionsResponse.data.brew_sessions
          .sort((a, b) => new Date(b.brew_date) - new Date(a.brew_date))
          .slice(0, 5);

        setRecentRecipes(sortedRecipes);
        setRecentSessions(sortedSessions);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Recipes Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Recipes</h2>
            <Link
              to="/recipes/new"
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
            >
              New Recipe
            </Link>
          </div>

          {recentRecipes.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentRecipes.map((recipe) => (
                <li key={recipe.recipe_id} className="py-3">
                  <Link
                    to={`/recipes/${recipe.recipe_id}`}
                    className="flex justify-between hover:bg-amber-50 p-2 rounded"
                  >
                    <div>
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-sm text-gray-600">{recipe.style}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(recipe.created_at).toLocaleDateString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">
              No recipes yet. Create your first recipe!
            </p>
          )}

          <div className="mt-4 text-right">
            <Link to="/recipes" className="text-amber-600 hover:text-amber-800">
              View all recipes →
            </Link>
          </div>
        </div>

        {/* Recent Brew Sessions Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Brew Sessions</h2>
            <Link
              to="/brew-sessions/new"
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
            >
              New Session
            </Link>
          </div>

          {recentSessions.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {recentSessions.map((session) => (
                <li key={session.session_id} className="py-3">
                  <Link
                    to={`/brew-sessions/${session.session_id}`}
                    className="flex justify-between hover:bg-amber-50 p-2 rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {session.name || `Brew #${session.session_id}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: {session.status}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(session.brew_date).toLocaleDateString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No brew sessions recorded yet.</p>
          )}

          <div className="mt-4 text-right">
            <Link
              to="/brew-sessions"
              className="text-amber-600 hover:text-amber-800"
            >
              View all sessions →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
