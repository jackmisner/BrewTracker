// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
const renderWithUnitProvider = (component: any) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("IngredientsList", () => {
  const mockOnRemove = jest.fn();
  const mockOnUpdate = jest.fn();

  const sampleIngredients = [
    {
      id: 1,
      ingredient_id: "grain-1",
      type: "grain",
      grain_type: "base_malt",
      name: "Pale Malt",
      amount: 10,
      unit: "lb",
      use: "mash",
      time: 60,
      time_unit: "min",
      color: 2.5,
    },
    {
      id: 2,
      ingredient_id: "hop-1",
      type: "hop",
      name: "Cascade",
      amount: 1,
      unit: "oz",
      use: "boil",
      time: 15,
      time_unit: "min",
      alpha_acid: 5.5,
      origin: "USA",
    },
    {
      id: 3,
      ingredient_id: "grain-2",
      type: "grain",
      grain_type: "caramel_crystal",
      name: "Crystal 40L",
      amount: 2,
      unit: "lb",
      use: "mash",
      time: null,
      time_unit: null,
    },
    {
      id: 4,
      ingredient_id: "yeast-1",
      type: "yeast",
      name: "Safale US-05",
      amount: 1,
      unit: "packet",
      manufacturer: "Fermentis",
      attenuation: 81,
    },
    {
      id: 5,
      ingredient_id: "other-1",
      type: "other",
      name: "Irish Moss",
      amount: 1,
      unit: "tsp",
      use: "boil",
      time: 15,
      time_unit: "min",
    },
  ];

  beforeEach(() => {
    mockOnRemove.mockClear();
    mockOnUpdate.mockClear();
    (Services.ingredient.sortIngredients as jest.Mock).mockClear();
    (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(sampleIngredients);
  });

  describe("Empty state", () => {
    it("renders empty state when no ingredients provided", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={[]}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("Recipe Ingredients")).toBeInTheDocument();
      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });

    it("renders empty state when ingredients is null", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={null as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("No ingredients added yet.")).toBeInTheDocument();
    });

    it("renders empty state when ingredients is undefined", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={undefined as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getAllByText("Mash")).toHaveLength(2);
      expect(screen.getAllByText("Boil")).toHaveLength(2);
    });

    it("displays time information correctly", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("60 min")).toBeInTheDocument();
      expect(screen.getAllByText("15 min")).toHaveLength(2);
      // Check for dashes in time columns specifically - should be 3 total (Crystal grain, yeast, and one other)
      expect(screen.getAllByText("-")).toHaveLength(3);
    });

    it("shows dash for missing use field", () => {
      const ingredientWithoutUse = [{ ...sampleIngredients[0], use: null, ingredient_id: "grain-1" }];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(ingredientWithoutUse);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={ingredientWithoutUse as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("-")).toBeInTheDocument();
    });
  });

  describe("Grain type mapping", () => {
    it("maps grain types correctly in ingredient name section", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredient_id: "grain-1",
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(
        unknownGrainIngredient
      );

      renderWithUnitProvider(
        <IngredientsList
          ingredients={unknownGrainIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredient_id: "grain-1",
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(nullGrainIngredient);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={nullGrainIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });

    it("maps all grain types correctly", () => {
      const allGrainTypes = [
        { ...sampleIngredients[0], grain_type: "specialty_malt", ingredient_id: "grain-1" },
        { ...sampleIngredients[0], grain_type: "adjunct_grain", id: 2, ingredient_id: "grain-2" },
        { ...sampleIngredients[0], grain_type: "roasted", id: 3, ingredient_id: "grain-3" },
        { ...sampleIngredients[0], grain_type: "smoked", id: 4, ingredient_id: "grain-4" },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(allGrainTypes);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={allGrainTypes as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("Specialty Malt")).toBeInTheDocument();
      expect(screen.getByText("Adjunct")).toBeInTheDocument();
      expect(screen.getByText("Roasted")).toBeInTheDocument();
      expect(screen.getByText("Smoked")).toBeInTheDocument();
    });
  });

  describe("Editing mode", () => {
    it("shows additional columns when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      expect(screen.getAllByText("grain")).toHaveLength(2);
      expect(screen.getByText("hop")).toBeInTheDocument();
      expect(screen.getByText("yeast")).toBeInTheDocument();
      expect(screen.getByText("other")).toBeInTheDocument();
    });

    it("shows remove buttons when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const removeButtons = screen.getAllByText("Remove");
      expect(removeButtons).toHaveLength(5);
    });

    it("calls onRemove when remove button is clicked", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.queryByText("Type")).not.toBeInTheDocument();
      expect(screen.queryByText("Actions")).not.toBeInTheDocument();
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });

    it("shows editing help text when editing", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      expect(screen.getByText(/Editable fields:/)).toBeInTheDocument();
      expect(
        screen.getByText(/Press Enter to save, Escape to cancel/)
      ).toBeInTheDocument();
    });
  });

  describe("Inline editing functionality", () => {
    beforeEach(() => {
      // Ensure clean state for each test
      jest.clearAllMocks();
    });

    it("starts editing when clicking on editable amount field", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    });

    it("does not start editing when not in editing mode", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      const amountText = screen.getByText("10 lb");
      fireEvent.click(amountText);

      expect(screen.queryByDisplayValue("10")).not.toBeInTheDocument();
    });

    it("cancels editing when pressing Escape", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByDisplayValue("15")).not.toBeInTheDocument();
      });
      expect(screen.getByText("10 lb")).toBeInTheDocument();
    });

    it("saves editing when pressing Enter with valid value", async () => {
      mockOnUpdate.mockResolvedValue({});

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            amount: 15,
          })
        );
      });
    });

    it("saves editing when input loses focus", async () => {
      mockOnUpdate.mockResolvedValue({});

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "12" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            amount: 12,
          })
        );
      });
    });

    it("shows validation error for invalid amount", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "-5" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(
          screen.getByText("Amount must be greater than 0")
        ).toBeInTheDocument();
      });
    });

    it("handles editing time field", async () => {
      mockOnUpdate.mockResolvedValue({});

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      // Find a hop row with editable time
      const hopRows = screen.getAllByText("hop");
      const hopRow = hopRows[0].closest("tr");
      const timeCell = hopRow!.querySelector(".ingredient-time .editable-cell");

      fireEvent.click(timeCell!);

      const input = screen.getByDisplayValue("15");
      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          2,
          expect.objectContaining({
            time: 30,
          })
        );
      });
    });
  });

  describe("Field validation", () => {
    it("validates excessive hop amounts in ounces", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const hopAmountCell = screen
        .getByText("1 oz")
        .closest(".ingredient-amount");
      const editableSpan = hopAmountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("1");
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(
          screen.getByText("More than 10 oz seems high for hops")
        ).toBeInTheDocument();
      });
    });

    it("validates excessive hop boil time", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const hopRows = screen.getAllByText("hop");
      const hopRow = hopRows[0].closest("tr");
      const timeCell = hopRow!.querySelector(".ingredient-time .editable-cell");

      fireEvent.click(timeCell!);

      const input = screen.getByDisplayValue("15");
      fireEvent.change(input, { target: { value: "150" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(
          screen.getByText("Boil time over 120 minutes is unusual")
        ).toBeInTheDocument();
      });
    });

    it("validates grain color field", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      // Find the first grain row and its color field in the details column
      const grainRows = screen.getAllByText("grain");
      const grainRow = grainRows[0].closest("tr");
      const detailsCell = grainRow!.querySelector(".ingredient-details");
      const colorContainer = Array.from(
        detailsCell!.querySelectorAll(".detail-item")
      ).find((item) => item.textContent!.includes("Color:"));

      expect(colorContainer).toBeInTheDocument();

      const editableSpan = colorContainer!.querySelector(".editable-cell");
      expect(editableSpan).toBeInTheDocument();

      fireEvent.click(editableSpan!);

      // Find the input that should appear
      const input = colorContainer!.querySelector("input");
      expect(input).toBeInTheDocument();

      fireEvent.change(input!, { target: { value: "700" } });
      fireEvent.keyDown(input!, { key: "Enter" });

      await waitFor(() => {
        expect(
          screen.getByText("Color over 600°L seems unusually high")
        ).toBeInTheDocument();
      });
    });

    describe("Dropdown functionality", () => {
      it("shows correct options in hop use dropdown", async () => {
        renderWithUnitProvider(
          <IngredientsList
            ingredients={sampleIngredients as any}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            isEditing={true}
          />
        );

        const hopRows = screen.getAllByText("hop");
        const hopRow = hopRows[0].closest("tr");
        const useCell = hopRow!.querySelector(".ingredient-use .editable-cell");

        fireEvent.click(useCell!);

        // Check that the select element exists and has the correct options
        const select = hopRow!.querySelector("select");
        expect(select).toBeInTheDocument();

        const options = Array.from(select!.querySelectorAll("option")).map(
          (option) => option.value
        );
        expect(options).toEqual(["boil", "whirlpool", "dry-hop"]);

        // Verify option text content within the select element specifically
        const optionTexts = Array.from(select!.querySelectorAll("option")).map(
          (option) => option.textContent
        );
        expect(optionTexts).toEqual(["Boil", "Whirlpool", "Dry hop"]);
      });

      it("shows correct options for other ingredient use dropdown", async () => {
        renderWithUnitProvider(
          <IngredientsList
            ingredients={sampleIngredients as any}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            isEditing={true}
          />
        );

        const otherRows = screen.getAllByText("other");
        const otherRow = otherRows[0].closest("tr");
        const useCell = otherRow!.querySelector(
          ".ingredient-use .editable-cell"
        );

        fireEvent.click(useCell!);

        const select = otherRow!.querySelector("select");
        expect(select).toBeInTheDocument();

        const options = Array.from(select!.querySelectorAll("option")).map(
          (option) => option.value
        );
        expect(options).toEqual([
          "boil",
          "whirlpool",
          "fermentation",
          "secondary",
          "packaging",
          "mash",
        ]);
      });
    });

    it("handles zero time values correctly", async () => {
      mockOnUpdate.mockResolvedValue({});

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const hopRows = screen.getAllByText("hop");
      const hopRow = hopRows[0].closest("tr");
      const timeCell = hopRow!.querySelector(".ingredient-time .editable-cell");

      fireEvent.click(timeCell!);

      const input = screen.getByDisplayValue("15");
      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          2,
          expect.objectContaining({
            time: 0,
          })
        );
      });
    });
  });

  describe("Field editability", () => {
    it("allows editing amount for all ingredient types", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      // All amount fields should be editable
      const amountCells = screen
        .getAllByText(/lb|oz|packet|tsp/)
        .map((el) =>
          el.closest(".ingredient-amount")?.querySelector(".editable-cell")
        )
        .filter(Boolean);

      expect(amountCells.length).toBeGreaterThan(0);
    });

    it("does not allow editing grain use field", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      // Find grain rows - they should have non-editable use fields
      const grainRows = screen.getAllByText("grain");
      const grainRow = grainRows[0].closest("tr");
      const useCell = grainRow!.querySelector(
        ".ingredient-use .non-editable-cell"
      );

      expect(useCell).toBeInTheDocument();
    });

    it("does not allow editing yeast time field", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const yeastRow = screen.getByText("yeast").closest("tr");
      const timeCell = yeastRow!.querySelector(
        ".ingredient-time .non-editable-cell"
      );

      expect(timeCell).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("handles onUpdate failure gracefully", async () => {
      mockOnUpdate.mockRejectedValue(new Error("Update failed"));

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(
          screen.getByText("Failed to update ingredient")
        ).toBeInTheDocument();
      });
    });

    it("handles onUpdate being called on non-existent ingredient", async () => {
      // Mock onUpdate to simulate trying to update an ingredient that doesn't exist
      mockOnUpdate.mockImplementation((ingredientId) => {
        if (ingredientId === 999) {
          // Simulate ingredient not found scenario
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      const input = screen.getByDisplayValue("10");
      fireEvent.change(input, { target: { value: "15" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            amount: 15,
          })
        );
      });

      // The editing should complete successfully even if the backend doesn't find the ingredient
      await waitFor(() => {
        expect(screen.queryByDisplayValue("15")).not.toBeInTheDocument();
      });
    });
  });

  describe("Table structure", () => {
    it("generates correct row IDs", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(document.getElementById("ingredient-row-1")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-2")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-3")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-4")).toBeInTheDocument();
      expect(document.getElementById("ingredient-row-5")).toBeInTheDocument();
    });

    it("applies correct CSS classes", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
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

    it("applies ingredient type specific CSS classes", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      const rows = screen.getAllByRole("row");
      const dataRows = rows.slice(1); // Skip header row

      expect(dataRows[0]).toHaveClass("grain-row");
      expect(dataRows[0]).toHaveClass("base-malt-row");
      expect(dataRows[1]).toHaveClass("hop-row");
      expect(dataRows[2]).toHaveClass("grain-row");
      expect(dataRows[3]).toHaveClass("yeast-row");
      expect(dataRows[4]).toHaveClass("other-row");
    });

    it("applies dry hop specific class", () => {
      const dryHopIngredient = [
        {
          ...sampleIngredients[1],
          use: "dry-hop",
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(dryHopIngredient);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={dryHopIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      const rows = screen.getAllByRole("row");
      const dataRow = rows[1]; // Skip header row
      expect(dataRow).toHaveClass("dry-hop-row");
    });
  });

  describe("useMemo optimization", () => {
    it("memoizes sorted ingredients correctly", () => {
      const { rerender } = renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with same ingredients
      rerender(
        <UnitProvider>
          <IngredientsList
            ingredients={sampleIngredients as any}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            isEditing={false}
          />
        </UnitProvider>
      );

      // Should not call sortIngredients again due to memoization
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(1);

      // Rerender with different ingredients
      const newIngredients = [
        ...sampleIngredients,
        { id: 6, ingredient_id: "yeast-2", name: "New Ingredient", type: "yeast" },
      ];
      rerender(
        <UnitProvider>
          <IngredientsList
            ingredients={newIngredients as any}
            onRemove={mockOnRemove}
            onUpdate={mockOnUpdate}
            isEditing={false}
          />
        </UnitProvider>
      );

      // Should call sortIngredients again
      expect(Services.ingredient.sortIngredients).toHaveBeenCalledTimes(2);
    });
  });

  describe("Enhanced ingredient display", () => {
    it("shows hop origin information", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("USA")).toBeInTheDocument();
    });

    it("shows yeast manufacturer information", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("Fermentis")).toBeInTheDocument();
    });

    it("shows yeast attenuation in editing mode", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      expect(screen.getByText("81%")).toBeInTheDocument();
    });

    it("shows ingredient details for hops in editing mode", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      expect(screen.getByText("5.5%")).toBeInTheDocument();
    });

    it("shows ingredient details for grains in editing mode", () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      expect(screen.getByText("2.5°L")).toBeInTheDocument();
    });
  });

  describe("Format functions", () => {
    it("formats time with zero value as dash", () => {
      const zeroTimeIngredient = [
        {
          ...sampleIngredients[0],
          time: 0,
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(zeroTimeIngredient);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={zeroTimeIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("formats usage with proper capitalization", () => {
      const specialUsageIngredients = [
        { ...sampleIngredients[1], use: "dry-hop", id: "10" },
        { ...sampleIngredients[1], use: "whirlpool", id: "11" },
        { ...sampleIngredients[4], use: "fermentation", id: "12" },
        { ...sampleIngredients[4], use: "secondary", id: "13" },
        { ...sampleIngredients[4], use: "packaging", id: "14" },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(
        specialUsageIngredients
      );

      renderWithUnitProvider(
        <IngredientsList
          ingredients={specialUsageIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("Dry Hop")).toBeInTheDocument();
      expect(screen.getByText("Whirlpool")).toBeInTheDocument();
      expect(screen.getByText("Fermentation")).toBeInTheDocument();
      expect(screen.getByText("Secondary")).toBeInTheDocument();
      expect(screen.getByText("Packaging")).toBeInTheDocument();
    });

    it("handles invalid amounts gracefully", () => {
      const invalidAmountIngredient = [
        {
          ...sampleIngredients[0],
          amount: "invalid",
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(
        invalidAmountIngredient
      );

      renderWithUnitProvider(
        <IngredientsList
          ingredients={invalidAmountIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("0 lb")).toBeInTheDocument();
    });

    it("handles singular time units correctly", () => {
      const oneMinuteIngredient = [
        {
          ...sampleIngredients[1],
          time: 1,
          time_unit: "minutes",
        },
      ];
      (Services.ingredient.sortIngredients as jest.Mock).mockReturnValue(oneMinuteIngredient);

      renderWithUnitProvider(
        <IngredientsList
          ingredients={oneMinuteIngredient as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={false}
        />
      );

      expect(screen.getByText("1 min")).toBeInTheDocument();
    });
  });

  describe("Focus management", () => {
    it("focuses input when editing starts", async () => {
      renderWithUnitProvider(
        <IngredientsList
          ingredients={sampleIngredients as any}
          onRemove={mockOnRemove}
          onUpdate={mockOnUpdate}
          isEditing={true}
        />
      );

      const amountCell = screen
        .getByText("10 lb")
        .closest(".ingredient-amount");
      const editableSpan = amountCell!.querySelector(".editable-cell");
      fireEvent.click(editableSpan!);

      await waitFor(() => {
        const input = screen.getByDisplayValue("10");
        expect(input).toHaveFocus();
      });
    });
  });
});
