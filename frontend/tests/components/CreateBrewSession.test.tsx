// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { screen, fireEvent, waitFor } from "@testing-library/react";
import CreateBrewSession from "../../src/components/BrewSessions/CreateBrewSession";
import BrewSessionService from "../../src/services/BrewSessionService";
import RecipeService from "../../src/services/RecipeService";
import { invalidateBrewSessionCaches } from "../../src/services/CacheManager";
import { renderWithProviders, mockData } from "../testUtils";

// Mock the CSS import
jest.mock("../../src/styles/BrewSessions.css", () => ({}));

// Mock services and cache manager
jest.mock("../../src/services/BrewSessionService");
jest.mock("../../src/services/RecipeService");
jest.mock("../../src/services/CacheManager", () => ({
  invalidateBrewSessionCaches: {
    onCreated: jest.fn(),
  },
}));

// Mock useNavigate and useLocation
const mockNavigate = jest.fn();
const mockLocation = { search: "?recipeId=123" };

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Create mock data using existing patterns
const mockRecipe = mockData.recipe({
  recipe_id: "123",
  name: "Test Recipe",
  style: "IPA",
  batch_size: 5,
  estimated_og: 1.055,
  estimated_fg: 1.012,
  estimated_abv: 6.5,
  estimated_ibu: 45,
  estimated_srm: 8,
});

const mockBrewSession = mockData.brewSession({
  session_id: "42",
  recipe_id: "123",
  name: "Test Recipe - 6/9/2025",
});

