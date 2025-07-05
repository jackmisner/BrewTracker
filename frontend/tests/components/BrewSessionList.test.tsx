import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import BrewSessionList from "../../src/components/BrewSessions/BrewSessionList";
import ApiService from "../../src/services/api";
import { renderWithProviders, mockData, scenarios } from "../testUtils";

// Mock the CSS import
jest.mock("../../src/styles/BrewSessions.css", () => ({}));

// Mock the ApiService
jest.mock("../../src/services/api", () => ({
  brewSessions: {
    getAll: jest.fn(),
  },
}));

// Mock react-router Link component
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock data using existing patterns
const createMockSession = (overrides = {}) =>
  mockData.brewSession({
    session_id: "session-1",
    name: "My First IPA",
    brew_date: "2024-01-15T00:00:00Z",
    status: "completed",
    actual_og: 1.055,
    actual_fg: 1.012,
    actual_abv: 5.6,
    ...overrides,
  });

const mockBrewSessionsData = [
  createMockSession(),
  createMockSession({
    session_id: "session-2",
    name: "Wheat Beer Experiment",
    brew_date: "2024-02-01T00:00:00Z",
    status: "fermenting",
    actual_og: 1.048,
    actual_fg: null,
    actual_abv: null,
  }),
  createMockSession({
    session_id: "session-3",
    name: null, // Test case with no name
    brew_date: "2024-02-10T00:00:00Z",
    status: "planned",
    actual_og: null,
    actual_fg: null,
    actual_abv: null,
  }),
];

const mockPagination = {
  page: 1,
  pages: 2,
  per_page: 10,
  total: 15,
  has_prev: false,
  has_next: true,
  prev_num: null,
  next_num: 2,
};

const mockBrewSessionsResponse = {
  data: {
    brew_sessions: mockBrewSessionsData,
    pagination: mockPagination,
  },
};

const mockEmptyResponse = {
  data: {
    brew_sessions: [],
    pagination: {
      page: 1,
      pages: 1,
      per_page: 10,
      total: 0,
      has_prev: false,
      has_next: false,
      prev_num: null,
      next_num: null,
    },
  },
};

