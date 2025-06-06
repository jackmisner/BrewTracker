import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RecipeVersionHistory from "../../src/components/RecipeBuilder/RecipeVersionHistory";
import ApiService from "../../src/services/api";

// Mock the ApiService
jest.mock("../../src/services/api", () => ({
  recipes: {
    getVersionHistory: jest.fn(),
  },
}));

// Mock React Router Link component
jest.mock("react-router", () => ({
  Link: ({ to, children, className }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock console.error to avoid noise in tests
const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

describe("RecipeVersionHistory", () => {
  const defaultProps = {
    recipeId: "123",
    version: 2,
    parentRecipeId: null,
  };

  const mockVersionHistoryData = {
    parent_recipe: {
      recipe_id: "456",
      name: "Original Recipe",
      version: 1,
    },
    child_versions: [
      {
        recipe_id: "789",
        name: "Modified Recipe A",
        version: 3,
      },
      {
        recipe_id: "101",
        name: "Modified Recipe B",
        version: 2,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe("Conditional rendering based on version", () => {
    it("renders nothing when version is 1 and no parentRecipeId", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId="123"
          version={1}
          parentRecipeId={null}
        />
      );

      expect(
        screen.queryByText("Recipe Version History")
      ).not.toBeInTheDocument();
    });

    it("renders nothing when version is undefined and no parentRecipeId", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId="123"
          version={undefined}
          parentRecipeId={null}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when version is null and no parentRecipeId", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId="123"
          version={null}
          parentRecipeId={null}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders when version is greater than 1", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      render(<RecipeVersionHistory {...defaultProps} version={2} />);

      expect(
        screen.getByText("Loading version history...")
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });
    });

    it("renders when parentRecipeId is provided even if version is 1", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      render(
        <RecipeVersionHistory recipeId="123" version={1} parentRecipeId="456" />
      );

      expect(
        screen.getByText("Loading version history...")
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading message initially", () => {
      ApiService.recipes.getVersionHistory.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<RecipeVersionHistory {...defaultProps} />);

      expect(
        screen.getByText("Loading version history...")
      ).toBeInTheDocument();
    });

    it("calls API with correct recipeId", () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledWith("123");
    });

    it("does not call API when version <= 1 and no parentRecipeId", () => {
      render(
        <RecipeVersionHistory
          recipeId="123"
          version={1}
          parentRecipeId={null}
        />
      );

      expect(ApiService.recipes.getVersionHistory).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("shows error message when API call fails", async () => {
      const errorMessage = "Network error";
      ApiService.recipes.getVersionHistory.mockRejectedValue(
        new Error(errorMessage)
      );

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load version history")
        ).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching version history:",
        expect.any(Error)
      );
    });

    it("handles API rejection gracefully", async () => {
      ApiService.recipes.getVersionHistory.mockRejectedValue({
        response: { status: 404, data: { message: "Not found" } },
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load version history")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Successful data rendering", () => {
    beforeEach(() => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });
    });

    it("renders version history title", async () => {
      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });
    });

    it("displays current version", async () => {
      render(<RecipeVersionHistory {...defaultProps} version={2} />);

      await waitFor(() => {
        expect(screen.getByText("Current Version:")).toBeInTheDocument();
        expect(screen.getByText("v2")).toBeInTheDocument();
      });
    });

    it("displays parent recipe when available", async () => {
      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Based on:")).toBeInTheDocument();
        expect(screen.getByText("Original Recipe")).toBeInTheDocument();
      });

      const parentLink = screen.getByText("Original Recipe");
      expect(parentLink.closest("a")).toHaveAttribute("href", "/recipes/456");
    });

    it("displays child versions when available", async () => {
      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Derived Recipes:")).toBeInTheDocument();
      });
      expect(screen.getByText("Modified Recipe A (v3)")).toBeInTheDocument();
      expect(screen.getByText("Modified Recipe B (v2)")).toBeInTheDocument();

      const childLinkA = screen.getByRole("link", {
        name: "Modified Recipe A (v3)",
      });
      const childLinkB = screen.getByRole("link", {
        name: "Modified Recipe B (v2)",
      });

      expect(childLinkA).toHaveAttribute("href", "/recipes/789");
      expect(childLinkB).toHaveAttribute("href", "/recipes/101");
    });
  });

  describe("Partial data scenarios", () => {
    it("handles missing parent recipe", async () => {
      const dataWithoutParent = {
        parent_recipe: null,
        child_versions: mockVersionHistoryData.child_versions,
      };

      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: dataWithoutParent,
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });

      expect(screen.queryByText("Based on:")).not.toBeInTheDocument();
      expect(screen.getByText("Derived Recipes:")).toBeInTheDocument();
    });

    it("handles missing child versions", async () => {
      const dataWithoutChildren = {
        parent_recipe: mockVersionHistoryData.parent_recipe,
        child_versions: [],
      };

      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: dataWithoutChildren,
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });

      expect(screen.getByText("Based on:")).toBeInTheDocument();
      expect(screen.queryByText("Derived Recipes:")).not.toBeInTheDocument();
    });

    it("handles null child versions", async () => {
      const dataWithNullChildren = {
        parent_recipe: mockVersionHistoryData.parent_recipe,
        child_versions: null,
      };

      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: dataWithNullChildren,
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });

      expect(screen.getByText("Based on:")).toBeInTheDocument();
      expect(screen.queryByText("Derived Recipes:")).not.toBeInTheDocument();
    });

    it("handles empty version history data", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: {
          parent_recipe: null,
          child_versions: [],
        },
      });

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
        expect(screen.getByText("Current Version:")).toBeInTheDocument();
        expect(screen.getByText("v2")).toBeInTheDocument();
      });

      expect(screen.queryByText("Based on:")).not.toBeInTheDocument();
      expect(screen.queryByText("Derived Recipes:")).not.toBeInTheDocument();
    });
  });

  describe("useEffect dependencies", () => {
    it("refetches data when recipeId changes", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      const { rerender } = render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledWith(
          "123"
        );
      });

      // Change recipeId
      rerender(<RecipeVersionHistory {...defaultProps} recipeId="999" />);

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledWith(
          "999"
        );
      });

      expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(2);
    });

    it("refetches data when version changes", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      const { rerender } = render(
        <RecipeVersionHistory {...defaultProps} version={2} />
      );

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(1);
      });

      // Change version
      rerender(<RecipeVersionHistory {...defaultProps} version={3} />);

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(2);
      });
    });

    it("refetches data when parentRecipeId changes", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      const { rerender } = render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(1);
      });

      // Change parentRecipeId
      rerender(<RecipeVersionHistory {...defaultProps} parentRecipeId="777" />);

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(2);
      });
    });

    it("does not refetch when unrelated props change", async () => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });

      const { rerender } = render(
        <RecipeVersionHistory {...defaultProps} className="test" />
      );

      await waitFor(() => {
        expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(1);
      });

      // Change unrelated prop
      rerender(<RecipeVersionHistory {...defaultProps} className="new-test" />);

      // Should not call API again
      expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe("CSS classes and structure", () => {
    beforeEach(() => {
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockVersionHistoryData,
      });
    });

    it("applies correct CSS classes", async () => {
      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Recipe Version History")).toBeInTheDocument();
      });
      expect(screen.getByText("Recipe Version History").className).toContain(
        "version-history-title"
      );
      expect(screen.getByText("Based on:").parentElement).toHaveClass(
        "parent-version"
      );
      expect(screen.getByText("Original Recipe").closest("a")).toHaveClass(
        "parent-link"
      );
      expect(screen.getByText("Current Version:").parentElement).toHaveClass(
        "current-version"
      );
      expect(screen.getByText("v2").className).toContain("version-badge");
      expect(screen.getByText("Derived Recipes:").parentElement).toHaveClass(
        "child-versions"
      );
      expect(
        screen.getByText("Modified Recipe A (v3)").parentElement.parentElement
      ).toHaveClass("derived-recipes-list");
    });

    it("applies loading state CSS class", () => {
      ApiService.recipes.getVersionHistory.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<RecipeVersionHistory {...defaultProps} />);

      expect(
        document.querySelector(".version-history-loading")
      ).toBeInTheDocument();
    });

    it("applies error state CSS class", async () => {
      ApiService.recipes.getVersionHistory.mockRejectedValue(
        new Error("Test error")
      );

      render(<RecipeVersionHistory {...defaultProps} />);

      await waitFor(() => {
        expect(
          document.querySelector(".version-history-error")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge cases", () => {
    it("handles missing recipeId gracefully", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId={null}
          version={2}
          parentRecipeId={null}
        />
      );

      expect(
        screen.queryByText("Recipe Version History")
      ).not.toBeInTheDocument();
      expect(ApiService.recipes.getVersionHistory).not.toHaveBeenCalled();
    });

    it("handles undefined recipeId gracefully", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId={undefined}
          version={2}
          parentRecipeId={null}
        />
      );

      expect(
        screen.queryByText("Recipe Version History")
      ).not.toBeInTheDocument();
      expect(ApiService.recipes.getVersionHistory).not.toHaveBeenCalled();
    });

    it("handles version 0 correctly", () => {
      const { container } = render(
        <RecipeVersionHistory
          recipeId="123"
          version={0}
          parentRecipeId={null}
        />
      );

      expect(container.firstChild).toBeNull();
      expect(ApiService.recipes.getVersionHistory).not.toHaveBeenCalled();
    });
  });
});
