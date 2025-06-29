// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HopInput from "../../src/components/RecipeBuilder/IngredientInputs/HopInput";
import { UnitProvider } from "../../src/contexts/UnitContext";

// Mock SearchableSelect component
jest.mock("../../src/components/SearchableSelect", () => {
  const mockReact = require("react");

  return function MockSearchableSelect({
    onSelect,
    placeholder,
    disabled,
    className,
    resetTrigger,
  }: {
    onSelect: (item: any) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    resetTrigger?: number;
  }) {
    const [value, setValue] = mockReact.useState("");

    // Reset input when resetTrigger changes
    mockReact.useEffect(() => {
      if (resetTrigger && resetTrigger > 0) {
        setValue("");
      }
    }, [resetTrigger]);

    return mockReact.createElement(
      "div",
      {
        "data-testid": "searchable-select",
        className: className,
      },
      mockReact.createElement("input", {
        value: value,
        placeholder: placeholder,
        disabled: disabled,
        onChange: (e: any) => {
          setValue(e.target.value);
          // Simulate selecting an ingredient when typing
          if (e.target.value === "cascade") {
            onSelect({
              ingredient_id: "hop-1",
              name: "Cascade",
              alpha_acid: 5.5,
              origin: "USA",
              description: "Floral and citrusy American hop",
            });
          } else if (e.target.value === "centennial") {
            onSelect({
              ingredient_id: "hop-2",
              name: "Centennial",
              alpha_acid: 10.0,
              origin: "USA",
              description: "Intense citrus and floral aroma",
            });
          } else if (e.target.value === "clear") {
            onSelect(null);
          }
        },
      })
    );
  };
});

// Mock the UserSettingsService that UnitContext depends on
jest.mock("../../src/services/UserSettingsService", () => ({
  getUserSettings: jest.fn().mockResolvedValue({
    settings: {
      preferred_units: "imperial",
    },
  }),
  updateSettings: jest.fn().mockResolvedValue({}),
}));

