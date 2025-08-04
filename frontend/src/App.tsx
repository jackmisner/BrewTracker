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
  handleLogin: (userData: User, token: string) => void;
  handleLogout: () => void;
}>({ user: null, handleLogin: () => {}, handleLogout: () => {} });

// Root layout component that provides authentication context
const RootLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (token) {
      ApiService.auth
        .getProfile()
        .then(response => {
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

  if (loading) return <div>Loading...</div>;

  return (
    <UnitProvider>
      <Layout user={user} onLogout={handleLogout}>
        <AuthContext.Provider value={{ user, handleLogin, handleLogout }}>
          <Outlet />
        </AuthContext.Provider>
      </Layout>
    </UnitProvider>
  );
};

// Protected route component
const ProtectedRoute: React.FC = () => {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Auth redirect component for login/register pages
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = React.useContext(AuthContext);
  if (user) return <Navigate to="/" replace />;
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
