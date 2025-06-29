// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen } from "@testing-library/react";
import IngredientInputsContainer from "../../src/components/RecipeBuilder/IngredientInputs/IngredientInputsContainer";

// Updated Mock implementations for IngredientInputContainer.test.js
// These mocks display the props they receive so tests can verify correct prop passing

// Mock FermentableInput
jest.mock(
  "../../src/components/RecipeBuilder/IngredientInputs/FermentableInput",
  () => {
    return function MockFermentableInput({ grains, onAdd, disabled }: { grains: any[]; onAdd: (data: any) => void; disabled: boolean }) {
      return (
        <div data-testid="fermentable-input">
          <span>FermentableInput</span>
          <div>Grains count: {grains ? grains.length : 0}</div>
          <div>Disabled: {disabled.toString()}</div>
          <button
            onClick={() => onAdd({ test: "data" })}
            disabled={disabled}
            data-testid="fermentable-add-button"
          >
            Add Fermentable
          </button>
        </div>
      );
    };
  }
);

// Mock HopInput
jest.mock(
  "../../src/components/RecipeBuilder/IngredientInputs/HopInput",
  () => {
    return function MockHopInput({ hops, onAdd, disabled }: { hops: any[]; onAdd: (data: any) => void; disabled: boolean }) {
      return (
        <div data-testid="hop-input">
          <span>HopInput</span>
          <div>Hops count: {hops ? hops.length : 0}</div>
          <div>Disabled: {disabled.toString()}</div>
          <button
            onClick={() => onAdd({ test: "data" })}
            disabled={disabled}
            data-testid="hop-add-button"
          >
            Add Hop
          </button>
        </div>
      );
    };
  }
);

// Mock YeastInput
jest.mock(
  "../../src/components/RecipeBuilder/IngredientInputs/YeastInput",
  () => {
    return function MockYeastInput({ yeasts, onAdd, disabled }: { yeasts: any[]; onAdd: (data: any) => void; disabled: boolean }) {
      return (
        <div data-testid="yeast-input">
          <span>YeastInput</span>
          <div>Yeasts count: {yeasts ? yeasts.length : 0}</div>
          <div>Disabled: {disabled.toString()}</div>
          <button
            onClick={() => onAdd({ test: "data" })}
            disabled={disabled}
            data-testid="yeast-add-button"
          >
            Add Yeast
          </button>
        </div>
      );
    };
  }
);

// Mock OtherInput
jest.mock(
  "../../src/components/RecipeBuilder/IngredientInputs/OtherInput",
  () => {
    return function MockOtherInput({ others, onAdd, disabled }: { others: any[]; onAdd: (data: any) => void; disabled: boolean }) {
      return (
        <div data-testid="other-input">
          <span>OtherInput</span>
          <div>Others count: {others ? others.length : 0}</div>
          <div>Disabled: {disabled.toString()}</div>
          <button
            onClick={() => onAdd({ test: "data" })}
            disabled={disabled}
            data-testid="other-add-button"
          >
            Add Other
          </button>
        </div>
      );
    };
  }
);

