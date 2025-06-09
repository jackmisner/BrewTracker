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
  Link: ({ to, children, className }) => (
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
      ApiService.brewSessions.getAll.mockReturnValue(scenarios.loading());

      renderWithProviders(<BrewSessionList />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should show error message when API call fails", async () => {
      ApiService.brewSessions.getAll.mockReturnValue(
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
      ApiService.brewSessions.getAll.mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should render header with title and new session button", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText("New Brew Session")).toBeInTheDocument();
      });
    });

    it("should render filter dropdown with all status options", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByLabelText("Filter by Status:")).toBeInTheDocument();
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
        expect(screen.getByText("Completed")).toBeInTheDocument();
        expect(screen.getByText("Fermenting")).toBeInTheDocument();
        expect(screen.getByText("Planned")).toBeInTheDocument();
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

  describe("Pagination", () => {
    beforeEach(() => {
      ApiService.brewSessions.getAll.mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should display pagination info when multiple pages exist", async () => {
      renderWithProviders(<BrewSessionList />);

      // Wait for the pagination info container
      const paginationInfo = await screen.findByRole("status", {
        name: /pagination results/i,
      });

      expect(paginationInfo).toHaveTextContent(
        /showing 1 to 10 of 15 results/i
      );
    });

    it("should render pagination controls", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("←")).toBeInTheDocument();
        expect(screen.getByText("→")).toBeInTheDocument();
      });

      // Use Testing Library queries to find the active page button
      const activePageButton = screen.getByRole("button", { name: "1" });
      expect(activePageButton).toHaveClass("active");

      // Find the page 2 button (not prev/next, not active)
      const page2Button = screen.getByRole("button", { name: "2" });
      expect(page2Button).toBeInTheDocument();
    });

    it("should disable previous button on first page", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const prevButton = screen.getByText("←").closest("button");
        expect(prevButton).toBeDisabled();
      });
    });

    it("should handle page navigation", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const nextButton = screen.getByText("→").closest("button");
        expect(nextButton).not.toBeDisabled();
        fireEvent.click(nextButton);
      });

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(2);
    });

    it("should handle direct page number clicks", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const paginationControls = screen
          .getByText("←")
          .closest(".pagination-controls");
        const pageButtons = paginationControls.querySelectorAll(
          'button:not([class*="prev"]):not([class*="next"])'
        );
        const page2Button = Array.from(pageButtons).find(
          (btn) => btn.textContent === "2"
        );
        fireEvent.click(page2Button);
      });

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(2);
    });
  });

  describe("Filtering", () => {
    beforeEach(() => {
      ApiService.brewSessions.getAll.mockReturnValue(
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

    it("should reset to first page when changing filter", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        // First navigate to page 2
        const paginationControls = screen
          .getByText("←")
          .closest(".pagination-controls");
        const pageButtons = paginationControls.querySelectorAll(
          'button:not([class*="prev"]):not([class*="next"])'
        );
        const page2Button = Array.from(pageButtons).find(
          (btn) => btn.textContent === "2"
        );
        fireEvent.click(page2Button);
      });

      // Then change filter
      const filterSelect = screen.getByDisplayValue("All Statuses");
      fireEvent.change(filterSelect, { target: { value: "fermenting" } });

      // Should have called API with page 1 for the filter change
      expect(ApiService.brewSessions.getAll).toHaveBeenLastCalledWith(1);
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no sessions exist", async () => {
      ApiService.brewSessions.getAll.mockReturnValue(
        scenarios.success(mockEmptyResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        expect(screen.getByText("No brew sessions found.")).toBeInTheDocument();
        expect(
          screen.getByText("Create your first brew session")
        ).toBeInTheDocument();
      });
    });

    it("should show empty state when filter results in no sessions", async () => {
      ApiService.brewSessions.getAll.mockReturnValue(
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

      // Should show empty state message
      expect(screen.getByText("No brew sessions found.")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should call API with correct parameters on mount", () => {
      ApiService.brewSessions.getAll.mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );

      renderWithProviders(<BrewSessionList />);

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(1);
    });

    it("should handle API call failure gracefully", async () => {
      ApiService.brewSessions.getAll.mockReturnValue(
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
      ApiService.brewSessions.getAll.mockReturnValue(
        scenarios.success(mockBrewSessionsResponse.data)
      );
    });

    it("should have correct href for new session link", async () => {
      renderWithProviders(<BrewSessionList />);

      await waitFor(() => {
        const newSessionLink = screen
          .getByText("New Brew Session")
          .closest("a");
        expect(newSessionLink).toHaveAttribute("href", "/brew-sessions/new");
      });
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
        const editLinks = screen.getAllByText("Edit");
        expect(editLinks[0].closest("a")).toHaveAttribute(
          "href",
          "/brew-sessions/session-1/edit"
        );
      });
    });
  });
});