describe("CreateBrewSession", () => {
  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();

    // Reset useLocation mock to default
    jest.spyOn(require("react-router"), "useLocation").mockReturnValue({
      search: "?recipeId=123",
    });

    // Default successful recipe fetch
    (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(mockRecipe);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("Loading State", () => {
    it("should show loading message initially", () => {
      (RecipeService.fetchRecipe as jest.Mock).mockReturnValue(new Promise(() => {})); // Never resolves

      renderWithProviders(<CreateBrewSession />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("No Recipe Selected", () => {
    it("should show warning when no recipeId in query", () => {
      jest.spyOn(require("react-router"), "useLocation").mockReturnValue({
        search: "",
      });

      renderWithProviders(<CreateBrewSession />);

      expect(
        screen.getByText("No recipe selected. Please select a recipe to brew.")
      ).toBeInTheDocument();
    });
  });

  describe("Recipe Fetch Error", () => {
    it("should show error message when recipe fetch fails", async () => {
      (RecipeService.fetchRecipe as jest.Mock).mockRejectedValue(
        new Error("Failed to load recipe details")
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Failed to load recipe details"
        );
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching recipe:",
        expect.any(Error)
      );
    });
  });

  describe("Successful Recipe Loading", () => {
    it("should render page title", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Start New Brew Session")).toBeInTheDocument();
      });
    });

    it("should render recipe preview with correct information", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveTextContent("Test Recipe");
        expect(preview).toHaveTextContent("IPA");
        expect(preview).toHaveTextContent("Batch Size: 5 gallons");
        expect(preview).toHaveTextContent("Est. OG: 1.055");
        expect(preview).toHaveTextContent("Est. FG: 1.012");
        expect(preview).toHaveTextContent("Est. ABV: 6.5%");
        expect(preview).toHaveTextContent("Est. IBU: 45");
        expect(preview).toHaveTextContent("Est. SRM: 8.0");
      });
    });

    it("should render form with all required fields", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        expect(screen.getByLabelText("Session Name")).toBeInTheDocument();
        expect(screen.getByLabelText("Brew Date")).toBeInTheDocument();
        expect(screen.getByLabelText("Status")).toBeInTheDocument();
        expect(screen.getByLabelText("Brew Day Notes")).toBeInTheDocument();
      });
    });

    it("should pre-populate session name with recipe name and current date", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const sessionNameInput = screen.getByLabelText("Session Name");
        expect((sessionNameInput as HTMLInputElement).value).toMatch(
          /Test Recipe - \d{1,2}\/\d{1,2}\/\d{4}/
        );
      });
    });

    it("should pre-populate brew date with current date", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const brewDateInput = screen.getByLabelText("Brew Date");
        expect((brewDateInput as HTMLInputElement).value).toBe(
          new Date().toISOString().split("T")[0]
        );
      });
    });

    it("should have planned as default status", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText("Status");
        expect((statusSelect as HTMLInputElement).value).toBe("planned");
      });
    });

    it("should render all status options", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText("Status");
        const options = statusSelect.querySelectorAll("option");

        expect(options).toHaveLength(6);
        expect(options[0]).toHaveTextContent("Planned");
        expect(options[1]).toHaveTextContent("In Progress");
        expect(options[2]).toHaveTextContent("Fermenting");
        expect(options[3]).toHaveTextContent("Conditioning");
        expect(options[4]).toHaveTextContent("Completed");
        expect(options[5]).toHaveTextContent("Archived");
      });
    });

    it("should render form action buttons", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
        expect(screen.getByText("Start Brew Session")).toBeInTheDocument();
      });
    });
  });

  describe("Form Interactions", () => {
    it("should update session name when changed", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const sessionNameInput = screen.getByLabelText("Session Name");
        fireEvent.change(sessionNameInput, {
          target: { value: "My Custom Session Name" },
        });
        expect((sessionNameInput as HTMLInputElement).value).toBe("My Custom Session Name");
      });
    });

    it("should update brew date when changed", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const brewDateInput = screen.getByLabelText("Brew Date");
        fireEvent.change(brewDateInput, {
          target: { value: "2024-12-25" },
        });
        expect((brewDateInput as HTMLInputElement).value).toBe("2024-12-25");
      });
    });

    it("should update status when changed", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText("Status");
        fireEvent.change(statusSelect, {
          target: { value: "in-progress" },
        });
        expect((statusSelect as HTMLInputElement).value).toBe("in-progress");
      });
    });

    it("should update notes when changed", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const notesTextarea = screen.getByLabelText("Brew Day Notes");
        fireEvent.change(notesTextarea, {
          target: { value: "These are my brew notes" },
        });
        expect((notesTextarea as HTMLInputElement).value).toBe("These are my brew notes");
      });
    });
  });

  describe("Form Submission", () => {
    beforeEach(() => {
      (BrewSessionService.createBrewSession as jest.Mock).mockResolvedValue(mockBrewSession);
    });

    it("should submit form with correct data and navigate to new session", async () => {
      renderWithProviders(<CreateBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      // Update session name
      const sessionNameInput = screen.getByLabelText("Session Name");
      fireEvent.change(sessionNameInput, {
        target: { value: "My Brew Session" },
      });

      // Submit form
      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(BrewSessionService.createBrewSession).toHaveBeenCalledWith(
          expect.objectContaining({
            recipe_id: "123",
            name: "My Brew Session",
            brew_date: new Date().toISOString().split("T")[0],
            status: "planned",
            notes: "",
          })
        );

        expect(invalidateBrewSessionCaches.onCreated).toHaveBeenCalledWith({
          session_id: "42",
          recipe_id: "123",
        });

        expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/42");
      });
    });

    it("should show creating state during submission", async () => {
      // Mock a delayed response
      (BrewSessionService.createBrewSession as jest.Mock).mockReturnValue(
        new Promise((resolve) =>
          setTimeout(() => resolve(mockBrewSession), 100)
        )
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      // Should show creating state
      expect(screen.getByText("Creating...")).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it("should disable form fields during submission", async () => {
      // Mock a delayed response
      (BrewSessionService.createBrewSession as jest.Mock).mockReturnValue(
        new Promise((resolve) =>
          setTimeout(() => resolve(mockBrewSession), 100)
        )
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      // All form fields should be disabled
      expect(screen.getByLabelText("Session Name")).toBeDisabled();
      expect(screen.getByLabelText("Brew Date")).toBeDisabled();
      expect(screen.getByLabelText("Status")).toBeDisabled();
      expect(screen.getByLabelText("Brew Day Notes")).toBeDisabled();
      expect(screen.getByText("Cancel")).toBeDisabled();
    });
  });

  describe("Form Submission Errors", () => {
    it("should show error message when submission fails", async () => {
      (BrewSessionService.createBrewSession as jest.Mock).mockRejectedValue(
        new Error("Create failed")
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Create failed");
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error creating brew session:",
        expect.any(Error)
      );
    });

    it("should allow dismissing error message", async () => {
      (BrewSessionService.createBrewSession as jest.Mock).mockRejectedValue(
        new Error("Create failed")
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Create failed");
      });

      // Dismiss error
      const dismissButton = screen.getByText("×");
      fireEvent.click(dismissButton);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("should re-enable form after error", async () => {
      (BrewSessionService.createBrewSession as jest.Mock).mockRejectedValue(
        new Error("Create failed")
      );

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const submitButton = screen.getByText("Start Brew Session");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Create failed");
      });

      // Form should be re-enabled
      expect(screen.getByLabelText("Session Name")).not.toBeDisabled();
      expect(screen.getByLabelText("Brew Date")).not.toBeDisabled();
      expect(screen.getByLabelText("Status")).not.toBeDisabled();
      expect(screen.getByLabelText("Brew Day Notes")).not.toBeDisabled();
      expect(screen.getByText("Cancel")).not.toBeDisabled();
      expect(screen.getByText("Start Brew Session")).not.toBeDisabled();
    });
  });

  describe("Navigation", () => {
    it("should navigate back when cancel button is clicked", async () => {
      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Test Recipe");
      });

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("API Integration", () => {
    it("should call RecipeService.fetchRecipe with correct recipeId", () => {
      renderWithProviders(<CreateBrewSession />);

      expect(RecipeService.fetchRecipe).toHaveBeenCalledWith("123");
    });

    it("should not call RecipeService.fetchRecipe when no recipeId", () => {
      jest.spyOn(require("react-router"), "useLocation").mockReturnValue({
        search: "",
      });

      renderWithProviders(<CreateBrewSession />);

      expect(RecipeService.fetchRecipe).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle recipe with missing optional fields", async () => {
      const minimalRecipe = mockData.recipe({
        recipe_id: "123",
        name: "Minimal Recipe",
        batch_size: 5,
        // Missing optional fields like estimated_og, etc.
        estimated_og: undefined,
        estimated_fg: undefined,
        estimated_abv: undefined,
        estimated_ibu: undefined,
        estimated_srm: undefined,
        style: undefined,
      });

      (RecipeService.fetchRecipe as jest.Mock).mockResolvedValue(minimalRecipe);

      renderWithProviders(<CreateBrewSession />);

      await waitFor(() => {
        const preview = screen.getByTestId("recipe-preview");
        expect(preview).toHaveTextContent("Minimal Recipe");
        expect(preview).toHaveTextContent("Batch Size: 5 gallons");
        // Should not show the optional fields
        expect(preview).not.toHaveTextContent("Est. OG:");
        expect(preview).not.toHaveTextContent("Est. FG:");
        expect(preview).not.toHaveTextContent("Est. ABV:");
        expect(preview).not.toHaveTextContent("Est. IBU:");
        expect(preview).not.toHaveTextContent("Est. SRM:");
      });
    });
  });
});
