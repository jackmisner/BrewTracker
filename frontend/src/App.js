import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ApiService from "./services/api";

// Components
import Navigation from "./components/Navigation";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

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
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
  };

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
  };

  return (
    <Router>
      <div className="app">
        <Navigation user={user} onLogout={handleLogout} />

        <main className="container mx-auto px-4 py-6">
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

            {/* <Route
              path="/recipes"
              element={
                <ProtectedRoute>
                  <RecipeList />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/recipes/new"
              element={
                <ProtectedRoute>
                  <RecipeForm />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/recipes/:id"
              element={
                <ProtectedRoute>
                  <RecipeDetail />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/recipes/:id/edit"
              element={
                <ProtectedRoute>
                  <RecipeForm isEditing={true} />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/brew-sessions"
              element={
                <ProtectedRoute>
                  <BrewSessionList />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/brew-sessions/new"
              element={
                <ProtectedRoute>
                  <BrewSessionForm />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/brew-sessions/:id"
              element={
                <ProtectedRoute>
                  <BrewSessionDetail />
                </ProtectedRoute>
              }
            /> */}

            {/* <Route
              path="/brew-sessions/:id/edit"
              element={
                <ProtectedRoute>
                  <BrewSessionForm isEditing={true} />
                </ProtectedRoute>
              }
            /> */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
