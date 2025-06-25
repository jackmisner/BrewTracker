import ApiService from "./api";

class BeerStyleService {
  constructor() {
    this.stylesCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Fetch all beer styles grouped by category
   */
  async fetchBeerStyles() {
    // Check cache first
    if (this.stylesCache && this.isCacheValid()) {
      return this.stylesCache;
    }

    try {
      const response = await ApiService.beerStyles.getAll();
      const styles = response.data.categories || {};

      // Update cache
      this.stylesCache = styles;
      this.cacheTimestamp = Date.now();

      return styles;
    } catch (error) {
      console.error("Error fetching beer styles:", error);
      // Return empty categories instead of throwing
      return {};
    }
  }

  /**
   * Search beer styles with better error handling
   */
  async searchBeerStyles(query) {
    try {
      const response = await ApiService.beerStyles.search(query);
      return response.data.styles || [];
    } catch (error) {
      console.error("Error searching beer styles:", error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get a specific beer style
   */
  async getBeerStyle(styleId) {
    try {
      const response = await ApiService.beerStyles.getById(styleId);
      return response.data;
    } catch (error) {
      console.error("Error fetching beer style:", error);
      return null;
    }
  }

  /**
   * Get style suggestions for a recipe
   */
  async getStyleSuggestions(recipeId) {
    try {
      const response = await ApiService.beerStyles.getStyleSuggestions(
        recipeId
      );
      return response.data.suggestions || [];
    } catch (error) {
      console.error("Error getting style suggestions:", error);
      return [];
    }
  }

  /**
   * Get style analysis for a recipe
   */
  async getRecipeStyleAnalysis(recipeId) {
    try {
      const response = await ApiService.beerStyles.getRecipeStyleAnalysis(
        recipeId
      );
      return response.data.analysis;
    } catch (error) {
      console.error("Error getting style analysis:", error);
      return null;
    }
  }

  /**
   * Get flattened list of all styles for search/selection
   */
  async getAllStylesList() {
    try {
      const categorizedStyles = await this.fetchBeerStyles();
      const allStyles = [];

      Object.values(categorizedStyles).forEach((category) => {
        if (category.styles && Array.isArray(category.styles)) {
          category.styles.forEach((style) => {
            allStyles.push({
              ...style,
              display_name: `${style.style_id} - ${style.name}`,
              category_name: category.category || style.category,
            });
          });
        }
      });

      return allStyles.sort((a, b) => a.style_id.localeCompare(b.style_id));
    } catch (error) {
      console.error("Error getting styles list:", error);
      return [];
    }
  }

  /**
   * Find styles matching recipe metrics (for frontend-calculated metrics)
   */
  async findMatchingStyles(metrics) {
    try {
      const allStyles = await this.getAllStylesList();
      const matches = [];

      allStyles.forEach((style) => {
        const match = this.calculateStyleMatch(style, metrics);
        if (match.percentage >= 60) {
          matches.push({
            style,
            match,
          });
        }
      });

      return matches.sort((a, b) => b.match.percentage - a.match.percentage);
    } catch (error) {
      console.error("Error finding matching styles:", error);
      return [];
    }
  }

  /**
   * Calculate how well recipe metrics match a style
   */
  calculateStyleMatch(style, metrics) {
    const matches = {};
    let totalSpecs = 5;
    let matchingSpecs = 0;

    // Check OG
    if (style.original_gravity) {
      matches.og =
        metrics.og && metrics.og > 0
          ? this.isInRange(metrics.og, style.original_gravity)
          : false;
      if (matches.og) matchingSpecs++;
    }

    // Check FG
    if (style.final_gravity) {
      matches.fg =
        metrics.fg && metrics.fg > 0
          ? this.isInRange(metrics.fg, style.final_gravity)
          : false;
      if (matches.fg) matchingSpecs++;
    }

    // Check ABV
    if (style.alcohol_by_volume) {
      matches.abv =
        metrics.abv && metrics.abv > 0
          ? this.isInRange(metrics.abv, style.alcohol_by_volume)
          : false;
      if (matches.abv) matchingSpecs++;
    }

    // Check IBU
    if (style.international_bitterness_units) {
      matches.ibu =
        metrics.ibu && metrics.ibu > 0
          ? this.isInRange(metrics.ibu, style.international_bitterness_units)
          : false;
      if (matches.ibu) matchingSpecs++;
    }

    // Check SRM
    if (style.color) {
      matches.srm =
        metrics.srm && metrics.srm > 0
          ? this.isInRange(metrics.srm, style.color)
          : false;
      if (matches.srm) matchingSpecs++;
    }

    const percentage = (matchingSpecs / totalSpecs) * 100;

    return {
      matches,
      percentage,
      matchingSpecs,
      totalSpecs,
    };
  }

  /**
   * Check if a value is within a style range
   */
  isInRange(value, range) {
    if (!range || !range.minimum || !range.maximum) return false;
    return value >= range.minimum.value && value <= range.maximum.value;
  }

  /**
   * Format style range for display
   */
  formatStyleRange(range, precision = 1) {
    if (!range || !range.minimum || !range.maximum) return "-";

    const min = Number(range.minimum.value).toFixed(precision);
    const max = Number(range.maximum.value).toFixed(precision);
    const unit = range.minimum.unit || "";

    if (min === max) {
      return `${min}${unit}`;
    }

    return `${min}-${max}${unit}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.stylesCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid() {
    return (
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }
}

// Export as singleton
const beerStyleServiceInstance = new BeerStyleService();
export default beerStyleServiceInstance;