// Helper function to render with UnitProvider
const renderWithUnitProvider = (component: any) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("HopInput", () => {
  const mockHops = [
    {
      ingredient_id: "hop-1",
      name: "Cascade",
      alpha_acid: 5.5,
      origin: "USA",
      description: "Floral and citrusy American hop",
    },
    {
      ingredient_id: "hop-2",
      name: "Centennial",
      alpha_acid: 10.0,
      origin: "USA",
      description: "Intense citrus and floral aroma",
    },
  ];

  const defaultProps = {
    hops: mockHops,
    onAdd: jest.fn(),
    disabled: false,
  };

  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("renders hop input form", () => {
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    expect(screen.getByText("Hops")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("1.0")).toBeInTheDocument(); // Updated placeholder for imperial
    expect(screen.getByDisplayValue("oz")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Alpha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boil")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  test("shows validation error for missing amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Select an ingredient but don't enter amount
    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    // Try to submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than 0")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for missing ingredient selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Enter amount but don't select ingredient
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    // Try to submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please select a hop variety")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for missing alpha acid", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    // Clear alpha acid that was auto-filled
    const alphaInput = screen.getByPlaceholderText("Alpha");
    await user.clear(alphaInput);

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Alpha acid percentage is required")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive amount in oz", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "15");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 10 oz seems unusually high for hops")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive amount in grams", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    // Change to grams
    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "g");

    // Now enter excessive gram amount
    await user.clear(amountInput);
    await user.type(amountInput, "400");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 300g seems unusually high for hops")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive alpha acid", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const alphaInput = screen.getByPlaceholderText("Alpha");
    await user.clear(alphaInput);
    await user.type(alphaInput, "30");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Alpha acid percentage seems unusually high")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for missing boil time", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    // Boil is default use, but don't enter time

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Boil time is required for boil additions")
      ).toBeInTheDocument();
    });
  });

  test("successfully adds hop with valid data", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue(undefined);

    renderWithUnitProvider(<HopInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const timeInput = screen.getByPlaceholderText("60");
    await user.type(timeInput, "60");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "hop-1",
        amount: "1",
        unit: "oz",
        alpha_acid: "5.5",
        use: "boil",
        time: 60,
        time_unit: "minutes",
      });
    });
  });

  test("auto-fills alpha acid when ingredient is selected", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "centennial");

    await waitFor(() => {
      const alphaInput = screen.getByPlaceholderText("Alpha");
      expect((alphaInput as HTMLInputElement).value).toBe("10");
    });
  });

  test("adjusts time defaults when use changes", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Change to whirlpool first
    const useSelect = screen.getByDisplayValue("Boil");
    await user.selectOptions(useSelect, "whirlpool");

    await waitFor(() => {
      const timeUnitSelect = screen.getByDisplayValue("min");
      expect(timeUnitSelect).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("15")).toBeInTheDocument();
    });
  });

  test("shows usage description for different uses", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Default boil
    expect(
      screen.getByText("Adds bitterness. Longer boil = more bitter.")
    ).toBeInTheDocument();

    // Change to whirlpool
    const useSelect = screen.getByDisplayValue("Boil");
    await user.selectOptions(useSelect, "whirlpool");

    await waitFor(() => {
      expect(
        screen.getByText("Adds flavor and aroma with some bitterness.")
      ).toBeInTheDocument();
    });

    // Change to dry-hop
    await user.selectOptions(useSelect, "dry-hop");

    await waitFor(() => {
      expect(
        screen.getByText("Adds aroma and flavor with no bitterness.")
      ).toBeInTheDocument();
    });
  });

  test("displays selected ingredient information", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    await waitFor(() => {
      expect(screen.getByText("Cascade")).toBeInTheDocument();
      expect(screen.getByText("USA")).toBeInTheDocument();
      expect(
        screen.getByText("Floral and citrusy American hop")
      ).toBeInTheDocument();
    });
  });

  test("changes unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "g");

    expect(screen.getByDisplayValue("g")).toBeInTheDocument();
  });

  test("resets form after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue(undefined);

    renderWithUnitProvider(<HopInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const timeInput = screen.getByPlaceholderText("60");
    await user.type(timeInput, "60");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalled();
    });

    // Wait for form state to reset after successful submission
    await waitFor(() => {
      expect((amountInput as HTMLInputElement).value).toBe("");
    });

    await waitFor(() => {
      expect((screen.getByPlaceholderText("Alpha") as HTMLInputElement).value).toBe("");
    });
  });

  test("clears errors when user starts typing", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Trigger validation error
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than 0")
      ).toBeInTheDocument();
    });

    // Start typing in amount field
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    await waitFor(() => {
      expect(
        screen.queryByText("Amount must be greater than 0")
      ).not.toBeInTheDocument();
    });
  });

  test("handles submission error gracefully", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockRejectedValue(new Error("Network error"));

    renderWithUnitProvider(<HopInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const timeInput = screen.getByPlaceholderText("60");
    await user.type(timeInput, "60");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to add hop. Please try again.")
      ).toBeInTheDocument();
    });

    // Verify console.error was called (but suppressed in output)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to add hop:",
      expect.any(Error)
    );
  });

  test("disables form when disabled prop is true", () => {
    renderWithUnitProvider(<HopInput {...defaultProps as any} disabled={true} />);

    expect(screen.getByPlaceholderText("1.0")).toBeDisabled();
    expect(screen.getByDisplayValue("oz")).toBeDisabled();
    expect(screen.getByPlaceholderText("Alpha")).toBeDisabled();
    expect(screen.getByText("Adding...")).toBeDisabled();
  });

  test("shows help text with unit-specific guidance", () => {
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    expect(
      screen.getByText(/Bittering hops.*0.5-2.0 oz.*Aroma hops.*0.5-1.0 oz/)
    ).toBeInTheDocument();
  });

  test("validates dry hop time", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Fill required fields
    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    // Change to dry-hop
    const useSelect = screen.getByDisplayValue("Boil");
    await user.selectOptions(useSelect, "dry-hop");

    // Wait for the state change to complete (placeholder should change to "3")
    await waitFor(() => {
      expect(screen.getByPlaceholderText("3")).toBeInTheDocument();
    });

    // Clear the auto-filled time value to simulate missing time
    const timeInput = screen.getByPlaceholderText("3");
    await user.clear(timeInput);

    // Submit with cleared time
    const addButton = screen.getByText("Add");
    await user.click(addButton);

    // Wait for error message to appear
    await waitFor(() => {
      const errorMessage = screen.getByTestId("time-error-message");
      expect(errorMessage).toHaveTextContent(
        /dry hop time must be greater than 0/i
      );
    });
  });

  test("validates excessive boil time", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    const timeInput = screen.getByPlaceholderText("60");
    await user.type(timeInput, "150");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Boil time over 120 minutes is unusual")
      ).toBeInTheDocument();
    });
  });

  test("validates excessive dry hop time", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1.0");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "cascade");

    // Change to dry-hop
    const useSelect = screen.getByDisplayValue("Boil");
    await user.selectOptions(useSelect, "dry-hop");

    const timeInput = screen.getByPlaceholderText("3");
    await user.type(timeInput, "30");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Dry hop time over 21 days is unusual")
      ).toBeInTheDocument();
    });
  });

  test("updates placeholder based on unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<HopInput {...defaultProps as any} />);

    // Default should be oz placeholder
    expect(screen.getByPlaceholderText("1.0")).toBeInTheDocument();

    // Change to g
    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "g");

    // Should update to g placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText("28")).toBeInTheDocument();
    });
  });
});
