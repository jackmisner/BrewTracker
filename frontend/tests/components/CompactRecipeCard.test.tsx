import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import CompactRecipeCard from "../../src/components/CompactRecipeCard";
import { Recipe } from "../../src/types";

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

const mockRecipe: Recipe = {
  recipe_id: "test-recipe-1",
  user_id: "test-user-1",
  username: "testuser",
  name: "Test IPA Recipe",
  style: "American IPA",
  batch_size: 5,
  batch_size_unit: "gal",
  description: "A hoppy test recipe",
  is_public: false,
  version: 1,
  boil_time: 60,
  efficiency: 75,
  notes: "Test notes",
  estimated_og: 1.055,
  estimated_fg: 1.012,
  estimated_abv: 5.6,
  estimated_ibu: 65,
  estimated_srm: 6,
  ingredients: [],
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
};

const mockRecipeMinimal: Recipe = {
  recipe_id: "test-recipe-2",
  name: "Minimal Recipe",
  batch_size: 5,
  batch_size_unit: "gal",
  is_public: false,
  ingredients: [],
};

describe("CompactRecipeCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe("Rendering", () => {
    it("renders recipe name and style", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("Test IPA Recipe")).toBeInTheDocument();
      expect(screen.getByText("American IPA")).toBeInTheDocument();
    });

    it("renders default style text when style is missing", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipeMinimal} />);
      
      expect(screen.getByText("Minimal Recipe")).toBeInTheDocument();
      expect(screen.getByText("No style specified")).toBeInTheDocument();
    });

    it("renders all metric labels", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("OG")).toBeInTheDocument();
      expect(screen.getByText("ABV")).toBeInTheDocument();
      expect(screen.getByText("IBU")).toBeInTheDocument();
      expect(screen.getByText("SRM")).toBeInTheDocument();
    });

    it("renders all action buttons", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Brew" })).toBeInTheDocument();
    });

    it("renders color swatch with SRM tooltip", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const colorSwatch = document.querySelector(".compact-color-swatch");
      expect(colorSwatch).toBeInTheDocument();
      expect(colorSwatch).toHaveAttribute("title", "SRM: 6");
    });
  });

  describe("Metric Formatting", () => {
    it("formats gravity values correctly", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("1.055")).toBeInTheDocument();
    });

    it("formats ABV values correctly", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("5.6%")).toBeInTheDocument();
    });

    it("formats IBU values correctly", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("65")).toBeInTheDocument();
    });

    it("formats SRM values correctly", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByText("6")).toBeInTheDocument();
    });

    it("handles missing metric values gracefully", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipeMinimal} />);
      
      expect(screen.getByText("1.000")).toBeInTheDocument(); // OG default
      expect(screen.getByText("0.0%")).toBeInTheDocument(); // ABV default
      expect(screen.getAllByText("0")).toHaveLength(2); // IBU and SRM both show 0
    });

    it("rounds decimal values appropriately", () => {
      const recipeWithDecimals: Recipe = {
        ...mockRecipe,
        estimated_og: 1.0547,
        estimated_abv: 5.67,
        estimated_ibu: 64.8,
        estimated_srm: 5.9,
      };
      
      renderWithRouter(<CompactRecipeCard recipe={recipeWithDecimals} />);
      
      expect(screen.getByText("1.055")).toBeInTheDocument(); // Gravity to 3 decimals
      expect(screen.getByText("5.7%")).toBeInTheDocument(); // ABV to 1 decimal
      expect(screen.getByText("65")).toBeInTheDocument(); // IBU rounded
      expect(screen.getByText("6")).toBeInTheDocument(); // SRM rounded
    });
  });

  describe("Navigation", () => {
    it("navigates to recipe view when View button is clicked", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const viewButton = screen.getByRole("button", { name: "View" });
      fireEvent.click(viewButton);
      
      expect(mockNavigate).toHaveBeenCalledWith("/recipes/test-recipe-1");
    });

    it("navigates to recipe edit when Edit button is clicked", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const editButton = screen.getByRole("button", { name: "Edit" });
      fireEvent.click(editButton);
      
      expect(mockNavigate).toHaveBeenCalledWith("/recipes/test-recipe-1/edit");
    });

    it("navigates to brew session creation when Brew button is clicked", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const brewButton = screen.getByRole("button", { name: "Brew" });
      fireEvent.click(brewButton);
      
      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/new?recipe=test-recipe-1");
    });
  });

  describe("CSS Classes", () => {
    it("applies correct CSS classes to main elements", () => {
      const { container } = renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(container.querySelector(".compact-recipe-card")).toBeInTheDocument();
      expect(container.querySelector(".compact-recipe-header")).toBeInTheDocument();
      expect(container.querySelector(".compact-recipe-info")).toBeInTheDocument();
      expect(container.querySelector(".compact-recipe-name")).toBeInTheDocument();
      expect(container.querySelector(".compact-recipe-style")).toBeInTheDocument();
      expect(container.querySelector(".compact-color-swatch")).toBeInTheDocument();
      expect(container.querySelector(".compact-recipe-metrics")).toBeInTheDocument();
      expect(container.querySelector(".compact-card-actions")).toBeInTheDocument();
    });

    it("applies correct CSS classes to metric elements", () => {
      const { container } = renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const metrics = container.querySelectorAll(".compact-metric");
      expect(metrics).toHaveLength(4);
      
      const metricValues = container.querySelectorAll(".compact-metric-value");
      expect(metricValues).toHaveLength(4);
      
      const metricLabels = container.querySelectorAll(".compact-metric-label");
      expect(metricLabels).toHaveLength(4);
    });

    it("applies correct CSS classes to action buttons", () => {
      const { container } = renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(container.querySelector(".compact-action-button.view")).toBeInTheDocument();
      expect(container.querySelector(".compact-action-button.edit")).toBeInTheDocument();
      expect(container.querySelector(".compact-action-button.brew")).toBeInTheDocument();
    });
  });

  describe("SRM Color Mapping", () => {
    it("uses light color for low SRM values", () => {
      const lightRecipe: Recipe = {
        ...mockRecipe,
        estimated_srm: 2,
      };
      
      const { container } = renderWithRouter(<CompactRecipeCard recipe={lightRecipe} />);
      const colorSwatch = container.querySelector(".compact-color-swatch");
      
      expect(colorSwatch).toHaveStyle("background-color: rgb(245, 242, 199)"); // Light color
    });

    it("uses dark color for high SRM values", () => {
      const darkRecipe: Recipe = {
        ...mockRecipe,
        estimated_srm: 25,
      };
      
      const { container } = renderWithRouter(<CompactRecipeCard recipe={darkRecipe} />);
      const colorSwatch = container.querySelector(".compact-color-swatch");
      
      expect(colorSwatch).toHaveStyle("background-color: rgb(139, 69, 19)"); // Dark brown
    });

    it("uses default color for missing SRM values", () => {
      const { container } = renderWithRouter(<CompactRecipeCard recipe={mockRecipeMinimal} />);
      const colorSwatch = container.querySelector(".compact-color-swatch");
      
      expect(colorSwatch).toHaveStyle("background-color: rgb(246, 243, 210)"); // Default light
    });
  });

  describe("Edge Cases", () => {
    it("handles extremely long recipe names gracefully", () => {
      const longNameRecipe: Recipe = {
        ...mockRecipe,
        name: "This is an extremely long recipe name that should wrap properly without breaking the layout design",
      };
      
      renderWithRouter(<CompactRecipeCard recipe={longNameRecipe} />);
      
      expect(screen.getByText(/This is an extremely long recipe name/)).toBeInTheDocument();
    });

    it("handles recipes with zero values", () => {
      const zeroRecipe: Recipe = {
        ...mockRecipe,
        estimated_og: 0,
        estimated_fg: 0,
        estimated_abv: 0,
        estimated_ibu: 0,
        estimated_srm: 0,
      };
      
      renderWithRouter(<CompactRecipeCard recipe={zeroRecipe} />);
      
      expect(screen.getByText("1.000")).toBeInTheDocument(); // OG formatted as 1.000
      expect(screen.getByText("0.0%")).toBeInTheDocument(); // ABV
      expect(screen.getAllByText("0")).toHaveLength(2); // IBU and SRM both show 0
    });

    it("handles recipes with undefined values", () => {
      const undefinedRecipe: Recipe = {
        ...mockRecipe,
        estimated_og: undefined,
        estimated_fg: undefined,
        estimated_abv: undefined,
        estimated_ibu: undefined,
        estimated_srm: undefined,
        style: undefined,
      };
      
      renderWithRouter(<CompactRecipeCard recipe={undefinedRecipe} />);
      
      expect(screen.getByText("No style specified")).toBeInTheDocument();
      expect(screen.getByText("1.000")).toBeInTheDocument();
      expect(screen.getByText("0.0%")).toBeInTheDocument();
      expect(screen.getAllByText("0")).toHaveLength(2); // IBU and SRM both show 0
    });
  });

  describe("Accessibility", () => {
    it("has accessible button labels", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Brew" })).toBeInTheDocument();
    });

    it("has meaningful tooltip for color swatch", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      const colorSwatch = document.querySelector(".compact-color-swatch");
      expect(colorSwatch).toHaveAttribute("title", "SRM: 6");
    });

    it("uses semantic HTML structure", () => {
      renderWithRouter(<CompactRecipeCard recipe={mockRecipe} />);
      
      // Recipe name should be in a heading
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Test IPA Recipe");
    });
  });
});