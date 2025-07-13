// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { screen, fireEvent, waitFor } from "@testing-library/react";
import EditBrewSession from "../../src/components/BrewSessions/EditBrewSession";
import BrewSessionService from "../../src/services/Brewing/BrewSessionService";
import { invalidateBrewSessionCaches } from "../../src/services/CacheManager";
import { renderWithProviders, mockData } from "../testUtils";

// Mock the CSS import
jest.mock("../../src/styles/BrewSessions.css", () => ({}));

// Mock services and cache manager
jest.mock("../../src/services/Brewing/BrewSessionService", () => ({
  fetchBrewSession: jest.fn(),
  updateBrewSession: jest.fn(),
}));

jest.mock("../../src/services/CacheManager", () => ({
  invalidateBrewSessionCaches: {
    onUpdated: jest.fn(),
  },
}));

// Mock useNavigate and useParams
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: "1" }),
}));

// Create mock data
const mockSession = mockData.brewSession({
  session_id: "1",
  name: "Test Session",
  status: "planned",
  brew_date: "2024-06-01",
  mash_temp: 150,
  actual_og: 1.05,
  actual_fg: 1.01,
  actual_abv: 5.2,
  actual_efficiency: 75,
  fermentation_start_date: "2024-06-02",
  fermentation_end_date: "2024-06-10",
  packaging_date: "2024-06-15",
  tasting_notes: "Fruity and crisp.",
  batch_rating: "4",
  recipe_id: "123",
});

