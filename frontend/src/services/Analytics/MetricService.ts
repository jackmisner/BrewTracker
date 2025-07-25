import ApiService from "../api";
import {
  Recipe,
  RecipeIngredient,
  RecipeMetrics,
  BatchSizeUnit,
} from "../../types";

// Metric service specific interfaces
interface CalculationData {
  batch_size: number;
  batch_size_unit: BatchSizeUnit;
  efficiency: number;
  boil_time: number;
  ingredients: RecipeIngredient[];
  mash_temperature?: number; // Mash temperature for FG calculations
  mash_temp_unit?: "F" | "C"; // Temperature unit
}

interface BalanceAnalysis {
  ratio: number;
  description: string;
}

interface StyleAnalysis {
  declared: string;
  matches: boolean | null;
  suggestions: string[];
}

interface RecipeAnalysis {
  metrics: RecipeMetrics;
  balance: BalanceAnalysis;
  style: StyleAnalysis;
  issues: string[];
  suggestions: string[];
}

/**
 * Service class for handling recipe metrics calculations
 */
class MetricService {
  private calculationCache: Map<string, RecipeMetrics>;
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private readonly DEBOUNCE_DELAY: number;

  constructor() {
    this.calculationCache = new Map();
    this.debounceTimers = new Map();
    this.DEBOUNCE_DELAY = 500;
  }

