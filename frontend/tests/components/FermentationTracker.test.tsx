import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import FermentationTracker from "../../src/components/BrewSessions/FermentationTracker";
import ApiService from "../../src/services/api";
import brewSessionService from "../../src/services/BrewSessionService";
import { renderWithProviders } from "../testUtils";

// Mock the CSS import
jest.mock("../../src/styles/BrewSessions.css", () => ({}));

// Mock ApiService
jest.mock("../../src/services/api", () => ({
  brewSessions: {
    getFermentationData: jest.fn(),
    getFermentationStats: jest.fn(),
    addFermentationEntry: jest.fn(),
    deleteFermentationEntry: jest.fn(),
    update: jest.fn(),
  },
}));

// Mock BrewSessionService
jest.mock("../../src/services/BrewSessionService", () => ({
  __esModule: true,
  default: {
    getFermentationData: jest.fn(),
    getFermentationStats: jest.fn(),
    addFermentationEntry: jest.fn(),
    analyzeFermentationCompletion: jest.fn(),
  },
}));

// Mock recharts to avoid canvas issues in tests
jest.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, "confirm", {
  value: mockConfirm,
  writable: true,
});

// Create test data
const mockFermentationData = [
  {
    entry_date: "2024-06-01T10:00:00Z",
    gravity: 1.055,
    temperature: 68.5,
    ph: 4.2,
    notes: "Initial reading",
  },
  {
    entry_date: "2024-06-03T10:00:00Z",
    gravity: 1.03,
    temperature: 69.0,
    ph: 4.1,
    notes: "Fermentation active",
  },
  {
    entry_date: "2024-06-06T10:00:00Z",
    gravity: 1.015,
    temperature: 68.0,
    ph: 4.0,
    notes: "Slowing down",
  },
  {
    entry_date: "2024-06-08T10:00:00Z",
    gravity: 1.012,
    temperature: 67.5,
    ph: 3.9,
    notes: "Almost done",
  },
];

const mockStats = {
  gravity: {
    initial: 1.055,
    current: 1.012,
    drop: 0.043,
    attenuation: 78.2,
  },
  temperature: {
    min: 67.5,
    max: 69.0,
    avg: 68.25,
  },
  ph: {
    min: 3.9,
    max: 4.2,
    avg: 4.05,
    data: [4.2, 4.1, 4.0, 3.9],
  },
};

const mockRecipeData = {
  estimated_og: 1.06,
  estimated_fg: 1.01,
};

const mockSessionData = {
  status: "fermenting",
  actual_og: 1.055,
  actual_fg: null,
};

const defaultProps = {
  sessionId: "test-session-id",
  recipeData: mockRecipeData,
  sessionData: mockSessionData,
  onUpdateSession: jest.fn(),
};

