import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import ViewBrewSession from "../../src/components/BrewSessions/ViewBrewSession";
import BrewSessionService from "../../src/services/BrewSessionService";
import RecipeService from "../../src/services/RecipeService";
import { invalidateBrewSessionCaches } from "../../src/services/CacheManager";
import { renderWithProviders, mockData } from "../testUtils";

// Mock the CSS import
jest.mock("../../src/styles/BrewSessions.css", () => ({}));

// Mock services and cache manager
jest.mock("../../src/services/BrewSessionService", () => ({
  fetchBrewSession: jest.fn(),
  updateBrewSession: jest.fn(),
  deleteBrewSession: jest.fn(),
}));

jest.mock("../../src/services/RecipeService", () => ({
  fetchRecipe: jest.fn(),
}));

jest.mock("../../src/services/CacheManager", () => ({
  invalidateBrewSessionCaches: {
    onUpdated: jest.fn(),
    onDeleted: jest.fn(),
  },
}));

// Mock FermentationTracker component
jest.mock("../../src/components/BrewSessions/FermentationTracker", () => ({
  __esModule: true,
  default: jest.fn(
    ({ sessionId, recipeData, sessionData, onUpdateSession }) => (
      <div data-testid="fermentation-tracker">
        <button
          data-testid="update-session-btn"
          onClick={() => onUpdateSession({ actual_fg: 1.01 })}
        >
          Update Session
        </button>
        <div data-testid="session-id">{sessionId}</div>
        <div data-testid="recipe-data">{JSON.stringify(recipeData)}</div>
        <div data-testid="session-data">{JSON.stringify(sessionData)}</div>
      </div>
    )
  ),
}));

// Mock window.confirm
const originalConfirm = window.confirm;

// Mock useNavigate and useParams
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: "1" }),
}));

// Create mock data
const mockSession = mockData.brewSession({
  session_id: "1",
  recipe_id: "123",
  name: "Test Session",
  status: "fermenting",
  brew_date: "2024-06-01",
  mash_temp: 150,
  actual_og: 1.055,
  actual_fg: 1.012,
  actual_abv: 5.2,
  actual_efficiency: 75,
  fermentation_start_date: "2024-06-02",
  fermentation_end_date: null,
  packaging_date: null,
  notes: "These are brew day notes.",
  tasting_notes: "Fruity and crisp.",
  batch_rating: "4",
});

const mockRecipe = mockData.recipe({
  recipe_id: "123",
  name: "Test Recipe",
  style: "IPA",
  batch_size: 5,
  estimated_og: 1.058,
  estimated_fg: 1.01,
  estimated_abv: 6.2,
  efficiency: 72,
});

