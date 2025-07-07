// @ts-ignore - React needed for JSX in test files
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecipeMetrics from "../../src/components/RecipeBuilder/RecipeMetrics";
import { UnitProvider } from "../../src/contexts/UnitContext";
import { mockData } from "../testUtils";

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
const renderWithUnitProvider = (component: React.ReactElement) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("RecipeMetrics", () => {
  const defaultProps = {
    metrics: {
      og: 1.048,
      fg: 1.012,
      abv: 4.7,
      ibu: 35,
      srm: 8.5,
    },
    calculating: false,
    recipe: mockData.recipe({ batch_size: 5, batch_size_unit: "gal", is_public: false }),
  };

  test("renders metrics correctly", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    expect(screen.getByText("1.048")).toBeInTheDocument();
    expect(screen.getByText("1.012")).toBeInTheDocument();
    expect(screen.getByText("4.7%")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("8.5 SRM")).toBeInTheDocument();
  });

  test("displays calculating indicator when calculating", () => {
    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics} 
        calculating={true} 
        recipe={defaultProps.recipe}
      />
    );

    expect(screen.getByText("Calculating...")).toBeInTheDocument();
  });

  test("shows balance description", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    // Should show "Balanced" for the given metrics
    expect(screen.getByText("Balanced (Malt)")).toBeInTheDocument();
  });

  test("displays color swatch with correct color", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    const colorSwatch = screen.getByTitle("SRM 8.5");
    expect(colorSwatch).toHaveStyle({ backgroundColor: "#F09100" });
  });

  test("renders recipe scaling section when onScale provided", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        onScale={mockOnScale} 
      />
    );

    expect(screen.getByText("Recipe Scaling")).toBeInTheDocument();
    expect(screen.getByText("(Current: 5 gal)")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("New batch size (gal)")
    ).toBeInTheDocument();
  });

  test("handles recipe scaling", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        onScale={mockOnScale} 
      />
    );

    const input = screen.getByPlaceholderText("New batch size (gal)");
    const scaleButton = screen.getByText("Scale");

    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(scaleButton);

    expect(mockOnScale).toHaveBeenCalledWith(10);
  });

  test("disables scale button when no value entered", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        onScale={mockOnScale} 
      />
    );

    const scaleButton = screen.getByText("Scale");
    expect(scaleButton).toBeDisabled();
  });

  test("disables scale button when calculating", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics
        metrics={defaultProps.metrics}
        calculating={true}
        recipe={defaultProps.recipe}
        onScale={mockOnScale}
      />
    );

    const input = screen.getByPlaceholderText("New batch size (gal)");
    const scaleButton = screen.getByText("Scaling...");

    fireEvent.change(input, { target: { value: "10" } });

    expect(scaleButton).toBeDisabled();
  });

  test("renders in card view mode", () => {
    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        cardView={true} 
      />
    );

    // In card view, should not show scaling or analysis sections
    expect(screen.queryByText("Recipe Scaling")).not.toBeInTheDocument();
    expect(screen.queryByText("Recipe Analysis")).not.toBeInTheDocument();

    // But should still show metrics
    expect(screen.getByText("1.048")).toBeInTheDocument();
  });

  test("handles zero metrics gracefully", () => {
    const zeroMetrics = {
      og: 1.0,
      fg: 1.0,
      abv: 0.0,
      ibu: 0,
      srm: 0,
    };

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={zeroMetrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
      />
    );

    // Use getAllByText for multiple occurrences
    expect(screen.getAllByText("1.000")).toHaveLength(2);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("0.0 SRM")).toBeInTheDocument();
  });

  test("shows appropriate balance description for different ratios", () => {
    const hoppyMetrics = {
      og: 1.05,
      fg: 1.012,
      abv: 5.0,
      ibu: 80,
      srm: 5,
    };

    const { rerender } = renderWithUnitProvider(
      <RecipeMetrics 
        metrics={hoppyMetrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
      />
    );

    // Use getAllByText and check specific element by role or test ID
    expect(screen.getByTestId("balance-description")).toHaveTextContent(
      "Hoppy"
    );

    const maltyMetrics = {
      og: 1.08,
      fg: 1.02,
      abv: 8.0,
      ibu: 15,
      srm: 20,
    };

    rerender(
      <UnitProvider>
        <RecipeMetrics 
          metrics={maltyMetrics}
          calculating={defaultProps.calculating}
          recipe={defaultProps.recipe}
        />
      </UnitProvider>
    );
    expect(screen.getByTestId("balance-description")).toHaveTextContent(
      "Malty"
    );
  });

  test("clears scale input after successful scaling", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        onScale={mockOnScale}
      />
    );

    const input = screen.getByPlaceholderText("New batch size (gal)");
    const scaleButton = screen.getByText("Scale");

    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(scaleButton);

    expect((input as HTMLInputElement).value).toBe("");
  });

  test("displays typical batch size examples", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics 
        metrics={defaultProps.metrics}
        calculating={defaultProps.calculating}
        recipe={defaultProps.recipe}
        onScale={mockOnScale}
      />
    );

    expect(
      screen.getByText(/Typical: 2\.5 gal, 5 gal, 10 gal/)
    ).toBeInTheDocument();
  });
});
