import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { UnitProvider } from "./contexts/UnitContext";
import ApiService from "./services/api";
import { User } from "./types";

// Components
import Layout from "./components/Header/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RecipeBuilder from "./pages/RecipeBuilder";
import ViewRecipe from "./pages/ViewRecipe";
import AllRecipes from "./pages/AllRecipes";
import PublicRecipes from "./pages/PublicRecipes";
import BrewSessionList from "./components/BrewSessions/BrewSessionList";
import CreateBrewSession from "./components/BrewSessions/CreateBrewSession";
import ViewBrewSession from "./components/BrewSessions/ViewBrewSession";
import EditBrewSession from "./components/BrewSessions/EditBrewSession";
import UserSettings from "./pages/UserSettings";
import IngredientManager from "./pages/IngredientManager";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (token) {
      ApiService.auth
        .getProfile()
        .then((response) => {
          setUser(response.data.user);
        })
        .catch((error: any) => {
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

  const handleLogin = (userData: User, token: string): void => {
    setUser(userData);
    localStorage.setItem("token", token);
    // Trigger custom event for other components
    window.dispatchEvent(new Event("authChange"));
  };

  const handleLogout = (): void => {
    setUser(null);
    localStorage.removeItem("token");
    // Trigger custom event for other components
    window.dispatchEvent(new Event("authChange"));
  };

  // Protected route component
  const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  return (
    <UnitProvider>
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

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <UserSettings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ingredients/manage"
              element={
                <ProtectedRoute>
                  <IngredientManager />
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

            {/* Routes for public recipes */}
            <Route
              path="/recipes/public"
              element={
                <ProtectedRoute>
                  <PublicRecipes />
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
    </UnitProvider>
  );
};

export default App;