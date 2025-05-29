import ApiService from "./api";

/**
 * Service class for handling recipe metrics calculations
 */
class MetricService {
  constructor() {
    this.calculationCache = new Map();
    this.debounceTimers = new Map();
    this.DEBOUNCE_DELAY = 500;
  }

  /**
   * Calculate metrics with debouncing for a specific recipe context
   */
  async calculateMetricsDebounced(contextId, recipeData, ingredients) {
    return new Promise((resolve, reject) => {
      // Clear existing timer for this context
      if (this.debounceTimers.has(contextId)) {
        clearTimeout(this.debounceTimers.get(contextId));
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
  async calculateMetrics(recipeData, ingredients) {
    try {
      const calculationData = this.prepareCalculationData(
        recipeData,
        ingredients
      );
      const cacheKey = this.generateCacheKey(calculationData);

      // Check cache first
      if (this.calculationCache.has(cacheKey)) {
        return this.calculationCache.get(cacheKey);
      }

      const response = await ApiService.recipes.calculateMetricsPreview(
        calculationData
      );
      const metrics = this.processMetricsResponse(response.data);

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
  prepareCalculationData(recipeData, ingredients) {
    const calculationData = {
      batch_size: parseFloat(recipeData.batch_size) || 5,
      efficiency: parseFloat(recipeData.efficiency) || 75,
      boil_time: parseInt(recipeData.boil_time) || 60,
      ingredients: this.formatIngredientsForCalculation(ingredients),
    };

    return calculationData;
  }

  /**
   * Format ingredients for calculation API
   */
  formatIngredientsForCalculation(ingredients) {
    if (!ingredients || !Array.isArray(ingredients)) {
      return [];
    }

    return ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      name: ing.name || "",
      type: ing.type || "",
      amount: parseFloat(ing.amount) || 0,
      unit: ing.unit || "",
      use: ing.use || "",
      time: parseInt(ing.time) || 0,
      potential: ing.potential || null,
      color: ing.color || null,
      grain_type: ing.grain_type || null,
      alpha_acid: ing.alpha_acid || null,
      attenuation: ing.attenuation || null,
    }));
  }

  /**
   * Process and validate metrics response
   */
  processMetricsResponse(rawMetrics) {
    const processed = {
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
  getDefaultMetrics() {
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
  calculateBalanceRatio(metrics) {
    if (!metrics.ibu || metrics.ibu === 0) return 0;
    return metrics.ibu / ((metrics.og - 1) * 1000) / 2;
  }

  /**
   * Get balance description
   */
  getBalanceDescription(metrics) {
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
  getRecipeAnalysis(metrics, recipeData) {
    const analysis = {
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
  analyzeStyle(metrics, styleName) {
    // This could be expanded with a comprehensive style database
    const analysis = {
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
  identifyIssues(metrics, recipeData) {
    const issues = [];

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
  generateSuggestions(metrics, recipeData) {
    const suggestions = [];

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
  validateGravity(value, defaultValue) {
    const num = parseFloat(value);
    return isNaN(num) || num < 0.99 || num > 1.2 ? defaultValue : num;
  }

  validatePercentage(value, defaultValue) {
    const num = parseFloat(value);
    return isNaN(num) || num < 0 || num > 20 ? defaultValue : num;
  }

  validateNumber(value, defaultValue) {
    const num = parseFloat(value);
    return isNaN(num) || num < 0 ? defaultValue : num;
  }

  /**
   * Generate cache key for calculation data
   */
  generateCacheKey(calculationData) {
    return JSON.stringify(calculationData);
  }

  /**
   * Clear all caches and timers
   */
  clearCache() {
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
  cancelCalculation(contextId) {
    if (this.debounceTimers.has(contextId)) {
      clearTimeout(this.debounceTimers.get(contextId));
      this.debounceTimers.delete(contextId);
    }
  }
}

// Export as singleton
const metricServiceInstance = new MetricService();
export default metricServiceInstance;
