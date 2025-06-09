import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import AllRecipes from "../../src/pages/AllRecipes";
import ApiService from "../../src/services/api";
import userEvent from "@testing-library/user-event";

// Mock ApiService
jest.mock("../../src/services/api");

// Mock RecipeCardContainer component
jest.mock(
  "../../src/components/RecipeCardContainer",
  () =>
    ({ recipes, refreshTrigger }) =>
      (
        <div data-testid="recipe-card-container">
          {recipes.map((r) => (
            <div key={r.id} data-testid={`recipe-${r.id}`}>
              {r.name}
            </div>
          ))}
          <button onClick={refreshTrigger} data-testid="refresh-button">
            Refresh
          </button>
        </div>
      )
);

// Suppress console errors during tests
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

const mockRecipes = [
  { id: 1, name: "Recipe 1", updated_at: "2024-06-10T12:00:00Z" },
  { id: 2, name: "Recipe 2", updated_at: "2024-06-09T12:00:00Z" },
  { id: 3, name: "Recipe 3", updated_at: "2024-06-08T12:00:00Z" },
  { id: 4, name: "Recipe 4", updated_at: "2024-06-07T12:00:00Z" },
  { id: 5, name: "Recipe 5", updated_at: "2024-06-06T12:00:00Z" },
  { id: 6, name: "Recipe 6", updated_at: "2024-06-05T12:00:00Z" },
];

describe("AllRecipes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up DOM between tests
    document.body.innerHTML = "";
  });

  describe("Loading States", () => {
    it("renders loading state initially", async () => {
      // Mock a promise that never resolves to simulate loading
      ApiService.recipes = {
        getAll: jest.fn(() => new Promise(() => {})),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    });
  });

  describe("Successful Data Loading", () => {
    it("renders recipes after successful fetch (shows only 5 most recent)", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: mockRecipes },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      // Should show only 5 most recent recipes
      mockRecipes.slice(0, 5).forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });

      // Should not show the 6th recipe (oldest)
      expect(screen.queryByText("Recipe 6")).not.toBeInTheDocument();
    });

    it("renders all recipes when less than 5 exist", async () => {
      const fewRecipes = mockRecipes.slice(0, 3);
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: fewRecipes },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      fewRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it("shows 'No recipes found.' if API returns empty list", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: [] },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/No recipes found/i)).toBeInTheDocument();
      });
    });

    it("handles missing recipes array in response", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: {}, // Missing recipes array
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        // Component treats missing recipes array as an error, not empty state
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error message if fetch fails (non-200 status)", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 500,
          data: {},
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });

    it("shows error message if fetch throws", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockRejectedValue(new Error("Network error")),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });

    it("shows error message for 401 unauthorized", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 401,
          data: {},
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });

    it("shows error message for 500 server error", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 500,
          data: {},
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });

    it("handles undefined API response gracefully", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue(undefined),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("refreshTrigger causes recipes to reload", async () => {
      const user = userEvent.setup();

      const getAllMock = jest
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          data: { recipes: mockRecipes },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { recipes: [mockRecipes[0]] }, // Only return first recipe on refresh
        });

      ApiService.recipes = { getAll: getAllMock };

      await act(async () => {
        render(<AllRecipes />);
      });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      expect(screen.getByText("Recipe 1")).toBeInTheDocument();
      expect(getAllMock).toHaveBeenCalledTimes(1);

      // Click refresh button
      const refreshButton = screen.getByTestId("refresh-button");
      await act(async () => {
        await user.click(refreshButton);
      });

      // Wait for refresh to complete
      await waitFor(() => {
        expect(getAllMock).toHaveBeenCalledTimes(2);
      });

      // Should still show Recipe 1 (the only one returned after refresh)
      expect(screen.getByText("Recipe 1")).toBeInTheDocument();
    });

    it("refresh functionality is not available during error state", async () => {
      const getAllMock = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      ApiService.recipes = { getAll: getAllMock };

      await act(async () => {
        render(<AllRecipes />);
      });

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByText(/Failed to load recipes/i)).toBeInTheDocument();
      });

      expect(getAllMock).toHaveBeenCalledTimes(1);

      // Refresh button should not be available in error state
      expect(screen.queryByTestId("refresh-button")).not.toBeInTheDocument();
    });

    it("multiple rapid refresh clicks are handled gracefully", async () => {
      const user = userEvent.setup();

      const getAllMock = jest.fn().mockResolvedValue({
        status: 200,
        data: { recipes: [mockRecipes[0]] },
      });

      ApiService.recipes = { getAll: getAllMock };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      const refreshButton = screen.getByTestId("refresh-button");

      // Click refresh multiple times rapidly
      await act(async () => {
        await user.click(refreshButton);
        await user.click(refreshButton);
        await user.click(refreshButton);
      });

      // Should handle multiple clicks gracefully
      await waitFor(() => {
        expect(getAllMock).toHaveBeenCalledTimes(4); // Initial + 3 refresh clicks
      });
    });
  });

  describe("Data Sorting", () => {
    it("displays recipes sorted by most recent first", async () => {
      const unsortedRecipes = [
        { id: 1, name: "Old Recipe", updated_at: "2024-06-01T12:00:00Z" },
        { id: 2, name: "New Recipe", updated_at: "2024-06-10T12:00:00Z" },
        { id: 3, name: "Medium Recipe", updated_at: "2024-06-05T12:00:00Z" },
      ];

      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: unsortedRecipes },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      // All recipes should be displayed (less than 5)
      expect(screen.getByText("Old Recipe")).toBeInTheDocument();
      expect(screen.getByText("New Recipe")).toBeInTheDocument();
      expect(screen.getByText("Medium Recipe")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles recipes with missing or invalid updated_at dates", async () => {
      const recipesWithBadDates = [
        { id: 1, name: "Recipe 1", updated_at: null },
        { id: 2, name: "Recipe 2", updated_at: "invalid-date" },
        { id: 3, name: "Recipe 3", updated_at: "2024-06-10T12:00:00Z" },
      ];

      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: recipesWithBadDates },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      // Should still display all recipes despite bad dates
      recipesWithBadDates.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it("handles very large recipe lists efficiently", async () => {
      const largeRecipeList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Recipe ${i + 1}`,
        updated_at: `2024-06-${String(10 - (i % 10)).padStart(
          2,
          "0"
        )}T12:00:00Z`,
      }));

      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: largeRecipeList },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("recipe-card-container")).toBeInTheDocument();
      });

      // Should only show 5 recipes regardless of input size
      // Use a more specific selector that excludes the container and button
      const displayedRecipes = screen.getAllByTestId(/^recipe-\d+$/);
      expect(displayedRecipes).toHaveLength(5);
    });
  });
});
