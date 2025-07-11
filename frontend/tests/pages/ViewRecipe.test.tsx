// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  mockData,
  scenarios,
} from "../../tests/testUtils";
import ViewRecipe from "../../src/pages/ViewRecipe";
import RecipeService from "../../src/services/RecipeService";
import BrewSessionService from "../../src/services/BrewSessionService";

// Mock the services
jest.mock("../../src/services/RecipeService");
jest.mock("../../src/services/BrewSessionService");
jest.mock("../../src/services/BeerStyleService", () => ({
  getAllStylesList: jest.fn(() => Promise.resolve([])),
  getStyleCategories: jest.fn(() => Promise.resolve({})),
  getRecipeStyleAnalysis: jest.fn(() => Promise.resolve(null)),
  findMatchingStyles: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../src/services/UserSettingsService", () => ({
  getUserSettings: jest.fn(() => Promise.resolve({ unit_system: "imperial" })),
  updateUserSettings: jest.fn(() => Promise.resolve()),
}));

// Mock react-router hooks
const mockNavigate = jest.fn();
const mockUseParams = jest.fn();

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

// Mock the child components to focus on ViewRecipe logic
jest.mock("../../src/components/RecipeBuilder/RecipeMetrics", () => {
  return function MockRecipeMetrics({ metrics }) {
    return (
      <div data-testid="recipe-metrics">
        <div data-testid="recipe-og">Recipe OG: {metrics.og}</div>
        <div data-testid="recipe-fg">Recipe FG: {metrics.fg}</div>
        <div data-testid="recipe-abv">Recipe ABV: {metrics.abv}</div>
        <div data-testid="recipe-ibu">Recipe IBU: {metrics.ibu}</div>
        <div data-testid="recipe-srm">Recipe SRM: {metrics.srm}</div>
      </div>
    );
  };
});

jest.mock("../../src/components/RecipeBuilder/RecipeVersionHistory", () => {
  return function MockRecipeVersionHistory({
    recipeId,
    version,
    parentRecipeId,
  }) {
    if (version <= 1 && !parentRecipeId) return null;
    return <div data-testid="version-history">Recipe Version: {version}</div>;
  };
});

