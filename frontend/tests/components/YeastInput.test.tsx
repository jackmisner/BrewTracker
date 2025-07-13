// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YeastInput from "../../src/components/RecipeBuilder/IngredientInputs/YeastInput";
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
          if (e.target.value === "us-05") {
            onSelect({
              ingredient_id: "yeast-1",
              name: "Safale US-05",
              manufacturer: "Fermentis",
              code: "US-05",
              attenuation: 81,
              min_temperature: 59,
              max_temperature: 75,
              alcohol_tolerance: 11,
              description: "American ale yeast producing well balanced beers",
            });
          } else if (e.target.value === "wyeast 1056") {
            onSelect({
              ingredient_id: "yeast-2",
              name: "Wyeast American Ale",
              manufacturer: "Wyeast",
              code: "1056",
              attenuation: 75,
              min_temperature: 60,
              max_temperature: 72,
              alcohol_tolerance: 10,
              description: "Very clean fermenting ale yeast",
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
jest.mock("../../src/services/User/UserSettingsService", () => ({
  getUserSettings: jest.fn().mockResolvedValue({
    settings: {
      preferred_units: "imperial",
    },
  }),
  updateSettings: jest.fn().mockResolvedValue({}),
}));

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, "confirm", {
  writable: true,
  value: mockConfirm,
});

// Helper function to render with UnitProvider
const renderWithUnitProvider = (component: any) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("YeastInput", () => {
  const mockYeasts = [
    {
      id: "yeast-1",
      ingredient_id: "yeast-1",
      name: "Safale US-05",
      manufacturer: "Fermentis",
      code: "US-05",
      attenuation: 81,
      min_temperature: 59,
      max_temperature: 75,
      alcohol_tolerance: 11,
      description: "American ale yeast producing well balanced beers",
    },
    {
      id: "yeast-2",
      ingredient_id: "yeast-2",
      name: "Wyeast American Ale",
      manufacturer: "Wyeast",
      code: "1056",
      attenuation: 75,
      min_temperature: 60,
      max_temperature: 72,
      alcohol_tolerance: 10,
      description: "Very clean fermenting ale yeast",
    },
  ];

  const defaultProps = {
    yeasts: mockYeasts,
    onAdd: jest.fn(),
    disabled: false,
  };

  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    mockConfirm.mockReturnValue(true); // Default to confirming
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("renders yeast input form", () => {
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    expect(screen.getByText("Yeast")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("1")).toBeInTheDocument(); // Updated placeholder
    expect(screen.getByDisplayValue("pkg")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  test("shows validation error for missing amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    // Select an ingredient but don't enter amount
    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

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
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    // Enter amount but don't select ingredient
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "1");

    // Try to submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please select a yeast strain")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for excessive package amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "15");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("More than 10 packages is unusual - are you sure?")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for invalid gram amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "200");

    const unitSelect = screen.getByDisplayValue("pkg");
    await user.selectOptions(unitSelect, "g");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Typical dry yeast: 5-15g. Liquid yeast: 10-50g")
      ).toBeInTheDocument();
    });
  });

  test("shows validation error for invalid ml amount", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "600");

    const unitSelect = screen.getByDisplayValue("pkg");
    await user.selectOptions(unitSelect, "ml");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Typical liquid yeast volume: 35-125ml")
      ).toBeInTheDocument();
    });
  });

  test("successfully adds yeast with valid data", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<YeastInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith({
        ingredient_id: "yeast-1",
        amount: "1",
        unit: "pkg",
      });
    });
  });

  test("shows confirmation dialog for excessive packages", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<YeastInput {...defaultProps as any} onAdd={mockOnAdd} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "5");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        "Using 5 packages of yeast is unusual for most batches. Continue?"
      );
    });

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalled();
    });
  });

  test("cancels submission when confirmation is denied", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();
    mockConfirm.mockReturnValue(false); // User cancels

    renderWithUnitProvider(<YeastInput {...defaultProps as any} onAdd={mockOnAdd} />);

    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "5");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });

    // Should not call onAdd when user cancels
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  test("displays selected ingredient information", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    await waitFor(() => {
      expect(screen.getByText("Safale US-05")).toBeInTheDocument();
      expect(screen.getByText("Fermentis")).toBeInTheDocument();
      expect(screen.getByText("US-05")).toBeInTheDocument();
      expect(
        screen.getByText("American ale yeast producing well balanced beers")
      ).toBeInTheDocument();
    });
  });

  test("displays yeast specifications with imperial temperatures", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    await waitFor(() => {
      // Should show temperatures in Fahrenheit for imperial unit system
      expect(
        screen.getByText("81% attenuation • 59-75°F • 11% alcohol tolerance")
      ).toBeInTheDocument();
    });
  });

  test("shows amount guidance for different units with imperial context", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    // Default pkg guidance should reference 5 gal
    expect(
      screen.getByText("Typically 1-2 packages per 5 gal batch")
    ).toBeInTheDocument();

    // Change to grams
    const unitSelect = screen.getByDisplayValue("pkg");
    await user.selectOptions(unitSelect, "g");

    expect(
      screen.getByText("Dry yeast: ~11g/pkg, Liquid: varies by strain")
    ).toBeInTheDocument();

    // Change to ml
    await user.selectOptions(unitSelect, "ml");

    expect(
      screen.getByText("Liquid yeast: ~35-125ml per vial/smack pack")
    ).toBeInTheDocument();
  });

  test("changes unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    const unitSelect = screen.getByDisplayValue("pkg");
    await user.selectOptions(unitSelect, "g");

    expect(screen.getByDisplayValue("g")).toBeInTheDocument();
  });

  test("resets form after successful submission", async () => {
    const user = userEvent.setup();
    const mockOnAdd = jest.fn().mockResolvedValue();

    renderWithUnitProvider(<YeastInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

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
  });

  test("clears errors when user starts typing", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

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

    renderWithUnitProvider(<YeastInput {...defaultProps as any} onAdd={mockOnAdd} />);

    // Fill out form
    const amountInput = screen.getByPlaceholderText("1");
    await user.type(amountInput, "1");

    const searchableSelect = screen
      .getByTestId("searchable-select")
      .querySelector("input");
    await user.type(searchableSelect!, "us-05");

    // Submit
    const addButton = screen.getByText("Add");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to add yeast. Please try again.")
      ).toBeInTheDocument();
    });

    // Verify console.error was called (but suppressed in output)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to add yeast:",
      expect.any(Error)
    );
  });

  test("disables form when disabled prop is true", () => {
    renderWithUnitProvider(<YeastInput {...defaultProps} disabled={true} />);

    expect(screen.getByPlaceholderText("1")).toBeDisabled();
    expect(screen.getByDisplayValue("pkg")).toBeDisabled();
    expect(screen.getByText("Adding...")).toBeDisabled();
  });

  test("shows help text with imperial batch size", () => {
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    expect(
      screen.getByText(/Most 5-gallon batches need 1-2 packages/)
    ).toBeInTheDocument();
  });

  test("updates placeholder based on unit selection", async () => {
    const user = userEvent.setup();
    renderWithUnitProvider(<YeastInput {...defaultProps as any} />);

    // Default should be pkg placeholder
    expect(screen.getByPlaceholderText("1")).toBeInTheDocument();

    // Change to grams
    const unitSelect = screen.getByDisplayValue("pkg");
    await user.selectOptions(unitSelect, "g");

    // Should update to g placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText("11")).toBeInTheDocument();
    });

    // Change to ml
    await user.selectOptions(unitSelect, "ml");

    // Should update to ml placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText("125")).toBeInTheDocument();
    });
  });
});
