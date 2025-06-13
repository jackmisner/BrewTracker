import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import IngredientsList from "../../src/components/RecipeBuilder/IngredientsList";
import { Services } from "../../src/services/index";
import { UnitProvider } from "../../src/contexts/UnitContext";

// Mock the Services module
jest.mock("../../src/services/index", () => ({
  Services: {
    ingredient: {
      sortIngredients: jest.fn(),
    },
  },
}));

// Mock the UserSettingsService that UnitContext depends on
jest.mock("../../src/services/UserSettingsService", () => ({
  getUserSettings: jest.fn().mockResolvedValue({
    settings: {
      preferred_units: "imperial",
    },
  }),
  updateSettings: jest.fn().mockResolvedValue({}),
}));

// Suppress console errors and warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Helper function to render with UnitProvider
const renderWithUnitProvider = (component) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("IngredientsList", () => {
  const mockOnRemove = jest.fn();

  const sampleIngredients = [
    {
      id: 1,
      type: "grain",
      grain_type: "base_malt",
      name: "Pale Malt",
      amount: 10,
      unit: "lb",
      use: "mash",
      time: 60,
      time_unit: "min",
    },
    {
      id: 2,
      type: "hop", // Changed from "hops" to "hop" to match expected format
      name: "Cascade",
      amount: 1,
      unit: "oz",
      use: "boil",
      time: 15,
      time_unit: "min",
    },
    {
      id: 3,
      type: "grain",
      grain_type: "caramel_crystal",
      name: "Crystal 40L",
      amount: 2,
      unit: "lb",
      use: "mash",
      time: null,
      time_unit: null,
    },
  ];

  beforeEach(() => {
    mockOnRemove.mockClear();
    Services.ingredient.sortIngredients.mockClear();
    Services.ingredient.sortIngredients.mockReturnValue(sampleIngredients);
  });

  describe("Empty state", () => {
    it("renders empty state when no ingredients provided", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={[]}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("Recipe Ingredients")).toBeInTheDocument();
      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });

    it("renders empty state when ingredients is null", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={null}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });

    it("renders empty state when ingredients is undefined", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={undefined}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });
  });

  describe("Ingredients display", () => {
    it("renders ingredients table with data", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("Recipe Ingredients")).toBeInTheDocument();
      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      expect(screen.getByText("Cascade")).toBeInTheDocument();
      expect(screen.getByText("Crystal 40L")).toBeInTheDocument();
    });

    it("calls Services.ingredient.sortIngredients with ingredients", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(Services.ingredient.sortIngredients).toHaveBeenCalledWith(
        sampleIngredients
      );
    });

    it("displays ingredient amounts and units correctly", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("10 lb")).toBeInTheDocument();
      expect(screen.getByText("1 oz")).toBeInTheDocument();
      expect(screen.getByText("2 lb")).toBeInTheDocument();
    });

    it("displays use information correctly", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // "Mash" appears in table rows (2 times) AND in process summary (1 time) = 3 total
      expect(screen.getAllByText("Mash")).toHaveLength(3);
      // "Boil" appears in table row (1 time) AND in process summary (1 time) = 2 total
      expect(screen.getAllByText("Boil")).toHaveLength(2);
    });

    it("displays time information correctly", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("60 min")).toBeInTheDocument();
      expect(screen.getByText("15 min")).toBeInTheDocument();
      expect(screen.getAllByText("-")).toHaveLength(1); // For Crystal 40L with no time
    });

    it("shows dash for missing use field", () => {
      const ingredientWithoutUse = [{ ...sampleIngredients[0], use: null }];
      Services.ingredient.sortIngredients.mockReturnValue(ingredientWithoutUse);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={ingredientWithoutUse}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("displays unit system badge", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("🇺🇸 Imperial")).toBeInTheDocument();
    });

    it("displays ingredient count", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("(3)")).toBeInTheDocument();
    });
  });

  describe("Grain type mapping", () => {
    it("maps grain types correctly in ingredient name section", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("Base Malt")).toBeInTheDocument();
      expect(screen.getByText("Caramel/Crystal")).toBeInTheDocument();
    });

    it("handles unknown grain type", () => {
      const unknownGrainIngredient = [
        {
          ...sampleIngredients[0],
          grain_type: "unknown_type",
        },
      ];
      Services.ingredient.sortIngredients.mockReturnValue(
        unknownGrainIngredient
      );

      renderWithUnitProvider(
        <IngredientsList
          ingredients={unknownGrainIngredient}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("Unknown_type")).toBeInTheDocument();
    });

    it("handles null grain type", () => {
      const nullGrainIngredient = [
        {
          ...sampleIngredients[0],
          grain_type: null,
        },
      ];
      Services.ingredient.sortIngredients.mockReturnValue(nullGrainIngredient);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={nullGrainIngredient}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // When grain_type is null, no subtype div is rendered, so we just check the ingredient name is there
      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      // No "Unknown" text should be displayed
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });
  });

  describe("Editing mode", () => {
    it("shows additional columns when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getByText("Type")).toBeInTheDocument();
      expect(screen.getByText("Details")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("shows ingredient types when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getAllByText("grain")).toHaveLength(2);
      expect(screen.getByText("hop")).toBeInTheDocument();
    });

    it("shows remove buttons when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      const removeButtons = screen.getAllByText("Remove");
      expect(removeButtons).toHaveLength(3);
    });

    it("calls onRemove when remove button is clicked", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      const removeButtons = screen.getAllByText("Remove");
      fireEvent.click(removeButtons[0]);

      expect(mockOnRemove).toHaveBeenCalledWith(1);
    });

    it("hides additional columns when not editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.queryByText("Type")).not.toBeInTheDocument();
      expect(screen.queryByText("Actions")).not.toBeInTheDocument();
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });
  });

  describe("Table structure", () => {
    it("generates correct row IDs", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(document.getElementById("ingredient-row-1")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-2")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-3")).toBeInTheDocument();
    });

    it("applies correct CSS classes", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      const table = screen.getByRole("table");
      expect(table).toHaveClass("ingredients-table");

      const rows = screen.getAllByRole("row");
      const dataRows = rows.slice(1); // Skip header row
      dataRows.forEach((row) => {
        expect(row).toHaveClass("ingredient-row");
      });
    });
  });

  describe("Summary section", () => {
    it("displays ingredient summary statistics", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // Check for summary stats
      expect(screen.getByText("Grains:")).toBeInTheDocument();
      expect(screen.getByText("Hops:")).toBeInTheDocument();
      expect(screen.getByText("Yeast:")).toBeInTheDocument();
      expect(screen.getByText("Other:")).toBeInTheDocument();
    });

    it("displays brewing process steps", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // Look specifically in the process summary section for process steps
      const processSummary = document.querySelector(".process-summary");
      expect(processSummary).toBeInTheDocument();

      // Check for process steps within the process summary
      const mashStep = processSummary.querySelector(".process-step");
      expect(mashStep).toHaveTextContent("Mash");

      // Check that both Mash and Boil process steps exist
      const processSteps = processSummary.querySelectorAll(".process-step");
      const stepTexts = Array.from(processSteps).map(
        (step) => step.textContent
      );
      expect(stepTexts).toContain("Mash");
      expect(stepTexts).toContain("Boil");
    });
  });

  describe("useMemo optimization", () => {
    it("memoizes sorted ingredients correctly", () => {
      const { rerender } = renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with same ingredients
      rerender(
        <UnitProvider>
          <IngredientsList
            ingredients={sampleIngredients}
            onRemove={mockOnRemove}
            isEditing={false}
          />
        </UnitProvider>
      );

      // Should not call sortIngredients again due to memoization
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with different ingredients
      const newIngredients = [
        ...sampleIngredients,
        { id: 4, name: "New Ingredient", type: "yeast" },
      ];
      rerender(
        <UnitProvider>
          <IngredientsList
            ingredients={newIngredients}
            onRemove={mockOnRemove}
            isEditing={false}
          />
        </UnitProvider>
      );

      // Should call sortIngredients again
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(2);
    });
  });

  describe("Enhanced ingredient display", () => {
    it("shows ingredient details for hops", () => {
      const hopWithAlphaAcid = [
        {
          id: 2,
          type: "hop",
          name: "Cascade",
          amount: 1,
          unit: "oz",
          use: "boil",
          time: 15,
          time_unit: "min",
          alpha_acid: 5.5,
        },
      ];

      Services.ingredient.sortIngredients.mockReturnValue(hopWithAlphaAcid);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={hopWithAlphaAcid}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getByText("5.5%")).toBeInTheDocument();
    });

    it("shows ingredient details for grains", () => {
      const grainWithColor = [
        {
          id: 1,
          type: "grain",
          grain_type: "base_malt",
          name: "Pale Malt",
          amount: 10,
          unit: "lb",
          use: "mash",
          color: 2.5,
        },
      ];

      Services.ingredient.sortIngredients.mockReturnValue(grainWithColor);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={grainWithColor}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getByText("2.5°L")).toBeInTheDocument();
    });

    it("applies ingredient type specific CSS classes", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      const rows = screen.getAllByRole("row");
      const dataRows = rows.slice(1); // Skip header row

      // Check that rows have appropriate classes
      expect(dataRows[0]).toHaveClass("grain-row");
      expect(dataRows[1]).toHaveClass("hop-row");
      expect(dataRows[2]).toHaveClass("grain-row");
    });
  });
});
