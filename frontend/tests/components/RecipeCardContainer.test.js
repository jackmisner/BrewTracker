import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecipeCardContainer from "../../src/components/RecipeCardContainer";

// Mock RecipeCard to isolate RecipeCardContainer logic
jest.mock("../../src/components/RecipeCard", () => ({ recipe, onDelete }) => (
  <div data-testid="recipe-card">
    <span>{recipe.name}</span>
    <button onClick={() => onDelete(recipe._id)}>Delete</button>
  </div>
));

describe("RecipeCardContainer", () => {
  const sampleRecipes = [
    { _id: "1", name: "Recipe 1" },
    { _id: "2", name: "Recipe 2" },
  ];
  let refreshTrigger;

  beforeEach(() => {
    refreshTrigger = jest.fn();
  });

  it("renders the correct number of RecipeCard components", () => {
    render(
      <RecipeCardContainer
        recipes={sampleRecipes}
        refreshTrigger={refreshTrigger}
      />
    );
    const cards = screen.getAllByTestId("recipe-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Recipe 1")).toBeInTheDocument();
    expect(screen.getByText("Recipe 2")).toBeInTheDocument();
  });

  it("shows 'No recipes found.' when recipes array is empty", () => {
    render(
      <RecipeCardContainer recipes={[]} refreshTrigger={refreshTrigger} />
    );
    expect(screen.getByText("No recipes found.")).toBeInTheDocument();
  });

  it("removes a recipe when handleDeleteRecipe is called", () => {
    render(
      <RecipeCardContainer
        recipes={sampleRecipes}
        refreshTrigger={refreshTrigger}
      />
    );
    // Delete the first recipe
    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    // Only one card should remain
    expect(screen.getAllByTestId("recipe-card")).toHaveLength(1);
    expect(screen.queryByText("Recipe 1")).not.toBeInTheDocument();
    expect(screen.getByText("Recipe 2")).toBeInTheDocument();
    // refreshTrigger should be called
    expect(refreshTrigger).toHaveBeenCalled();
  });

  it("shows 'No recipes found.' after deleting all recipes", () => {
    render(
      <RecipeCardContainer
        recipes={[{ _id: "1", name: "Recipe 1" }]}
        refreshTrigger={refreshTrigger}
      />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("No recipes found.")).toBeInTheDocument();
  });
});