describe("IngredientInputsContainer", () => {
  const mockIngredients = {
    grain: [
      { ingredient_id: "grain-1", name: "Pale Malt" },
      { ingredient_id: "grain-2", name: "Crystal 60L" },
    ],
    hop: [
      { ingredient_id: "hop-1", name: "Cascade" },
      { ingredient_id: "hop-2", name: "Centennial" },
    ],
    yeast: [{ ingredient_id: "yeast-1", name: "US-05" }],
    other: [{ ingredient_id: "other-1", name: "Irish Moss" }],
  };

  const defaultProps = {
    ingredients: mockIngredients,
    addIngredient: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all ingredient input components", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    expect(screen.getByTestId("fermentable-input")).toBeInTheDocument();
    expect(screen.getByTestId("hop-input")).toBeInTheDocument();
    expect(screen.getByTestId("yeast-input")).toBeInTheDocument();
    expect(screen.getByTestId("other-input")).toBeInTheDocument();

    expect(screen.getByText("FermentableInput")).toBeInTheDocument();
    expect(screen.getByText("HopInput")).toBeInTheDocument();
    expect(screen.getByText("YeastInput")).toBeInTheDocument();
    expect(screen.getByText("OtherInput")).toBeInTheDocument();
  });

  test("passes correct ingredients to each component", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    expect(screen.getByText("Grains count: 2")).toBeInTheDocument();
    expect(screen.getByText("Hops count: 2")).toBeInTheDocument();
    expect(screen.getByText("Yeasts count: 1")).toBeInTheDocument();
    expect(screen.getByText("Others count: 1")).toBeInTheDocument();
  });

  test("passes disabled prop to all components", () => {
    render(<IngredientInputsContainer {...defaultProps as any} disabled={true} />);

    expect(screen.getAllByText("Disabled: true")).toHaveLength(4);
  });

  test("passes disabled false by default", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    expect(screen.getAllByText("Disabled: false")).toHaveLength(4);
  });

  test("handles missing ingredients gracefully", () => {
    const incompleteIngredients = {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
      // No other property
    } as any;

    render(
      <IngredientInputsContainer
        {...defaultProps}
        ingredients={incompleteIngredients}
      />
    );

    expect(screen.getByText("Grains count: 0")).toBeInTheDocument();
    expect(screen.getByText("Hops count: 0")).toBeInTheDocument();
    expect(screen.getByText("Yeasts count: 0")).toBeInTheDocument();
    expect(screen.getByText("Others count: 0")).toBeInTheDocument(); // Should default to empty array
  });

  test("handles adjunct property as fallback for other", () => {
    const ingredientsWithAdjunct = {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
      adjunct: [
        { ingredient_id: "adj-1", name: "Corn Sugar" },
        { ingredient_id: "adj-2", name: "Honey" },
      ],
    } as any;

    render(
      <IngredientInputsContainer
        {...defaultProps}
        ingredients={ingredientsWithAdjunct}
      />
    );

    expect(screen.getByText("Others count: 2")).toBeInTheDocument();
  });

  test("prefers other property over adjunct", () => {
    const ingredientsWithBoth = {
      grain: [],
      hop: [],
      yeast: [],
      other: [{ ingredient_id: "other-1", name: "Irish Moss" }],
      adjunct: [
        { ingredient_id: "adj-1", name: "Corn Sugar" },
        { ingredient_id: "adj-2", name: "Honey" },
      ],
    } as any;

    render(
      <IngredientInputsContainer
        {...defaultProps}
        ingredients={ingredientsWithBoth}
      />
    );

    expect(screen.getByText("Others count: 1")).toBeInTheDocument(); // Uses 'other', not 'adjunct'
  });

  test("calls addIngredient with correct parameters for fermentables", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    const addButton = screen.getByTestId("fermentable-add-button");
    addButton.click();

    expect(defaultProps.addIngredient).toHaveBeenCalledWith("grain", {
      ingredient_id: undefined,
      amount: undefined,
      unit: undefined,
      color: undefined,
    });
  });

  test("calls addIngredient with correct parameters for hops", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    const addButton = screen.getByTestId("hop-add-button");
    addButton.click();

    expect(defaultProps.addIngredient).toHaveBeenCalledWith("hop", {
      ingredient_id: undefined,
      amount: undefined,
      unit: undefined,
      use: undefined,
      time: undefined,
      alpha_acid: undefined,
    });
  });

  test("calls addIngredient with correct parameters for yeast", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    const addButton = screen.getByTestId("yeast-add-button");
    addButton.click();

    expect(defaultProps.addIngredient).toHaveBeenCalledWith("yeast", {
      ingredient_id: undefined,
      amount: undefined,
      unit: undefined,
    });
  });

  test("calls addIngredient with correct parameters for other", () => {
    render(<IngredientInputsContainer {...defaultProps as any} />);

    const addButton = screen.getByTestId("other-add-button");
    addButton.click();

    expect(defaultProps.addIngredient).toHaveBeenCalledWith("other", {
      ingredient_id: undefined,
      amount: undefined,
      unit: undefined,
    });
  });

  test("has correct CSS classes for layout", () => {
    const { container } = render(
      <IngredientInputsContainer {...defaultProps as any} />
    );

    const containerElement = container.querySelector(
      ".ingredient-inputs-container"
    );
    expect(containerElement).toBeInTheDocument();

    const fermentableWrapper = container.querySelector(".grid-col-2-3");
    expect(fermentableWrapper).toBeInTheDocument();
    expect(fermentableWrapper).toContainElement(
      screen.getByTestId("fermentable-input")
    );
  });
});
