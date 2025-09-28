// Misc imports
import React, { useState, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router";
import { UnitProvider } from "./contexts/UnitContext";
import ApiService from "./services/api";
import { User } from "./types";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import RecipeBuilder from "./pages/RecipeBuilder";
import ViewRecipe from "./pages/ViewRecipe";
import AllRecipes from "./pages/AllRecipes";
import PublicRecipes from "./pages/PublicRecipes";
import UserSettings from "./pages/UserSettings";
import IngredientManager from "./pages/IngredientManager";
import AttenuationAnalyticsPage from "./pages/AttenuationAnalytics";
import About from "./pages/About";
import Help from "./pages/Help";
import FAQ from "./pages/FAQ";
import ReportBug from "./pages/ReportBug";
import FeatureRequest from "./pages/FeatureRequest";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

// Components
import Layout from "./components/Layout/Layout";
import BrewSessionList from "./components/BrewSessions/BrewSessionList";
import CreateBrewSession from "./components/BrewSessions/CreateBrewSession";
import ViewBrewSession from "./components/BrewSessions/ViewBrewSession";
import EditBrewSession from "./components/BrewSessions/EditBrewSession";

// Authentication context
export const AuthContext = React.createContext<{
  user: User | null;
  loading: boolean;
  handleLogin: (userData: User, token: string) => void;
  handleLogout: () => void;
}>({
  user: null,
  loading: true,
  handleLogin: () => {},
  handleLogout: () => {},
});

// Root layout component that provides authentication context
const RootLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true; // Flag to prevent race conditions

    // Check if user is logged in
    const token = localStorage.getItem("token");

    if (token) {
      ApiService.auth
        .getProfile()
        .then(response => {
          if (!isMounted) return; // Prevent state updates on unmounted component

          // The user data might be directly in response.data, not nested under .user
          const userData = response.data.user || response.data;
          setUser(userData);
          setLoading(false);
        })
        .catch((error: any) => {
          if (!isMounted) return; // Prevent state updates on unmounted component

          console.error("Failed to get user profile:", error);

          // Only remove token for authentication errors (401/403)
          if (
            error.response &&
            (error.response.status === 401 || error.response.status === 403)
          ) {
            localStorage.removeItem("token");
            setUser(null);
          } else {
            // For network errors or server errors, keep token but clear user state
            // This allows retry without forcing re-authentication
            setUser(null);
            console.warn(
              "Profile fetch failed due to network/server error. Token preserved for retry."
            );
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
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

  if (loading) return <div>Loading...</div>;

  return (
    <UnitProvider>
      <Layout user={user} onLogout={handleLogout}>
        <AuthContext.Provider
          value={{ user, loading, handleLogin, handleLogout }}
        >
          <Outlet />
        </AuthContext.Provider>
      </Layout>
    </UnitProvider>
  );
};

// Protected route component with proper loading handling
const ProtectedRoute: React.FC = () => {
  const { user, loading } = React.useContext(AuthContext);

  // Show loading spinner while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  // Only redirect to login if we're sure there's no user and we're not loading
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// Auth redirect component for login/register pages
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = React.useContext(AuthContext);

  // Don't show loading for auth pages - let them render immediately
  // This prevents flash and allows Google login to work properly

  // Redirect to home if already authenticated (but not if still loading)
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Login page wrapper
const LoginPage: React.FC = () => {
  const { handleLogin } = React.useContext(AuthContext);
  return (
    <AuthRedirect>
      <Login onLogin={handleLogin} />
    </AuthRedirect>
  );
};

// Register page wrapper
const RegisterPage: React.FC = () => {
  const { handleLogin } = React.useContext(AuthContext);
  return (
    <AuthRedirect>
      <Register onLogin={handleLogin} />
    </AuthRedirect>
  );
};

// Create the router configuration
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "verify-email",
        element: <VerifyEmail />,
      },
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "about",
        element: <About />,
      },
      {
        path: "help",
        element: <Help />,
      },
      {
        path: "faq",
        element: <FAQ />,
      },
      {
        path: "report-bug",
        element: <ReportBug />,
      },
      {
        path: "feature-request",
        element: <FeatureRequest />,
      },
      {
        path: "privacy",
        element: <PrivacyPolicy />,
      },
      {
        path: "terms",
        element: <TermsOfService />,
      },
      {
        path: "",
        element: <ProtectedRoute />,
        children: [
          {
            index: true,
            element: <Dashboard />,
          },
          {
            path: "settings",
            element: <UserSettings />,
          },
          {
            path: "ingredients/manage",
            element: <IngredientManager />,
          },
          {
            path: "attenuation-analytics",
            element: <AttenuationAnalyticsPage />,
          },
          {
            path: "recipes",
            element: <AllRecipes />,
          },
          {
            path: "recipes/new",
            element: <RecipeBuilder />,
          },
          {
            path: "recipes/:recipeId",
            element: <ViewRecipe />,
          },
          {
            path: "recipes/:recipeId/edit",
            element: <RecipeBuilder />,
          },
          {
            path: "recipes/public",
            element: <PublicRecipes />,
          },
          {
            path: "brew-sessions",
            element: <BrewSessionList />,
          },
          {
            path: "brew-sessions/new",
            element: <CreateBrewSession />,
          },
          {
            path: "brew-sessions/:sessionId",
            element: <ViewBrewSession />,
          },
          {
            path: "brew-sessions/:sessionId/edit",
            element: <EditBrewSession />,
          },
        ],
      },
    ],
  },
]);

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;
