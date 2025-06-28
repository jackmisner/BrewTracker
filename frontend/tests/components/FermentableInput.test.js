import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FermentableInput from "../../src/components/RecipeBuilder/IngredientInputs/FermentableInput";
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
  }) {
    const [value, setValue] = mockReact.useState("");

    // Reset input when resetTrigger changes
    mockReact.useEffect(() => {
      if (resetTrigger > 0) {
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
        onChange: (e) => {
          setValue(e.target.value);
          // Simulate selecting an ingredient when typing
          if (e.target.value === "pale malt") {
            onSelect({
              ingredient_id: "grain-1",
              name: "Pale Malt",
              color: 2,
              grain_type: "base_malt",
              description: "Base malt for most beer styles",
            });
          } else if (e.target.value === "crystal 60") {
            onSelect({
              ingredient_id: "grain-2",
              name: "Crystal 60L",
              color: 60,
              grain_type: "caramel_crystal",
              description: "Medium caramel malt",
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
const renderWithUnitProvider = (component) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("FermentableInput", () => {
  const mockGrains = [
    {
      ingredient_id: "grain-1",
      name: "Pale Malt",
      color: 2,
      grain_type: "base_malt",
      description: "Base malt for most beer styles",
    },
    {
      ingredient_id: "grain-2",
      name: "Crystal 60L",
      color: 60,
      grain_type: "caramel_crystal",
      description: "Medium caramel malt",
    },
  ];

  const defaultProps = {
    grains: mockGrains,
    onAdd: jest.fn(),
    disabled: false,
  };

  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to suppress expected error messages
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  test("renders fermentable input form", () => {
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    expect(screen.getByText("Fermentables")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("1")).toBeInTheDocument(); // Correct placeholder for lb
    expect(screen.getByDisplayValue("lb")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Color")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  test("shows validation error for missing amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Select an ingredient but don't enter amount
    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

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
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Enter amount but don't select ingredient
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    // Try to submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please select a fermentable")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive amount in imperial", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "150");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 100 pounds seems unusually high")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for invalid color", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const colorInput = screen.getByPlaceholderText("Color");
    await user.type(colorInput, "700");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Color should be between 0-600 Lovibond")
      ).toBeInTheDocument();
    });
  });

  test("successfully adds fermentable with valid data", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(
      <FermentableInput {...defaultProps} onAdd={mockOnAdd} />
    );

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const colorInput = screen.getByPlaceholderText("Color");
    await user.clear(colorInput);
    await user.type(colorInput, "2");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "grain-1",
        amount: "8",
        unit: "lb",
        color: 2,
      });
    });
  });

  test("resets form after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(
      <FermentableInput {...defaultProps} onAdd={mockOnAdd} />
    );

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalled();
    });

    // Wait for form state to reset after successful submission
    await waitFor(() => {
      expect(amountInput.value).toBe("");
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Color").value).toBe("");
    });
  });

  test("displays selected ingredient information", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    await waitFor(() => {
      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      expect(screen.getByText("base malt")).toBeInTheDocument();
    });
  });

  test("auto-fills color when ingredient is selected", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "crystal 60");

    await waitFor(() => {
      const colorInput = screen.getByPlaceholderText("Color");
      expect(colorInput.value).toBe("60");
    });
  });

  test("shows color preview swatch", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const colorInput = screen.getByPlaceholderText("Color");
    await user.type(colorInput, "20");

    await waitFor(() => {
      const colorSwatch = screen.getByTitle("~20°L");
      expect(colorSwatch).toBeInTheDocument();
      expect(colorSwatch).toHaveStyle({ backgroundColor: "#D37600" });
    });
  });

  test("changes unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const unitSelect = screen.getByDisplayValue("lb");
    await user.selectOptions(unitSelect, "oz");

    expect(screen.getByDisplayValue("oz")).toBeInTheDocument();
  });

  test("disables form when disabled prop is true", () => {
    renderWithUnitProvider(
      <FermentableInput {...defaultProps} disabled={true} />
    );

    expect(screen.getByPlaceholderText("1")).toBeDisabled();
    expect(screen.getByDisplayValue("lb")).toBeDisabled();
    expect(screen.getByPlaceholderText("Color")).toBeDisabled();
    expect(screen.getByText("Adding...")).toBeDisabled();
  });

  test("button is enabled when component is not disabled", () => {
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    const addButton = screen.getByText("Add");
    expect(addButton).not.toBeDisabled();
  });

  test("button is enabled when required fields are filled", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Fill required fields
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    await waitFor(() => {
      const addButton = screen.getByText("Add");
      expect(addButton).not.toBeDisabled();
    });
  });

  test("clears errors when user starts typing", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Trigger validation error
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than 0")
      ).toBeInTheDocument();
    });

    // Start typing in amount field
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "5");

    await waitFor(() => {
      expect(
        screen.queryByText("Amount must be greater than 0")
      ).not.toBeInTheDocument();
    });
  });

  test("handles submission error gracefully", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockRejectedValue(new Error("Network error"));

    renderWithUnitProvider(
      <FermentableInput {...defaultProps} onAdd={mockOnAdd} />
    );

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to add fermentable. Please try again.")
      ).toBeInTheDocument();
    });

    // Verify console.error was called (but suppressed in output)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to add fermentable:",
      expect.any(Error)
    );
  });

  test("shows help text with unit-specific guidance", () => {
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    expect(
      screen.getByText(/Base malts.*4-12 lb.*Specialty malts.*4-32 oz/)
    ).toBeInTheDocument();
  });

  test("allows submission without color (optional field)", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(
      <FermentableInput {...defaultProps} onAdd={mockOnAdd} />
    );

    // Fill required fields only
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "8");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    // Submit without color
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "grain-1",
        amount: "8",
        unit: "lb",
        color: 2, // Auto-filled from ingredient
      });
    });
  });

  test("updates placeholder based on unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Default should be lb placeholder
    expect(screen.getByPlaceholderText("1")).toBeInTheDocument();

    // Change to oz
    const unitSelect = screen.getByDisplayValue("lb");
    await user.selectOptions(unitSelect, "oz");

    // Should update to oz placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText("16")).toBeInTheDocument();
    });
  });

  test("shows unit-specific validation limits", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<FermentableInput {...defaultProps} />);

    // Change to oz and test oz limits
    const unitSelect = screen.getByDisplayValue("lb");
    await user.selectOptions(unitSelect, "oz");

    const amountInput = screen.getByPlaceholderText("16");
    await user.type(amountInput, "2000"); // Over 1600 oz limit

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 100 pounds seems unusually high")
      ).toBeInTheDocument();
    });
  });
});