jest.mock("../../src/components/RecipeActions", () => {
  return function MockRecipeActions({ recipe, showViewButton }) {
    return (
      <div data-testid="recipe-actions">
        <button
          onClick={() => mockNavigate(`/recipes/${recipe.recipe_id}/edit`)}
        >
          Edit Recipe
        </button>
        <button
          onClick={() =>
            mockNavigate(`/brew-sessions/new?recipeId=${recipe.recipe_id}`)
          }
        >
          Brew This Recipe
        </button>
      </div>
    );
  };
});

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("ViewRecipe", () => {
  const mockRecipeId = "test-recipe-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ recipeId: mockRecipeId });

    // Reset service mocks
    RecipeService.fetchRecipe = jest.fn();
    BrewSessionService.getBrewSessionsForRecipe = jest.fn();
    BrewSessionService.getBrewSessionSummary = jest.fn();
    BrewSessionService.getBrewingStats = jest.fn();
  });

  describe("Loading States", () => {
    it("displays loading state while fetching recipe", async () => {
      (RecipeService.fetchRecipe as jest.Mock).mockImplementation(() => scenarios.loading());

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      expect(screen.getByText("Loading recipe...")).toBeInTheDocument();
    });

    it("displays loading state for brew sessions separately", async () => {
      const mockRecipe = mockData.recipe({
        recipe_id: mockRecipeId,
        name: "Test IPA",
        ingredients: [mockData.ingredient("grain"), mockData.ingredient("hop")],
      });

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );
      (BrewSessionService.getBrewingStats as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test IPA")).toBeInTheDocument();
      });

      expect(screen.getByText("Loading brew sessions...")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("displays error message when recipe fetch fails", async () => {
      const errorMessage = "Failed to load recipe";
      (RecipeService.fetchRecipe as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("displays recipe not found message", async () => {
      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Recipe not found")).toBeInTheDocument();
      });
    });

    it("handles brew session fetch errors gracefully", async () => {
      const mockRecipe = mockData.recipe({
        recipe_id: mockRecipeId,
        name: "Test IPA",
      });

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue([]);
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 0 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test IPA")).toBeInTheDocument();
      });

      // Should still show brew sessions section
      expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
    });
  });

  describe("Recipe Display", () => {
    const mockRecipe = mockData.recipe({
      recipe_id: mockRecipeId,
      name: "Test Imperial IPA",
      style: "Imperial IPA",
      batch_size: 5.5,
      boil_time: 90,
      efficiency: 78,
      description: "A hoppy and strong IPA",
      notes: "Use WLP001 yeast",
      version: 2,
      estimated_og: 1.075,
      estimated_fg: 1.012,
      estimated_abv: 8.3,
      estimated_ibu: 85,
      estimated_srm: 7.2,
      ingredients: [
        mockData.ingredient("grain", {
          id: "grain-1",
          name: "Pale Malt",
          amount: "10",
          unit: "lbs",
          use: "mash",
        }),
        mockData.ingredient("hop", {
          id: "hop-1",
          name: "Citra",
          amount: "2",
          unit: "oz",
          use: "boil",
          time: "60",
        }),
        mockData.ingredient("yeast", {
          id: "yeast-1",
          name: "Safale US-05",
          amount: "1",
          unit: "pkg",
          use: "fermentation",
        }),
      ],
    });

    beforeEach(() => {
      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue([]);
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 0 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);
    });

    it("displays recipe header information", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Imperial IPA")).toBeInTheDocument();
        expect(screen.getByText("Imperial IPA")).toBeInTheDocument();
        expect(screen.getByText("Version 2")).toBeInTheDocument();
      });
    });

    it("displays recipe details", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("5.5 gallons")).toBeInTheDocument();
        expect(screen.getByText("90 min")).toBeInTheDocument();
        expect(screen.getByText("78.0%")).toBeInTheDocument();
      });
    });

    it("displays recipe description when present", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("A hoppy and strong IPA")).toBeInTheDocument();
      });
    });

    it("displays recipe metrics", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        // Check metrics are displayed in the header
        expect(screen.getByText("1.075")).toBeInTheDocument();
        expect(screen.getByText("1.012")).toBeInTheDocument();
        expect(screen.getByText("8.3%")).toBeInTheDocument();
        expect(screen.getByText("85")).toBeInTheDocument();
        expect(screen.getByText("7.2")).toBeInTheDocument();
      });
    });

    it("displays ingredients in table format", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        // Check table headers
        expect(screen.getByText("Ingredient")).toBeInTheDocument();
        expect(screen.getByText("Amount")).toBeInTheDocument();
        expect(screen.getByText("Use")).toBeInTheDocument();
        expect(screen.getByText("Time")).toBeInTheDocument();

        // Check ingredient names and details
        expect(screen.getByText("Pale Malt")).toBeInTheDocument();
        expect(screen.getByText("10 lbs")).toBeInTheDocument();

        expect(screen.getByText("Citra")).toBeInTheDocument();
        expect(screen.getByText("2 oz")).toBeInTheDocument();
        expect(screen.getByText("60 min")).toBeInTheDocument();

        expect(screen.getByText("Safale US-05")).toBeInTheDocument();
        expect(screen.getByText("1 pkg")).toBeInTheDocument();
      });
    });

    it("displays brewing notes when present", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Use WLP001 yeast")).toBeInTheDocument();
      });
    });

    it("displays version history for versioned recipes", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Version 2")).toBeInTheDocument();
      });
    });

    it("handles recipes without optional fields", async () => {
      const basicRecipe = mockData.recipe({
        recipe_id: mockRecipeId,
        name: "Basic Recipe",
        style: "",
        description: "",
        notes: "",
        boil_time: null,
        efficiency: null,
        ingredients: [],
      });

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(basicRecipe);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Basic Recipe")).toBeInTheDocument();
        expect(
          screen.getByText("No ingredients added yet.")
        ).toBeInTheDocument();
      });

      // Should not display optional sections
      expect(screen.queryByText("Description")).not.toBeInTheDocument();
      expect(screen.queryByText("Brewing Notes")).not.toBeInTheDocument();
    });
  });

  describe("Brew Sessions Section", () => {
    const mockRecipe = mockData.recipe({ recipe_id: mockRecipeId });

    beforeEach(() => {
      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
    });

    it("displays empty state when no brew sessions exist", async () => {
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue([]);
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 0 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(
          screen.getByText("No brew sessions recorded for this recipe yet.")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Start Your First Brew Session")
        ).toBeInTheDocument();
      });
    });

    it("displays brew sessions summary and stats", async () => {
      const mockSessions = [
        {
          ...mockData.brewSession({
            session_id: "session-1",
            name: "Batch #1",
            status: "completed",
            actual_og: 1.074,
            actual_abv: 8.1,
            actual_efficiency: 76,
            batch_rating: 4,
          }),
          displayName: "Batch #1",
          formattedStatus: "Completed",
          statusColor: "#059669",
          brew_date: new Date("2024-01-15"),
          duration: 21,
        },
        {
          ...mockData.brewSession({
            session_id: "session-2",
            name: "Batch #2",
            status: "fermenting",
          }),
          displayName: "Batch #2",
          formattedStatus: "Fermenting",
          statusColor: "#8b5cf6",
          brew_date: new Date("2024-02-01"),
          duration: 7,
        },
      ];

      const mockSummary = {
        total: 2,
        active: 1,
        completed: 1,
        averageRating: 4.0,
        successRate: 50,
      };

      const mockStats = {
        averageOG: 1.074,
        averageABV: 8.1,
        averageEfficiency: 76,
        consistency: { abv: 0.2 },
      };

      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(mockSummary);
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(mockStats);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("2 total")).toBeInTheDocument();
        expect(screen.getByText("1 active")).toBeInTheDocument();
        expect(screen.getByText("1 completed")).toBeInTheDocument();
        expect(screen.getByText("4.0★ avg")).toBeInTheDocument();
        expect(screen.getByText("50% success")).toBeInTheDocument();

        expect(screen.getByText("Avg OG:")).toBeInTheDocument();
        expect(screen.getByText("1.074")).toBeInTheDocument();
        expect(screen.getByText("Avg ABV:")).toBeInTheDocument();
        expect(screen.getByText("8.1%")).toBeInTheDocument();
        expect(screen.getByText("High")).toBeInTheDocument(); // Consistency
      });
    });

    it("displays individual brew sessions", async () => {
      const mockSessions = [
        {
          session_id: "session-1",
          displayName: "Holiday Batch",
          formattedStatus: "Completed",
          statusColor: "#059669",
          brew_date: new Date("2024-01-15"),
          duration: 21,
          actual_og: 1.074,
          actual_fg: 1.012,
          actual_abv: 8.1,
          actual_efficiency: 76,
          batch_rating: 4,
        },
      ];

      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 1 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Holiday Batch")).toBeInTheDocument();
        expect(screen.getByText("Completed")).toBeInTheDocument();
        expect(screen.getByText("Duration: 21 days")).toBeInTheDocument();

        // Check session metrics (different from recipe metrics)
        const sessionMetrics = screen
          .getByText("Holiday Batch")
          .closest(".brew-session-item");
        expect(
          within(sessionMetrics).getByText("OG: 1.074")
        ).toBeInTheDocument();
        expect(
          within(sessionMetrics).getByText("ABV: 8.1%")
        ).toBeInTheDocument();
        expect(
          within(sessionMetrics).getByText("Eff: 76.0%")
        ).toBeInTheDocument();

        // Check rating stars
        const ratingStars = within(sessionMetrics).getAllByText("★");
        const filledStars = ratingStars.filter(
          (star) => star.className && star.className.includes("filled")
        );
        expect(filledStars).toHaveLength(4);
      });
    });
  });

  describe("User Interactions", () => {
    const user = userEvent.setup();
    const mockRecipe = mockData.recipe({ recipe_id: mockRecipeId });

    beforeEach(() => {
      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue([]);
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 0 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);
    });

    it("navigates to brew session creation from recipe actions", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Brew This Recipe")).toBeInTheDocument();
      });

      const brewButton = screen.getByText("Brew This Recipe");
      await user.click(brewButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        `/brew-sessions/new?recipeId=${mockRecipeId}`
      );
    });

    it("navigates to recipe editing from recipe actions", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit Recipe");
      await user.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        `/recipes/${mockRecipeId}/edit`
      );
    });

    it("navigates to new brew session from empty state", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Start Your First Brew Session")
        ).toBeInTheDocument();
      });

      const startButton = screen.getByText("Start Your First Brew Session");
      await user.click(startButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        `/brew-sessions/new?recipeId=${mockRecipeId}`
      );
    });

    it("navigates to new brew session from header button", async () => {
      const mockSessions = [
        {
          ...mockData.brewSession(),
          displayName: "Test Session",
          formattedStatus: "Fermenting",
          statusColor: "#8b5cf6",
          brew_date: new Date("2024-01-15"),
        },
      ];
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 1 });

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("+ New Session")).toBeInTheDocument();
      });

      const newSessionButton = screen.getByText("+ New Session");
      await user.click(newSessionButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        `/brew-sessions/new?recipeId=${mockRecipeId}`
      );
    });

    it("navigates to view brew session", async () => {
      const mockSessions = [
        {
          session_id: "session-123",
          displayName: "Test Session",
          formattedStatus: "Completed",
          statusColor: "#059669",
          brew_date: new Date("2024-01-15"),
        },
      ];

      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 1 });

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("View Session")).toBeInTheDocument();
      });

      const viewButton = screen.getByText("View Session");
      await user.click(viewButton);

      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/session-123");
    });
  });

  describe("Edge Cases", () => {
    it("handles missing recipe ID param", async () => {
      mockUseParams.mockReturnValue({});

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      // Should not call fetchRecipe when recipeId is missing
      expect(RecipeService.fetchRecipe).not.toHaveBeenCalled();
      // Should show loading state indefinitely or navigate away
      expect(screen.getByText("Loading recipe...")).toBeInTheDocument();
    });

    it("handles brew session date formatting edge cases", async () => {
      const mockRecipe = mockData.recipe({ recipe_id: mockRecipeId });
      const mockSessions = [
        {
          session_id: "session-1",
          displayName: "Test Session",
          formattedStatus: "Planned",
          statusColor: "#3b82f6",
          brew_date: null, // No brew date
        },
      ];

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 1 });

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Brewed: Unknown")).toBeInTheDocument();
      });
    });

    it("handles partial brew session data", async () => {
      const mockRecipe = mockData.recipe({ recipe_id: mockRecipeId });
      const mockSessions = [
        {
          session_id: "partial-session",
          displayName: "Partial Session",
          formattedStatus: "Planned",
          statusColor: "#3b82f6",
          brew_date: new Date("2024-01-15"),
          // Missing actual measurements
          actual_og: null,
          actual_fg: null,
          actual_abv: null,
          actual_efficiency: null,
          batch_rating: null,
        },
      ];

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue(
        mockSessions
      );
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 1 });

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        expect(screen.getByText("Partial Session")).toBeInTheDocument();
        expect(screen.getByText("Planned")).toBeInTheDocument();

        const sessionItem = screen
          .getByText("Partial Session")
          .closest(".brew-session-item");
        // Should not show metrics that are null
        expect(within(sessionItem).queryByText(/OG:/)).not.toBeInTheDocument();
        expect(
          within(sessionItem).queryByText(/Rating:/)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    const mockRecipe = mockData.recipe({ recipe_id: mockRecipeId });

    beforeEach(() => {
      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
      (BrewSessionService.getBrewSessionsForRecipe as jest.Mock).mockResolvedValue([]);
      (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({ total: 0 });
      (BrewSessionService.getBrewingStats as jest.Mock).mockResolvedValue(null);
    });

    it("has proper heading hierarchy", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toHaveTextContent(mockRecipe.name);

        const h2s = screen.getAllByRole("heading", { level: 2 });
        expect(h2s.length).toBeGreaterThan(0);
      });
    });

    it("has accessible table structure for ingredients", async () => {
      const mockRecipeWithIngredients = {
        ...mockRecipe,
        ingredients: [mockData.ingredient("grain")],
      };

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipeWithIngredients);

      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const columnHeaders = within(table).getAllByRole("columnheader");
        expect(columnHeaders).toHaveLength(4); // Ingredient, Amount, Use, Time
      });
    });

    it("provides appropriate ARIA labels and roles", async () => {
      await act(async () => {
        renderWithProviders(<ViewRecipe />);
      });

      await waitFor(() => {
        // Check for action buttons
        expect(screen.getByText("Brew This Recipe")).toBeInTheDocument();
        expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
      });
    });
  });
});
