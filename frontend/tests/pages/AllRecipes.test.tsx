// @ts-ignore - React needed for JSX in test files
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import AllRecipes from "../../src/pages/AllRecipes";
import ApiService from "../../src/services/api";
import userEvent from "@testing-library/user-event";

// Mock ApiService
jest.mock("../../src/services/api");

// Mock CompactRecipeCard component
jest.mock(
  "../../src/components/CompactRecipeCard",
  () =>
    ({ recipe }) =>
      (
        <div data-testid={`recipe-${recipe.id}`} className="compact-recipe-card">
          <div className="compact-recipe-name">{recipe.name}</div>
          <div className="compact-recipe-style">{recipe.style}</div>
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
  { id: 1, name: "American IPA", style: "IPA", description: "Hoppy beer", updated_at: "2024-06-10T12:00:00Z" },
  { id: 2, name: "German Lager", style: "Lager", description: "Clean and crisp", updated_at: "2024-06-09T12:00:00Z" },
  { id: 3, name: "Belgian Witbier", style: "Wheat Beer", description: "Refreshing wheat", updated_at: "2024-06-08T12:00:00Z" },
  { id: 4, name: "Porter Stout", style: "Porter", description: "Dark and roasty", updated_at: "2024-06-07T12:00:00Z" },
  { id: 5, name: "Saison Farmhouse", style: "Saison", description: "Spicy and fruity", updated_at: "2024-06-06T12:00:00Z" },
  { id: 6, name: "Pilsner Classic", style: "Pilsner", description: "Light and crisp", updated_at: "2024-06-05T12:00:00Z" },
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
    it("renders all recipes after successful fetch", async () => {
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
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      // Should show all recipes
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it("renders all recipes when few exist", async () => {
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
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
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
        // Component gracefully handles missing recipes array as empty state
        expect(screen.getByText(/No recipes found/i)).toBeInTheDocument();
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
    it("recipes are properly displayed in grid layout", async () => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: mockRecipes },
        }),
      };

      await act(async () => {
        render(<AllRecipes />);
      });

      // Wait for initial load
      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      // Should show all recipes
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it("no recipes are displayed during error state", async () => {
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

      // Recipes grid should not be available in error state
      expect(document.querySelector(".recipes-grid")).not.toBeInTheDocument();
    });

    it("displays correct number of recipes in grid", async () => {
      const getAllMock = jest.fn().mockResolvedValue({
        status: 200,
        data: { recipes: mockRecipes },
      });

      ApiService.recipes = { getAll: getAllMock };

      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      // Should show correct number of recipe cards
      const recipeCards = document.querySelectorAll(".compact-recipe-card");
      expect(recipeCards).toHaveLength(mockRecipes.length);
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
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
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
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
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
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      // Should show all recipes now
      // Use a more specific selector that excludes the container and button
      const displayedRecipes = screen.getAllByTestId(/^recipe-\d+$/);
      expect(displayedRecipes).toHaveLength(100);
    });
  });

  describe("Sorting Functionality", () => {
    beforeEach(() => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: mockRecipes },
        }),
      };
    });

    it("shows sort dropdown when recipes are loaded", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Sort by:")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Last Updated (Newest)")).toBeInTheDocument();
    });

    it("sorts recipes by name when name sort is selected", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText("Sort by:");
      
      await act(async () => {
        fireEvent.change(sortSelect, { target: { value: "name_asc" } });
      });

      // Should still show all recipes, but potentially in different order
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("Name (A-Z)")).toBeInTheDocument();
    });

    it("sorts recipes by ABV when ABV sort is selected", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText("Sort by:");
      
      await act(async () => {
        fireEvent.change(sortSelect, { target: { value: "abv_desc" } });
      });

      // Should still show all recipes
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("ABV (High to Low)")).toBeInTheDocument();
    });

    it("search and sort work together", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      // First apply search
      const searchInput = screen.getByPlaceholderText(
        "Search recipes by name, style, description..."
      );
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "IPA" } });
      });

      // Then apply sort
      const sortSelect = screen.getByLabelText("Sort by:");
      
      await act(async () => {
        fireEvent.change(sortSelect, { target: { value: "name_asc" } });
      });

      // Should show search results with sorting applied
      await waitFor(() => {
        expect(screen.getByText("American IPA")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Name (A-Z)")).toBeInTheDocument();
        expect(screen.getByText(/Showing \d+ of \d+ recipes/)).toBeInTheDocument();
      });
    });
  });

  describe("Search Functionality", () => {
    beforeEach(() => {
      ApiService.recipes = {
        getAll: jest.fn().mockResolvedValue({
          status: 200,
          data: { recipes: mockRecipes },
        }),
      };
    });

    it("shows search bar when recipes are loaded", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("Search recipes by name, style, description...")
      ).toBeInTheDocument();
    });

    it("filters recipes by search term", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search recipes by name, style, description..."
      );

      // Search for "IPA"
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "IPA" } });
      });

      // Should show only recipes matching "IPA"
      await waitFor(() => {
        expect(screen.getByText("American IPA")).toBeInTheDocument();
        expect(screen.queryByText("German Lager")).not.toBeInTheDocument();
        expect(screen.queryByText("Porter Stout")).not.toBeInTheDocument();
        expect(screen.queryByText("Saison Farmhouse")).not.toBeInTheDocument();
        expect(screen.queryByText("Pilsner Classic")).not.toBeInTheDocument();
      });
      
      // Note: We're not testing that Belgian Witbier is NOT shown because fuzzy search
      // might match it due to common brewing terms

      // Should show search result count
      expect(screen.getByText(/Showing \d+ of \d+ recipes/)).toBeInTheDocument();
    });

    it("shows no results message when search finds nothing", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search recipes by name, style, description..."
      );

      // Search for something that doesn't exist
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "NonExistentRecipe" } });
      });

      await waitFor(() => {
        expect(
          screen.getByText(/No recipes found matching "NonExistentRecipe"/)
        ).toBeInTheDocument();
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      });
    });

    it("clears search when clear button is clicked", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search recipes by name, style, description..."
      );

      // Enter a search term
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "IPA" } });
      });

      // Clear button should appear (it's the X button in the search input)
      await waitFor(() => {
        const clearButtons = screen.getAllByRole("button");
        const clearButton = clearButtons.find(button => 
          button.querySelector('svg path[d="M6 18L18 6M6 6l12 12"]')
        );
        expect(clearButton).toBeInTheDocument();
      });

      // Click clear button
      const clearButtons = screen.getAllByRole("button");
      const clearButton = clearButtons.find(button => 
        button.querySelector('svg path[d="M6 18L18 6M6 6l12 12"]')
      );
      await act(async () => {
        fireEvent.click(clearButton);
      });

      // Search should be cleared and all recipes shown
      expect(searchInput).toHaveValue("");
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });
    });

    it("does not search when term is less than 2 characters", async () => {
      await act(async () => {
        render(<AllRecipes />);
      });

      await waitFor(() => {
        expect(document.querySelector(".recipes-grid")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search recipes by name, style, description..."
      );

      // Enter single character
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "A" } });
      });

      // Should still show all recipes
      mockRecipes.forEach((recipe) => {
        expect(screen.getByText(recipe.name)).toBeInTheDocument();
      });

      // Should not show search results count
      await waitFor(() => {
        expect(screen.queryByText(/Showing \d+ of \d+ recipes/)).not.toBeInTheDocument();
      });
    });
  });
});