describe("FermentationTracker", () => {
  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  /*
   * Note: FermentationTracker has auto-form behavior that shows the form automatically
   * when there's no fermentation data but the session has actual_og and status is "fermenting".
   * The auto-form only triggers after data loading is complete to avoid race conditions.
   */

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.warn = jest.fn();
    mockConfirm.mockReturnValue(true);

    // Default successful BrewSessionService responses
    (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue(mockFermentationData);
    (brewSessionService.getFermentationStats as jest.Mock).mockResolvedValue(mockStats);
    (brewSessionService.addFermentationEntry as jest.Mock).mockResolvedValue(mockFermentationData);
    (brewSessionService.analyzeFermentationCompletion as jest.Mock).mockResolvedValue(null);

    // Default successful API responses (for direct API calls that still remain)
    (ApiService.brewSessions.getFermentationData as jest.Mock).mockResolvedValue({
      data: { data: mockFermentationData },
    });
    (ApiService.brewSessions.getFermentationStats as jest.Mock).mockResolvedValue({
      data: { data: mockStats },
    });
    (ApiService.brewSessions.addFermentationEntry as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
    (ApiService.brewSessions.deleteFermentationEntry as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
    (ApiService.brewSessions.update as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe("Loading State", () => {
    it("should show loading message initially", () => {
      (ApiService.brewSessions.getFermentationData as jest.Mock).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );
      (ApiService.brewSessions.getFermentationStats as jest.Mock).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      expect(
        screen.getByText("Loading fermentation data...")
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle generic error gracefully without blocking UI", async () => {
      (brewSessionService.getFermentationData as jest.Mock).mockRejectedValue(
        new Error("Failed to fetch data")
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        // Should show empty message since data load failed but UI isn't blocked
        expect(
          screen.getByText("No fermentation data recorded yet.")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching fermentation data:",
        expect.any(Error)
      );
    });

    it("should show specific error message for 404 errors", async () => {
      const notFoundError = new Error("Not found") as any;
      notFoundError.response = { status: 404 };
      (brewSessionService.getFermentationData as jest.Mock).mockRejectedValue(
        notFoundError
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Brew session not found.")).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching fermentation data:",
        expect.any(Error)
      );
    });

    it("should show access denied for 403 errors", async () => {
      const accessDeniedError = new Error("Access denied") as any;
      accessDeniedError.response = { status: 403 };
      (brewSessionService.getFermentationData as jest.Mock).mockRejectedValue(
        accessDeniedError
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(
          screen.getByText("Access denied to fermentation data.")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching fermentation data:",
        expect.any(Error)
      );
    });

    it("should handle backend error gracefully without blocking UI", async () => {
      const backendError = new Error("Backend error") as any;
      backendError.response = { data: { error: "Database connection failed" } };
      (brewSessionService.getFermentationData as jest.Mock).mockRejectedValue(
        backendError
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        // Should show empty message since data load failed but UI isn't blocked
        expect(
          screen.getByText("No fermentation data recorded yet.")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching fermentation data:",
        expect.any(Error)
      );
    });

    it("should show error message when adding entry fails", async () => {
      (brewSessionService.addFermentationEntry as jest.Mock).mockRejectedValue(
        new Error("Failed to add entry")
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
      });

      // Show form
      const addButton = screen.getByText("Add Entry");
      fireEvent.click(addButton);

      // Fill and submit form
      const gravityInput = screen.getByLabelText("Gravity");
      fireEvent.change(gravityInput, { target: { value: "1.050" } });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to add fermentation entry")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error adding fermentation entry:",
        expect.any(Error)
      );
    });

    it("should show error message when delete fails", async () => {
      (ApiService.brewSessions.deleteFermentationEntry as jest.Mock).mockRejectedValue(
        new Error("Failed to delete entry")
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
      });

      // Click delete button on first entry
      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to delete fermentation entry")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error deleting fermentation entry:",
        expect.any(Error)
      );
    });

    it("should gracefully handle stats fetch errors", async () => {
      (brewSessionService.getFermentationStats as jest.Mock).mockRejectedValue(
        new Error("Stats error")
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
      });

      expect(console.warn).toHaveBeenCalledWith(
        "Error fetching fermentation stats:",
        expect.any(Error)
      );

      // Should still show other content
      expect(screen.getByText("Add Entry")).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("should render fermentation header with title and add button", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
        expect(screen.getByText("Add Entry")).toBeInTheDocument();
      });
    });

    it("should display fermentation statistics", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        // Use more specific selectors to avoid conflicts with table headers
        // Look for the stats section specifically
        const gravityStatsCard = screen
          .getByRole("heading", { name: "Gravity" })
          .closest(".fermentation-stat-card");
        expect(gravityStatsCard).toBeInTheDocument();
        expect(gravityStatsCard).toHaveTextContent("Initial:");
        expect(gravityStatsCard).toHaveTextContent("1.055");
        expect(gravityStatsCard).toHaveTextContent("Current:");
        expect(gravityStatsCard).toHaveTextContent("1.012");
        expect(gravityStatsCard).toHaveTextContent("Drop:");
        expect(gravityStatsCard).toHaveTextContent("0.043");
        expect(gravityStatsCard).toHaveTextContent("Attenuation:");
        expect(gravityStatsCard).toHaveTextContent("78.2%");

        // Temperature stats
        const tempStatsCard = screen
          .getByRole("heading", { name: "Temperature" })
          .closest(".fermentation-stat-card");
        expect(tempStatsCard).toBeInTheDocument();
        expect(tempStatsCard).toHaveTextContent("Min:");
        expect(tempStatsCard).toHaveTextContent("67.5°F");
        expect(tempStatsCard).toHaveTextContent("Max:");
        expect(tempStatsCard).toHaveTextContent("69.0°F");
        expect(tempStatsCard).toHaveTextContent("Avg:");
        expect(tempStatsCard).toHaveTextContent("68.3°F");

        // pH stats - Fixed expectation: 4.05 rounds to 4.0, not 4.1
        const phStatsCard = screen
          .getByRole("heading", { name: "pH" })
          .closest(".fermentation-stat-card");
        expect(phStatsCard).toBeInTheDocument();
        expect(phStatsCard).toHaveTextContent("4.0");
      });
    });

    it("should display expected vs actual comparison", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(
          screen.getByText("Expected vs. Actual Fermentation")
        ).toBeInTheDocument();
        expect(screen.getByText("Expected OG")).toBeInTheDocument();
        expect(screen.getByText("1.060")).toBeInTheDocument();
        expect(screen.getByText("Expected FG")).toBeInTheDocument();
        expect(screen.getByText("1.010")).toBeInTheDocument();
        expect(screen.getByText("Expected Attenuation")).toBeInTheDocument();
        // Fixed expectation: ((1.06-1.01)/(1.06-1.0))*100 = 83.3%, not 90.9%
        expect(screen.getByText("83.3%")).toBeInTheDocument();

        expect(screen.getByText("Actual OG")).toBeInTheDocument();
        expect(screen.getByText("Current Gravity")).toBeInTheDocument();
        expect(screen.getByText("Current Attenuation")).toBeInTheDocument();
      });
    });

    it("should display fermentation chart when data exists", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Progress")).toBeInTheDocument();
        expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });
    });

    it("should display fermentation data table", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
        expect(screen.getByText("Date & Time")).toBeInTheDocument();
        // Use more specific selectors for table headers to avoid conflicts with stats
        expect(
          screen.getByRole("columnheader", { name: "Gravity" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Temperature" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "pH" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Notes" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Actions" })
        ).toBeInTheDocument();

        // Check data rows
        expect(screen.getByText("Initial reading")).toBeInTheDocument();
        expect(screen.getByText("Fermentation active")).toBeInTheDocument();
        expect(screen.getByText("Almost done")).toBeInTheDocument();
      });
    });

    it("should show empty message when no fermentation data exists", async () => {
      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue([]);

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(
          screen.getByText("No fermentation data recorded yet.")
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            'Use the "Add Entry" button above to start tracking your fermentation progress.'
          )
        ).toBeInTheDocument();
      });
    });

    it("should handle network error gracefully and still allow adding data", async () => {
      (brewSessionService.getFermentationData as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        // Should show empty state since data load failed but UI isn't blocked
        expect(
          screen.getByText("No fermentation data recorded yet.")
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Use the \"Add Entry\" button above to start tracking your fermentation progress."
          )
        ).toBeInTheDocument();
        // Add Entry button should still be available
        expect(screen.getByText("Cancel")).toBeInTheDocument(); // Form auto-opens due to actual_og
      });
    });
  });

  describe("Form Interactions", () => {
    it("should show/hide form when add entry button is clicked", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        expect(screen.getByText("Add Entry")).toBeInTheDocument();
      });

      // Form should not be visible initially
      expect(
        screen.queryByText("New Fermentation Reading")
      ).not.toBeInTheDocument();

      // Click add entry button
      const addButton = screen.getByText("Add Entry");
      fireEvent.click(addButton);

      // Form should now be visible
      expect(screen.getByText("New Fermentation Reading")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      // Form should be hidden again
      expect(
        screen.queryByText("New Fermentation Reading")
      ).not.toBeInTheDocument();
    });

    it("should render all form fields", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      expect(screen.getByLabelText("Gravity")).toBeInTheDocument();
      expect(screen.getByLabelText("Temperature (°F)")).toBeInTheDocument();
      expect(screen.getByLabelText("pH (optional)")).toBeInTheDocument();
      expect(screen.getByLabelText("Notes")).toBeInTheDocument();
      expect(screen.getByText("Save Reading")).toBeInTheDocument();
    });

    it("should handle form field changes", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      const gravityInput = screen.getByLabelText("Gravity");
      const temperatureInput = screen.getByLabelText("Temperature (°F)");
      const phInput = screen.getByLabelText("pH (optional)");
      const notesInput = screen.getByLabelText("Notes");

      fireEvent.change(gravityInput, { target: { value: "1.050" } });
      fireEvent.change(temperatureInput, { target: { value: "68.5" } });
      fireEvent.change(phInput, { target: { value: "4.2" } });
      fireEvent.change(notesInput, { target: { value: "Test notes" } });

      expect((gravityInput as HTMLInputElement).value).toBe("1.050");
      expect((temperatureInput as HTMLInputElement).value).toBe("68.5");
      expect((phInput as HTMLInputElement).value).toBe("4.2");
      expect((notesInput as HTMLInputElement).value).toBe("Test notes");
    });

    it("should submit form with correct data", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      // Fill form
      fireEvent.change(screen.getByLabelText("Gravity"), {
        target: { value: "1.050" },
      });
      fireEvent.change(screen.getByLabelText("Temperature (°F)"), {
        target: { value: "68.5" },
      });
      fireEvent.change(screen.getByLabelText("pH (optional)"), {
        target: { value: "4.2" },
      });
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Test notes" },
      });

      // Submit form
      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          brewSessionService.addFermentationEntry
        ).toHaveBeenCalledWith(
          "test-session-id",
          expect.objectContaining({
            gravity: 1.05,
            temperature: 68.5,
            ph: 4.2,
            notes: "Test notes",
            entry_date: expect.any(String),
          })
        );
      });
    });

    it("should reset form after successful submission", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      // Fill and submit form
      fireEvent.change(screen.getByLabelText("Gravity"), {
        target: { value: "1.050" },
      });
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Test notes" },
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(brewSessionService.addFermentationEntry).toHaveBeenCalled();
      });

      // Wait for form to be hidden (form is hidden after successful submission)
      await waitFor(() => {
        expect(
          screen.queryByText("New Fermentation Reading")
        ).not.toBeInTheDocument();
      });
    });

    it("should show submitting state during form submission", async () => {
      (brewSessionService.addFermentationEntry as jest.Mock).mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Delete Functionality", () => {
    it("should call delete API when delete button is clicked and confirmed", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Are you sure you want to delete this entry?"
      );

      await waitFor(() => {
        expect(
          ApiService.brewSessions.deleteFermentationEntry
        ).toHaveBeenCalledWith("test-session-id", 0);
      });
    });

    it("should not call delete API when delete is cancelled", async () => {
      mockConfirm.mockReturnValue(false);

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      expect(mockConfirm).toHaveBeenCalled();
      expect(
        ApiService.brewSessions.deleteFermentationEntry
      ).not.toHaveBeenCalled();
    });
  });

  describe("Auto OG Setting", () => {
    it("should auto-populate gravity and show form when session has actual_og but no fermentation data", async () => {
      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue([]); // No fermentation data

      const propsWithOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: 1.055,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithOG as any} />);

      await waitFor(() => {
        expect(
          screen.getByText("New Fermentation Reading")
        ).toBeInTheDocument();
        const gravityInput = screen.getByLabelText("Gravity");
        expect((gravityInput as HTMLInputElement).value).toBe("1.055");
      });
    });

    it("should not auto-show form if not in fermenting status", async () => {
      (ApiService.brewSessions.getFermentationData as jest.Mock).mockResolvedValue({
        data: [], // No fermentation data
      });

      const propsWithPlannedStatus = {
        ...defaultProps,
        sessionData: {
          status: "planned",
          actual_og: 1.055,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithPlannedStatus as any} />);

      await waitFor(() => {
        expect(screen.getByText("Add Entry")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("New Fermentation Reading")
      ).not.toBeInTheDocument();
    });

    it("should not auto-show form when fermentation data already exists", async () => {
      // Uses default mockFermentationData (has existing data)
      const propsWithDataAndOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: 1.055,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithDataAndOG as any} />);

      // Should show existing data and Add Entry button, not auto-form
      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
        expect(screen.getByText("Initial reading")).toBeInTheDocument();
        expect(screen.getByText("Add Entry")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("New Fermentation Reading")
      ).not.toBeInTheDocument();
    });
  });

  describe("Session Updates", () => {
    it("should update session with actual_og if first entry and session has no OG", async () => {
      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue([]); // No existing fermentation data

      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null, // No OG set
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        const addButton = screen.getByText("Add Entry");
        fireEvent.click(addButton);
      });

      // Add first gravity reading
      fireEvent.change(screen.getByLabelText("Gravity"), {
        target: { value: "1.055" },
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(ApiService.brewSessions.update).toHaveBeenCalledWith(
          "test-session-id",
          { actual_og: 1.055 }
        );
        expect(defaultProps.onUpdateSession).toHaveBeenCalledWith({
          actual_og: 1.055,
        });
      });
    });

    it("should add fermentation entry without automatic FG calculation", async () => {
      // Mock data with two entries where the last one is close to what we'll add
      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue([
        {
          entry_date: "2024-06-01T10:00:00Z",
          gravity: 1.055, // Initial OG
          temperature: 68.0,
          ph: 4.2,
          notes: "Initial reading",
        },
        {
          entry_date: "2024-06-05T10:00:00Z",
          gravity: 1.012, // Previous reading that we'll compare against
          temperature: 68.0,
          ph: 4.0,
          notes: "Previous reading",
        },
      ]);

      // Mock a successful add that returns updated data
      (brewSessionService.addFermentationEntry as jest.Mock).mockResolvedValue([]);

      const propsForFG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: 1.055,
          actual_fg: null, // No FG set yet
        },
      };

      renderWithProviders(<FermentationTracker {...propsForFG as any} />);

      // Should show existing data and Add Entry button
      await waitFor(() => {
        expect(screen.getByText("Previous reading")).toBeInTheDocument();
        expect(screen.getByText("Add Entry")).toBeInTheDocument();
      });

      const addButton = screen.getByText("Add Entry");
      fireEvent.click(addButton);

      // Wait for form to be visible
      await waitFor(() => {
        expect(
          screen.getByText("New Fermentation Reading")
        ).toBeInTheDocument();
      });

      // Add gravity reading 
      const gravityInput = screen.getByLabelText("Gravity");
      fireEvent.change(gravityInput, {
        target: { value: "1.012" },
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      // Verify that addFermentationEntry was called
      await waitFor(() => {
        expect(
          brewSessionService.addFermentationEntry
        ).toHaveBeenCalledWith(
          "test-session-id",
          expect.objectContaining({
            gravity: 1.012,
          })
        );
      });

      // With new intelligent analysis system, FG calculation is no longer automatic
      // The intelligent analysis component handles fermentation completion detection
      expect(ApiService.brewSessions.update).not.toHaveBeenCalledWith(
        "test-session-id",
        expect.objectContaining({
          actual_fg: expect.any(Number),
        })
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing stats data gracefully", async () => {
      (ApiService.brewSessions.getFermentationStats as jest.Mock).mockResolvedValue({
        data: null,
      });

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
      });

      // Should not crash and should still display the rest of the component
      expect(screen.getByText("Add Entry")).toBeInTheDocument();
    });

    it("should handle empty recipe data", async () => {
      const propsWithoutRecipe = {
        ...defaultProps,
        recipeData: {},
      };

      renderWithProviders(<FermentationTracker {...propsWithoutRecipe as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
      });

      // Should not show expected vs actual section
      expect(
        screen.queryByText("Expected vs. Actual Fermentation")
      ).not.toBeInTheDocument();
    });

    it("should handle entries with missing data fields", async () => {
      const sparseData = [
        {
          entry_date: "2024-06-01T10:00:00Z",
          gravity: 1.055,
          // Missing temperature, ph, notes
        },
        {
          entry_date: "2024-06-03T10:00:00Z",
          temperature: 68.5,
          // Missing gravity, ph, notes
        },
      ];

      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue(sparseData);

      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
      });

      // Should display dashes for missing data
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });

    it("should calculate attenuation correctly", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(
          screen.getByText("Expected vs. Actual Fermentation")
        ).toBeInTheDocument();
      });

      // Check that attenuation is calculated correctly in the stats section
      // Use more specific selector to avoid multiple "Gravity" elements
      const statsSection = screen
        .getByRole("heading", { name: "Gravity" })
        .closest(".fermentation-stat-card");
      expect(statsSection).toHaveTextContent("78.2%");

      // Also check that the comparison section shows the attenuation
      const comparisonSection = screen
        .getByText("Current Attenuation")
        .closest(".fermentation-comparison-col");
      expect(comparisonSection).toHaveTextContent("78.2%");
    });

    it("should handle form submission with only partial data", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      await waitFor(() => {
        expect(screen.getByText("Fermentation Tracking")).toBeInTheDocument();
      });

      const addButton = screen.getByText("Add Entry");
      fireEvent.click(addButton);

      // Only fill gravity field
      const gravityInput = screen.getByLabelText("Gravity");
      fireEvent.change(gravityInput, {
        target: { value: "1.050" },
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          brewSessionService.addFermentationEntry
        ).toHaveBeenCalledWith(
          "test-session-id",
          expect.objectContaining({
            gravity: 1.05,
            temperature: undefined,
            ph: undefined,
            notes: undefined,
            entry_date: expect.any(String),
          })
        );
      });
    });
  });

  describe("API Integration", () => {
    it("should call all required API endpoints on component mount", async () => {
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      await waitFor(() => {
        expect(
          brewSessionService.getFermentationData
        ).toHaveBeenCalledWith("test-session-id");
        expect(
          brewSessionService.getFermentationStats
        ).toHaveBeenCalledWith("test-session-id");
      });
    });

    it("should refresh data after successful form submission", async () => {
      // Use props that won't trigger auto-form (no actual_og)
      const propsWithoutOG = {
        ...defaultProps,
        sessionData: {
          status: "fermenting",
          actual_og: null,
          actual_fg: null,
        },
      };

      renderWithProviders(<FermentationTracker {...propsWithoutOG as any} />);

      // Wait for initial load
      await waitFor(() => {
        expect(
          brewSessionService.getFermentationData
        ).toHaveBeenCalledTimes(1);
      });

      // Add entry
      const addButton = screen.getByText("Add Entry");
      fireEvent.click(addButton);

      fireEvent.change(screen.getByLabelText("Gravity"), {
        target: { value: "1.050" },
      });

      const submitButton = screen.getByText("Save Reading");
      fireEvent.click(submitButton);

      // Should refresh data after submission
      await waitFor(() => {
        expect(
          brewSessionService.getFermentationData
        ).toHaveBeenCalledTimes(2);
        expect(
          brewSessionService.getFermentationStats
        ).toHaveBeenCalledTimes(2);
      });
    });

    it("should refresh data after successful deletion", async () => {
      // Reset mocks specifically for this test
      jest.clearAllMocks();
      (brewSessionService.getFermentationData as jest.Mock).mockResolvedValue(mockFermentationData);
      (brewSessionService.getFermentationStats as jest.Mock).mockResolvedValue(mockStats);
      (ApiService.brewSessions.deleteFermentationEntry as jest.Mock).mockResolvedValue({
        data: { success: true },
      });
      
      renderWithProviders(<FermentationTracker {...defaultProps as any} />);

      // Wait for initial load and verify data table is shown
      await waitFor(() => {
        expect(
          brewSessionService.getFermentationData
        ).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Fermentation Data Log")).toBeInTheDocument();
      });

      // Wait for data to be loaded and table to be rendered
      await waitFor(() => {
        expect(screen.getByText("Initial reading")).toBeInTheDocument();
      });

      // Delete entry
      const deleteButtons = screen.getAllByText("Delete");
      fireEvent.click(deleteButtons[0]);

      // Should refresh data after deletion
      await waitFor(() => {
        expect(
          brewSessionService.getFermentationData
        ).toHaveBeenCalledTimes(2);
      });
    });
  });
});
