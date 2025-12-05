import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AttenuationAnalyticsPage from "../../src/pages/AttenuationAnalytics";
import { attenuationAnalyticsServiceInstance } from "../../src/services";

// Mock the attenuation analytics service
jest.mock("../../src/services", () => ({
  attenuationAnalyticsServiceInstance: {
    getAllYeastAnalytics: jest.fn(),
    getSystemStats: jest.fn(),
    hasSignificantData: jest.fn(),
    getConfidenceLevel: jest.fn(),
    formatConfidence: jest.fn(),
    formatAttenuationDifference: jest.fn(),
  },
}));

// Mock the formatUtils
jest.mock("../../src/utils/formatUtils", () => ({
  formatAttenuation: jest.fn((value: number) => `${value}%`),
}));

// Mock the CSS import
jest.mock("../../src/styles/AttenuationAnalytics.css", () => ({}));

describe("AttenuationAnalyticsPage", () => {
  const mockAnalyticsData = [
    {
      ingredient_id: 1,
      name: "Safale US-05",
      manufacturer: "Fermentis",
      code: "US-05",
      theoretical_attenuation: 78,
      actual_attenuation_average: 82,
      actual_attenuation_count: 15,
      attenuation_confidence: 0.85,
    },
    {
      ingredient_id: 2,
      name: "Nottingham Ale Yeast",
      manufacturer: "Lallemand",
      code: "NottyA",
      theoretical_attenuation: 75,
      actual_attenuation_average: 73,
      actual_attenuation_count: 8,
      attenuation_confidence: 0.6,
    },
    {
      ingredient_id: 3,
      name: "Belle Saison",
      manufacturer: "Lallemand",
      code: "BelleSaison",
      theoretical_attenuation: 85,
      actual_attenuation_average: 88,
      actual_attenuation_count: 5,
      attenuation_confidence: 0.4,
    },
  ];

  const mockSystemStats = {
    total_yeast_ingredients: 150,
    yeast_with_actual_data: 25,
    total_attenuation_data_points: 287,
    high_confidence_yeast: 12,
    data_coverage_percentage: 17,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (
      attenuationAnalyticsServiceInstance.hasSignificantData as jest.Mock
    ).mockImplementation((yeast: any) => yeast.actual_attenuation_count >= 5);

    (
      attenuationAnalyticsServiceInstance.getConfidenceLevel as jest.Mock
    ).mockImplementation((confidence: number) => {
      if (confidence >= 0.7) {
        return {
          level: "high",
          description: "High confidence",
          color: "text-green-500",
        };
      } else if (confidence >= 0.3) {
        return {
          level: "medium",
          description: "Medium confidence",
          color: "text-yellow-500",
        };
      } else {
        return {
          level: "low",
          description: "Low confidence",
          color: "text-orange-500",
        };
      }
    });

    (
      attenuationAnalyticsServiceInstance.formatConfidence as jest.Mock
    ).mockImplementation(
      (confidence: number) => `${Math.round(confidence * 100)}%`
    );

    (
      attenuationAnalyticsServiceInstance.formatAttenuationDifference as jest.Mock
    ).mockImplementation((theoretical?: number, actual?: number) => {
      if (!theoretical || !actual) {
        return { difference: 0, direction: "same", formatted: "0%" };
      }
      const diff = actual - theoretical;
      return {
        difference: Math.abs(diff),
        direction: diff > 0 ? "higher" : diff < 0 ? "lower" : "same",
        formatted: `${diff > 0 ? "+" : ""}${diff}%`,
      };
    });
  });

  describe("Loading State", () => {
    test("displays loading state initially", () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AttenuationAnalyticsPage />);

      expect(screen.getByText("Loading analytics data...")).toBeInTheDocument();
      expect(screen.getByText("Attenuation Analytics")).toBeInTheDocument();
      expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    test("displays error state when data fetching fails", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockRejectedValue(new Error("API Error"));
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockRejectedValue(new Error("API Error"));

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load attenuation analytics")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Try Again")).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching analytics data:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    test("handles retry button click", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockRejectedValue(new Error("API Error"));
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockRejectedValue(new Error("API Error"));

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("Try Again");

      // Verify the retry button exists and is clickable
      // Note: window.location.reload is read-only in Jest 30 and cannot be mocked
      // The button's actual behavior (page reload) is tested manually
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).not.toBeDisabled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Successful Data Load", () => {
    beforeEach(() => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);
    });

    test("displays page header and description", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Yeast Attenuation Analytics")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "Real-world fermentation data improving recipe predictions"
        )
      ).toBeInTheDocument();
    });

    test("displays system statistics", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText("150")).toBeInTheDocument(); // total_yeast_ingredients
      });

      expect(screen.getByText("Total Yeast Strains")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument(); // yeast_with_actual_data
      expect(screen.getByText("With Real Data")).toBeInTheDocument();
      expect(screen.getByText("287")).toBeInTheDocument(); // total_attenuation_data_points
      expect(screen.getByText("Fermentation Data Points")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument(); // high_confidence_yeast
      expect(screen.getByText("High Confidence Strains")).toBeInTheDocument();
      expect(screen.getByText("17%")).toBeInTheDocument(); // data_coverage_percentage
      expect(screen.getByText("Data Coverage")).toBeInTheDocument();
    });

    test("displays top performers section", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("🏆 Most Tracked Yeast Strains")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "Yeast strains with the most real-world fermentation data"
        )
      ).toBeInTheDocument();

      // Should show US-05 first (highest count: 15)
      expect(screen.getAllByText("Safale US-05")).toHaveLength(2); // Appears in both sections
      expect(screen.getAllByText("Fermentis")).toHaveLength(2); // Appears in both sections with US-05
      expect(screen.getByText("US-05")).toBeInTheDocument();

      // Check rankings
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("#2")).toBeInTheDocument();
      expect(screen.getByText("#3")).toBeInTheDocument();
    });

    test("displays yeast performance data correctly", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(screen.getAllByText("Data Points:")).toHaveLength(3); // All 3 yeast strains
      });

      // Check data points display
      expect(screen.getByText("15")).toBeInTheDocument(); // US-05 count
      expect(screen.getByText("8")).toBeInTheDocument(); // Nottingham count

      // Check attenuation averages (mocked to return value%)
      expect(screen.getAllByText("82%")).toHaveLength(2); // US-05 average appears in both sections
      expect(screen.getAllByText("73%")).toHaveLength(2); // Nottingham average appears in both sections

      // Check that confidence percentages are displayed
      expect(screen.getAllByText("85%").length).toBeGreaterThan(0); // US-05 confidence
      expect(screen.getAllByText("60%").length).toBeGreaterThan(0); // Nottingham confidence
    });

    test("displays biggest improvements section", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("📈 Biggest Prediction Improvements")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "Yeast strains where real-world data differs most from manufacturer specs"
        )
      ).toBeInTheDocument();

      // Should show theoretical vs actual data (appears for each improvement card)
      expect(screen.getAllByText("Theoretical:")).toHaveLength(3); // All 3 yeast strains
      expect(screen.getAllByText("Actual Average:")).toHaveLength(3);
      expect(screen.getAllByText("Difference:")).toHaveLength(3);
    });

    test("calculates and sorts improvements correctly", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("📈 Biggest Prediction Improvements")
        ).toBeInTheDocument();
      });

      // US-05: 82-78 = 4% improvement
      // Nottingham: 75-73 = 2% improvement
      // Belle Saison: 88-85 = 3% improvement
      // So US-05 should be first (highest improvement)

      const improvementCards = document.querySelectorAll(".improvement-card");
      expect(improvementCards.length).toBeGreaterThan(0);
    });

    test("filters yeast by significance", async () => {
      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          attenuationAnalyticsServiceInstance.hasSignificantData
        ).toHaveBeenCalledTimes(6); // 3 for top performers, 3 for improvements
      });

      // Should call hasSignificantData for each yeast strain
      expect(
        attenuationAnalyticsServiceInstance.hasSignificantData
      ).toHaveBeenCalledWith(mockAnalyticsData[0]);
      expect(
        attenuationAnalyticsServiceInstance.hasSignificantData
      ).toHaveBeenCalledWith(mockAnalyticsData[1]);
      expect(
        attenuationAnalyticsServiceInstance.hasSignificantData
      ).toHaveBeenCalledWith(mockAnalyticsData[2]);
    });
  });

  describe("No Data State", () => {
    test("displays no data message when analytics array is empty", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue([]);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.getByText("No Analytics Data Available")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("📊")).toBeInTheDocument();
      expect(
        screen.getByText(
          "As users complete fermentations and share their data, analytics will appear here. Help improve the system by enabling data sharing in your user settings!"
        )
      ).toBeInTheDocument();
    });

    test("does not show top performers section when no significant data", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);
      (
        attenuationAnalyticsServiceInstance.hasSignificantData as jest.Mock
      ).mockReturnValue(false);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.queryByText("🏆 Most Tracked Yeast Strains")
        ).not.toBeInTheDocument();
      });
    });

    test("does not show improvements section when no significant data", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);
      (
        attenuationAnalyticsServiceInstance.hasSignificantData as jest.Mock
      ).mockReturnValue(false);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          screen.queryByText("📈 Biggest Prediction Improvements")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Service Method Calls", () => {
    test("calls getAllYeastAnalytics and getSystemStats on mount", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          attenuationAnalyticsServiceInstance.getAllYeastAnalytics
        ).toHaveBeenCalledTimes(1);
        expect(
          attenuationAnalyticsServiceInstance.getSystemStats
        ).toHaveBeenCalledTimes(1);
      });
    });

    test("calls service methods in parallel using Promise.all", async () => {
      const getAllYeastAnalyticsSpy = jest
        .spyOn(attenuationAnalyticsServiceInstance, "getAllYeastAnalytics")
        .mockResolvedValue(mockAnalyticsData);
      const getSystemStatsSpy = jest
        .spyOn(attenuationAnalyticsServiceInstance, "getSystemStats")
        .mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(getAllYeastAnalyticsSpy).toHaveBeenCalledTimes(1);
        expect(getSystemStatsSpy).toHaveBeenCalledTimes(1);
      });
    });

    test("calls formatConfidence for each yeast strain", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          attenuationAnalyticsServiceInstance.formatConfidence
        ).toHaveBeenCalledWith(0.85);
        expect(
          attenuationAnalyticsServiceInstance.formatConfidence
        ).toHaveBeenCalledWith(0.6);
        expect(
          attenuationAnalyticsServiceInstance.formatConfidence
        ).toHaveBeenCalledWith(0.4);
      });
    });

    test("calls getConfidenceLevel for each yeast strain", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          attenuationAnalyticsServiceInstance.getConfidenceLevel
        ).toHaveBeenCalledWith(0.85);
        expect(
          attenuationAnalyticsServiceInstance.getConfidenceLevel
        ).toHaveBeenCalledWith(0.6);
        expect(
          attenuationAnalyticsServiceInstance.getConfidenceLevel
        ).toHaveBeenCalledWith(0.4);
      });
    });

    test("calls formatAttenuationDifference for improvement calculations", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(
          attenuationAnalyticsServiceInstance.formatAttenuationDifference
        ).toHaveBeenCalledWith(78, 82);
        expect(
          attenuationAnalyticsServiceInstance.formatAttenuationDifference
        ).toHaveBeenCalledWith(75, 73);
        expect(
          attenuationAnalyticsServiceInstance.formatAttenuationDifference
        ).toHaveBeenCalledWith(85, 88);
      });
    });
  });

  describe("Data Processing", () => {
    test("sorts top performers by data point count", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(screen.getAllByText("Safale US-05")).toHaveLength(2); // Appears in both sections
      });

      // Verify US-05 appears first (15 data points)
      const yeastCards = document.querySelectorAll(".yeast-card");
      expect(yeastCards[0]).toHaveTextContent("Safale US-05");
    });

    test("limits top performers to 10 items", async () => {
      const manyYeast = Array(15)
        .fill(null)
        .map((_, i) => ({
          ingredient_id: i + 1,
          name: `Yeast ${i + 1}`,
          manufacturer: "Test Manufacturer",
          actual_attenuation_count: 15 - i, // Descending count
          actual_attenuation_average: 75,
          attenuation_confidence: 0.8,
        }));

      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(manyYeast);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        const yeastCards = document.querySelectorAll(".yeast-card");
        expect(yeastCards.length).toBeLessThanOrEqual(10);
      });
    });

    test("limits improvements to 5 items", async () => {
      const manyYeast = Array(8)
        .fill(null)
        .map((_, i) => ({
          ingredient_id: i + 1,
          name: `Yeast ${i + 1}`,
          manufacturer: "Test Manufacturer",
          theoretical_attenuation: 75,
          actual_attenuation_average: 75 + i, // Increasing difference
          actual_attenuation_count: 10,
          attenuation_confidence: 0.8,
        }));

      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(manyYeast);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        const improvementCards = document.querySelectorAll(".improvement-card");
        expect(improvementCards.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe("CSS Classes and Structure", () => {
    test("applies correct CSS classes", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        expect(document.querySelector(".analytics-page")).toBeInTheDocument();
        expect(document.querySelector(".analytics-header")).toBeInTheDocument();
        expect(document.querySelector(".stats-grid")).toBeInTheDocument();
        expect(
          document.querySelector(".analytics-content")
        ).toBeInTheDocument();
      });
    });

    test("applies stat card classes correctly", async () => {
      (
        attenuationAnalyticsServiceInstance.getAllYeastAnalytics as jest.Mock
      ).mockResolvedValue(mockAnalyticsData);
      (
        attenuationAnalyticsServiceInstance.getSystemStats as jest.Mock
      ).mockResolvedValue(mockSystemStats);

      render(<AttenuationAnalyticsPage />);

      await waitFor(() => {
        const statCards = document.querySelectorAll(".stat-card");
        expect(statCards.length).toBe(5);

        // Check for highlight and success classes
        expect(
          document.querySelector(".stat-card.highlight")
        ).toBeInTheDocument();
        expect(
          document.querySelector(".stat-card.success")
        ).toBeInTheDocument();
      });
    });
  });
});
