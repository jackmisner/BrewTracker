import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { BrowserRouter } from "react-router";
import RecipeCard from "../../src/components/RecipeCard";
import ApiService from "../../src/services/api";
import BrewSessionService from "../../src/services/BrewSessionService";
import CacheManager from "../../src/services/CacheManager";

// Import types for better type safety
interface MockRecipe {
  recipe_id: string;
  name: string;
  style: string;
  description?: string;
  created_at: string;
  version: number;
}

interface MockMetrics {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
}

interface MockBrewingSummary {
  total: number;
  active: number;
  averageRating: number;
  mostRelevant: {
    session_id: string;
    status: string;
    formattedStatus: string;
    statusColor: string;
    brew_date: Date;
    actual_abv: number;
    batch_rating: number;
  };
}

// Mock the services
jest.mock("../../src/services/api");
jest.mock("../../src/services/BrewSessionService");
jest.mock("../../src/services/CacheManager");

// Mock react-router
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

// Mock RecipeMetrics component
jest.mock("../../src/components/RecipeBuilder/RecipeMetrics", () => {
  return function MockRecipeMetrics({ metrics, cardView }: { metrics: MockMetrics; cardView: boolean }) {
    return (
      <div data-testid="recipe-metrics" data-card-view={cardView}>
        <div>OG: {metrics.og}</div>
        <div>ABV: {metrics.abv}%</div>
        <div>IBU: {metrics.ibu}</div>
      </div>
    );
  };
});

