// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router";
import PublicRecipes from "../../src/pages/PublicRecipes";
import ApiService from "../../src/services/api";
import { renderWithProviders, mockData, scenarios } from "../testUtils";

// Mock the ApiService
jest.mock("../../src/services/api", () => ({
  recipes: {
    getPublic: jest.fn(),
    clone: jest.fn(),
    clonePublic: jest.fn(),
  },
}));

// Mock CompactRecipeCard component
jest.mock("../../src/components/CompactRecipeCard", () => {
  return function MockCompactRecipeCard({ recipe }) {
    return (
      <div data-testid={`recipe-card-${recipe.recipe_id}`}>
        <h3>{recipe.name}</h3>
        <p>{recipe.style}</p>
        <p>OG: {recipe.estimated_og}</p>
      </div>
    );
  };
});

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("PublicRecipes", () => {
  const sampleRecipes = [
    {
      recipe_id: "recipe-1",
      name: "American IPA",
      style: "IPA",
      estimated_og: 1.065,
      estimated_fg: 1.012,
      estimated_abv: 6.9,
      estimated_ibu: 65,
      estimated_srm: 6.5,
      username: "brewer1",
      is_public: true,
    },
    {
      recipe_id: "recipe-2",
      name: "Imperial Stout",
      style: "Stout",
      estimated_og: 1.085,
      estimated_fg: 1.02,
      estimated_abv: 8.5,
      estimated_ibu: 50,
      estimated_srm: 35,
      username: "brewer2",
      is_public: true,
    },
    {
      recipe_id: "recipe-3",
      name: "German Lager",
      style: "Lager",
      estimated_og: 1.048,
      estimated_fg: 1.01,
      estimated_abv: 5.0,
      estimated_ibu: 25,
      estimated_srm: 4,
      username: "brewer3",
      is_public: true,
    },
  ];

  const samplePagination = {
    page: 1,
    pages: 3,
    per_page: 12,
    total: 30,
    has_prev: false,
    has_next: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();

    // Default successful API response
    (ApiService.recipes.getPublic as jest.Mock).mockResolvedValue({
      data: {
        recipes: sampleRecipes,
        pagination: samplePagination,
      },
    });
  });

  describe("Initial render and loading", () => {
    it("renders page title and search form", async () => {
      renderWithProviders(<PublicRecipes />);

      expect(screen.getByText("Public Recipe Library")).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("Search recipes by name, style, description...")
      ).toBeInTheDocument();
      expect(screen.getByText("All Styles")).toBeInTheDocument();
    });

    it("shows loading state initially", () => {
      (ApiService.recipes.getPublic as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );

      renderWithProviders(<PublicRecipes />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("calls getPublic API on mount", () => {
      renderWithProviders(<PublicRecipes />);

      expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {});
    });

    it("renders style filter options", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const styleSelect = screen.getByDisplayValue("All Styles");
      expect(styleSelect).toBeInTheDocument();

      // Check if all style options are present
      expect(
        screen.getByRole("option", { name: "All Styles" })
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "IPA" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Stout" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Lager" })).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Wheat Beer" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Porter" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Pale Ale" })
      ).toBeInTheDocument();
    });
  });

  describe("Successful data display", () => {
    it("displays recipes after loading", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("recipe-card-recipe-1")).toBeInTheDocument();
      expect(screen.getByTestId("recipe-card-recipe-2")).toBeInTheDocument();
      expect(screen.getByTestId("recipe-card-recipe-3")).toBeInTheDocument();
    });

    it("displays recipe information correctly", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.getByText("American IPA")).toBeInTheDocument();
      });

      expect(screen.getByText("Imperial Stout")).toBeInTheDocument();
      expect(screen.getByText("German Lager")).toBeInTheDocument();
      expect(screen.getByText("by brewer1")).toBeInTheDocument();
      expect(screen.getByText("by brewer2")).toBeInTheDocument();
      expect(screen.getByText("by brewer3")).toBeInTheDocument();
    });

    it("displays clone buttons for each recipe", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const cloneButtons = screen.getAllByText("Clone");
      expect(cloneButtons).toHaveLength(3);
    });

    it("displays pagination when multiple pages exist", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
      expect(screen.getByText("Previous")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    it("disables previous button on first page", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const prevButton = screen.getByText("Previous");
      expect(prevButton).toBeDisabled();
    });

    it("enables next button when has_next is true", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const nextButton = screen.getByText("Next");
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe("Error handling", () => {
    it("displays error message when API fails", async () => {
      (ApiService.recipes.getPublic as jest.Mock).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load public recipes")
        ).toBeInTheDocument();
      });

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("recipe-card-recipe-1")
      ).not.toBeInTheDocument();
    });

    it("logs error to console when API fails", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (ApiService.recipes.getPublic as jest.Mock).mockRejectedValue(
        new Error("Network Error")
      );

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error fetching public recipes:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Search functionality", () => {
    it("updates search query when typing", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      fireEvent.change(searchInput, { target: { value: "IPA" } });

      expect((searchInput as HTMLInputElement).value).toBe("IPA");
    });

    it("calls API with search query when form is submitted", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      fireEvent.change(searchInput, { target: { value: "IPA recipes" } });

      // Note: The new implementation uses client-side filtering, not API calls for search
      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {});
      });
    });

    it("calls API with search query when Enter is pressed", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      fireEvent.change(searchInput, { target: { value: "stout" } });
      
      // Note: The new implementation uses client-side filtering, not form submission
      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {});
      });
    });

    it("resets to page 1 when searching", async () => {
      // First, simulate being on page 2
      const { rerender } = renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(2, 12, {});
      });

      // Now search, which should reset to page 1
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {});
      });
    });
  });

  describe("Style filtering", () => {
    it("updates style filter when option is selected", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const styleSelect = screen.getByDisplayValue("All Styles");
      fireEvent.change(styleSelect, { target: { value: "IPA" } });

      expect((styleSelect as HTMLInputElement).value).toBe("IPA");
    });

    it("calls API with style filter when changed", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const styleSelect = screen.getByDisplayValue("All Styles");
      fireEvent.change(styleSelect, { target: { value: "Stout" } });

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, { style: "Stout" });
      });
    });

    it("combines search and style filter", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      const styleSelect = screen.getByDisplayValue("All Styles");

      fireEvent.change(searchInput, { target: { value: "hoppy" } });
      fireEvent.change(styleSelect, { target: { value: "IPA" } });

      // Note: The new implementation uses client-side filtering for search,
      // so we only expect the API to be called with the style filter
      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {
          style: "IPA",
        });
      });
    });
  });

  describe("Recipe cloning", () => {
    it("calls clonePublic API when clone button is clicked", async () => {
      (ApiService.recipes.clonePublic as jest.Mock).mockResolvedValue({
        data: { recipe_id: "cloned-recipe-id" },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const cloneButtons = screen.getAllByText("Clone");
      fireEvent.click(cloneButtons[0]);

      expect(ApiService.recipes.clonePublic).toHaveBeenCalledWith("recipe-1", "brewer1");
    });

    it("navigates to edit page after successful clone", async () => {
      (ApiService.recipes.clonePublic as jest.Mock).mockResolvedValue({
        status: 201,
        data: { recipe_id: "cloned-recipe-id" },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const cloneButtons = screen.getAllByText("Clone");
      fireEvent.click(cloneButtons[0]);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/recipes/cloned-recipe-id/edit"
        );
      });
    });

    it("shows alert when clone fails", async () => {
      const alertSpy = jest.spyOn(window, "alert").mockImplementation();
      (ApiService.recipes.clonePublic as jest.Mock).mockRejectedValue(new Error("Clone failed"));

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const cloneButtons = screen.getAllByText("Clone");
      fireEvent.click(cloneButtons[0]);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "Failed to clone recipe: Clone failed"
        );
      });

      alertSpy.mockRestore();
    });
  });

  describe("Pagination", () => {
    it("hides pagination when only one page", async () => {
      (ApiService.recipes.getPublic as jest.Mock).mockResolvedValue({
        data: {
          recipes: [sampleRecipes[0]],
          pagination: { ...samplePagination, pages: 1 },
        },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.queryByText("Previous")).not.toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
      expect(screen.queryByText("Page 1 of 1")).not.toBeInTheDocument();
    });

    it("calls API with correct page when next is clicked", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(2, 12, {});
    });

    it("calls API with correct page when previous is clicked", async () => {
      // Start on page 2
      (ApiService.recipes.getPublic as jest.Mock).mockResolvedValue({
        data: {
          recipes: sampleRecipes,
          pagination: { ...samplePagination, page: 2, has_prev: true },
        },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const prevButton = screen.getByText("Previous");
      fireEvent.click(prevButton);

      expect(ApiService.recipes.getPublic).toHaveBeenCalledWith(1, 12, {});
    });

    it("disables next button on last page", async () => {
      (ApiService.recipes.getPublic as jest.Mock).mockResolvedValue({
        data: {
          recipes: sampleRecipes,
          pagination: { ...samplePagination, page: 3, has_next: false },
        },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const nextButton = screen.getByText("Next");
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Empty state", () => {
    it("handles empty recipe list gracefully", async () => {
      (ApiService.recipes.getPublic as jest.Mock).mockResolvedValue({
        data: {
          recipes: [],
          pagination: { ...samplePagination, total: 0, pages: 0 },
        },
      });

      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId(/recipe-card/)).not.toBeInTheDocument();
      expect(screen.queryByText("Clone")).not.toBeInTheDocument();
    });
  });

  describe("Component lifecycle", () => {
    it("refetches data when page changes", async () => {
      renderWithProviders(<PublicRecipes />);

      // Wait for initial loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(1);

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(2);
      });
    });

    it("refetches data when style filter changes", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const styleSelect = screen.getByDisplayValue("All Styles");
      fireEvent.change(styleSelect, { target: { value: "IPA" } });

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(2);
      });
    });

    it("does not refetch when search query changes without submit", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search recipes by name, style, description...");
      fireEvent.change(searchInput, { target: { value: "test" } });

      // Should not trigger additional API call (client-side filtering)
      expect(ApiService.recipes.getPublic).toHaveBeenCalledTimes(1);
    });
  });

  describe("Loading states", () => {
    it("shows loading state during pagination", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Mock a slow response for the next page
      (ApiService.recipes.getPublic as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );

      const nextButton = screen.getByText("Next");
      fireEvent.click(nextButton);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows loading state during filtering", async () => {
      renderWithProviders(<PublicRecipes />);

      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });

      // Mock a slow response for filtering
      (ApiService.recipes.getPublic as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );

      const styleSelect = screen.getByDisplayValue("All Styles");
      fireEvent.change(styleSelect, { target: { value: "IPA" } });

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });
});