describe("EditBrewSession", () => {
  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();

    // Default successful session fetch
    (BrewSessionService.fetchBrewSession as jest.Mock).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("Loading State", () => {
    it("renders loading state initially", async () => {
      (BrewSessionService.fetchBrewSession as jest.Mock).mockReturnValue(
        new Promise(() => {})
      ); // never resolves

      renderWithProviders(<EditBrewSession />);

      expect(screen.getByText(/Loading brew session/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("renders error if fetch fails", async () => {
      (BrewSessionService.fetchBrewSession as jest.Mock).mockRejectedValue(
        new Error("Failed to load brew session data")
      );

      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load brew session data/i)
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching brew session:",
        expect.any(Error)
      );
    });

    it("shows error if update fails", async () => {
      (BrewSessionService.updateBrewSession as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Update failed/i)).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error updating brew session:",
        expect.any(Error)
      );
    });

    it("dismisses error message when clicking the close button", async () => {
      (BrewSessionService.updateBrewSession as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toBeInTheDocument();
      });

      // Submit form to trigger error
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Update failed/i)).toBeInTheDocument();
      });

      // Click the close button (×)
      const closeButton = screen.getByRole("button", { name: /×/i });
      fireEvent.click(closeButton);

      // Error should be dismissed
      expect(screen.queryByText(/Update failed/i)).not.toBeInTheDocument();
    });

    it("redirects to sessions list if session not found", async () => {
      const error = new Error("Session not found") as any;
      error.response = { status: 404 };
      (BrewSessionService.fetchBrewSession as jest.Mock).mockRejectedValue(error);

      jest.useFakeTimers();
      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        expect(screen.getByText(/Session not found/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Redirecting to brew sessions list/i)
        ).toBeInTheDocument();
      });

      // Fast-forward the timer for redirect
      jest.runAllTimers();

      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions");

      jest.useRealTimers();
    });
  });

  describe("Form Rendering", () => {
    it("renders form with fetched session data", async () => {
      renderWithProviders(<EditBrewSession />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText(/Loading brew session/i)
        ).not.toBeInTheDocument();
      });

      // Check page title
      expect(screen.getByText("Edit Brew Session")).toBeInTheDocument();

      // Check form sections
      expect(screen.getByText("Basic Information")).toBeInTheDocument();
      expect(screen.getByText("Metrics and Timeline")).toBeInTheDocument();
      expect(screen.getByText("Tasting and Evaluation")).toBeInTheDocument();

      // Check form fields are populated with correct values
      await waitFor(() => {
        // Basic Information
        const nameInput = screen.getByLabelText(/Session Name/i);
        expect(nameInput).toHaveValue(mockSession.name);

        const statusSelect = screen.getByLabelText(/Status/i);
        expect(statusSelect).toHaveValue(mockSession.status);

        const brewDateInput = screen.getByLabelText(/Brew Date/i);
        expect(brewDateInput).toHaveValue(mockSession.brew_date);

        const mashTempInput = screen.getByLabelText(/Mash Temperature/i);
        expect(mashTempInput).toHaveValue((mockSession as any).mash_temp);

        // Metrics
        expect(screen.getByLabelText(/Original Gravity/i)).toHaveValue(
          mockSession.actual_og
        );
        expect(screen.getByLabelText(/Final Gravity/i)).toHaveValue(
          mockSession.actual_fg
        );
        expect(screen.getByLabelText(/ABV/i)).toHaveValue(
          mockSession.actual_abv
        );
        expect(screen.getByLabelText(/Efficiency/i)).toHaveValue(
          (mockSession as any).actual_efficiency
        );

        // Dates
        expect(screen.getByLabelText(/Fermentation Start Date/i)).toHaveValue(
          (mockSession as any).fermentation_start_date
        );
        expect(screen.getByLabelText(/Fermentation End Date/i)).toHaveValue(
          (mockSession as any).fermentation_end_date
        );
        expect(screen.getByLabelText(/Packaging Date/i)).toHaveValue(
          (mockSession as any).packaging_date
        );

        // Tasting and Evaluation
        expect(screen.getByLabelText(/Tasting Notes/i)).toHaveValue(
          (mockSession as any).tasting_notes
        );
        expect(screen.getByLabelText(/Batch Rating/i)).toHaveValue(
          (mockSession as any).batch_rating
        );
      });

      // Check for action buttons
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Save Changes/i })
      ).toBeInTheDocument();
    });

    it("renders all status options", async () => {
      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText(/Status/i);
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

    it("renders batch rating options", async () => {
      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        const ratingSelect = screen.getByLabelText(/Batch Rating/i);
        const options = ratingSelect.querySelectorAll("option");

        expect(options).toHaveLength(6); // Including empty option
        expect(options[0]).toHaveTextContent("Select Rating");
        expect(options[1]).toHaveTextContent("1 - Poor");
        expect(options[2]).toHaveTextContent("2 - Fair");
        expect(options[3]).toHaveTextContent("3 - Good");
        expect(options[4]).toHaveTextContent("4 - Very Good");
        expect(options[5]).toHaveTextContent("5 - Excellent");
      });
    });
  });

  describe("Form Interactions", () => {
    it("handles form field changes correctly", async () => {
      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      // Test changing various form fields
      const nameInput = screen.getByLabelText(/Session Name/i);
      fireEvent.change(nameInput, {
        target: { value: "Updated Session Name" },
      });
      expect(nameInput).toHaveValue("Updated Session Name");

      const statusSelect = screen.getByLabelText(/Status/i);
      fireEvent.change(statusSelect, { target: { value: "completed" } });
      expect(statusSelect).toHaveValue("completed");

      const mashTempInput = screen.getByLabelText(/Mash Temperature/i);
      fireEvent.change(mashTempInput, { target: { value: "155" } });
      expect(mashTempInput).toHaveValue(155);

      const tastingNotesInput = screen.getByLabelText(/Tasting Notes/i);
      fireEvent.change(tastingNotesInput, {
        target: { value: "New tasting notes" },
      });
      expect(tastingNotesInput).toHaveValue("New tasting notes");

      const ogInput = screen.getByLabelText(/Original Gravity/i);
      fireEvent.change(ogInput, { target: { value: "1.065" } });
      expect(ogInput).toHaveValue(1.065);

      const ratingSelect = screen.getByLabelText(/Batch Rating/i);
      fireEvent.change(ratingSelect, { target: { value: "3" } });
      expect(ratingSelect).toHaveValue("3");
    });
  });

  describe("Form Submission", () => {
    it("disables form controls while submitting", async () => {
      (BrewSessionService.updateBrewSession as jest.Mock).mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve(mockSession), 100))
      );

      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      // Verify button shows submitting state
      expect(submitButton).toHaveTextContent("Saving...");
      expect(submitButton).toBeDisabled();

      // Check all form controls are disabled
      expect(screen.getByLabelText(/Session Name/i)).toBeDisabled();
      expect(screen.getByLabelText(/Status/i)).toBeDisabled();
      expect(screen.getByLabelText(/Brew Date/i)).toBeDisabled();
      expect(screen.getByLabelText(/Mash Temperature/i)).toBeDisabled();
      expect(screen.getByLabelText(/Original Gravity/i)).toBeDisabled();
      expect(screen.getByLabelText(/Tasting Notes/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
    });

    it("properly formats and submits data when form is submitted", async () => {
      // For this test, let's use a different sessionId
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "123" });
      (BrewSessionService.updateBrewSession as jest.Mock).mockResolvedValue(mockSession);

      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      // Update some form fields
      const nameInput = screen.getByLabelText(/Session Name/i);
      fireEvent.change(nameInput, { target: { value: "Updated Session" } });

      const ogInput = screen.getByLabelText(/Original Gravity/i);
      fireEvent.change(ogInput, { target: { value: "1.065" } });

      const efficiencyInput = screen.getByLabelText(/Efficiency/i);
      fireEvent.change(efficiencyInput, { target: { value: "78.5" } });

      const brewDateInput = screen.getByLabelText(/Brew Date/i);
      fireEvent.change(brewDateInput, { target: { value: "" } });

      // Submit the form
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      // Check that service was called with proper data
      await waitFor(() => {
        expect(BrewSessionService.updateBrewSession).toHaveBeenCalledWith(
          "123",
          expect.objectContaining({
            name: "Updated Session",
            actual_og: 1.065,
            actual_efficiency: 78.5,
            status: "planned",
            // brew_date should be removed since it's empty
          })
        );

        // Should not contain the empty brew_date
        const updateCall =
          (BrewSessionService.updateBrewSession as jest.Mock).mock.calls[0][1];
        expect(updateCall).not.toHaveProperty("brew_date");

        // Check numeric values are converted to numbers
        expect(typeof updateCall.actual_og).toBe("number");
        expect(updateCall.actual_og).toBe(1.065);
        expect(typeof updateCall.actual_efficiency).toBe("number");
        expect(updateCall.actual_efficiency).toBe(78.5);
      });

      // Check cache invalidation
      expect(invalidateBrewSessionCaches.onUpdated).toHaveBeenCalledWith({
        session_id: "123",
        recipe_id: mockSession.recipe_id,
      });

      // Check navigation
      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/123");

      // Reset the mock for other tests
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "1" });
    });

    it("re-enables form after error", async () => {
      (BrewSessionService.updateBrewSession as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Update failed/i)).toBeInTheDocument();
      });

      // Form should be re-enabled
      expect(screen.getByLabelText(/Session Name/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Status/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Brew Date/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Mash Temperature/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Original Gravity/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Tasting Notes/i)).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent("Save Changes");
    });
  });

  describe("Navigation", () => {
    it("navigates to session view on cancel", async () => {
      // Set specific sessionId for this test
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "123" });

      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // Check navigation was called
      expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/123");

      // Reset the mock for other tests
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "1" });
    });

    it("navigates to session view after successful update", async () => {
      // Set specific sessionId for this test
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "123" });
      (BrewSessionService.updateBrewSession as jest.Mock).mockResolvedValue(mockSession);

      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      // Submit form
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      // Check navigation
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/brew-sessions/123");
      });

      // Reset the mock for other tests
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "1" });
    });
  });

  describe("Edge Cases", () => {
    it("handles session with missing optional fields", async () => {
      const minimalSession = mockData.brewSession({
        session_id: "1",
        name: "Minimal Session",
        status: "planned",
        // Missing all optional fields
        brew_date: undefined,
        mash_temp: undefined,
        actual_og: undefined,
        actual_fg: undefined,
        actual_abv: undefined,
        actual_efficiency: undefined,
        fermentation_start_date: undefined,
        fermentation_end_date: undefined,
        packaging_date: undefined,
        tasting_notes: undefined,
        batch_rating: undefined,
      });

      (BrewSessionService.fetchBrewSession as jest.Mock).mockResolvedValue(minimalSession);

      renderWithProviders(<EditBrewSession />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Session Name/i);
        expect(nameInput).toHaveValue("Minimal Session");
      });

      // Check that optional fields are empty
      expect(screen.getByLabelText(/Brew Date/i)).toHaveValue("");
      expect(screen.getByLabelText(/Mash Temperature/i)).toHaveValue(null);
      expect(screen.getByLabelText(/Original Gravity/i)).toHaveValue(null);
      expect(screen.getByLabelText(/Final Gravity/i)).toHaveValue(null);
      expect(screen.getByLabelText(/ABV/i)).toHaveValue(null);
      expect(screen.getByLabelText(/Efficiency/i)).toHaveValue(null);
      expect(screen.getByLabelText(/Fermentation Start Date/i)).toHaveValue("");
      expect(screen.getByLabelText(/Fermentation End Date/i)).toHaveValue("");
      expect(screen.getByLabelText(/Packaging Date/i)).toHaveValue("");
      expect(screen.getByLabelText(/Tasting Notes/i)).toHaveValue("");
      expect(screen.getByLabelText(/Batch Rating/i)).toHaveValue("");
    });

    it("properly handles empty date and numeric fields during submission", async () => {
      // Set specific sessionId for this test
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "123" });
      (BrewSessionService.updateBrewSession as jest.Mock).mockResolvedValue(mockSession);

      renderWithProviders(<EditBrewSession />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Session Name/i)).toHaveValue(
          mockSession.name
        );
      });

      // Clear some fields
      const brewDateInput = screen.getByLabelText(/Brew Date/i);
      fireEvent.change(brewDateInput, { target: { value: "" } });

      const abvInput = screen.getByLabelText(/ABV/i);
      fireEvent.change(abvInput, { target: { value: "" } });

      const ogInput = screen.getByLabelText(/Original Gravity/i);
      fireEvent.change(ogInput, { target: { value: "" } });

      // Submit the form
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      fireEvent.click(submitButton);

      // Check updateBrewSession was called with proper data transformation
      await waitFor(() => {
        const updateCall =
          (BrewSessionService.updateBrewSession as jest.Mock).mock.calls[0][1];
        expect(updateCall).not.toHaveProperty("brew_date"); // Should be removed
        expect(updateCall).not.toHaveProperty("actual_abv"); // Should be removed
        expect(updateCall).not.toHaveProperty("actual_og"); // Should be removed
        expect(updateCall).toHaveProperty("name", mockSession.name); // Should still exist
      });

      // Reset the mock for other tests
      jest
        .spyOn(require("react-router"), "useParams")
        .mockReturnValue({ sessionId: "1" });
    });
  });
});