// Mock RecipeActions component
jest.mock("../../src/components/RecipeActions", () => {
  return function MockRecipeActions({
    recipe,
    compact: _compact,
    onDelete,
    refreshTrigger,
  }: {
    recipe: MockRecipe;
    compact?: boolean;
    onDelete?: (recipeId: string) => void;
    refreshTrigger: () => void;
  }) {
    return (
      <div data-testid="recipe-actions">
        <button onClick={() => onDelete?.(recipe.recipe_id)}>Delete</button>
        <button onClick={refreshTrigger}>Refresh</button>
      </div>
    );
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("RecipeCard", () => {
  const mockRecipe: MockRecipe = {
    recipe_id: "recipe-123",
    name: "American IPA",
    style: "American IPA",
    description: "A hoppy American IPA with citrus notes",
    created_at: "2024-01-15T10:00:00Z",
    version: 1,
  };

  const mockMetrics: MockMetrics = {
    og: 1.048,
    fg: 1.012,
    abv: 4.7,
    ibu: 35,
    srm: 8.5,
  };

  const mockBrewingSummary: MockBrewingSummary = {
    total: 2,
    active: 1,
    averageRating: 4.2,
    mostRelevant: {
      session_id: "session-123",
      status: "fermenting",
      formattedStatus: "Fermenting",
      statusColor: "#f59e0b",
      brew_date: new Date("2024-02-01"),
      actual_abv: 4.8,
      batch_rating: 4,
    },
  };

  const defaultProps = {
    recipe: mockRecipe,
    onDelete: jest.fn(),
    refreshTrigger: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API responses
    ApiService.recipes = {
      calculateMetrics: jest.fn(),
    } as any;

    BrewSessionService.getBrewSessionSummary = jest.fn();
    BrewSessionService.safeNavigateToSession = jest.fn();

    CacheManager.addEventListener = jest.fn();
    CacheManager.removeEventListener = jest.fn();
  });

  test("renders recipe information correctly", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    // Wait for async operations to complete
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "American IPA" })
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("recipe-metrics")).toBeInTheDocument();
    expect(
      screen.getByText("A hoppy American IPA with citrus notes")
    ).toBeInTheDocument();
  });

  test("displays version number for versioned recipes", async () => {
    const versionedRecipe = { ...mockRecipe, version: 3 };

    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(
        <RecipeCard {...{ ...defaultProps, recipe: versionedRecipe } as any} />
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Version: 3")).toBeInTheDocument();
    });
  });

  test("shows fallback description when none provided", async () => {
    const recipeWithoutDescription = { ...mockRecipe, description: null };

    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(
        <RecipeCard {...{ ...defaultProps, recipe: recipeWithoutDescription } as any} />
      );
    });

    await waitFor(() => {
      expect(screen.getByText("No description available.")).toBeInTheDocument();
    });
  });

  test("renders metrics in card view", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      const metricsComponent = screen.getByTestId("recipe-metrics");
      expect(metricsComponent).toHaveAttribute("data-card-view", "true");
      expect(screen.getByText("OG: 1.048")).toBeInTheDocument();
      expect(screen.getByText("ABV: 4.7%")).toBeInTheDocument();
    });
  });

  test("displays brewing session summary when sessions exist", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("2 sessions")).toBeInTheDocument();
      expect(screen.getByText("1 active")).toBeInTheDocument();
      expect(screen.getByText("4.2★")).toBeInTheDocument();
      expect(screen.getByText("Latest:")).toBeInTheDocument();
      expect(screen.getByText("FERMENTING")).toBeInTheDocument();
    });
  });

  test("shows no sessions state when recipe hasn't been brewed", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Not brewed yet")).toBeInTheDocument();
      expect(screen.getByText("Ready to try this recipe?")).toBeInTheDocument();
      expect(screen.getByText("Start Brewing")).toBeInTheDocument();
    });
  });

  test("handles session loading state", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    ); // Never resolves

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    // Should show loading state immediately
    expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
  });

  test("handles session loading error", async () => {
    // Mock console.error to avoid cluttering test output
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockRejectedValue(
      new Error("Failed to load")
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      expect(screen.getByTestId("refresh-button")).toBeInTheDocument();
    });

    // Restore console.error
    consoleSpy.mockRestore();
  });

  test("navigates to brew session creation when brew button clicked", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    // Wait for the brew button to appear
    const brewButton = await screen.findByText("Start Brewing");

    await act(async () => {
      fireEvent.click(brewButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/brew-sessions/new?recipeId=recipe-123"
    );
  });

  test("navigates to latest session when view latest clicked", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );
    (BrewSessionService.safeNavigateToSession as jest.Mock).mockResolvedValue(undefined);

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    const viewLatestButton = await screen.findByText("View Latest");

    await act(async () => {
      fireEvent.click(viewLatestButton);
    });

    expect(BrewSessionService.safeNavigateToSession).toHaveBeenCalledWith(
      "session-123",
      mockNavigate
    );
  });

  test("shows brew again button when sessions exist", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Brew Again")).toBeInTheDocument();
    });
  });

  test("displays session metrics when available", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("ABV: 4.8%")).toBeInTheDocument();
      expect(screen.getByText("4★")).toBeInTheDocument();
    });
  });

  test("handles metrics loading error gracefully", async () => {
    // Mock console.error to avoid cluttering test output
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (ApiService.recipes.calculateMetrics as jest.Mock).mockRejectedValue(
      new Error("Failed to load metrics")
    );
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    // Should still render the card even if metrics fail to load
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "American IPA" })
      ).toBeInTheDocument();
    });

    // Restore console.error
    consoleSpy.mockRestore();
  });

  test("refreshes brewing data when cache invalidation events occur", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    let eventHandlers: { [key: string]: any } = {};
    (CacheManager.addEventListener as jest.Mock).mockImplementation((event: string, handler: any) => {
      eventHandlers[event] = handler;
    });

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("2 sessions")).toBeInTheDocument();
    });

    // Simulate cache invalidation event
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue({
      ...mockBrewingSummary,
      total: 3,
    });

    await act(async () => {
      eventHandlers["brew-session-created"]({ recipe_id: "recipe-123" });
    });

    await waitFor(() => {
      expect(BrewSessionService.getBrewSessionSummary).toHaveBeenCalledWith(
        "recipe-123",
        true
      );
    });
  });

  test("renders recipe actions component", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("recipe-actions")).toBeInTheDocument();
    });
  });

  test("shows last brewed instead of latest for completed sessions", async () => {
    const completedSessionSummary = {
      ...mockBrewingSummary,
      active: 0,
      mostRelevant: {
        ...mockBrewingSummary.mostRelevant,
        formattedStatus: "Completed",
      },
    };

    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      completedSessionSummary
    );

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Last brewed:")).toBeInTheDocument();
    });
  });

  test("handles refresh button click", async () => {
    // Mock console.error to avoid cluttering test output
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(mockBrewingSummary);

    await act(async () => {
      renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-button"));
    });

    await waitFor(() => {
      expect(screen.getByText("2 sessions")).toBeInTheDocument();
    });

    // Restore console.error
    consoleSpy.mockRestore();
  });

  test("cleans up event listeners on unmount", async () => {
    (ApiService.recipes.calculateMetrics as jest.Mock).mockResolvedValue({
      data: mockMetrics,
    });
    (BrewSessionService.getBrewSessionSummary as jest.Mock).mockResolvedValue(
      mockBrewingSummary
    );

    let component: any;
    await act(async () => {
      component = renderWithRouter(<RecipeCard {...defaultProps as any} />);
    });

    await act(async () => {
      component.unmount();
    });

    expect(CacheManager.removeEventListener).toHaveBeenCalledWith(
      "brew-session-created",
      expect.any(Function)
    );
    expect(CacheManager.removeEventListener).toHaveBeenCalledWith(
      "brew-session-updated",
      expect.any(Function)
    );
    expect(CacheManager.removeEventListener).toHaveBeenCalledWith(
      "brew-session-deleted",
      expect.any(Function)
    );
  });
});
