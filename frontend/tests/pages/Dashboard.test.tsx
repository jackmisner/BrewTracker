// @ts-ignore - React needed for JSX in test files
import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router";
import Dashboard from "../../src/pages/Dashboard";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

// Mock react-router
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRecipesResponse = {
    data: {
      recipes: [
        {
          recipe_id: "recipe-1",
          name: "Test IPA",
          style: "American IPA",
          created_at: "2024-01-01T00:00:00Z",
          estimated_og: 1.065,
          estimated_fg: 1.012,
          estimated_abv: 6.9,
          estimated_ibu: 65,
          estimated_srm: 6.5,
        },
        {
          recipe_id: "recipe-2",
          name: "Brown Ale",
          style: "English Brown Ale",
          created_at: "2024-01-02T00:00:00Z",
          estimated_og: 1.048,
          estimated_fg: 1.012,
          estimated_abv: 4.7,
          estimated_ibu: 25,
          estimated_srm: 18,
        },
      ],
    },
  };

  const mockSessionsResponse = {
    data: {
      brew_sessions: [
        {
          session_id: "session-1",
          name: "IPA Batch #1",
          brew_date: "2024-01-15T00:00:00Z",
          status: "completed",
          actual_og: 1.064,
          actual_fg: 1.012,
          actual_abv: 6.8,
          batch_rating: 4,
        },
        {
          session_id: "session-2",
          name: "Brown Ale Test",
          brew_date: "2024-01-20T00:00:00Z",
          status: "fermenting",
          actual_og: 1.047,
          actual_fg: null,
          actual_abv: null,
          batch_rating: null,
        },
        {
          session_id: "session-3",
          name: "Another Completed",
          brew_date: "2024-01-10T00:00:00Z",
          status: "completed",
          actual_og: 1.05,
          actual_fg: 1.01,
          actual_abv: 5.2,
          batch_rating: 5,
        },
      ],
    },
  };

  test("renders loading state initially", () => {
    (ApiService.recipes.getAll as jest.Mock).mockImplementation(() => new Promise(() => {}));
    (ApiService.brewSessions.getAll as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithRouter(<Dashboard />);

    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  });

  test("renders dashboard with data successfully", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Check stats cards using data-testid
    await waitFor(() => {
      expect(screen.getByTestId("stat-card-total-recipes")).toHaveTextContent(
        "2"
      );
    });
    expect(screen.getByTestId("stat-card-active-ferments")).toHaveTextContent(
      "1"
    );
    expect(screen.getByTestId("stat-card-completed-batches")).toHaveTextContent(
      "2"
    );
    expect(screen.getByTestId("stat-card-avg-rating")).toHaveTextContent(
      "4.5★"
    );
  });

  test("displays recent recipes correctly", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for each element individually
    await waitFor(() => {
      expect(screen.getByText("Test IPA")).toBeInTheDocument();
    });

    // Once first element is present, others should be too
    // These can be checked synchronously
    expect(screen.getByText("Brown Ale")).toBeInTheDocument();
    expect(screen.getByText("American IPA")).toBeInTheDocument();
    expect(screen.getByText("English Brown Ale")).toBeInTheDocument();

    // Check recipe metrics
    expect(screen.getByText("1.065")).toBeInTheDocument();
    expect(screen.getByText("6.9%")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("6.5")).toBeInTheDocument();
  });

  test("displays recent brew sessions correctly", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for session name to appear first
    await waitFor(() => {
      expect(screen.getByText("IPA Batch #1")).toBeInTheDocument();
    });
    expect(screen.getByText("Brown Ale Test")).toBeInTheDocument();

    // Check status badges using getAllByText for "completed"
    const completedBadges = screen.getAllByText("completed");
    expect(completedBadges).toHaveLength(2);
    expect(screen.getByText("fermenting")).toBeInTheDocument();

    // Check session metrics
    expect(screen.getByText("1.064")).toBeInTheDocument(); // Session OG
    expect(screen.getByText("6.8%")).toBeInTheDocument(); // Session ABV
  });

  test("handles empty recipes state", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue({ data: { recipes: [] } });
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("No recipes yet. Create your first recipe!")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Create Recipe")).toBeInTheDocument();
  });

  test("handles empty brew sessions state", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue({
      data: { brew_sessions: [] },
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("No brew sessions recorded yet.")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Start Brewing")).toBeInTheDocument();
  });

  test("handles API errors", async () => {
    // Mock console.error to prevent it from cluttering test output
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (ApiService.recipes.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));
    (ApiService.brewSessions.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load dashboard data")
      ).toBeInTheDocument();
    });

    // Restore console.error
    consoleSpy.mockRestore();
  });

  test("navigates to recipe creation", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("+ New Recipe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("+ New Recipe"));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/new");
  });

  test("navigates to recipe view when View button clicked", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("View")).toHaveLength(5); // 2 recipes + 3 sessions
    });

    const recipeViewButtons = screen.getAllByText("View");
    fireEvent.click(recipeViewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/recipes/recipe-2"); // Should navigate to the first recipe in the list (most recent recipe)
  });

  test("navigates to recipe edit when Edit button clicked", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Edit")).toHaveLength(5); // 2 recipes + 3 sessions
    });

    const recipeEditButtons = screen.getAllByText("Edit");
    fireEvent.click(recipeEditButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/recipes/recipe-2/edit");
  });

  test("navigates to brew session when Brew button clicked", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByText("Brew")).toHaveLength(2); // One for each recipe
    });

    const brewButtons = screen.getAllByText("Brew");
    fireEvent.click(brewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/brew-sessions/new?recipeId=recipe-2"
    );
  });

  test("calculates dashboard stats correctly", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for stats to load and check them by their container context
    await waitFor(() => {
      // Find stats within their specific containers using getByTestId or role if available
      const totalRecipesCard = screen.getByTestId("stat-card-total-recipes");
      const totalRecipes = within(totalRecipesCard).getByText("2");
      expect(totalRecipes).toBeInTheDocument();
    });

    // Then check remaining stats
    const activeFermentsCard = screen.getByTestId("stat-card-active-ferments");
    const completedBatchesCard = screen.getByTestId(
      "stat-card-completed-batches"
    );
    const avgRatingCard = screen.getByTestId("stat-card-avg-rating");

    expect(within(activeFermentsCard).getByText("1")).toBeInTheDocument();
    expect(within(completedBatchesCard).getByText("2")).toBeInTheDocument();
    expect(within(avgRatingCard).getByText("4.5★")).toBeInTheDocument();
  });

  test("formats dates correctly", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for first date to appear
    await waitFor(() => {
      expect(screen.getByText("1/15/2024")).toBeInTheDocument();
    });

    // Check second date synchronously
    expect(screen.getByText("1/20/2024")).toBeInTheDocument();
  });

  test("displays session ratings correctly", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      // Check for star ratings
      const stars = screen.getAllByText("★");
      expect(stars.length).toBeGreaterThan(0);
    });
  });

  test("shows correct status colors", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for status badges and use getAllByText since there are multiple
    let completedBadges: any;
    await waitFor(() => {
      completedBadges = screen.getAllByText("completed");
      expect(completedBadges).toHaveLength(2); // We expect 2 completed sessions
    });

    // Check the color styling of the first completed badge
    expect(completedBadges[0]).toHaveStyle({
      backgroundColor: "rgba(5, 150, 105, 0.125)",
      color: "rgb(5, 150, 105)",
    });

    // Check fermenting status
    const fermentingBadge = screen.getByText("fermenting");
    expect(fermentingBadge).toHaveStyle({
      backgroundColor: "rgba(139, 92, 246, 0.125)",
      color: "rgb(139, 92, 246)",
    });
  });

  test("shows View all links", async () => {
    (ApiService.recipes.getAll as jest.Mock).mockResolvedValue(mockRecipesResponse);
    (ApiService.brewSessions.getAll as jest.Mock).mockResolvedValue(mockSessionsResponse);

    renderWithRouter(<Dashboard />);

    // Wait for recipes link
    await waitFor(() => {
      expect(screen.getByText("View all recipes →")).toBeInTheDocument();
    });

    // Check sessions link synchronously
    expect(screen.getByText("View all sessions →")).toBeInTheDocument();
  });
});
