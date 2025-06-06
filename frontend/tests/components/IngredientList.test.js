import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import IngredientsList from "../../src/components/RecipeBuilder/IngredientsList";
import { Services } from "../../src/services/index";

// Mock the Services module
jest.mock("../../src/services/index", () => ({
  Services: {
    ingredient: {
      sortIngredients: jest.fn(),
    },
  },
}));

describe("IngredientsList", () => {
  const mockOnRemove = jest.fn();

  const sampleIngredients = [
    {
      id: 1,
      type: "grain",
      grain_type: "base_malt",
      name: "Pale Malt",
      amount: 10,
      unit: "lbs",
      use: "Mash",
      time: 60,
      time_unit: "min",
    },
    {
      id: 2,
      type: "hops",
      name: "Cascade",
      amount: 1,
      unit: "oz",
      use: "Boil",
      time: 15,
      time_unit: "min",
    },
    {
      id: 3,
      type: "grain",
      grain_type: "caramel_crystal",
      name: "Crystal 40L",
      amount: 2,
      unit: "lbs",
      use: "Mash",
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
      render(
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
      render(
        <IngredientsList
          ingredients={null}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });

    it("renders empty state when ingredients is undefined", () => {
      render(
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
      render(
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
      render(
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
      render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("10 lbs")).toBeInTheDocument();
      expect(screen.getByText("1 oz")).toBeInTheDocument();
      expect(screen.getByText("2 lbs")).toBeInTheDocument();
    });

    it("displays use information correctly", () => {
      render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getAllByText("Mash")).toHaveLength(2);
      expect(screen.getByText("Boil")).toBeInTheDocument();
    });

    it("displays time information correctly", () => {
      render(
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

      render(
        <IngredientsList
          ingredients={ingredientWithoutUse}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("-")).toBeInTheDocument();
    });
  });

  describe("Grain type mapping", () => {
    it("maps grain types correctly", () => {
      render(
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

      render(
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

      render(
        <IngredientsList
          ingredients={nullGrainIngredient}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("shows empty string for non-grain ingredients", () => {
      const hopsIngredient = [sampleIngredients[1]]; // Cascade hops
      Services.ingredient.sortIngredients.mockReturnValue(hopsIngredient);

      render(
        <IngredientsList
          ingredients={hopsIngredient}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // The grain type column should be empty for non-grain ingredients
      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      const grainTypeCell = dataRow.cells[0];
      expect(grainTypeCell).toHaveTextContent("");
    });
  });

  describe("Editing mode", () => {
    it("shows additional columns when editing", () => {
      render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getByText("Ingredient Type")).toBeInTheDocument();
      expect(screen.getByText("Grain Type")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("shows ingredient types when editing", () => {
      render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={true}
        />
      );

      expect(screen.getAllByText("grain")).toHaveLength(2);
      expect(screen.getByText("hops")).toBeInTheDocument();
    });

    it("shows remove buttons when editing", () => {
      render(
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
      render(
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
      render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(screen.queryByText("Ingredient Type")).not.toBeInTheDocument();
      expect(screen.queryByText("Actions")).not.toBeInTheDocument();
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });
  });

  describe("Table structure", () => {
    it("generates correct row IDs", () => {
      render(
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
      render(
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

  describe("useMemo optimization", () => {
    it("memoizes sorted ingredients correctly", () => {
      const { rerender } = render(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with same ingredients
      rerender(
        <IngredientsList
          ingredients={sampleIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // Should not call sortIngredients again due to memoization
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with different ingredients
      const newIngredients = [
        ...sampleIngredients,
        { id: 4, name: "New Ingredient", type: "yeast" },
      ];
      rerender(
        <IngredientsList
          ingredients={newIngredients}
          onRemove={mockOnRemove}
          isEditing={false}
        />
      );

      // Should call sortIngredients again
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(2);
    });
  });
});
