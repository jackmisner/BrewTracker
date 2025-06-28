import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OtherInput from "../../src/components/RecipeBuilder/IngredientInputs/OtherInput";
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
          if (e.target.value === "irish moss") {
            onSelect({
              ingredient_id: "other-1",
              name: "Irish Moss",
              type: "clarifying",
              description: "Clarifying agent made from seaweed",
            });
          } else if (e.target.value === "yeast nutrient") {
            onSelect({
              ingredient_id: "other-2",
              name: "Yeast Nutrient",
              type: "nutrient",
              description: "Nutrient blend for healthy fermentation",
            });
          } else if (e.target.value === "corn sugar") {
            onSelect({
              ingredient_id: "other-3",
              name: "Corn Sugar (Dextrose)",
              type: "sugar",
              description: "Fermentable sugar for priming or boosting gravity",
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

describe("OtherInput", () => {
  const mockOthers = [
    {
      ingredient_id: "other-1",
      name: "Irish Moss",
      type: "clarifying",
      description: "Clarifying agent made from seaweed",
    },
    {
      ingredient_id: "other-2",
      name: "Yeast Nutrient",
      type: "nutrient",
      description: "Nutrient blend for healthy fermentation",
    },
    {
      ingredient_id: "other-3",
      name: "Corn Sugar (Dextrose)",
      type: "sugar",
      description: "Fermentable sugar for priming or boosting gravity",
    },
  ];

  const defaultProps = {
    others: mockOthers,
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

  test("renders other input form", () => {
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    expect(screen.getByText("Other Ingredients")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.5")).toBeInTheDocument(); // Amount placeholder for oz
    expect(screen.getByDisplayValue("oz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boil")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Time (min)")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  test("shows validation error for missing amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    // Select an ingredient but don't enter amount
    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

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
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    // Enter amount but don't select ingredient
    const amountInput = screen.getByPlaceholderText("0.5"); // Updated to match component
    await user.type(amountInput, "1");

    // Try to submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please select an ingredient")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive oz amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "20");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 1 pound seems high - double check amount")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive lb amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "8");

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "lb");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "corn sugar");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 5 pounds of adjunct seems unusual")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive g amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "600");

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "g");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "yeast nutrient");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 500g seems high for most additives")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive spice amounts", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "15");

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "tsp");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "yeast nutrient");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Large amounts of spices/nutrients - double check")
      ).toBeInTheDocument();
    });
  });

  test("successfully adds other ingredient with valid data", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<OtherInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

    const timeInput = screen.getByPlaceholderText("Time (min)");
    await user.type(timeInput, "15");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "other-1",
        amount: "1",
        unit: "oz",
        use: "boil",
        time: 15,
      });
    });
  });

  test("successfully adds ingredient without time", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<OtherInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form without time
    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "0.5");

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "tsp");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "yeast nutrient");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "other-2",
        amount: "0.5",
        unit: "tsp",
        use: "boil",
        time: undefined,
      });
    });
  });

  test("displays selected ingredient information and category", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "yeast nutrient");

    await waitFor(() => {
      // Use getAllByText for elements that appear multiple times
      const yeastNutrientElements = screen.getAllByText("Yeast Nutrient");
      expect(yeastNutrientElements.length).toBeGreaterThan(0);
    });

    // Check specific element by role/selector
    expect(
      screen.getByText("Yeast Nutrient", {
        selector: ".ingredient-badge",
      })
    ).toBeInTheDocument();
  });

  test("shows ingredient category for clarifying agent", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

    await waitFor(() => {
      expect(screen.getByText("Clarifying Agent")).toBeInTheDocument();
    });
  });

  test("shows ingredient category for fermentable sugar", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "corn sugar");

    await waitFor(() => {
      expect(screen.getByText("Fermentable Sugar")).toBeInTheDocument();
    });
  });

  test("shows amount guidance for different ingredient categories", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    // Yeast nutrient
    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "yeast nutrient");

    await waitFor(() => {
      expect(
        screen.getByText("Typical: 1/2 tsp per 5 gallons")
      ).toBeInTheDocument();
    });

    // Clear and try clarifying agent
    await user.clear(searchableSelect);
    await user.type(searchableSelect, "irish moss");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Irish Moss: 1 tsp per 5 gallons, Whirlfloc: 1 tablet per 5 gallons"
        )
      ).toBeInTheDocument();
    });

    // Clear and try sugar
    await user.clear(searchableSelect);
    await user.type(searchableSelect, "corn sugar");

    await waitFor(() => {
      expect(
        screen.getByText("1 lb sugar ≈ 46 gravity points in 5 gallons")
      ).toBeInTheDocument();
    });
  });

  test("changes use selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const useSelect = screen.getByDisplayValue("Boil");
    await user.selectOptions(useSelect, "fermentation");

    expect(screen.getByDisplayValue("Fermentation")).toBeInTheDocument();
  });

  test("shows usage description", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

    await waitFor(() => {
      // Look for the usage description container
      const usageDescription = screen
        .getByText(/usage/i)
        .closest(".usage-description");
      expect(usageDescription).toHaveTextContent("Added during the boil");
    });
  });

  test("changes unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    const unitSelect = screen.getByDisplayValue("oz");
    await user.selectOptions(unitSelect, "tsp");

    expect(screen.getByDisplayValue("tsp")).toBeInTheDocument();
  });

  test("resets form after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<OtherInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

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
  });

  test("clears errors when user starts typing", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    // Trigger validation error
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than 0")
      ).toBeInTheDocument();
    });

    // Start typing in amount field
    const amountInput = screen.getByPlaceholderText("0.5");
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

    renderWithUnitProvider(<OtherInput {...defaultProps} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("0.5");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect, "irish moss");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to add ingredient. Please try again.")
      ).toBeInTheDocument();
    });

    // Verify console.error was called (but suppressed in output)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to add other ingredient:",
      expect.any(Error)
    );
  });

  test("disables form when disabled prop is true", () => {
    renderWithUnitProvider(<OtherInput {...defaultProps} disabled={true} />);

    expect(screen.getByPlaceholderText("0.5")).toBeDisabled();
    expect(screen.getByDisplayValue("oz")).toBeDisabled();
    expect(screen.getByDisplayValue("Boil")).toBeDisabled();
    expect(screen.getByPlaceholderText("Time (min)")).toBeDisabled();
    expect(screen.getByText("Adding...")).toBeDisabled();
  });

  test("shows help text", () => {
    renderWithUnitProvider(<OtherInput {...defaultProps} />);

    expect(
      screen.getByText(/For yeast nutrients, clarifying agents/)
    ).toBeInTheDocument();
  });
});
