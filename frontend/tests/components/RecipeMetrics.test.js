import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecipeMetrics from "../../src/components/RecipeBuilder/RecipeMetrics";
import { UnitProvider } from "../../src/contexts/UnitContext";

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
    recipe: {
      batch_size: 5,
    },
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
      <RecipeMetrics {...defaultProps} calculating={true} />
    );

    expect(screen.getByText("Calculating...")).toBeInTheDocument();
  });

  test("shows balance description", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    // Should show "Balanced" for the given metrics
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });

  test("displays color swatch with correct color", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    const colorSwatch = screen.getByTitle("SRM 8.5");
    expect(colorSwatch).toHaveStyle({ backgroundColor: "#E58500" });
  });

  test("renders recipe scaling section when onScale provided", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics {...defaultProps} onScale={mockOnScale} />
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
      <RecipeMetrics {...defaultProps} onScale={mockOnScale} />
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
      <RecipeMetrics {...defaultProps} onScale={mockOnScale} />
    );

    const scaleButton = screen.getByText("Scale");
    expect(scaleButton).toBeDisabled();
  });

  test("disables scale button when calculating", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics
        {...defaultProps}
        onScale={mockOnScale}
        calculating={true}
      />
    );

    const input = screen.getByPlaceholderText("New batch size (gal)");
    const scaleButton = screen.getByText("Scaling...");

    fireEvent.change(input, { target: { value: "10" } });

    expect(scaleButton).toBeDisabled();
  });

  test("shows recipe analysis section", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    expect(screen.getByText("Recipe Analysis")).toBeInTheDocument();
    expect(screen.getByText(/Standard/)).toBeInTheDocument(); // Use regex for partial match
    expect(screen.getByText(/High/)).toBeInTheDocument(); // Changed from "Strong"
    expect(screen.getByText(/Amber/)).toBeInTheDocument(); // Changed from "Gold"
  });

  test("calculates and displays attenuation", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} />);

    // With OG 1.048 and FG 1.012, attenuation should be 75%
    expect(screen.getByText("75.0%")).toBeInTheDocument();
  });

  test("renders in card view mode", () => {
    renderWithUnitProvider(<RecipeMetrics {...defaultProps} cardView={true} />);

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
      <RecipeMetrics {...defaultProps} metrics={zeroMetrics} />
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
      <RecipeMetrics {...defaultProps} metrics={hoppyMetrics} />
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
        <RecipeMetrics {...defaultProps} metrics={maltyMetrics} />
      </UnitProvider>
    );
    expect(screen.getByTestId("balance-description")).toHaveTextContent(
      "Malty"
    );
  });

  test("clears scale input after successful scaling", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics {...defaultProps} onScale={mockOnScale} />
    );

    const input = screen.getByPlaceholderText("New batch size (gal)");
    const scaleButton = screen.getByText("Scale");

    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(scaleButton);

    expect(input.value).toBe("");
  });

  test("shows batch size analysis for different sizes", () => {
    const smallBatchProps = {
      ...defaultProps,
      recipe: { batch_size: 1 }, // 1 gallon = small batch
    };

    renderWithUnitProvider(<RecipeMetrics {...smallBatchProps} />);

    expect(screen.getByText(/Small batch/)).toBeInTheDocument();
  });

  test("displays typical batch size examples", () => {
    const mockOnScale = jest.fn();

    renderWithUnitProvider(
      <RecipeMetrics {...defaultProps} onScale={mockOnScale} />
    );

    expect(
      screen.getByText(/Typical: 5 gal, 6 gal, 10 gal/)
    ).toBeInTheDocument();
  });
});