describe("BrewSessionList", () => {
  // Mock console.error to suppress noise in test output
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("Loading State", () => {
    it("should show loading message initially", () => {
      // Use scenarios.loading() from existing testUtils
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(scenarios.loading());

      renderWithProviders(<BrewSessionList />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should show error message when API call fails", async () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.error("Network error")
      );

      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load brew sessions")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Successful Data Loading", () => {
    beforeEach(() => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should render header with title", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
      });
    });

    it("should render filter dropdown with all status options", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByLabelText("Status:")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByDisplayValue("All Statuses")).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue("All Statuses");
      const options = filterSelect.querySelectorAll("option");

      expect(options).toHaveLength(7); // All + 6 statuses
      expect(options[0]).toHaveTextContent("All Statuses");
      expect(options[1]).toHaveTextContent("Planned");
      expect(options[2]).toHaveTextContent("In Progress");
      expect(options[3]).toHaveTextContent("Fermenting");
      expect(options[4]).toHaveTextContent("Conditioning");
      expect(options[5]).toHaveTextContent("Completed");
      expect(options[6]).toHaveTextContent("Archived");
    });

    it("should render table with correct headers", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("Session Name")).toBeInTheDocument();
      });
      expect(screen.getByText("Brew Date")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("OG / FG")).toBeInTheDocument();
      expect(screen.getByText("ABV")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("should render brew sessions in table rows", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Wheat Beer Experiment")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Brew #sessio")).toBeInTheDocument(); // Truncated session ID
      });
    });

    it("should format dates correctly", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        // Check that first date is formatted (format may vary by locale)
        expect(screen.getByText(/1\/15\/2024|15\/1\/2024/)).toBeInTheDocument();
      });
      await waitFor(() => {
        // Check that second date is formatted (format may vary by locale)
        expect(screen.getByText(/2\/1\/2024|1\/2\/2024/)).toBeInTheDocument();
      });
    });

    it("should display status badges with correct text", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        // Get all status badges and check their content
        const statusBadges = screen.getAllByText("Completed").concat(
          screen.getAllByText("Fermenting"),
          screen.getAllByText("Planned")
        ).filter(element => element.closest(".status-badge"));
        
        expect(statusBadges.length).toBeGreaterThan(0);
      });
    });

    it("should display gravity and ABV values correctly", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("1.055 /1.012")).toBeInTheDocument();
        expect(screen.getByText("5.6%")).toBeInTheDocument();
        expect(screen.getByText("1.048 /-")).toBeInTheDocument();
        expect(screen.getByText("- /-")).toBeInTheDocument();
      });
    });

    it("should render View and Edit links for each session", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const viewLinks = screen.getAllByText("View");
        const editLinks = screen.getAllByText("Edit");
        expect(viewLinks).toHaveLength(3);
        expect(editLinks).toHaveLength(3);
      });
    });
  });


  describe("Filtering", () => {
    beforeEach(() => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should filter sessions by status", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("Wheat Beer Experiment")).toBeInTheDocument();
      });

      const filterSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(filterSelect, { target: { value: "completed" } });

      // Should only show completed sessions
      expect(screen.getByText("My First IPA")).toBeInTheDocument();
      expect(
        screen.queryByText("Wheat Beer Experiment")
      ).not.toBeInTheDocument();
    });

  });

  describe("Search and Sort", () => {
    beforeEach(() => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should render search input", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search sessions by name, status, notes...")).toBeInTheDocument();
      });
    });

    it("should render sort dropdown with options", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByLabelText("Sort by:")).toBeInTheDocument();
      });
      
      const sortSelect = screen.getByDisplayValue("Brew Date (Newest)");
      expect(sortSelect).toBeInTheDocument();
      
      const options = sortSelect.querySelectorAll("option");
      expect(options.length).toBeGreaterThan(5); // Should have multiple sort options
    });

    it("should filter sessions by search term", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
        expect(screen.getByText("Wheat Beer Experiment")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search sessions by name, status, notes...");
      fireEvent.change(searchInput, { target: { value: "IPA" } });

      // Should show search results count
      await waitFor(() => {
        expect(screen.getByText(/Showing .* of .* sessions/)).toBeInTheDocument();
      });
    });

    it("should show clear search button when searching", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search sessions by name, status, notes...");
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
      });
    });

    it("should clear search when clear button is clicked", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search sessions by name, status, notes...");
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        const clearButton = screen.getByRole("button", { name: /clear/i });
        fireEvent.click(clearButton);
      });

      expect(searchInput).toHaveValue("");
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no sessions exist", async () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockEmptyResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("No brew sessions found.")).toBeInTheDocument();
      });
    });

    it("should show empty state when filter results in no sessions", async () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });

      // Change filter to a status that has no sessions
      const filterSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(filterSelect, { target: { value: "archived" } });

      // Should hide the sessions that don't match the filter
      expect(screen.queryByText("My First IPA")).not.toBeInTheDocument();
      expect(screen.queryByText("Wheat Beer Experiment")).not.toBeInTheDocument();
    });

    it("should show no search results message when search returns no matches", async () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText("Search sessions by name, status, notes...");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      // Should show no search results message
      await waitFor(() => {
        expect(screen.getByText(/No sessions found matching "nonexistent"/)).toBeInTheDocument();
        expect(screen.getByText("Clear search")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should call API with correct parameters on mount", () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(1, 1000);
    });

    it("should handle API call failure gracefully", async () => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.error("API Error")
      );

      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load brew sessions")
        ).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching brew sessions:",
        expect.any(Error)
      );
    });
  });

  describe("Navigation Links", () => {
    beforeEach(() => {
      (ApiService.brewSessions.getAll as jest.Mock).mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should have correct href for session view links", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const sessionNameLink = screen.getByText("My First IPA").closest("a");
        expect(sessionNameLink).toHaveAttribute(
          "href",
          "/brew-sessions/session-1"
        );
      });
    });

    it("should have correct href for edit links", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("My First IPA")).toBeInTheDocument();
      });
      
      // Find the specific edit link for "My First IPA" session
      const ipaRow = screen.getByText("My First IPA").closest("tr");
      const editLink = ipaRow?.querySelector('a[href*="/edit"]');
      expect(editLink).toHaveAttribute(
        "href",
        "/brew-sessions/session-1/edit"
      );
    });
  });
});
