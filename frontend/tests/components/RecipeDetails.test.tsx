import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import RecipeDetails from "../../src/components/RecipeBuilder/RecipeDetails";
import { UnitProvider } from "../../src/contexts/UnitContext";
import { Recipe } from "../../src/types/recipe";

// Suppress console errors and traces during tests
const originalConsoleError = console.error;
const originalConsoleTrace = console.trace;

beforeAll(() => {
  console.error = jest.fn();
  console.trace = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.trace = originalConsoleTrace;
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

// Mock react-router Link component
jest.mock("react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock BeerStyleSelector component
jest.mock(
  "../../src/components/RecipeBuilder/BeerStyles/BeerStyleSelector",
  () => {
    return function MockBeerStyleSelector({
      value,
      onChange,
      placeholder,
      disabled,
    }: {
      value: string | undefined;
      onChange: (value: string) => void;
      placeholder?: string;
      disabled?: boolean;
    }) {
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="form-control"
          id="style"
          name="style"
          aria-label="Beer Style"
        />
      );
    };
  }
);

// Helper function to render with UnitProvider
const renderWithUnitProvider = (component: React.ReactElement) => {
  return render(<UnitProvider>{component}</UnitProvider>);
};

describe("RecipeDetails", () => {
  const mockOnChange = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultRecipe: Recipe = {
    id: "test-recipe-1",
    recipe_id: "test-recipe-1",
    name: "Test Recipe",
    style: "IPA",
    batch_size: 5,
    batch_size_unit: "gal",
    boil_time: 60,
    efficiency: 75,
    description: "Test description",
    notes: "Test notes",
    is_public: false,
    ingredients: [],
    user_id: "test-user",
    version: 1,
    created_at: "2023-01-01T00:00:00.000Z",
    updated_at: "2023-01-01T00:00:00.000Z",
  };

  const defaultProps = {
    recipe: defaultRecipe,
    onChange: mockOnChange,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    isEditing: false,
    saving: false,
    canSave: true,
    hasUnsavedChanges: false,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  describe("Loading state", () => {
    it("renders loading message when recipe is null", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} recipe={null as any} />);

      expect(screen.getByText("Loading recipe details...")).toBeInTheDocument();
    });

    it("renders loading message when recipe is undefined", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} recipe={undefined as any} />
      );

      expect(screen.getByText("Loading recipe details...")).toBeInTheDocument();
    });
  });

  describe("Title rendering", () => {
    it('shows "Recipe Details" when editing', () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} isEditing={true} />
      );

      expect(screen.getByText("Recipe Details")).toBeInTheDocument();
    });

    it('shows "New Recipe Details" when not editing', () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} isEditing={false} />
      );

      expect(screen.getByText("New Recipe Details")).toBeInTheDocument();
    });

    it("shows unsaved changes indicator when hasUnsavedChanges is true", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} hasUnsavedChanges={true} />
      );

      expect(screen.getByTitle("Unsaved changes")).toBeInTheDocument();
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("hides unsaved changes indicator when hasUnsavedChanges is false", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} hasUnsavedChanges={false} />
      );

      expect(screen.queryByTitle("Unsaved changes")).not.toBeInTheDocument();
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });
  });

  describe("Form field rendering", () => {
    it("renders all form fields with correct values", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      expect(screen.getByDisplayValue("Test Recipe")).toBeInTheDocument();
      expect(screen.getByDisplayValue("IPA")).toBeInTheDocument();
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      expect(screen.getByDisplayValue("60")).toBeInTheDocument();
      expect(screen.getByDisplayValue("75")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test notes")).toBeInTheDocument();
    });

    it("handles empty/null values correctly", () => {
      const emptyRecipe: Recipe = {
        ...defaultRecipe,
        style: undefined,
        boil_time: undefined,
        efficiency: undefined,
        description: undefined,
        notes: undefined,
      };

      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} recipe={emptyRecipe} />
      );

      expect(screen.getByDisplayValue("Test Recipe")).toBeInTheDocument();
      expect(screen.getByLabelText("Beer Style")).toHaveValue("");
      expect(
        screen.getByRole("spinbutton", { name: /boil time/i })
      ).toHaveValue(null);
      expect(
        screen.getByRole("spinbutton", { name: /mash efficiency/i })
      ).toHaveValue(null);
      expect(screen.getByRole("textbox", { name: /description/i })).toHaveValue(
        ""
      );
      expect(
        screen.getByRole("textbox", { name: /brewing notes/i })
      ).toHaveValue("");
    });

    it("sets checkbox correctly", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox", {
        name: /make recipe public/i,
      });
      expect(checkbox).not.toBeChecked();
    });

    it("sets checkbox when recipe is public", () => {
      const publicRecipe: Recipe = { ...defaultRecipe, is_public: true };
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} recipe={publicRecipe} />
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /make recipe public/i,
      });
      expect(checkbox).toBeChecked();
    });
  });

  describe("Form interactions", () => {
    it("calls onChange when text input changes", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const nameInput = screen.getByRole("textbox", { name: /recipe name/i });
      fireEvent.change(nameInput, {
        target: { name: "name", value: "New Recipe Name", type: "text" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("name", "New Recipe Name");
    });

    it("calls onChange when number input changes", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const batchSizeInput = screen.getByRole("spinbutton", {
        name: /batch size/i,
      });
      fireEvent.change(batchSizeInput, {
        target: { name: "batch_size", value: "10", type: "number" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("batch_size", 10);
    });

    it("calls onChange when textarea changes", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const descriptionInput = screen.getByRole("textbox", {
        name: /description/i,
      });
      fireEvent.change(descriptionInput, {
        target: { name: "description", value: "New description" },
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        "description",
        "New description"
      );
    });

    it("calls onChange when checkbox changes", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox", {
        name: /make recipe public/i,
      });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith("is_public", true);
    });

    it("handles empty number input correctly", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const batchSizeInput = screen.getByRole("spinbutton", {
        name: /batch size/i,
      });
      fireEvent.change(batchSizeInput, {
        target: { name: "batch_size", value: "", type: "number" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("batch_size", "");
    });

    it("handles invalid number input correctly", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const efficiencyInput = screen.getByRole("spinbutton", {
        name: /mash efficiency/i,
      });
      fireEvent.change(efficiencyInput, {
        target: { name: "efficiency", value: "abc", type: "number" },
      });

      // parseFloat('abc') returns NaN, which should be converted to ''
      expect(mockOnChange).toHaveBeenCalledWith("efficiency", "");
    });

    it("calls onChange with correct string values for text inputs", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const styleInput = screen.getByLabelText("Beer Style");
      fireEvent.change(styleInput, {
        target: { value: "American Pale Ale" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("style", "American Pale Ale");
    });

    it("calls onChange with correct numeric values for number inputs", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const boilTimeInput = screen.getByRole("spinbutton", {
        name: /boil time/i,
      });
      fireEvent.change(boilTimeInput, {
        target: { name: "boil_time", value: "90", type: "number" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("boil_time", 90);
    });

    it("handles decimal number input correctly", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const batchSizeInput = screen.getByRole("spinbutton", {
        name: /batch size/i,
      });
      fireEvent.change(batchSizeInput, {
        target: { name: "batch_size", value: "5.5", type: "number" },
      });

      expect(mockOnChange).toHaveBeenCalledWith("batch_size", 5.5);
    });
  });

  describe("Form submission", () => {
    it("calls onSubmit when form is submitted via button click", async () => {
      const user = userEvent.setup();
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const submitButton = screen.getByRole("button", { name: /save recipe/i });
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it("calls onSubmit when form is submitted via Enter key", () => {
      const { container } = renderWithUnitProvider(
        <RecipeDetails {...defaultProps} />
      );

      const form = container.querySelector("form");
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it("form submission event has preventDefault method", async () => {
      const user = userEvent.setup();
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const submitButton = screen.getByRole("button", { name: /save recipe/i });
      await user.click(submitButton);

      // Verify onSubmit was called with an event that has preventDefault
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          preventDefault: expect.any(Function),
        })
      );
    });
  });

  describe("Button states", () => {
    it('shows "Save Recipe" button when not editing', () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} isEditing={false} />
      );

      expect(
        screen.getByRole("button", { name: /save recipe/i })
      ).toBeInTheDocument();
    });

    it('shows "Update Recipe" button when editing', () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} isEditing={true} />
      );

      expect(
        screen.getByRole("button", { name: /update recipe/i })
      ).toBeInTheDocument();
    });

    it("disables submit button when canSave is false", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} canSave={false} />
      );

      const submitButton = screen.getByRole("button", { name: /save recipe/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveClass("btn-disabled");
    });

    it("shows tooltip when canSave is false", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} canSave={false} />
      );

      const submitButton = screen.getByRole("button", { name: /save recipe/i });
      expect(submitButton).toHaveAttribute(
        "title",
        "Add at least one ingredient to save"
      );
    });

    it("enables submit button when canSave is true", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} canSave={true} />
      );

      const submitButton = screen.getByRole("button", { name: /save recipe/i });
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).not.toHaveClass("btn-disabled");
    });

    it("calls onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("Saving state", () => {
    it("shows saving state on submit button", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} saving={true} />);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /saving.../i })).toBeDisabled();
    });

    it("disables all inputs when saving", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} saving={true} />);

      expect(
        screen.getByRole("textbox", { name: /recipe name/i })
      ).toBeDisabled();
      expect(screen.getByLabelText("Beer Style")).toBeDisabled();
      expect(
        screen.getByRole("spinbutton", { name: /batch size/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("spinbutton", { name: /boil time/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("spinbutton", { name: /mash efficiency/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("textbox", { name: /description/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("textbox", { name: /brewing notes/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("checkbox", { name: /make recipe public/i })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    it("shows spinner when saving", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} saving={true} />);

      expect(document.querySelector(".button-spinner")).toBeInTheDocument();
    });
  });

  describe("Validation messages", () => {
    it("shows validation message when canSave is false", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} canSave={false} />
      );

      expect(
        screen.getByText(
          "💡 Add at least one grain and yeast to save your recipe"
        )
      ).toBeInTheDocument();
    });

    it("hides validation message when canSave is true", () => {
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} canSave={true} />
      );

      expect(
        screen.queryByText(
          "💡 Add at least one grain and yeast to save your recipe"
        )
      ).not.toBeInTheDocument();
    });
  });

  describe("Public recipe help text", () => {
    it("shows help text when recipe is public", () => {
      const publicRecipe: Recipe = { ...defaultRecipe, is_public: true };
      renderWithUnitProvider(
        <RecipeDetails {...defaultProps} recipe={publicRecipe} />
      );

      expect(
        screen.getByText(
          "Other users will be able to view and clone this recipe"
        )
      ).toBeInTheDocument();
    });

    it("hides help text when recipe is not public", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      expect(
        screen.queryByText(
          "Other users will be able to view and clone this recipe"
        )
      ).not.toBeInTheDocument();
    });
  });

  describe("Input validation attributes", () => {
    it("sets correct input attributes for required fields", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const nameInput = screen.getByRole("textbox", { name: /recipe name/i });
      const batchSizeInput = screen.getByRole("spinbutton", {
        name: /batch size/i,
      });

      expect(nameInput).toBeRequired();
      expect(batchSizeInput).toBeRequired();
    });

    it("sets correct min/max/step attributes for number inputs", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      const batchSizeInput = screen.getByRole("spinbutton", {
        name: /batch size/i,
      });
      const boilTimeInput = screen.getByRole("spinbutton", {
        name: /boil time/i,
      });
      const efficiencyInput = screen.getByRole("spinbutton", {
        name: /mash efficiency/i,
      });

      expect(batchSizeInput).toHaveAttribute("min", "0.5");
      expect(batchSizeInput).toHaveAttribute("max", "100");
      expect(batchSizeInput).toHaveAttribute("step", "0.5");

      expect(boilTimeInput).toHaveAttribute("min", "15");
      expect(boilTimeInput).toHaveAttribute("max", "180");
      expect(boilTimeInput).toHaveAttribute("step", "1");

      expect(efficiencyInput).toHaveAttribute("min", "50");
      expect(efficiencyInput).toHaveAttribute("max", "95");
      expect(efficiencyInput).toHaveAttribute("step", "1");
    });

    it("sets correct placeholder text", () => {
      renderWithUnitProvider(<RecipeDetails {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Enter recipe name")
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("60")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("75")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Describe your recipe, inspiration, or other relevant details"
        )
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Special instructions, tips, or modifications"
        )
      ).toBeInTheDocument();
    });
  });
});
