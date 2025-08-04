import ApiService from "../api";
import {
  BeerStyleGuide,
  StyleAnalysis,
  StyleSuggestion,
  RecipeMetrics,
  StyleRange,
  ID,
} from "../../types";

// Service-specific interfaces
interface InternalStyleMatch {
  matches: {
    og?: boolean;
    fg?: boolean;
    abv?: boolean;
    ibu?: boolean;
    srm?: boolean;
  };
  percentage: number;
  matchingSpecs: number;
  totalSpecs: number;
}

interface EnhancedBeerStyle extends BeerStyleGuide {
  display_name: string;
  category_name: string;
}

interface CategorizedStyles {
  [categoryKey: string]: {
    category?: string;
    styles: BeerStyleGuide[];
  };
}

class BeerStyleService {
  private stylesCache: CategorizedStyles | null;
  private cacheTimestamp: number | null;
  private readonly CACHE_DURATION: number;

  constructor() {
    this.stylesCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Fetch all beer styles grouped by category
   */
  async fetchBeerStyles(): Promise<CategorizedStyles> {
    // Check cache first
    if (this.stylesCache && this.isCacheValid()) {
      return this.stylesCache;
    }

    try {
      const response = await ApiService.beerStyles.getAll();
      const styles: CategorizedStyles = (response.data as any).categories || {};

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
  async searchBeerStyles(query: string): Promise<BeerStyleGuide[]> {
    try {
      const response = await ApiService.beerStyles.search(query);
      return (response.data as any).styles || [];
    } catch (error) {
      console.error("Error searching beer styles:", error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get a specific beer style
   */
  async getBeerStyle(styleId: ID): Promise<BeerStyleGuide | null> {
    try {
      const response = await ApiService.beerStyles.getById(styleId);
      return response.data.data || response.data;
    } catch (error) {
      console.error("Error fetching beer style:", error);
      return null;
    }
  }

  /**
   * Get style suggestions for a recipe
   */
  async getStyleSuggestions(recipeId: ID): Promise<StyleSuggestion[]> {
    try {
      const response =
        await ApiService.beerStyles.getStyleSuggestions(recipeId);
      return (response.data as any).suggestions || [];
    } catch (error) {
      console.error("Error getting style suggestions:", error);
      return [];
    }
  }

  /**
   * Get style analysis for a recipe
   */
  async getRecipeStyleAnalysis(recipeId: ID): Promise<StyleAnalysis | null> {
    try {
      const response =
        await ApiService.beerStyles.getRecipeStyleAnalysis(recipeId);
      return (response.data as any).analysis;
    } catch (error) {
      console.error("Error getting style analysis:", error);
      return null;
    }
  }

  /**
   * Get flattened list of all styles for search/selection
   */
  async getAllStylesList(): Promise<EnhancedBeerStyle[]> {
    try {
      const categorizedStyles = await this.fetchBeerStyles();
      const allStyles: EnhancedBeerStyle[] = [];

      Object.values(categorizedStyles).forEach(category => {
        if (category.styles && Array.isArray(category.styles)) {
          category.styles.forEach(style => {
            allStyles.push({
              ...style,
              display_name: `${style.style_id} - ${style.name}`,
              category_name: category.category || style.category || "Unknown",
            });
          });
        }
      });

      return allStyles.sort((a, b) => {
        const aStyleId = a.style_id || "";
        const bStyleId = b.style_id || "";

        // Extract category number and subcategory letter from style_id (e.g., "1A" -> [1, "A"])
        const parseStyleId = (styleId: string) => {
          const match = styleId.match(/^(\d+)([A-Z]?)$/);
          if (match) {
            return {
              category: parseInt(match[1], 10),
              subcategory: match[2] || "",
            };
          }
          // Fallback for non-standard format
          return {
            category: 999,
            subcategory: styleId,
          };
        };

        const aParsed = parseStyleId(aStyleId);
        const bParsed = parseStyleId(bStyleId);

        // First sort by category number
        if (aParsed.category !== bParsed.category) {
          return aParsed.category - bParsed.category;
        }

        // Then sort by subcategory letter alphabetically
        return aParsed.subcategory.localeCompare(bParsed.subcategory);
      });
    } catch (error) {
      console.error("Error getting styles list:", error);
      return [];
    }
  }

  /**
   * Find styles matching recipe metrics (for frontend-calculated metrics)
   */
  async findMatchingStyles(metrics: RecipeMetrics): Promise<StyleSuggestion[]> {
    try {
      const allStyles = await this.getAllStylesList();
      const matches: StyleSuggestion[] = [];

      allStyles.forEach(style => {
        const match = this.calculateStyleMatch(style, metrics);
        if (match.percentage >= 60) {
          matches.push({
            style,
            match_percentage: match.percentage,
            matches: match.matches,
          });
        }
      });

      return matches.sort((a, b) => b.match_percentage - a.match_percentage);
    } catch (error) {
      console.error("Error finding matching styles:", error);
      return [];
    }
  }

  /**
   * Calculate how well recipe metrics match a style
   */
  calculateStyleMatch(
    style: BeerStyleGuide,
    metrics: RecipeMetrics
  ): InternalStyleMatch {
    const matches: InternalStyleMatch["matches"] = {};
    let totalSpecs = 5;
    let matchingSpecs = 0;

    // Check OG
    if (style.original_gravity) {
      matches.og =
        metrics.og && metrics.og > 0
          ? this.isInRange(metrics.og, style.original_gravity as StyleRange)
          : false;
      if (matches.og) matchingSpecs++;
    }

    // Check FG
    if (style.final_gravity) {
      matches.fg =
        metrics.fg && metrics.fg > 0
          ? this.isInRange(metrics.fg, style.final_gravity as StyleRange)
          : false;
      if (matches.fg) matchingSpecs++;
    }

    // Check ABV
    if (style.alcohol_by_volume) {
      matches.abv =
        metrics.abv && metrics.abv > 0
          ? this.isInRange(metrics.abv, style.alcohol_by_volume as StyleRange)
          : false;
      if (matches.abv) matchingSpecs++;
    }

    // Check IBU
    if (style.international_bitterness_units) {
      matches.ibu =
        metrics.ibu && metrics.ibu > 0
          ? this.isInRange(
              metrics.ibu,
              style.international_bitterness_units as StyleRange
            )
          : false;
      if (matches.ibu) matchingSpecs++;
    }

    // Check SRM
    if (style.color) {
      matches.srm =
        metrics.srm && metrics.srm > 0
          ? this.isInRange(metrics.srm, style.color as StyleRange)
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
  isInRange(value: number, range: StyleRange): boolean {
    if (!range || !range.minimum || !range.maximum) return false;
    return value >= range.minimum.value && value <= range.maximum.value;
  }

  /**
   * Format style range for display
   */
  formatStyleRange(
    range: StyleRange | null | undefined,
    precision: number = 1
  ): string {
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
  clearCache(): void {
    this.stylesCache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return (
      this.cacheTimestamp !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }
}

// Export as singleton
const beerStyleServiceInstance = new BeerStyleService();
export default beerStyleServiceInstance;
