// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import IngredientManager from "../../src/pages/IngredientManager";
import ApiService from "../../src/services/api";
import { ingredientServiceInstance } from "../../src/services";

// Mock the API service
jest.mock("../../src/services/api", () => ({
  ingredients: {
    getAll: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock the ingredient service
jest.mock("../../src/services", () => ({
  ingredientServiceInstance: {
    groupIngredientsByType: jest.fn(),
  },
}));

// Mock Fuse.js for fuzzy search
jest.mock("fuse.js", () => {
  return jest.fn().mockImplementation(() => ({
    search: jest.fn().mockReturnValue([]),
  }));
});

// Mock CSS import
jest.mock("../../src/styles/IngredientManager.css", () => ({}));

// Suppress console errors during tests
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

describe("IngredientManager", () => {
  const mockIngredients = [
    {
      ingredient_id: 1,
      name: "Pale Malt",
      type: "grain",
      grain_type: "base_malt",
      potential: 37,
      color: 2.5,
      description: "Base malt for brewing",
    },
    {
      ingredient_id: 2,
      name: "Cascade",
      type: "hop",
      alpha_acid: 5.5,
      description: "Classic American hop",
    },
    {
      ingredient_id: 3,
      name: "Wyeast 1056",
      type: "yeast",
      manufacturer: "Wyeast",
      code: "1056",
      attenuation: 81,
      alcohol_tolerance: 12,
      min_temperature: 60,
      max_temperature: 72,
    },
  ];

  const mockGroupedIngredients = {
    grain: [mockIngredients[0]],
    hop: [mockIngredients[1]],
    yeast: [mockIngredients[2]],
    other: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default API mocks
    (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
      data: mockIngredients,
    });

    (ingredientServiceInstance.groupIngredientsByType as jest.Mock).mockReturnValue(
      mockGroupedIngredients
    );
  });

  describe("Initial render and loading", () => {
    it("renders the component with initial form", () => {
      render(<IngredientManager />);

      expect(screen.getByText("Ingredient Manager")).toBeInTheDocument();
      expect(screen.getByText("Add New Ingredient")).toBeInTheDocument();
      expect(screen.getByText("Existing Ingredients")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
        )
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Grain/Fermentable")).toBeInTheDocument();
    });

    it("loads existing ingredients on mount", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        expect(ApiService.ingredients.getAll).toHaveBeenCalledTimes(1);
        expect(
          ingredientServiceInstance.groupIngredientsByType
        ).toHaveBeenCalledWith(mockIngredients);
      });
    });

    it("displays ingredient count correctly", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        expect(screen.getByText("3 ingredients total")).toBeInTheDocument();
      });
    });

    it("handles API error during initial load", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

      render(<IngredientManager />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load existing ingredients")
        ).toBeInTheDocument();
      });
    });

    it("handles empty ingredient response", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
        data: { ingredients: [] },
      });
      (ingredientServiceInstance.groupIngredientsByType as jest.Mock).mockReturnValue({
        grain: [],
        hop: [],
        yeast: [],
        other: [],
      });

      render(<IngredientManager />);

      await waitFor(() => {
        expect(screen.getByText("0 ingredients total")).toBeInTheDocument();
        expect(
          screen.getByText("No ingredients in database yet.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form state management", () => {
    it("updates form fields when user types", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      await user.type(nameInput, "Test Ingredient");

      expect(nameInput).toHaveValue("Test Ingredient");
    });

    it("updates description field", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      const descriptionInput = screen.getByPlaceholderText(
        "Optional description of the ingredient..."
      );
      await user.type(descriptionInput, "Test description");

      expect(descriptionInput).toHaveValue("Test description");
    });

    it("clears error and success messages when user starts typing", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      // Trigger an error by submitting empty form
      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Ingredient name is required")
        ).toBeInTheDocument();
      });

      // Start typing should clear the error
      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      await user.type(nameInput, "Test");

      expect(
        screen.queryByText("Ingredient name is required")
      ).not.toBeInTheDocument();
    });

    it("resets form to initial state", () => {
      render(<IngredientManager />);

      // Fill in some form data
      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const resetButton = screen.getByText("Reset");
      fireEvent.click(resetButton);

      expect(nameInput).toHaveValue("");
    });
  });

  describe("Ingredient type handling", () => {
    it("shows grain-specific fields when grain type is selected", () => {
      render(<IngredientManager />);

      // Grain should be selected by default
      expect(screen.getByText("Grain Properties")).toBeInTheDocument();
      expect(screen.getByText("Grain Type")).toBeInTheDocument();
      expect(screen.getByText("Color (°Lovibond)")).toBeInTheDocument();
      expect(screen.getByText("Potential (SG)")).toBeInTheDocument();
    });

    it("shows hop-specific fields when hop type is selected", () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "hop" } });

      expect(screen.getByText("Hop Properties")).toBeInTheDocument();
      expect(screen.getByText("Alpha Acid (%)")).toBeInTheDocument();
    });

    it("shows yeast-specific fields when yeast type is selected", () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      expect(screen.getByText("Yeast Properties")).toBeInTheDocument();
      expect(screen.getByText("Manufacturer")).toBeInTheDocument();
      expect(screen.getByText("Code/Number")).toBeInTheDocument();
      expect(screen.getByText("Attenuation (%)")).toBeInTheDocument();
      expect(screen.getByText("Alcohol Tolerance (%)")).toBeInTheDocument();
      expect(screen.getByText("Min Temperature (°F)")).toBeInTheDocument();
      expect(screen.getByText("Max Temperature (°F)")).toBeInTheDocument();
    });

    it("hides type-specific fields when other type is selected", () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "other" } });

      expect(screen.queryByText("Grain Properties")).not.toBeInTheDocument();
      expect(screen.queryByText("Hop Properties")).not.toBeInTheDocument();
      expect(screen.queryByText("Yeast Properties")).not.toBeInTheDocument();
    });

    it("clears type-specific fields when changing ingredient type", () => {
      render(<IngredientManager />);

      // Fill in grain-specific field
      const colorInput = screen.getByPlaceholderText("e.g., 2.5");
      fireEvent.change(colorInput, { target: { value: "40" } });
      expect(colorInput).toHaveValue(40);

      // Switch to hop type
      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "hop" } });

      // Switch back to grain - field should be cleared
      fireEvent.change(typeSelect, { target: { value: "grain" } });
      const newColorInput = screen.getByPlaceholderText("e.g., 2.5");
      expect(newColorInput).toHaveValue(null);
    });
  });

  describe("Form validation", () => {
    it("validates required ingredient name", async () => {
      render(<IngredientManager />);

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Ingredient name is required")
        ).toBeInTheDocument();
      });
    });

    it("validates grain potential range", async () => {
      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Grain" } });

      const potentialInput = screen.getByPlaceholderText("e.g., 37");
      fireEvent.change(potentialInput, { target: { value: "60" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Grain potential should be between 20 (1.020) and 50 (1.050)"
          )
        ).toBeInTheDocument();
      });
    });

    it("validates grain color range", async () => {
      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Grain" } });

      const colorInput = screen.getByPlaceholderText("e.g., 2.5");
      fireEvent.change(colorInput, { target: { value: "700" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Grain color should be between 0 and 600°L")
        ).toBeInTheDocument();
      });
    });

    it("validates hop alpha acid range", async () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "hop" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Hop" } });

      const alphaAcidInput = screen.getByPlaceholderText("e.g., 5.5");
      fireEvent.change(alphaAcidInput, { target: { value: "30" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Alpha acid should be between 0.1% and 25%")
        ).toBeInTheDocument();
      });
    });

    it("validates yeast attenuation range", async () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Yeast" } });

      const attenuationInput = screen.getByPlaceholderText("e.g., 75");
      fireEvent.change(attenuationInput, { target: { value: "150" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Attenuation should be between 1% and 100%")
        ).toBeInTheDocument();
      });
    });

    it("validates yeast alcohol tolerance range", async () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Yeast" } });

      const alcoholToleranceInput = screen.getByPlaceholderText("e.g., 12");
      fireEvent.change(alcoholToleranceInput, { target: { value: "25" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Alcohol tolerance should be between 0% and 20%")
        ).toBeInTheDocument();
      });
    });

    it("validates yeast temperature range", async () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Yeast" } });

      const minTempInput = screen.getByPlaceholderText("e.g., 60");
      const maxTempInput = screen.getByPlaceholderText("e.g., 72");
      fireEvent.change(minTempInput, { target: { value: "80" } });
      fireEvent.change(maxTempInput, { target: { value: "70" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Minimum temperature must be less than maximum temperature"
          )
        ).toBeInTheDocument();
      });
    });

    it("shows multiple validation errors", async () => {
      render(<IngredientManager />);

      const potentialInput = screen.getByPlaceholderText("e.g., 37");
      const colorInput = screen.getByPlaceholderText("e.g., 2.5");
      fireEvent.change(potentialInput, { target: { value: "60" } });
      fireEvent.change(colorInput, { target: { value: "700" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorText = screen.getByText(/Ingredient name is required/);
        expect(errorText).toBeInTheDocument();
        expect(
          screen.getByText(/Grain potential should be between/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Grain color should be between/)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("submits valid grain ingredient successfully", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});
      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
        data: [...mockIngredients, { ingredient_id: 4, name: "New Grain" }],
      });

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      const grainTypeSelect = screen.getByDisplayValue("Select type...");
      const potentialInput = screen.getByPlaceholderText("e.g., 37");
      const colorInput = screen.getByPlaceholderText("e.g., 2.5");

      fireEvent.change(nameInput, { target: { value: "New Grain" } });
      fireEvent.change(grainTypeSelect, { target: { value: "base_malt" } });
      fireEvent.change(potentialInput, { target: { value: "37" } });
      fireEvent.change(colorInput, { target: { value: "2" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.ingredients.create).toHaveBeenCalledWith({
          name: "New Grain",
          type: "grain",
          grain_type: "base_malt",
          potential: 37,
          color: 2,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("New Grain has been added successfully!")
        ).toBeInTheDocument();
      });
    });

    it("submits valid hop ingredient successfully", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});

      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "hop" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      const alphaAcidInput = screen.getByPlaceholderText("e.g., 5.5");

      fireEvent.change(nameInput, { target: { value: "New Hop" } });
      fireEvent.change(alphaAcidInput, { target: { value: "6.5" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.ingredients.create).toHaveBeenCalledWith({
          name: "New Hop",
          type: "hop",
          alpha_acid: 6.5,
        });
      });
    });

    it("submits valid yeast ingredient successfully", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});

      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      const manufacturerInput = screen.getByPlaceholderText(
        "e.g., Wyeast, White Labs"
      );
      const codeInput = screen.getByPlaceholderText("e.g., 1056, WLP001");

      fireEvent.change(nameInput, { target: { value: "New Yeast" } });
      fireEvent.change(manufacturerInput, { target: { value: "Wyeast" } });
      fireEvent.change(codeInput, { target: { value: "1084" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.ingredients.create).toHaveBeenCalledWith({
          name: "New Yeast",
          type: "yeast",
          manufacturer: "Wyeast",
          code: "1084",
        });
      });
    });

    it("shows loading state during submission", async () => {
      // Make the API call hang to test loading state
      (ApiService.ingredients.create as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      expect(screen.getByText("Adding...")).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it("handles submission error", async () => {
      (ApiService.ingredients.create as jest.Mock).mockRejectedValue(
        new Error("Server error")
      );

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("handles submission error with fallback message", async () => {
      (ApiService.ingredients.create as jest.Mock).mockRejectedValue(
        new Error() // Error without message
      );

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to create ingredient. Please try again.")
        ).toBeInTheDocument();
      });
    });

    it("handles API error response", async () => {
      (ApiService.ingredients.create as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: "Ingredient already exists",
          },
        },
      });

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, {
        target: { value: "Duplicate Ingredient" },
      });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Ingredient already exists")
        ).toBeInTheDocument();
      });
    });

    it("resets form after successful submission", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      const potentialInput = screen.getByPlaceholderText("e.g., 37");

      fireEvent.change(nameInput, { target: { value: "Test Grain" } });
      fireEvent.change(potentialInput, { target: { value: "37" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Test Grain has been added successfully!")
        ).toBeInTheDocument();
      });

      // Form should be reset
      expect(nameInput).toHaveValue("");
      expect(potentialInput).toHaveValue(null);
    });

    it("refreshes ingredient list after successful submission", async () => {
      const newIngredientsList = [
        ...mockIngredients,
        { ingredient_id: 4, name: "New Ingredient", type: "grain" },
      ];

      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});
      (ApiService.ingredients.getAll as jest.Mock)
        .mockResolvedValueOnce({
          data: mockIngredients,
        })
        .mockResolvedValueOnce({
          data: newIngredientsList,
        });

      render(<IngredientManager />);

      await waitFor(() => {
        expect(screen.getByText("3 ingredients total")).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "New Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.ingredients.getAll).toHaveBeenCalledTimes(2);
      });
    });

    it("filters out empty fields from submission data", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      const descriptionInput = screen.getByPlaceholderText(
        "Optional description of the ingredient..."
      );

      fireEvent.change(nameInput, { target: { value: "Test Grain" } });
      fireEvent.change(descriptionInput, { target: { value: "" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.ingredients.create).toHaveBeenCalledWith({
          name: "Test Grain",
          type: "grain",
        });
      });
    });
  });

  describe("Search functionality", () => {
    const Fuse = require("fuse.js");

    beforeEach(() => {
      // Reset the Fuse mock
      Fuse.mockClear();
    });

    it("initializes search input", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search ingredients by name, description, manufacturer, type..."
        );
        expect(searchInput).toBeInTheDocument();
      });
    });

    it("updates search query when typing", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search ingredients by name, description, manufacturer, type..."
        );
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "cascade");

      expect(searchInput).toHaveValue("cascade");
    });

    it("shows clear search button when search has value", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search ingredients by name, description, manufacturer, type..."
        );
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "test");

      expect(screen.getByTitle("Clear search")).toBeInTheDocument();
    });

    it("clears search when clear button is clicked", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search ingredients by name, description, manufacturer, type..."
        );
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "test");

      const clearButton = screen.getByTitle("Clear search");
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue("");
    });

    it("shows search help text when searching", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search ingredients by name, description, manufacturer, type..."
        );
        expect(searchInput).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "test");

      expect(
        screen.getByText("Fuzzy search enabled - all sections expanded to show results")
      ).toBeInTheDocument();
    });

    it("shows filtered count when searching", async () => {
      const mockFuseInstance = {
        search: jest.fn().mockReturnValue([
          {
            item: mockIngredients[1], // Cascade hop
            score: 0.1,
            matches: [],
          },
        ]),
      };
      Fuse.mockImplementation(() => mockFuseInstance);

      const user = userEvent.setup();
      render(<IngredientManager />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("3 ingredients total")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "cascade");

      await waitFor(() => {
        expect(
          screen.getByText("Showing 1 of 3 ingredients")
        ).toBeInTheDocument();
        expect(screen.getByText('matching "cascade"')).toBeInTheDocument();
      });
    });

    it("shows no results message when search yields no results", async () => {
      const mockFuseInstance = {
        search: jest.fn().mockReturnValue([]),
      };
      Fuse.mockImplementation(() => mockFuseInstance);

      const user = userEvent.setup();
      render(<IngredientManager />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("3 ingredients total")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        "Search ingredients by name, description, manufacturer, type..."
      );

      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(
          screen.getByText(
            'No ingredients match your search for "nonexistent".'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Ingredient display", () => {
    it("displays grouped ingredients by type", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        expect(screen.getByText("Grains & Fermentables")).toBeInTheDocument();
        expect(screen.getByText("Hops")).toBeInTheDocument();
        // Use a more specific selector for the Yeast section header
        const yeastSection = document.querySelector(".ingredient-type-title");
        const yeastHeader = Array.from(
          document.querySelectorAll(".ingredient-type-title")
        ).find((el) => el.textContent.includes("Yeast"));
        expect(yeastHeader).toBeInTheDocument();
      });
    });

    it("shows ingredient count for each type", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        const typeCounts = screen.getAllByText(/\(\s*1\s*\)/);
        expect(typeCounts.length).toBeGreaterThan(0);
      });
    });

    it("displays ingredient details correctly", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      // Wait for ingredients to load
      await waitFor(() => {
        expect(screen.getByText("Grains & Fermentables")).toBeInTheDocument();
      });

      // Expand grain section to see "Pale Malt"
      const grainHeader = screen.getByText("Grains & Fermentables").closest(".ingredient-type-header");
      await user.click(grainHeader);

      // Expand hop section to see "Cascade"
      const hopHeader = screen.getByText("Hops").closest(".ingredient-type-header");
      await user.click(hopHeader);

      // Expand yeast section to see "Wyeast 1056"
      const yeastHeaders = screen.getAllByText("Yeast");
      const yeastHeader = yeastHeaders.find(el => el.closest(".ingredient-type-header"))?.closest(".ingredient-type-header");
      await user.click(yeastHeader);

      // Now check for ingredient names
      expect(screen.getByText("Pale Malt")).toBeInTheDocument();
      expect(screen.getByText("Cascade")).toBeInTheDocument();
      expect(screen.getByText("Wyeast 1056")).toBeInTheDocument();
    });

    it("shows ingredient properties based on type", async () => {
      const user = userEvent.setup();
      render(<IngredientManager />);

      // Wait for ingredients to load
      await waitFor(() => {
        expect(screen.getByText("Grains & Fermentables")).toBeInTheDocument();
      });

      // Expand grain section to see grain properties
      const grainHeader = screen.getByText("Grains & Fermentables").closest(".ingredient-type-header");
      await user.click(grainHeader);

      // Check grain properties
      expect(screen.getByText("Color: 2.5°L")).toBeInTheDocument();
      expect(
        screen.getByText("Potential: 37 ppg (points per pound per gallon)")
      ).toBeInTheDocument();

      // Expand hop section to see hop properties
      const hopHeader = screen.getByText("Hops").closest(".ingredient-type-header");
      await user.click(hopHeader);

      // Check hop properties
      expect(screen.getByText("AA: 5.5%")).toBeInTheDocument();

      // Expand yeast section to see yeast properties
      const yeastHeaders = screen.getAllByText("Yeast");
      const yeastHeader = yeastHeaders.find(el => el.closest(".ingredient-type-header"))?.closest(".ingredient-type-header");
      await user.click(yeastHeader);

      // Check yeast properties
      expect(screen.getByText("Attenuation: 81%")).toBeInTheDocument();
      expect(screen.getByText("Mfg: Wyeast")).toBeInTheDocument();
      expect(screen.getByText("Code: 1056")).toBeInTheDocument();
    });

    it("applies correct type colors", async () => {
      render(<IngredientManager />);

      await waitFor(() => {
        const grainHeader = screen.getByText("Grains & Fermentables");
        const hopHeader = screen.getByText("Hops");
        // Use a more specific selector for the Yeast header to avoid the dropdown option
        const yeastHeaderText = Array.from(
          document.querySelectorAll(".ingredient-type-title")
        ).find((el) => el.textContent.includes("Yeast"));

        expect(grainHeader).toHaveStyle({ color: "rgb(139, 69, 19)" });
        expect(hopHeader).toHaveStyle({ color: "rgb(34, 139, 34)" });
        expect(yeastHeaderText).toHaveStyle({ color: "rgb(218, 165, 32)" });
      });
    });

    it("shows empty state when no ingredients exist", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({ data: [] });
      (ingredientServiceInstance.groupIngredientsByType as jest.Mock).mockReturnValue({
        grain: [],
        hop: [],
        yeast: [],
        other: [],
      });

      render(<IngredientManager />);

      await waitFor(() => {
        expect(
          screen.getByText("No ingredients in database yet.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Grain type dropdown options", () => {
    it("shows all grain type options", () => {
      render(<IngredientManager />);

      const grainTypeSelect = screen.getByDisplayValue("Select type...");
      const options = Array.from(grainTypeSelect.querySelectorAll("option"));

      expect(options.map((option) => option.value)).toEqual([
        "",
        "base_malt",
        "specialty_malt",
        "caramel_crystal",
        "roasted",
        "smoked",
        "adjunct_grain",
      ]);
    });

    it("shows correct grain type labels", () => {
      render(<IngredientManager />);

      const grainTypeSelect = screen.getByDisplayValue("Select type...");
      const options = Array.from(grainTypeSelect.querySelectorAll("option"));

      expect(options.map((option) => option.textContent)).toEqual([
        "Select type...",
        "Base Malt",
        "Specialty Malt",
        "Caramel/Crystal",
        "Roasted",
        "Smoked",
        "Adjunct",
      ]);
    });
  });

  describe("Field constraints and placeholders", () => {
    it("sets correct input constraints for numeric fields", () => {
      render(<IngredientManager />);

      const colorInput = screen.getByPlaceholderText("e.g., 2.5");
      expect(colorInput).toHaveAttribute("step", "0.5");
      expect(colorInput).toHaveAttribute("min", "0");
      expect(colorInput).toHaveAttribute("max", "600");

      const potentialInput = screen.getByPlaceholderText("e.g., 37");
      expect(potentialInput).toHaveAttribute("step", "1");
      expect(potentialInput).toHaveAttribute("min", "1");
      expect(potentialInput).toHaveAttribute("max", "100");
    });

    it("sets correct placeholders", () => {
      render(<IngredientManager />);

      expect(
        screen.getByPlaceholderText(
          "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
        )
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g., 2.5")).toBeInTheDocument();
    });

    it("sets correct yeast field constraints", () => {
      render(<IngredientManager />);

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      fireEvent.change(typeSelect, { target: { value: "yeast" } });

      const attenuationInput = screen.getByPlaceholderText("e.g., 75");
      expect(attenuationInput).toHaveAttribute("step", "1");
      expect(attenuationInput).toHaveAttribute("min", "1");
      expect(attenuationInput).toHaveAttribute("max", "100");

      const alcoholToleranceInput = screen.getByPlaceholderText("e.g., 12");
      expect(alcoholToleranceInput).toHaveAttribute("step", "0.5");
      expect(alcoholToleranceInput).toHaveAttribute("min", "0");
      expect(alcoholToleranceInput).toHaveAttribute("max", "20");

      const minTempInput = screen.getByPlaceholderText("e.g., 60");
      expect(minTempInput).toHaveAttribute("step", "1");
      expect(minTempInput).toHaveAttribute("min", "50");
      expect(minTempInput).toHaveAttribute("max", "100");
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("handles malformed API response", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
        data: "invalid data structure",
      });

      render(<IngredientManager />);

      await waitFor(() => {
        // With invalid data structure, ingredients becomes undefined || [] = []
        expect(
          ingredientServiceInstance.groupIngredientsByType
        ).toHaveBeenCalledWith([]);
      });
    });

    it("handles null API response", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
        data: null,
      });

      render(<IngredientManager />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load existing ingredients")
        ).toBeInTheDocument();
      });
    });

    it("handles missing ingredient service", async () => {
      (ingredientServiceInstance.groupIngredientsByType as jest.Mock).mockImplementation(
        () => {
          throw new Error("Service unavailable");
        }
      );

      // Should not crash the component
      render(<IngredientManager />);

      await waitFor(() => {
        expect(screen.getByText("Ingredient Manager")).toBeInTheDocument();
      });
    });

    it("handles form inputs with name attributes", () => {
      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      expect(nameInput).toHaveAttribute("name", "name");

      const typeSelect = screen.getByDisplayValue("Grain/Fermentable");
      expect(typeSelect).toHaveAttribute("name", "type");

      const descriptionInput = screen.getByPlaceholderText(
        "Optional description of the ingredient..."
      );
      expect(descriptionInput).toHaveAttribute("name", "description");
    });
  });

  describe("Error handling and messages", () => {
    it("displays error messages with proper styling", async () => {
      render(<IngredientManager />);

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorDiv = screen.getByText("Ingredient name is required");
        expect(errorDiv.closest(".alert")).toHaveClass("alert-error");
      });
    });

    it("displays success messages with proper styling", async () => {
      (ApiService.ingredients.create as jest.Mock).mockResolvedValue({});

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        const successDiv = screen.getByText(
          "Test Ingredient has been added successfully!"
        );
        expect(successDiv.closest(".alert")).toHaveClass("alert-success");
      });
    });

    it("handles network timeout during submission", async () => {
      (ApiService.ingredients.create as jest.Mock).mockRejectedValue(
        new Error("Network timeout")
      );

      render(<IngredientManager />);

      const nameInput = screen.getByPlaceholderText(
        "e.g., Cascade Hops, Pilsner Malt, Wyeast 1056"
      );
      fireEvent.change(nameInput, { target: { value: "Test Ingredient" } });

      const submitButton = screen.getByText("Add Ingredient");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Network timeout")).toBeInTheDocument();
      });
    });
  });
});
