import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FermentableInput from "../../src/components/RecipeBuilder/IngredientInputs/FermentableInput";

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
    render(<FermentableInput {...defaultProps} />);

    expect(screen.getByText("Fermentables")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument();
    expect(screen.getByDisplayValue("lb")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Color")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  test("shows validation error for missing amount", async () => {
    const user = userEvent.setup();
    render(<FermentableInput {...defaultProps} />);

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
    render(<FermentableInput {...defaultProps} />);

    // Enter amount but don't select ingredient
    const amountInput = screen.getByPlaceholderText("Amount");
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

  test("shows validation error for excessive amount", async () => {
    const user = userEvent.setup();
    render(<FermentableInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("Amount");
    await user.type(amountInput, "150");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount seems unusually high")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for invalid color", async () => {
    const user = userEvent.setup();
    render(<FermentableInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    const amountInput = screen.getByPlaceholderText("Amount");
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

    render(<FermentableInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("Amount");
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
        color: "2",
      });
    });
  });

  test("resets form after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    render(<FermentableInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("Amount");
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
    render(<FermentableInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "pale malt");

    await waitFor(() => {
      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
    });
  });

  test("auto-fills color when ingredient is selected", async () => {
    const user = userEvent.setup();
    render(<FermentableInput {...defaultProps} />);

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
    render(<FermentableInput {...defaultProps} />);

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
    render(<FermentableInput {...defaultProps} />);

    const unitSelect = screen.getByDisplayValue("lb");
    await user.selectOptions(unitSelect, "kg");

    expect(screen.getByDisplayValue("kg")).toBeInTheDocument();
  });

  test("disables form when disabled prop is true", () => {
    render(<FermentableInput {...defaultProps} disabled={true} />);

    expect(screen.getByPlaceholderText("Amount")).toBeDisabled();
    expect(screen.getByDisplayValue("lb")).toBeDisabled();
    expect(screen.getByPlaceholderText("Color")).toBeDisabled();
    expect(screen.getByText("Adding...")).toBeDisabled();
  });

  test("button is enabled when component is not disabled", () => {
    render(<FermentableInput {...defaultProps} />);

    const addButton = screen.getByText("Add");
    expect(addButton).not.toBeDisabled();
  });

  test("button is enabled when required fields are filled", async () => {
    const user = userEvent.setup();
    render(<FermentableInput {...defaultProps} />);

    // Fill required fields
    const amountInput = screen.getByPlaceholderText("Amount");
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
    render(<FermentableInput {...defaultProps} />);

    // Trigger validation error
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than 0")
      ).toBeInTheDocument();
    });

    // Start typing in amount field
    const amountInput = screen.getByPlaceholderText("Amount");
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

    render(<FermentableInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("Amount");
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

  test("shows help text", () => {
    render(<FermentableInput {...defaultProps} />);

    expect(
      screen.getByText(/Base malts.*should make up 60-80%/)
    ).toBeInTheDocument();
  });

  test("allows submission without color (optional field)", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    render(<FermentableInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill required fields only
    const amountInput = screen.getByPlaceholderText("Amount");
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
});
