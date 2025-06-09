import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AllRecipes from "../../src/pages/AllRecipes";
import ApiService from "../../src/services/api";
import userEvent from "@testing-library/user-event";

// Mock ApiService
jest.mock("../../src/services/api");
jest.mock(
  "../../src/components/RecipeCardContainer",
  () =>
    ({ recipes, refreshTrigger }) =>
      (
        <div data-testid="recipe-card-container">
          {recipes.map((r) => (
            <div key={r.id}>{r.name}</div>
          ))}
          <button onClick={refreshTrigger}>Refresh</button>
        </div>
      )
);

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

  it("renders loading state initially", async () => {
    ApiService.recipes = { getAll: jest.fn(() => new Promise(() => {})) };
    render(<AllRecipes />);
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });

  it("renders recipes after successful fetch (shows only 5 most recent)", async () => {
    ApiService.recipes = {
      getAll: jest.fn().mockResolvedValue({
        status: 200,
        data: { recipes: mockRecipes },
      }),
    };
    render(<AllRecipes />);
    await screen.findByTestId("recipe-card-container");
    // Should show only 5 most recent recipes
    mockRecipes.slice(0, 5).forEach((recipe) => {
      expect(screen.getByText(recipe.name)).toBeInTheDocument();
    });
    expect(screen.queryByText("Recipe 6")).not.toBeInTheDocument();
  });

  it("shows error message if fetch fails (non-200 status)", async () => {
    ApiService.recipes = {
      getAll: jest.fn().mockResolvedValue({
        status: 500,
        data: {},
      }),
    };
    render(<AllRecipes />);
    await screen.findByText(/Failed to load recipes/i);
  });

  it("shows error message if fetch throws", async () => {
    ApiService.recipes = {
      getAll: jest.fn().mockRejectedValue(new Error("Network error")),
    };
    render(<AllRecipes />);
    await screen.findByText(/Failed to load recipes/i);
  });

  it("shows 'No recipes found.' if API returns empty list", async () => {
    ApiService.recipes = {
      getAll: jest.fn().mockResolvedValue({
        status: 200,
        data: { recipes: [] },
      }),
    };
    render(<AllRecipes />);
    await screen.findByText(/No recipes found/i);
  });

  it("refreshTrigger causes recipes to reload", async () => {
    const getAllMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { recipes: mockRecipes },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { recipes: [mockRecipes[0]] },
      });
    ApiService.recipes = { getAll: getAllMock };
    render(<AllRecipes />);
    await screen.findByTestId("recipe-card-container");
    expect(screen.getByText("Recipe 1")).toBeInTheDocument();
    userEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(getAllMock).toHaveBeenCalledTimes(2));
    await screen.findByTestId("recipe-card-container");
    expect(screen.getByText("Recipe 1")).toBeInTheDocument();
  });
});
