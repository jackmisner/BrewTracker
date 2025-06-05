import MetricService from "../../src/services/MetricService";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("MetricService", () => {
  let metricService;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    metricService = MetricService;
    metricService.clearCache();
    jest.clearAllMocks();

    // Mock console.warn and console.error
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Clear any existing timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restore console mocks
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Clear timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("calculateMetrics", () => {
    const mockRecipeData = {
      batch_size: 5,
      efficiency: 75,
      boil_time: 60,
    };

    const mockIngredients = [
      {
        ingredient_id: 1,
        name: "Pale Malt",
        type: "grain",
        amount: 10,
        unit: "lb",
        potential: 1.037,
        color: 2,
        grain_type: "base_malt",
      },
    ];

    const mockApiResponse = {
      data: {
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      },
    };

    test("calculates metrics successfully and caches result", async () => {
      ApiService.recipes.calculateMetricsPreview.mockResolvedValue(
        mockApiResponse
      );

      const result = await metricService.calculateMetrics(
        mockRecipeData,
        mockIngredients
      );

      expect(ApiService.recipes.calculateMetricsPreview).toHaveBeenCalledTimes(
        1
      );
      expect(result).toEqual({
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      });

      // Second call should use cache
      const cachedResult = await metricService.calculateMetrics(
        mockRecipeData,
        mockIngredients
      );
      expect(ApiService.recipes.calculateMetricsPreview).toHaveBeenCalledTimes(
        1
      ); // Still only 1 call
      expect(cachedResult).toEqual(result);
    });

    test("handles API errors and returns default metrics", async () => {
      ApiService.recipes.calculateMetricsPreview.mockRejectedValue(
        new Error("API Error")
      );

      const result = await metricService.calculateMetrics(
        mockRecipeData,
        mockIngredients
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error calculating metrics:",
        expect.any(Error)
      );
      expect(result).toEqual({
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      });
    });

    test("limits cache size to 50 entries", async () => {
      ApiService.recipes.calculateMetricsPreview.mockResolvedValue(
        mockApiResponse
      );

      // Fill cache with 51 entries
      for (let i = 0; i < 51; i++) {
        const uniqueRecipeData = { ...mockRecipeData, batch_size: i + 1 };
        await metricService.calculateMetrics(uniqueRecipeData, mockIngredients);
      }

      expect(metricService.calculationCache.size).toBe(50);
    });
  });

  describe("calculateMetricsDebounced", () => {
    const mockRecipeData = { batch_size: 5, efficiency: 75, boil_time: 60 };
    const mockIngredients = [];
    const mockApiResponse = {
      data: { og: 1.055, fg: 1.012, abv: 5.6, ibu: 25, srm: 4 },
    };

    test("debounces multiple calls and only executes the last one", async () => {
      ApiService.recipes.calculateMetricsPreview.mockResolvedValue(
        mockApiResponse
      );

      const contextId = "test-context";

      // Make multiple rapid calls
      const promise1 = metricService.calculateMetricsDebounced(
        contextId,
        mockRecipeData,
        mockIngredients
      );
      const promise2 = metricService.calculateMetricsDebounced(
        contextId,
        mockRecipeData,
        mockIngredients
      );
      const promise3 = metricService.calculateMetricsDebounced(
        contextId,
        mockRecipeData,
        mockIngredients
      );

      // Fast-forward time to trigger debounce
      jest.advanceTimersByTime(500);

      const result = await promise3;

      expect(ApiService.recipes.calculateMetricsPreview).toHaveBeenCalledTimes(
        1
      );
      expect(result).toEqual({
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      });
    });
  });

  describe("prepareCalculationData", () => {
    test("prepares calculation data with default values", () => {
      const recipeData = {};
      const ingredients = [];

      const result = metricService.prepareCalculationData(
        recipeData,
        ingredients
      );

      expect(result).toEqual({
        batch_size: 5,
        efficiency: 75,
        boil_time: 60,
        ingredients: [],
      });
    });

    test("uses provided values when available", () => {
      const recipeData = {
        batch_size: "10.5",
        efficiency: "80",
        boil_time: "90",
      };
      const ingredients = [{ ingredient_id: 1, amount: 5 }];

      const result = metricService.prepareCalculationData(
        recipeData,
        ingredients
      );

      expect(result.batch_size).toBe(10.5);
      expect(result.efficiency).toBe(80);
      expect(result.boil_time).toBe(90);
    });
  });

  describe("formatIngredientsForCalculation", () => {
    test("formats ingredients correctly", () => {
      const ingredients = [
        {
          ingredient_id: 1,
          name: "Pale Malt",
          type: "grain",
          amount: "10",
          unit: "lb",
          potential: 1.037,
          color: 2,
          grain_type: "base_malt",
        },
        {
          ingredient_id: 2,
          name: "Cascade",
          type: "hop",
          amount: "1",
          unit: "oz",
          use: "boil",
          time: "60",
          alpha_acid: 5.5,
        },
      ];

      const result = metricService.formatIngredientsForCalculation(ingredients);

      expect(result).toEqual([
        {
          ingredient_id: 1,
          name: "Pale Malt",
          type: "grain",
          amount: 10,
          unit: "lb",
          use: "",
          time: 0,
          potential: 1.037,
          color: 2,
          grain_type: "base_malt",
          alpha_acid: null,
          attenuation: null,
        },
        {
          ingredient_id: 2,
          name: "Cascade",
          type: "hop",
          amount: 1,
          unit: "oz",
          use: "boil",
          time: 60,
          potential: null,
          color: null,
          grain_type: null,
          alpha_acid: 5.5,
          attenuation: null,
        },
      ]);
    });

    test("handles null or undefined ingredients", () => {
      expect(metricService.formatIngredientsForCalculation(null)).toEqual([]);
      expect(metricService.formatIngredientsForCalculation(undefined)).toEqual(
        []
      );
      expect(
        metricService.formatIngredientsForCalculation("not-array")
      ).toEqual([]);
    });

    test("handles missing properties with defaults", () => {
      const ingredients = [{ ingredient_id: 1 }];

      const result = metricService.formatIngredientsForCalculation(ingredients);

      expect(result[0]).toEqual({
        ingredient_id: 1,
        name: "",
        type: "",
        amount: 0,
        unit: "",
        use: "",
        time: 0,
        potential: null,
        color: null,
        grain_type: null,
        alpha_acid: null,
        attenuation: null,
      });
    });
  });

  describe("processMetricsResponse", () => {
    test("processes valid metrics response", () => {
      const rawMetrics = {
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      };

      const result = metricService.processMetricsResponse(rawMetrics);

      expect(result).toEqual({
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      });
    });

    test("validates gravity relationships and fixes invalid data", () => {
      const rawMetrics = {
        og: 1.01, // Invalid: OG less than FG
        fg: 1.02,
        abv: 5.6,
        ibu: 25,
        srm: 4,
      };

      const result = metricService.processMetricsResponse(rawMetrics);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "OG is less than FG, using default values"
      );
      expect(result.og).toBe(1.05);
      expect(result.fg).toBe(1.01);
      expect(result.abv).toBe(5.2);
    });

    test("handles invalid values with defaults", () => {
      const rawMetrics = {
        og: "invalid",
        fg: -1,
        abv: 25, // Too high
        ibu: "not-a-number",
        srm: null,
      };

      const result = metricService.processMetricsResponse(rawMetrics);

      expect(result.og).toBe(1.0);
      expect(result.fg).toBe(1.0);
      expect(result.abv).toBe(0.0);
      expect(result.ibu).toBe(0);
      expect(result.srm).toBe(0);
    });
  });

  describe("getDefaultMetrics", () => {
    test("returns correct default metrics", () => {
      const defaults = metricService.getDefaultMetrics();

      expect(defaults).toEqual({
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      });
    });
  });

  describe("calculateBalanceRatio", () => {
    test("calculates balance ratio correctly", () => {
      const metrics = { og: 1.055, ibu: 30 };
      const ratio = metricService.calculateBalanceRatio(metrics);

      // Expected: 30 / ((1.055 - 1) * 1000) / 2 = 30 / 55 / 2 = 0.27
      expect(ratio).toBeCloseTo(0.27, 2);
    });

    test("returns 0 when IBU is 0", () => {
      const metrics = { og: 1.055, ibu: 0 };
      const ratio = metricService.calculateBalanceRatio(metrics);

      expect(ratio).toBe(0);
    });
  });

  describe("getBalanceDescription", () => {
    test("returns correct descriptions for different balance ratios", () => {
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 0 })).toBe(
        "Not calculated"
      );
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 10 })).toBe(
        "Very Malty"
      ); // ratio: 0.2
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 25 })).toBe(
        "Malty"
      ); // ratio: 0.5
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 35 })).toBe(
        "Balanced (Malt)"
      ); // ratio: 0.7
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 50 })).toBe(
        "Balanced"
      ); // ratio: 1.0
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 65 })).toBe(
        "Balanced (Hoppy)"
      ); // ratio: 1.3
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 80 })).toBe(
        "Hoppy"
      ); // ratio: 1.6
      expect(metricService.getBalanceDescription({ og: 1.05, ibu: 120 })).toBe(
        "Very Hoppy"
      ); // ratio: 2.4
    });
  });

  describe("getRecipeAnalysis", () => {
    test("returns comprehensive recipe analysis", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 5.6, ibu: 45, srm: 4 };
      const recipeData = { style: "IPA" };

      const analysis = metricService.getRecipeAnalysis(metrics, recipeData);

      expect(analysis).toHaveProperty("metrics", metrics);
      expect(analysis).toHaveProperty("balance");
      expect(analysis.balance).toHaveProperty("ratio");
      expect(analysis.balance).toHaveProperty("description");
      expect(analysis).toHaveProperty("style");
      expect(analysis).toHaveProperty("issues");
      expect(analysis).toHaveProperty("suggestions");
    });
  });

  describe("analyzeStyle", () => {
    test("analyzes IPA style correctly", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 6.5, ibu: 65, srm: 4 };
      const result = metricService.analyzeStyle(metrics, "American IPA");

      expect(result.declared).toBe("American IPA");
      expect(result.matches).toBe(true);
    });

    test("identifies IPA style issues", () => {
      const metrics = { og: 1.045, fg: 1.012, abv: 4.0, ibu: 25, srm: 4 };
      const result = metricService.analyzeStyle(metrics, "IPA");

      expect(result.matches).toBe(false);
      expect(result.suggestions).toContain(
        "Consider adding more hops for IPA style"
      );
      expect(result.suggestions).toContain("ABV might be low for IPA style");
    });

    test("analyzes stout style correctly", () => {
      const metrics = { og: 1.065, fg: 1.018, abv: 6.2, ibu: 35, srm: 35 };
      const result = metricService.analyzeStyle(metrics, "Imperial Stout");

      expect(result.declared).toBe("Imperial Stout");
      expect(result.matches).toBe(true);
    });

    test("identifies stout color issues", () => {
      const metrics = { og: 1.065, fg: 1.018, abv: 6.2, ibu: 35, srm: 15 };
      const result = metricService.analyzeStyle(metrics, "Stout");

      expect(result.matches).toBe(false);
      expect(result.suggestions).toContain(
        "Consider darker malts for stout color"
      );
    });

    test("handles unknown style", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 5.6, ibu: 30, srm: 4 };
      const result = metricService.analyzeStyle(metrics, null);

      expect(result.declared).toBe("Not specified");
      expect(result.matches).toBe(null);
    });
  });

  describe("identifyIssues", () => {
    test("identifies low gravity issues", () => {
      const metrics = { og: 1.025, fg: 1.01, abv: 2.0, ibu: 20, srm: 4 };
      const recipeData = {};

      const issues = metricService.identifyIssues(metrics, recipeData);

      expect(issues).toContain(
        "Very low original gravity - may result in weak beer"
      );
    });

    test("identifies high gravity issues", () => {
      const metrics = { og: 1.12, fg: 1.025, abv: 13.5, ibu: 40, srm: 8 };
      const recipeData = {};

      const issues = metricService.identifyIssues(metrics, recipeData);

      expect(issues).toContain("Very high original gravity - may stress yeast");
      expect(issues).toContain(
        "High alcohol content - ensure yeast can handle this"
      );
    });

    test("identifies high IBU issues", () => {
      const metrics = { og: 1.065, fg: 1.015, abv: 6.5, ibu: 120, srm: 6 };
      const recipeData = {};

      const issues = metricService.identifyIssues(metrics, recipeData);

      expect(issues).toContain("Very high bitterness - may be overwhelming");
    });

    test("identifies gravity relationship issues", () => {
      const metrics = { og: 1.055, fg: 1.055, abv: 0, ibu: 30, srm: 4 };
      const recipeData = {};

      const issues = metricService.identifyIssues(metrics, recipeData);

      expect(issues).toContain(
        "Final gravity higher than or equal to original gravity"
      );
    });

    test("returns no issues for normal metrics", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 5.6, ibu: 35, srm: 4 };
      const recipeData = {};

      const issues = metricService.identifyIssues(metrics, recipeData);

      expect(issues).toHaveLength(0);
    });
  });

  describe("generateSuggestions", () => {
    test("suggests adding hops for low IBU", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 5.6, ibu: 5, srm: 4 };
      const recipeData = { style: "Pale Ale" };

      const suggestions = metricService.generateSuggestions(
        metrics,
        recipeData
      );

      expect(suggestions).toContain("Consider adding hops for flavor balance");
    });

    test("suggests increasing grain for low ABV", () => {
      const metrics = { og: 1.025, fg: 1.01, abv: 2.5, ibu: 20, srm: 4 };
      const recipeData = {};

      const suggestions = metricService.generateSuggestions(
        metrics,
        recipeData
      );

      expect(suggestions).toContain(
        "Consider increasing grain bill for higher alcohol content"
      );
    });

    test("suggests adding color for amber styles", () => {
      const metrics = { og: 1.055, fg: 1.012, abv: 5.6, ibu: 25, srm: 1 };
      const recipeData = { style: "American Amber Ale" };

      const suggestions = metricService.generateSuggestions(
        metrics,
        recipeData
      );

      expect(suggestions).toContain(
        "Add crystal or caramel malt for amber color"
      );
    });

    test("doesn't suggest hops for wheat beers", () => {
      const metrics = { og: 1.045, fg: 1.01, abv: 4.5, ibu: 8, srm: 3 };
      const recipeData = { style: "American Wheat Beer" };

      const suggestions = metricService.generateSuggestions(
        metrics,
        recipeData
      );

      expect(suggestions).not.toContain(
        "Consider adding hops for flavor balance"
      );
    });
  });

  describe("validation methods", () => {
    describe("validateGravity", () => {
      test("validates correct gravity values", () => {
        expect(metricService.validateGravity(1.055, 1.0)).toBe(1.055);
        expect(metricService.validateGravity("1.045", 1.0)).toBe(1.045);
      });

      test("returns default for invalid values", () => {
        expect(metricService.validateGravity("invalid", 1.0)).toBe(1.0);
        expect(metricService.validateGravity(0.5, 1.0)).toBe(1.0); // Too low
        expect(metricService.validateGravity(1.5, 1.0)).toBe(1.0); // Too high
        expect(metricService.validateGravity(null, 1.0)).toBe(1.0);
      });
    });

    describe("validatePercentage", () => {
      test("validates correct percentage values", () => {
        expect(metricService.validatePercentage(5.6, 0.0)).toBe(5.6);
        expect(metricService.validatePercentage("12.5", 0.0)).toBe(12.5);
      });

      test("returns default for invalid values", () => {
        expect(metricService.validatePercentage("invalid", 0.0)).toBe(0.0);
        expect(metricService.validatePercentage(-5, 0.0)).toBe(0.0); // Too low
        expect(metricService.validatePercentage(25, 0.0)).toBe(0.0); // Too high
        expect(metricService.validatePercentage(null, 0.0)).toBe(0.0);
      });
    });

    describe("validateNumber", () => {
      test("validates correct number values", () => {
        expect(metricService.validateNumber(25, 0)).toBe(25);
        expect(metricService.validateNumber("35.5", 0)).toBe(35.5);
      });

      test("returns default for invalid values", () => {
        expect(metricService.validateNumber("invalid", 0)).toBe(0);
        expect(metricService.validateNumber(-5, 0)).toBe(0); // Negative
        expect(metricService.validateNumber(null, 0)).toBe(0);
      });
    });
  });

  describe("generateCacheKey", () => {
    test("generates consistent cache keys", () => {
      const data1 = { batch_size: 5, efficiency: 75 };
      const data2 = { batch_size: 5, efficiency: 75 };
      const data3 = { batch_size: 10, efficiency: 75 };

      const key1 = metricService.generateCacheKey(data1);
      const key2 = metricService.generateCacheKey(data2);
      const key3 = metricService.generateCacheKey(data3);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe("clearCache", () => {
    test("clears calculation cache and timers", () => {
      // Add something to cache
      metricService.calculationCache.set("test", { og: 1.055 });

      // Set a debounce timer
      metricService.debounceTimers.set(
        "test-context",
        setTimeout(() => {}, 1000)
      );

      expect(metricService.calculationCache.size).toBe(1);
      expect(metricService.debounceTimers.size).toBe(1);

      metricService.clearCache();

      expect(metricService.calculationCache.size).toBe(0);
      expect(metricService.debounceTimers.size).toBe(0);
    });
  });

  describe("cancelCalculation", () => {
    test("cancels specific debounced calculation", () => {
      const contextId = "test-context";

      // Set a timer
      metricService.debounceTimers.set(
        contextId,
        setTimeout(() => {}, 1000)
      );
      expect(metricService.debounceTimers.has(contextId)).toBe(true);

      metricService.cancelCalculation(contextId);

      expect(metricService.debounceTimers.has(contextId)).toBe(false);
    });

    test("handles canceling non-existent calculation", () => {
      // Should not throw
      expect(() => {
        metricService.cancelCalculation("non-existent");
      }).not.toThrow();
    });
  });
});