describe("ViewBrewSession", () => {
  // Mock console methods to suppress noise in test output
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.warn = jest.fn();
    window.confirm = jest.fn(() => true); // Default to confirming all dialogs

    // Default successful session and recipe fetch
    BrewSessionService.fetchBrewSession.mockResolvedValue(mockSession);
    RecipeService.fetchRecipe.mockResolvedValue(mockRecipe);
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    window.confirm = originalConfirm;
  });

  describe("Loading State", () => {
    it("renders loading state initially", async () => {
      BrewSessionService.fetchBrewSession.mockReturnValue(
        new Promise(() => {})
      ); // never resolves

      renderWithProviders(<ViewBrewSession />);

      expect(screen.getByText(/Loading brew session/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("renders error if session fetch fails", async () => {
      BrewSessionService.fetchBrewSession.mockRejectedValue(
        new Error("Failed to load brew session data")
      );

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load brew session data/i)
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching brew session:",
        expect.any(Error)
      );
    });

    it("renders session details even if recipe fetch fails", async () => {
      RecipeService.fetchRecipe.mockRejectedValue(
        new Error("Recipe not found")
      );

      renderWithProviders(<ViewBrewSession />);

      // Session should still load
      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Recipe section shouldn't be there
      expect(screen.queryByText("View Recipe")).not.toBeInTheDocument();

      expect(console.warn).toHaveBeenCalledWith(
        "Could not fetch associated recipe:",
        expect.any(Error)
      );
    });

    it("redirects to sessions list if session not found", async () => {
      const error = new Error("Session not found");
      error.response = { status: 404 };
      BrewSessionService.fetchBrewSession.mockRejectedValue(error);

      jest.useFakeTimers();
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText(/Session not found/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Redirecting to brew sessions list/i)
        ).toBeInTheDocument();
      });

      // Fast-forward the timer for redirect
      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions");

      jest.useRealTimers();
    });

    it("shows error and allows dismissal when status update fails", async () => {
      BrewSessionService.updateBrewSession.mockRejectedValue(
        new Error("Failed to update status")
      );

      renderWithProviders(<ViewBrewSession />);

      // Wait for the session to load
      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Click status update button (conditioning)
      const updateButton = screen.getByText("Conditioning");
      fireEvent.click(updateButton);

      // Error should be displayed
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to update status/i)
        ).toBeInTheDocument();
      });

      // Dismiss error
      const dismissButton = screen.getByRole("button", { name: "×" });
      fireEvent.click(dismissButton);

      // Error should be gone
      expect(
        screen.queryByText(/Failed to update status/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Session Details Display", () => {
    it("renders session details correctly", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Status badge
      expect(screen.getByText("Fermenting")).toBeInTheDocument();

      // Timeline information
      expect(screen.getByText("Brew Date:")).toBeInTheDocument();
      expect(
        screen.getByText(new Date("2024-06-01").toLocaleDateString())
      ).toBeInTheDocument();
      expect(screen.getByText("Fermentation Start:")).toBeInTheDocument();
      expect(
        screen.getByText(new Date("2024-06-02").toLocaleDateString())
      ).toBeInTheDocument();
      expect(screen.getByText("Fermentation End:")).toBeInTheDocument();
      expect(screen.getByText("Not completed")).toBeInTheDocument();
      expect(screen.getByText("Packaging Date:")).toBeInTheDocument();
      expect(screen.getByText("Not packaged")).toBeInTheDocument();

      // Brew metrics
      expect(screen.getByText("Original Gravity")).toBeInTheDocument();
      expect(screen.getByText("1.055")).toBeInTheDocument();
      expect(screen.getByText("Est: 1.058")).toBeInTheDocument();
      expect(screen.getByText("Final Gravity")).toBeInTheDocument();
      expect(screen.getByText("1.012")).toBeInTheDocument();
      expect(screen.getByText("Est: 1.010")).toBeInTheDocument();
      expect(screen.getByText("ABV")).toBeInTheDocument();
      expect(screen.getByText("5.2%")).toBeInTheDocument();
      expect(screen.getByText("Est: 6.2%")).toBeInTheDocument();
      expect(screen.getByText("Efficiency")).toBeInTheDocument();
      expect(screen.getByText("75.0%")).toBeInTheDocument();
      expect(screen.getByText("Target: 72.0%")).toBeInTheDocument();

      // Brew day notes
      expect(screen.getByText("Brew Day Notes")).toBeInTheDocument();
      expect(screen.getByText("These are brew day notes.")).toBeInTheDocument();
      expect(screen.getByText("Mash Temperature:")).toBeInTheDocument();
      expect(screen.getByText("150°F")).toBeInTheDocument();
    });

    it("renders recipe information when available", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Recipe")).toBeInTheDocument();
      });

      expect(screen.getByText("IPA")).toBeInTheDocument();
      expect(screen.getByText("View Recipe")).toBeInTheDocument();
    });

    it("navigates to recipe page when View Recipe is clicked", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Recipe")).toBeInTheDocument();
      });

      const viewRecipeButton = screen.getByText("View Recipe");
      fireEvent.click(viewRecipeButton);

      expect(mockNavigate).toHaveBeenCalledWith("/recipes/123");
    });
  });

  describe("Status Management", () => {
    it("displays the correct status update buttons based on current status", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // For fermenting status, should show conditioning and completed buttons
      expect(screen.getByText("Conditioning")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
    });

    it("updates session status correctly with appropriate date updates", async () => {
      const updatedSession = {
        ...mockSession,
        status: "conditioning",
        fermentation_end_date: "2024-06-15",
      };

      BrewSessionService.updateBrewSession.mockResolvedValue(updatedSession);

      // Mock current date for consistent testing
      const mockDate = new Date("2024-06-15");
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(date) {
          if (date) {
            return new originalDate(date);
          }
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      };

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Click conditioning button
      const conditioningButton = screen.getByText("Conditioning");
      fireEvent.click(conditioningButton);

      // Check confirmation
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to update the status to "conditioning"?'
      );

      // Check service was called with correct data including session name
      await waitFor(() => {
        expect(BrewSessionService.updateBrewSession).toHaveBeenCalledWith("1", {
          name: "Test Session", // This is now included to fix validation
          status: "conditioning",
          fermentation_end_date: "2024-06-15",
        });
      });

      // Check cache invalidation
      expect(invalidateBrewSessionCaches.onUpdated).toHaveBeenCalledWith({
        session_id: "1",
        recipe_id: "123",
      });

      // Reset Date mock
      global.Date = originalDate;
    });

    it("cancels status update when confirmation is rejected", async () => {
      window.confirm = jest.fn(() => false);

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Click conditioning button
      const conditioningButton = screen.getByText("Conditioning");
      fireEvent.click(conditioningButton);

      // Check confirmation
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to update the status to "conditioning"?'
      );

      // Service should not be called
      expect(BrewSessionService.updateBrewSession).not.toHaveBeenCalled();
    });
  });

  describe("Tab Navigation", () => {
    it("defaults to details tab and switches between tabs", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Details tab should be active by default
      expect(screen.getByText("Session Details")).toBeInTheDocument();

      // Switch to Fermentation tab
      const fermentationTab = screen.getByRole("button", {
        name: "Fermentation Tracking",
      });
      fireEvent.click(fermentationTab);

      // Fermentation tracker should be visible
      expect(screen.getByTestId("fermentation-tracker")).toBeInTheDocument();

      // Switch to Notes tab
      const notesTab = screen.getByRole("button", { name: "Notes & Analysis" });
      fireEvent.click(notesTab);

      // Notes content should be visible - use getByRole to avoid ambiguity
      expect(
        screen.getByRole("heading", { name: "Notes & Analysis" })
      ).toBeInTheDocument();
      expect(screen.getByText("Tasting Notes")).toBeInTheDocument();
      expect(screen.getByText("Fruity and crisp.")).toBeInTheDocument();
    });

    it("integrates with fermentation tracker component", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Switch to Fermentation tab
      const fermentationTab = screen.getByRole("button", {
        name: "Fermentation Tracking",
      });
      fireEvent.click(fermentationTab);

      // Check that fermentation tracker receives correct props
      expect(screen.getByTestId("session-id").textContent).toBe("1");
      expect(JSON.parse(screen.getByTestId("recipe-data").textContent)).toEqual(
        {
          estimated_og: mockRecipe.estimated_og,
          estimated_fg: mockRecipe.estimated_fg,
        }
      );
      expect(
        JSON.parse(screen.getByTestId("session-data").textContent)
      ).toEqual({
        status: mockSession.status,
        actual_og: mockSession.actual_og,
        actual_fg: mockSession.actual_fg,
      });

      // Test updating session from fermentation tracker
      const updateButton = screen.getByTestId("update-session-btn");
      fireEvent.click(updateButton);

      // Session state should be updated
      await waitFor(() => {
        expect(invalidateBrewSessionCaches.onUpdated).toHaveBeenCalled();
      });
    });

    it("displays batch rating correctly", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Switch to Notes tab
      const notesTab = screen.getByRole("button", { name: "Notes & Analysis" });
      fireEvent.click(notesTab);

      // Check rating display
      expect(screen.getByText("Batch Rating")).toBeInTheDocument();
      expect(screen.getByText("4 out of 5")).toBeInTheDocument();

      // Check that 4 stars are filled (rating is 4)
      const filledStars = document.querySelectorAll(".rating-star.filled");
      expect(filledStars.length).toBe(4);
    });

    it("shows attenuation analysis when gravity readings are available", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Switch to Notes tab
      const notesTab = screen.getByRole("button", { name: "Notes & Analysis" });
      fireEvent.click(notesTab);

      // Check attenuation analysis
      expect(screen.getByText("Attenuation Analysis")).toBeInTheDocument();
      expect(screen.getByText("Actual Attenuation:")).toBeInTheDocument();
      expect(screen.getByText("Estimated Attenuation:")).toBeInTheDocument();

      // The text value will depend on the calculation - should contain a percentage
      const attenuationValues = screen.getAllByText(/\d+\.\d+%/);
      expect(attenuationValues.length).toBeGreaterThan(0);
    });
  });

  describe("Session Actions", () => {
    it("navigates to edit session when Edit button is clicked", async () => {
      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      const editButton = screen.getByRole("button", { name: "Edit Session" });
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/1/edit");
    });

    it("confirms and deletes session when Delete button is clicked", async () => {
      BrewSessionService.deleteBrewSession.mockResolvedValue({});

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", {
        name: "Delete Session",
      });
      fireEvent.click(deleteButton);

      // Check confirmation
      expect(window.confirm).toHaveBeenCalledWith(
        "Are you sure you want to delete this brew session? This action cannot be undone."
      );

      // Check service was called
      await waitFor(() => {
        expect(BrewSessionService.deleteBrewSession).toHaveBeenCalledWith("1");
      });

      // Check cache invalidation
      expect(invalidateBrewSessionCaches.onDeleted).toHaveBeenCalledWith({
        session_id: "1",
        recipe_id: "123",
      });

      // Check navigation
      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions");
    });

    it("cancels deletion when confirmation is rejected", async () => {
      window.confirm = jest.fn(() => false);

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", {
        name: "Delete Session",
      });
      fireEvent.click(deleteButton);

      // Check confirmation
      expect(window.confirm).toHaveBeenCalled();

      // Service should not be called
      expect(BrewSessionService.deleteBrewSession).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows error when deletion fails", async () => {
      BrewSessionService.deleteBrewSession.mockRejectedValue(
        new Error("Failed to delete session")
      );

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", {
        name: "Delete Session",
      });
      fireEvent.click(deleteButton);

      // Check error
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to delete session/i)
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error deleting brew session:",
        expect.any(Error)
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles missing recipe gracefully", async () => {
      const sessionWithoutRecipe = { ...mockSession, recipe_id: null };
      BrewSessionService.fetchBrewSession.mockResolvedValue(
        sessionWithoutRecipe
      );

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Recipe section should not be rendered
      expect(screen.queryByText("Recipe")).not.toBeInTheDocument();
      expect(screen.queryByText("View Recipe")).not.toBeInTheDocument();
    });

    it("handles empty session name gracefully", async () => {
      const sessionWithoutName = { ...mockSession, name: null };
      BrewSessionService.fetchBrewSession.mockResolvedValue(sessionWithoutName);

      // Set specific sessionId for this test
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "abcdef123456" });

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Brew Session #abcdef")).toBeInTheDocument();
      });

      // Reset the mock for other tests
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "1" });
    });

    it("handles missing metrics gracefully", async () => {
      const sessionWithoutMetrics = {
        ...mockSession,
        actual_og: null,
        actual_fg: null,
        actual_abv: null,
        actual_efficiency: null,
      };
      BrewSessionService.fetchBrewSession.mockResolvedValue(
        sessionWithoutMetrics
      );

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Metrics should show placeholders
      const metricValues = screen.getAllByText("-");
      expect(metricValues.length).toBeGreaterThan(0);
    });

    it("handles sessions without notes gracefully", async () => {
      const sessionWithoutNotes = {
        ...mockSession,
        notes: null,
        tasting_notes: null,
      };
      BrewSessionService.fetchBrewSession.mockResolvedValue(
        sessionWithoutNotes
      );

      renderWithProviders(<ViewBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Test Session")).toBeInTheDocument();
      });

      // Should show empty message for brew day notes
      expect(
        screen.getByText("No brew day notes recorded.")
      ).toBeInTheDocument();

      // Switch to Notes tab
      const notesTab = screen.getByRole("button", { name: "Notes & Analysis" });
      fireEvent.click(notesTab);

      // Should show empty message for tasting notes
      expect(
        screen.getByText("No tasting notes recorded yet.")
      ).toBeInTheDocument();
    });
  });
});
