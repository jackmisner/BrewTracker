import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../src/App";
import ApiService from "../src/services/api";

// Mock the API service
jest.mock("../src/services/api");

// Mock the page components to avoid rendering complexity
jest.mock("../src/pages/Login", () => {
  return function MockLogin({ onLogin }) {
    return (
      <div data-testid="login-page">
        <button
          data-testid="mock-login-button"
          onClick={() => onLogin({ username: "testuser" }, "mock-token")}
        >
          Mock Login
        </button>
      </div>
    );
  };
});

jest.mock("../src/pages/Register", () => {
  return function MockRegister({ onLogin }) {
    return (
      <div data-testid="register-page">
        <button
          data-testid="mock-register-button"
          onClick={() => onLogin({ username: "newuser" }, "mock-token")}
        >
          Mock Register
        </button>
      </div>
    );
  };
});

jest.mock("../src/pages/Dashboard", () => {
  return function MockDashboard() {
    return <div data-testid="dashboard-page">Dashboard</div>;
  };
});

jest.mock("../src/pages/RecipeBuilder", () => {
  return function MockRecipeBuilder() {
    return <div data-testid="recipe-builder-page">Recipe Builder</div>;
  };
});

jest.mock("../src/pages/ViewRecipe", () => {
  return function MockViewRecipe() {
    return <div data-testid="view-recipe-page">View Recipe</div>;
  };
});

jest.mock("../src/pages/AllRecipes", () => {
  return function MockAllRecipes() {
    return <div data-testid="all-recipes-page">All Recipes</div>;
  };
});

jest.mock("../src/components/BrewSessions/BrewSessionList", () => {
  return function MockBrewSessionList() {
    return <div data-testid="brew-session-list-page">Brew Session List</div>;
  };
});

jest.mock("../src/components/BrewSessions/CreateBrewSession", () => {
  return function MockCreateBrewSession() {
    return (
      <div data-testid="create-brew-session-page">Create Brew Session</div>
    );
  };
});

jest.mock("../src/components/BrewSessions/ViewBrewSession", () => {
  return function MockViewBrewSession() {
    return <div data-testid="view-brew-session-page">View Brew Session</div>;
  };
});

jest.mock("../src/components/BrewSessions/EditBrewSession", () => {
  return function MockEditBrewSession() {
    return <div data-testid="edit-brew-session-page">Edit Brew Session</div>;
  };
});

