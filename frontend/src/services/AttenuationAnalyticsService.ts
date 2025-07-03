import ApiService from "./api";
import {
  AttenuationAnalytics,
  ID,
} from "../types";

/**
 * Service class for managing attenuation analytics functionality
 */
class AttenuationAnalyticsService {
  private analyticsCache: AttenuationAnalytics[] | null = null;
  private cacheTimestamp: number | null = null;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter cache for analytics)

  /**
   * Get attenuation analytics for a specific yeast ingredient
   */
  async getYeastAnalytics(ingredientId: ID): Promise<AttenuationAnalytics> {
    try {
      const response = await ApiService.attenuationAnalytics.getYeastAnalytics(ingredientId);
      return response.data;
    } catch (error) {
      console.error("Error fetching yeast analytics:", error);
      throw new Error(`Failed to load analytics for yeast ${ingredientId}`);
    }
  }

  /**
   * Get analytics for all yeast ingredients with actual data
   */
  async getAllYeastAnalytics(useCache: boolean = true): Promise<AttenuationAnalytics[]> {
    // Check cache first if requested
    if (useCache && this.analyticsCache && this.isCacheValid()) {
      return this.analyticsCache;
    }

    try {
      const response = await ApiService.attenuationAnalytics.getAllYeastAnalytics();
      const analytics = response.data.yeast_analytics;

      // Update cache
      if (useCache) {
        this.analyticsCache = analytics;
        this.cacheTimestamp = Date.now();
      }

      return analytics;
    } catch (error) {
      console.error("Error fetching all yeast analytics:", error);
      throw new Error("Failed to load yeast analytics");
    }
  }

  /**
   * Get improved attenuation estimate for a specific yeast
   */
  async getImprovedEstimate(ingredientId: ID): Promise<number> {
    try {
      const response = await ApiService.attenuationAnalytics.getImprovedEstimate(ingredientId);
      return response.data.improved_estimate;
    } catch (error) {
      console.error("Error fetching improved estimate:", error);
      throw new Error(`Failed to get improved estimate for yeast ${ingredientId}`);
    }
  }

  /**
   * Get system-wide attenuation tracking statistics
   */
  async getSystemStats(): Promise<{
    total_yeast_ingredients: number;
    yeast_with_actual_data: number;
    total_attenuation_data_points: number;
    high_confidence_yeast: number;
    data_coverage_percentage: number;
  }> {
    try {
      const response = await ApiService.attenuationAnalytics.getSystemStats();
      return response.data;
    } catch (error) {
      console.error("Error fetching system stats:", error);
      throw new Error("Failed to load system statistics");
    }
  }

  /**
   * Format attenuation confidence as a percentage
   */
  formatConfidence(confidence?: number): string {
    if (!confidence || confidence === 0) {
      return "No data";
    }
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevel(confidence?: number): {
    level: "none" | "low" | "medium" | "high";
    description: string;
    color: string;
  } {
    if (!confidence || confidence === 0) {
      return {
        level: "none",
        description: "No real-world data available",
        color: "text-gray-500",
      };
    }

    if (confidence < 0.3) {
      return {
        level: "low",
        description: "Limited data - use with caution",
        color: "text-orange-500",
      };
    }

    if (confidence < 0.7) {
      return {
        level: "medium",
        description: "Moderate confidence in prediction",
        color: "text-yellow-500",
      };
    }

    return {
      level: "high",
      description: "High confidence in prediction",
      color: "text-green-500",
    };
  }

  /**
   * Format attenuation difference between theoretical and actual
   */
  formatAttenuationDifference(theoretical?: number, actual?: number): {
    difference: number;
    direction: "higher" | "lower" | "same";
    formatted: string;
  } {
    if (!theoretical || !actual) {
      return {
        difference: 0,
        direction: "same",
        formatted: "N/A",
      };
    }

    const difference = actual - theoretical;
    const direction = difference > 0 ? "higher" : difference < 0 ? "lower" : "same";
    const formatted = `${difference > 0 ? "+" : ""}${difference.toFixed(1)}%`;

    return {
      difference,
      direction,
      formatted,
    };
  }

  /**
   * Get analytics for yeast ingredients in a recipe
   */
  async getRecipeYeastAnalytics(yeastIngredientIds: ID[]): Promise<AttenuationAnalytics[]> {
    if (yeastIngredientIds.length === 0) {
      return [];
    }

    try {
      const analyticsPromises = yeastIngredientIds.map((id) =>
        this.getYeastAnalytics(id).catch((error) => {
          console.warn(`Failed to get analytics for yeast ${id}:`, error);
          return null;
        })
      );

      const results = await Promise.all(analyticsPromises);
      return results.filter((analytics): analytics is AttenuationAnalytics => analytics !== null);
    } catch (error) {
      console.error("Error fetching recipe yeast analytics:", error);
      return [];
    }
  }

  /**
   * Check if an ingredient has meaningful attenuation data
   */
  hasSignificantData(analytics: AttenuationAnalytics): boolean {
    return (
      analytics.actual_attenuation_count !== undefined &&
      analytics.actual_attenuation_count >= 3 &&
      analytics.attenuation_confidence !== undefined &&
      analytics.attenuation_confidence > 0
    );
  }

  /**
   * Get the best attenuation estimate (improved if available, theoretical otherwise)
   */
  getBestEstimate(analytics: AttenuationAnalytics): number | undefined {
    if (analytics.improved_estimate !== undefined) {
      return analytics.improved_estimate;
    }
    return analytics.theoretical_attenuation;
  }

  /**
   * Clear the analytics cache
   */
  clearCache(): void {
    this.analyticsCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Force refresh analytics data
   */
  async refreshAnalytics(): Promise<AttenuationAnalytics[]> {
    this.clearCache();
    return this.getAllYeastAnalytics(false);
  }

  // Private helper methods
  private isCacheValid(): boolean {
    return (
      this.cacheTimestamp !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }
}

// Export as singleton
const attenuationAnalyticsServiceInstance = new AttenuationAnalyticsService();
export default attenuationAnalyticsServiceInstance;