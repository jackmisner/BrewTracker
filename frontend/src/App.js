import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import ApiService from "./services/api";

// Components
import Layout from "./components/Header/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RecipeBuilder from "./pages/RecipeBuilder";
import ViewRecipe from "./pages/ViewRecipe";
import AllRecipes from "./pages/AllRecipes";
import BrewSessionList from "./components/BrewSessions/BrewSessionList";
import CreateBrewSession from "./components/BrewSessions/CreateBrewSession";
import ViewBrewSession from "./components/BrewSessions/ViewBrewSession";
import EditBrewSession from "./components/BrewSessions/EditBrewSession";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (token) {
      ApiService.auth
        .getProfile()
        .then((response) => {
          setUser(response.data.user);
        })
        .catch((error) => {
          console.error("Failed to get user profile:", error);
          localStorage.removeItem("token");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem("token", token);
    // Trigger custom event for other components
    window.dispatchEvent(new Event("authChange"));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    // Trigger custom event for other components
    window.dispatchEvent(new Event("authChange"));
  };

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
  };

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/register"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Register onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Routes for recipes */}
          <Route
            path="/recipes"
            element={
              <ProtectedRoute>
                <AllRecipes />
              </ProtectedRoute>
            }
          />

          {/* Routes for new recipe */}
          <Route
            path="/recipes/new"
            element={
              <ProtectedRoute>
                <RecipeBuilder />
              </ProtectedRoute>
            }
          />
          {/* Routes for specific recipe */}
          <Route
            path="/recipes/:recipeId"
            element={
              <ProtectedRoute>
                <ViewRecipe />
              </ProtectedRoute>
            }
          />
          {/* Routes for editing specific recipe */}
          <Route
            path="/recipes/:recipeId/edit"
            element={
              <ProtectedRoute>
                <RecipeBuilder />
              </ProtectedRoute>
            }
          />

          {/* Routes for brew sessions */}
          <Route
            path="/brew-sessions"
            element={
              <ProtectedRoute>
                <BrewSessionList />
              </ProtectedRoute>
            }
          />
          {/* Route for creating a new brew session */}
          <Route
            path="/brew-sessions/new"
            element={
              <ProtectedRoute>
                <CreateBrewSession />
              </ProtectedRoute>
            }
          />
          {/* Route for viewing a specific brew session */}
          <Route
            path="/brew-sessions/:sessionId"
            element={
              <ProtectedRoute>
                <ViewBrewSession />
              </ProtectedRoute>
            }
          />
          {/* Route for editing a specific brew session */}
          <Route
            path="/brew-sessions/:sessionId/edit"
            element={
              <ProtectedRoute>
                <EditBrewSession />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