jest.mock("../src/components/Header/Layout", () => {
  return function MockLayout({ user, onLogout, children }) {
    return (
      <div data-testid="layout">
        <div data-testid="layout-header">
          {user ? (
            <>
              <span data-testid="user-info">User: {user.username}</span>
              <button data-testid="logout-button" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <span data-testid="not-logged-in">Not logged in</span>
          )}
        </div>
        <div data-testid="layout-content">{children}</div>
      </div>
    );
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock window events
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, "dispatchEvent", {
  value: mockDispatchEvent,
});

// Custom render function for App component (App already includes Router)
function renderApp(ui = <App />, options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe("Initial Loading and Authentication", () => {
    it("shows loading state initially when token exists", () => {
      mockLocalStorage.getItem.mockReturnValue("mock-token");
      ApiService.auth.getProfile.mockReturnValue(new Promise(() => {})); // Never resolves

      renderApp();

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("does not show loading state when no token exists", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Should redirect to login since no user
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    it("fetches user profile when token exists and sets user", async () => {
      const mockUser = { username: "testuser", email: "test@example.com" };
      mockLocalStorage.getItem.mockReturnValue("existing-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
        expect(screen.getByTestId("user-info")).toHaveTextContent(
          "User: testuser"
        );
      });
    });

    it("removes invalid token and shows login when profile fetch fails", async () => {
      mockLocalStorage.getItem.mockReturnValue("invalid-token");
      ApiService.auth.getProfile.mockRejectedValue(new Error("Token expired"));

      // Mock console.error to suppress expected error output
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe("Authentication Flow", () => {
    it("handles successful login", async () => {
      const user = userEvent.setup();
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      // Simulate login
      const loginButton = screen.getByTestId("mock-login-button");
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          "token",
          "mock-token"
        );
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: "authChange" })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
        expect(screen.getByTestId("user-info")).toHaveTextContent(
          "User: testuser"
        );
      });
    });

    it("handles logout", async () => {
      const user = userEvent.setup();
      const mockUser = { username: "testuser" };
      mockLocalStorage.getItem.mockReturnValue("existing-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      // Wait for user to be loaded
      await waitFor(() => {
        expect(screen.getByTestId("user-info")).toBeInTheDocument();
      });

      // Logout
      const logoutButton = screen.getByTestId("logout-button");
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: "authChange" })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
        expect(screen.getByTestId("not-logged-in")).toBeInTheDocument();
      });
    });
  });

  describe("Route Protection", () => {
    it("redirects unauthenticated users to login from protected routes", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      // For route testing, we need to mock location or navigate programmatically
      // Since we can't control initial route directly, this test will verify
      // the redirect behavior from the root route
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });
    });

    it("allows authenticated users to access protected routes", async () => {
      const mockUser = { username: "testuser" };
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
      });
    });

    it("redirects authenticated users away from auth pages", async () => {
      const mockUser = { username: "testuser" };
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles network error during profile fetch", async () => {
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockRejectedValue(new Error("Network Error"));

      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to get user profile:",
          expect.any(Error)
        );
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it("handles API response without user data", async () => {
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockResolvedValue({ data: {} });

      renderApp();

      await waitFor(() => {
        // When API returns no user data, user becomes undefined,
        // so ProtectedRoute should redirect to login
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
        expect(screen.getByTestId("not-logged-in")).toBeInTheDocument();
      });
    });
  });

  describe("Layout Integration", () => {
    it("passes user and onLogout to Layout", async () => {
      const mockUser = { username: "testuser", email: "test@example.com" };
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("layout")).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId("user-info")).toHaveTextContent(
          "User: testuser"
        );
        expect(screen.getByTestId("logout-button")).toBeInTheDocument();
      });
    });

    it("passes null user to Layout when not authenticated", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("not-logged-in")).toBeInTheDocument();
      });
    });
  });

  describe("Token Management", () => {
    it("checks localStorage for token on mount", async () => {
      mockLocalStorage.getItem.mockReturnValue("existing-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: { username: "testuser" } },
      });

      renderApp();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("token");

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });
    });

    it("does not call getProfile when no token exists", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      expect(ApiService.auth.getProfile).not.toHaveBeenCalled();
    });

    it("stores token on successful login", async () => {
      const user = userEvent.setup();
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      const loginButton = screen.getByTestId("mock-login-button");
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          "token",
          "mock-token"
        );
      });
    });

    it("removes token on logout", async () => {
      const user = userEvent.setup();
      const mockUser = { username: "testuser" };
      mockLocalStorage.getItem.mockReturnValue("existing-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("logout-button")).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId("logout-button");
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
      });
    });
  });

  describe("Auth Events", () => {
    it("dispatches authChange event on login", async () => {
      const user = userEvent.setup();
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      const loginButton = screen.getByTestId("mock-login-button");
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "authChange",
          })
        );
      });
    });

    it("dispatches authChange event on logout", async () => {
      const user = userEvent.setup();
      const mockUser = { username: "testuser" };
      mockLocalStorage.getItem.mockReturnValue("existing-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: mockUser },
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("logout-button")).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId("logout-button");
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "authChange",
          })
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty token string", async () => {
      mockLocalStorage.getItem.mockReturnValue("");

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      expect(ApiService.auth.getProfile).not.toHaveBeenCalled();
    });

    it("handles malformed user data from API", async () => {
      mockLocalStorage.getItem.mockReturnValue("valid-token");
      ApiService.auth.getProfile.mockResolvedValue({
        data: { user: null },
      });

      renderApp();

      await waitFor(() => {
        expect(ApiService.auth.getProfile).toHaveBeenCalled();
      });

      // When API returns null user, the app treats it as unauthenticated
      // and redirects to login page
      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
        expect(screen.getByTestId("not-logged-in")).toBeInTheDocument();
      });

      // Note: Token is NOT removed because the API call succeeded (no error),
      // it just returned null user data
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it("handles multiple rapid auth state changes", async () => {
      const user = userEvent.setup();
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      // Rapid login/logout
      const loginButton = screen.getByTestId("mock-login-button");
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId("logout-button")).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId("logout-button");
      await user.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      // Should handle state changes properly
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          "token",
          "mock-token"
        );
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
      });
    });

    it("handles user data updates correctly", async () => {
      const user = userEvent.setup();
      mockLocalStorage.getItem.mockReturnValue(null);

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });

      // Login with different user data
      const loginButton = screen.getByTestId("mock-login-button");
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId("user-info")).toHaveTextContent(
          "User: testuser"
        );
      });
    });
  });
});