  /**
   * Calculate metrics with debouncing for a specific recipe context
   */
  async calculateMetricsDebounced(
    contextId: string,
    recipeData: Partial<Recipe>,
    ingredients: RecipeIngredient[]
  ): Promise<RecipeMetrics> {
    return new Promise((resolve, reject) => {
      // Clear existing timer for this context
      if (this.debounceTimers.has(contextId)) {
        clearTimeout(this.debounceTimers.get(contextId)!);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        try {
          const metrics = await this.calculateMetrics(recipeData, ingredients);
          this.debounceTimers.delete(contextId);
          resolve(metrics);
        } catch (error) {
          this.debounceTimers.delete(contextId);
          reject(error);
        }
      }, this.DEBOUNCE_DELAY);

      this.debounceTimers.set(contextId, timer);
    });
  }

  /**
   * Calculate metrics immediately without debouncing
   */
  async calculateMetrics(
    recipeData: Partial<Recipe>,
    ingredients: RecipeIngredient[]
  ): Promise<RecipeMetrics> {
    try {
      const calculationData = this.prepareCalculationData(
        recipeData,
        ingredients
      );
      const cacheKey = this.generateCacheKey(calculationData);

      // Check cache first
      if (this.calculationCache.has(cacheKey)) {
        return this.calculationCache.get(cacheKey)!;
      }

      const requestPayload = {
        batch_size: calculationData.batch_size,
        batch_size_unit: calculationData.batch_size_unit,
        efficiency: calculationData.efficiency,
        boil_time: calculationData.boil_time,
        ingredients: calculationData.ingredients,
        mash_temperature: calculationData.mash_temperature,
        mash_temp_unit: calculationData.mash_temp_unit,
      };

      console.log("MetricService: API request payload:", {
        ...requestPayload,
        ingredients: `${requestPayload.ingredients.length} ingredients`,
        yeastIngredients: requestPayload.ingredients.filter(ing => ing.type === 'yeast').map(yeast => ({
          name: yeast.name,
          attenuation: yeast.attenuation,
          improved_attenuation_estimate: yeast.improved_attenuation_estimate
        }))
      });

      const response = await ApiService.recipes.calculateMetricsPreview(requestPayload);
      const metrics = this.processMetricsResponse(
        response.data.data || response.data
      );

      // Cache the result
      this.calculationCache.set(cacheKey, metrics);

      // Limit cache size
      if (this.calculationCache.size > 50) {
        const firstKey = this.calculationCache.keys().next().value;
        this.calculationCache.delete(firstKey);
      }

      return metrics;
    } catch (error) {
      console.error("Error calculating metrics:", error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Prepare recipe data for metrics calculation
   */
  prepareCalculationData(
    recipeData: Partial<Recipe>,
    ingredients: RecipeIngredient[]
  ): CalculationData {
    const calculationData: CalculationData = {
      batch_size: parseFloat((recipeData.batch_size || 5).toString()),
      batch_size_unit: (recipeData.batch_size_unit as BatchSizeUnit) || "gal",
      efficiency: parseFloat((recipeData.efficiency || 75).toString()),
      boil_time: parseInt((recipeData.boil_time || 60).toString()),
      ingredients: this.formatIngredientsForCalculation(ingredients),
      mash_temperature: recipeData.mash_temperature ? parseFloat(recipeData.mash_temperature.toString()) : undefined,
      mash_temp_unit: recipeData.mash_temp_unit || undefined,
    };

    return calculationData;
  }

  /**
   * Format ingredients for calculation API
   */
  formatIngredientsForCalculation(
    ingredients: RecipeIngredient[]
  ): RecipeIngredient[] {
    if (!ingredients || !Array.isArray(ingredients)) {
      return [];
    }

    return ingredients.map((ing) => ({
      ...ing,
      ingredient_id: ing.ingredient_id,
      name: ing.name || "",
      type: ing.type || "other",
      amount: parseFloat((ing.amount || 0).toString()) || 0,
      unit: ing.unit || "oz",
      use: ing.use || "",
      time: parseInt((ing.time || 0).toString()),
      potential: ing.potential || undefined,
      color: ing.color || undefined,
      grain_type: ing.grain_type || undefined,
      alpha_acid: ing.alpha_acid || undefined,
      attenuation:
        ing.improved_attenuation_estimate || ing.attenuation || undefined,
    }));
  }

  /**
   * Process and validate metrics response
   */
  processMetricsResponse(rawMetrics: any): RecipeMetrics {
    const processed: RecipeMetrics = {
      og: this.validateGravity(rawMetrics.og, 1.0),
      fg: this.validateGravity(rawMetrics.fg, 1.0),
      abv: this.validatePercentage(rawMetrics.abv, 0.0),
      ibu: this.validateNumber(rawMetrics.ibu, 0),
      srm: this.validateNumber(rawMetrics.srm, 0),
    };

    // Validate relationships
    if (processed.og < processed.fg) {
      console.warn("OG is less than FG, using default values");
      processed.og = 1.05;
      processed.fg = 1.01;
      processed.abv = 5.2;
    }

    return processed;
  }

  /**
   * Get default metrics when calculation fails
   */
  getDefaultMetrics(): RecipeMetrics {
    return {
      og: 1.0,
      fg: 1.0,
      abv: 0.0,
      ibu: 0,
      srm: 0,
    };
  }

  /**
   * Calculate balance ratio for hoppy/malty balance
   */
  calculateBalanceRatio(metrics: RecipeMetrics): number {
    if (!metrics.ibu || metrics.ibu === 0) return 0;
    return metrics.ibu / ((metrics.og - 1) * 1000) / 2;
  }

  /**
   * Get balance description
   */
  getBalanceDescription(metrics: RecipeMetrics): string {
    const ratio = metrics.ibu / ((metrics.og - 1) * 1000);

    if (metrics.ibu === 0) return "Not calculated";
    if (ratio < 0.3) return "Very Malty";
    if (ratio < 0.6) return "Malty";
    if (ratio < 0.8) return "Balanced (Malt)";
    if (ratio < 1.2) return "Balanced";
    if (ratio < 1.5) return "Balanced (Hoppy)";
    if (ratio < 2.0) return "Hoppy";
    return "Very Hoppy";
  }

  /**
   * Get comprehensive recipe analysis
   */
  getRecipeAnalysis(
    metrics: RecipeMetrics,
    recipeData: Partial<Recipe>
  ): RecipeAnalysis {
    const analysis: RecipeAnalysis = {
      metrics,
      balance: {
        ratio: this.calculateBalanceRatio(metrics),
        description: this.getBalanceDescription(metrics),
      },
      style: this.analyzeStyle(metrics, recipeData.style),
      issues: this.identifyIssues(metrics, recipeData),
      suggestions: this.generateSuggestions(metrics, recipeData),
    };

    return analysis;
  }

  /**
   * Analyze if metrics fit the declared style
   */
  analyzeStyle(metrics: RecipeMetrics, styleName?: string): StyleAnalysis {
    // This could be expanded with a comprehensive style database
    const analysis: StyleAnalysis = {
      declared: styleName || "Not specified",
      matches: null,
      suggestions: [],
    };

    // Basic style analysis (can be expanded)
    if (styleName) {
      const lowerStyle = styleName.toLowerCase();

      if (lowerStyle.includes("ipa")) {
        analysis.matches = metrics.ibu >= 40 && metrics.abv >= 5.0;
        if (metrics.ibu < 40)
          analysis.suggestions.push("Consider adding more hops for IPA style");
        if (metrics.abv < 5.0)
          analysis.suggestions.push("ABV might be low for IPA style");
      } else if (lowerStyle.includes("stout")) {
        analysis.matches = metrics.srm >= 30;
        if (metrics.srm < 30)
          analysis.suggestions.push("Consider darker malts for stout color");
      }
    }

    return analysis;
  }

  /**
   * Identify potential issues with the recipe
   */
  identifyIssues(
    metrics: RecipeMetrics,
    _recipeData: Partial<Recipe>
  ): string[] {
    const issues: string[] = [];

    if (metrics.og < 1.03) {
      issues.push("Very low original gravity - may result in weak beer");
    }
    if (metrics.og > 1.1) {
      issues.push("Very high original gravity - may stress yeast");
    }
    if (metrics.abv > 12) {
      issues.push("High alcohol content - ensure yeast can handle this");
    }
    if (metrics.ibu > 100) {
      issues.push("Very high bitterness - may be overwhelming");
    }
    if (metrics.fg >= metrics.og) {
      issues.push("Final gravity higher than or equal to original gravity");
    }

    return issues;
  }

  /**
   * Generate suggestions for recipe improvement
   */
  generateSuggestions(
    metrics: RecipeMetrics,
    recipeData: Partial<Recipe>
  ): string[] {
    const suggestions: string[] = [];

    if (
      metrics.ibu < 10 &&
      recipeData.style &&
      !recipeData.style.toLowerCase().includes("wheat")
    ) {
      suggestions.push("Consider adding hops for flavor balance");
    }
    if (metrics.abv < 3.0) {
      suggestions.push(
        "Consider increasing grain bill for higher alcohol content"
      );
    }
    if (
      metrics.srm < 2 &&
      recipeData.style &&
      recipeData.style.toLowerCase().includes("amber")
    ) {
      suggestions.push("Add crystal or caramel malt for amber color");
    }

    return suggestions;
  }

  // Validation helper methods
  private validateGravity(value: any, defaultValue: number): number {
    const num = parseFloat(value);
    return isNaN(num) || num < 0.99 || num > 1.2 ? defaultValue : num;
  }

  private validatePercentage(value: any, defaultValue: number): number {
    const num = parseFloat(value);
    return isNaN(num) || num < 0 || num > 20 ? defaultValue : num;
  }

  private validateNumber(value: any, defaultValue: number): number {
    const num = parseFloat(value);
    return isNaN(num) || num < 0 ? defaultValue : num;
  }

  /**
   * Generate cache key for calculation data
   */
  private generateCacheKey(calculationData: CalculationData): string {
    return JSON.stringify(calculationData);
  }

  /**
   * Clear all caches and timers
   */
  clearCache(): void {
    this.calculationCache.clear();

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Cancel debounced calculation for a specific context
   */
  cancelCalculation(contextId: string): void {
    if (this.debounceTimers.has(contextId)) {
      clearTimeout(this.debounceTimers.get(contextId)!);
      this.debounceTimers.delete(contextId);
    }
  }
}

// Export as singleton
const metricServiceInstance = new MetricService();
export default metricServiceInstance;
