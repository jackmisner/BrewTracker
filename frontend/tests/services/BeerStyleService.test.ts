import BeerStyleService from "../../src/services/BeerStyleService";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("BeerStyleService", () => {
  let service: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let dateNowSpy: any;

  // Mock data
  const mockBeerStyles = {
    1: {
      category: "Light Lager",
      styles: [
        {
          style_id: "1A",
          name: "American Light Lager",
          category: "Light Lager",
          original_gravity: {
            minimum: { value: 1.028, unit: "" },
            maximum: { value: 1.04, unit: "" },
          },
          final_gravity: {
            minimum: { value: 0.998, unit: "" },
            maximum: { value: 1.008, unit: "" },
          },
          alcohol_by_volume: {
            minimum: { value: 2.8, unit: "%" },
            maximum: { value: 4.2, unit: "%" },
          },
          international_bitterness_units: {
            minimum: { value: 8, unit: "IBU" },
            maximum: { value: 12, unit: "IBU" },
          },
          color: {
            minimum: { value: 2, unit: "SRM" },
            maximum: { value: 3, unit: "SRM" },
          },
        },
      ],
    },
    2: {
      category: "International Lager",
      styles: [
        {
          style_id: "2A",
          name: "International Pale Lager",
          category: "International Lager",
          original_gravity: {
            minimum: { value: 1.042, unit: "" },
            maximum: { value: 1.05, unit: "" },
          },
          final_gravity: {
            minimum: { value: 1.008, unit: "" },
            maximum: { value: 1.012, unit: "" },
          },
          alcohol_by_volume: {
            minimum: { value: 4.6, unit: "%" },
            maximum: { value: 6.0, unit: "%" },
          },
          international_bitterness_units: {
            minimum: { value: 18, unit: "IBU" },
            maximum: { value: 25, unit: "IBU" },
          },
          color: {
            minimum: { value: 2, unit: "SRM" },
            maximum: { value: 6, unit: "SRM" },
          },
        },
      ],
    },
  };

  const mockSingleStyle = {
    style_id: "1A",
    name: "American Light Lager",
    category: "Light Lager",
    original_gravity: {
      minimum: { value: 1.028, unit: "" },
      maximum: { value: 1.04, unit: "" },
    },
    description:
      "A highly carbonated, very light-bodied, nearly flavorless lager.",
  };

  const mockStyleSuggestions = [
    {
      style_id: "1A",
      name: "American Light Lager",
      match_percentage: 85,
      matching_attributes: ["og", "fg", "abv"],
    },
    {
      style_id: "2A",
      name: "International Pale Lager",
      match_percentage: 72,
      matching_attributes: ["og", "ibu"],
    },
  ];

  const mockStyleAnalysis = {
    current_style: "1A",
    match_percentage: 85,
    matching_attributes: ["og", "fg", "abv"],
    non_matching_attributes: ["ibu", "srm"],
    suggestions: [
      {
        attribute: "ibu",
        current_value: 15,
        target_range: { min: 8, max: 12 },
        suggestion: "Reduce hop additions to lower IBU",
      },
    ],
  };

  const mockRecipeMetrics = {
    og: 1.045,
    fg: 1.01,
    abv: 4.6,
    ibu: 20,
    srm: 4,
  };

  beforeEach(() => {
    service = BeerStyleService;
    service.clearCache();
    jest.clearAllMocks();

    // Mock console methods
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock Date.now for cache testing
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1000000);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  describe("fetchBeerStyles", () => {
    test("fetches and caches beer styles", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: mockBeerStyles },
      });

      const result = await service.fetchBeerStyles();

      expect(ApiService.beerStyles.getAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockBeerStyles);
      expect(service.stylesCache).toEqual(mockBeerStyles);
      expect(service.cacheTimestamp).toBe(1000000);
    });

    test("returns cached data when cache is valid", async () => {
      // Set up cache
      service.stylesCache = mockBeerStyles;
      service.cacheTimestamp = 1000000;
      dateNowSpy.mockReturnValue(1000000 + 5 * 60 * 1000); // 5 minutes later

      const result = await service.fetchBeerStyles();

      expect(ApiService.beerStyles.getAll).not.toHaveBeenCalled();
      expect(result).toEqual(mockBeerStyles);
    });

    test("fetches fresh data when cache is expired", async () => {
      // Set up expired cache
      service.stylesCache = mockBeerStyles;
      service.cacheTimestamp = 1000000;
      dateNowSpy.mockReturnValue(1000000 + 15 * 60 * 1000); // 15 minutes later

      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: mockBeerStyles },
      });

      const result = await service.fetchBeerStyles();

      expect(ApiService.beerStyles.getAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockBeerStyles);
    });

    test("handles API errors gracefully", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

      const result = await service.fetchBeerStyles();

      expect(result).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beer styles:",
        expect.any(Error)
      );
    });

    test("handles missing categories in response", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: {},
      });

      const result = await service.fetchBeerStyles();

      expect(result).toEqual({});
    });
  });

  describe("searchBeerStyles", () => {
    test("searches beer styles successfully", async () => {
      const mockSearchResults = [mockSingleStyle];
      (ApiService.beerStyles.search as jest.Mock).mockResolvedValue({
        data: { styles: mockSearchResults },
      });

      const result = await service.searchBeerStyles("lager");

      expect(ApiService.beerStyles.search).toHaveBeenCalledWith("lager");
      expect(result).toEqual(mockSearchResults);
    });

    test("handles search errors gracefully", async () => {
      (ApiService.beerStyles.search as jest.Mock).mockRejectedValue(new Error("Search Error"));

      const result = await service.searchBeerStyles("lager");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error searching beer styles:",
        expect.any(Error)
      );
    });

    test("handles missing styles in search response", async () => {
      (ApiService.beerStyles.search as jest.Mock).mockResolvedValue({
        data: {},
      });

      const result = await service.searchBeerStyles("lager");

      expect(result).toEqual([]);
    });
  });

  describe("getBeerStyle", () => {
    test("fetches a specific beer style", async () => {
      (ApiService.beerStyles.getById as jest.Mock).mockResolvedValue({
        data: mockSingleStyle,
      });

      const result = await service.getBeerStyle("1A");

      expect(ApiService.beerStyles.getById).toHaveBeenCalledWith("1A");
      expect(result).toEqual(mockSingleStyle);
    });

    test("handles errors when fetching specific style", async () => {
      (ApiService.beerStyles.getById as jest.Mock).mockRejectedValue(new Error("Not Found"));

      const result = await service.getBeerStyle("INVALID");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beer style:",
        expect.any(Error)
      );
    });
  });

  describe("getStyleSuggestions", () => {
    test("fetches style suggestions for a recipe", async () => {
      (ApiService.beerStyles.getStyleSuggestions as jest.Mock).mockResolvedValue({
        data: { suggestions: mockStyleSuggestions },
      });

      const result = await service.getStyleSuggestions("recipe-123");

      expect(ApiService.beerStyles.getStyleSuggestions).toHaveBeenCalledWith(
        "recipe-123"
      );
      expect(result).toEqual(mockStyleSuggestions);
    });

    test("handles errors when fetching style suggestions", async () => {
      (ApiService.beerStyles.getStyleSuggestions as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      const result = await service.getStyleSuggestions("recipe-123");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error getting style suggestions:",
        expect.any(Error)
      );
    });

    test("handles missing suggestions in response", async () => {
      (ApiService.beerStyles.getStyleSuggestions as jest.Mock).mockResolvedValue({
        data: {},
      });

      const result = await service.getStyleSuggestions("recipe-123");

      expect(result).toEqual([]);
    });
  });

  describe("getRecipeStyleAnalysis", () => {
    test("fetches recipe style analysis", async () => {
      (ApiService.beerStyles.getRecipeStyleAnalysis as jest.Mock).mockResolvedValue({
        data: { analysis: mockStyleAnalysis },
      });

      const result = await service.getRecipeStyleAnalysis("recipe-123");

      expect(ApiService.beerStyles.getRecipeStyleAnalysis).toHaveBeenCalledWith(
        "recipe-123"
      );
      expect(result).toEqual(mockStyleAnalysis);
    });

    test("handles errors when fetching style analysis", async () => {
      (ApiService.beerStyles.getRecipeStyleAnalysis as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      const result = await service.getRecipeStyleAnalysis("recipe-123");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error getting style analysis:",
        expect.any(Error)
      );
    });
  });

  describe("getAllStylesList", () => {
    test("flattens categorized styles into a sorted list", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: mockBeerStyles },
      });

      const result = await service.getAllStylesList();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        style_id: "1A",
        name: "American Light Lager",
        display_name: "1A - American Light Lager",
        category_name: "Light Lager",
      });
      expect(result[1]).toMatchObject({
        style_id: "2A",
        name: "International Pale Lager",
        display_name: "2A - International Pale Lager",
        category_name: "International Lager",
      });
    });

    test("handles categories without styles array", async () => {
      const malformedStyles = {
        1: {
          category: "Test Category",
          // Missing styles array
        },
      };

      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: malformedStyles },
      });

      const result = await service.getAllStylesList();

      expect(result).toEqual([]);
    });

    test("handles errors when fetching styles list", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

      const result = await service.getAllStylesList();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beer styles:",
        expect.any(Error)
      );
    });
  });

  describe("findMatchingStyles", () => {
    beforeEach(() => {
      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: mockBeerStyles },
      });
    });

    test("finds styles that match recipe metrics", async () => {
      const metrics = {
        og: 1.045, // Matches 2A but not 1A
        fg: 1.01, // Matches 2A but not 1A
        abv: 5.0, // Matches 2A but not 1A
        ibu: 20, // Matches 2A but not 1A
        srm: 4, // Matches 2A but not 1A
      };

      const result = await service.findMatchingStyles(metrics);

      expect(result).toHaveLength(1);
      expect(result[0].style.style_id).toBe("2A");
      expect(result[0].match_percentage).toBe(100);
    });

    test("excludes styles with low match percentage", async () => {
      const metrics = {
        og: 1.02, // Doesn't match any style
        fg: 1.02, // Doesn't match any style
        abv: 1.0, // Doesn't match any style
        ibu: 50, // Doesn't match any style
        srm: 20, // Doesn't match any style
      };

      const result = await service.findMatchingStyles(metrics);

      expect(result).toHaveLength(0);
    });

    test("sorts results by match percentage", async () => {
      // Create a style that will have a lower match percentage
      const partialMatchStyle = {
        style_id: "1B",
        name: "Partial Match Style",
        category: "Light Lager",
        original_gravity: {
          minimum: { value: 1.04, unit: "" },
          maximum: { value: 1.05, unit: "" },
        },
        final_gravity: {
          minimum: { value: 1.008, unit: "" },
          maximum: { value: 1.012, unit: "" },
        },
        alcohol_by_volume: {
          minimum: { value: 4.0, unit: "%" },
          maximum: { value: 6.0, unit: "%" },
        },
        // Missing IBU and SRM ranges - will only match 3/5 = 60%
      };

      const modifiedStyles = {
        ...mockBeerStyles,
        1: {
          ...mockBeerStyles["1"],
          styles: [...mockBeerStyles["1"].styles, partialMatchStyle],
        },
      };

      (ApiService.beerStyles.getAll as jest.Mock).mockResolvedValue({
        data: { categories: modifiedStyles },
      });

      const metrics = {
        og: 1.045,
        fg: 1.01,
        abv: 5.0,
        ibu: 20,
        srm: 4,
      };

      const result = await service.findMatchingStyles(metrics);

      // Should have both styles: one with 100% match, one with 60% match
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Should be sorted by match percentage (highest first)
      if (result.length > 1) {
        expect(result[0].match_percentage).toBeGreaterThanOrEqual(
          result[1].match_percentage
        );
      }
    });

    test("handles errors when finding matching styles", async () => {
      (ApiService.beerStyles.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

      const result = await service.findMatchingStyles(mockRecipeMetrics);

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching beer styles:",
        expect.any(Error)
      );
    });
  });

  describe("calculateStyleMatch", () => {
    const testStyle = mockBeerStyles["2"]["styles"][0]; // International Pale Lager

    test("calculates perfect match when all metrics are in range", () => {
      const metrics = {
        og: 1.045,
        fg: 1.01,
        abv: 5.0,
        ibu: 20,
        srm: 4,
      };

      const result = service.calculateStyleMatch(testStyle, metrics);

      expect(result.percentage).toBe(100);
      expect(result.matchingSpecs).toBe(5);
      expect(result.totalSpecs).toBe(5);
      expect(result.matches.og).toBe(true);
      expect(result.matches.fg).toBe(true);
      expect(result.matches.abv).toBe(true);
      expect(result.matches.ibu).toBe(true);
      expect(result.matches.srm).toBe(true);
    });

    test("calculates partial match when some metrics are out of range", () => {
      const metrics = {
        og: 1.045, // In range
        fg: 1.01, // In range
        abv: 7.0, // Out of range (max 6.0)
        ibu: 30, // Out of range (max 25)
        srm: 4, // In range
      };

      const result = service.calculateStyleMatch(testStyle, metrics);

      expect(result.percentage).toBe(60); // 3/5 = 60%
      expect(result.matchingSpecs).toBe(3);
      expect(result.matches.og).toBe(true);
      expect(result.matches.fg).toBe(true);
      expect(result.matches.abv).toBe(false);
      expect(result.matches.ibu).toBe(false);
      expect(result.matches.srm).toBe(true);
    });

    test("handles missing or zero metrics", () => {
      const metrics = {
        og: 0,
        fg: null,
        abv: undefined,
        ibu: 20,
        srm: 4,
      };

      const result = service.calculateStyleMatch(testStyle, metrics);

      expect(result.percentage).toBe(40); // 2/5 = 40%
      expect(result.matches.og).toBe(false);
      expect(result.matches.fg).toBe(false);
      expect(result.matches.abv).toBe(false);
      expect(result.matches.ibu).toBe(true);
      expect(result.matches.srm).toBe(true);
    });

    test("handles style with missing ranges", () => {
      const incompleteStyle = {
        style_id: "TEST",
        name: "Test Style",
        original_gravity: null,
        final_gravity: undefined,
        alcohol_by_volume: {
          minimum: { value: 4.0, unit: "%" },
          maximum: { value: 6.0, unit: "%" },
        },
        // Missing IBU and SRM completely
      };

      const metrics = {
        og: 1.045,
        fg: 1.01,
        abv: 5.0,
      };

      const result = service.calculateStyleMatch(incompleteStyle, metrics);

      // Properties for missing ranges should be undefined, not false
      expect(result.matches.og).toBeUndefined();
      expect(result.matches.fg).toBeUndefined();
      expect(result.matches.abv).toBe(true);
      expect(result.matches.ibu).toBeUndefined();
      expect(result.matches.srm).toBeUndefined();
    });
  });

  describe("isInRange", () => {
    const testRange = {
      minimum: { value: 1.04, unit: "" },
      maximum: { value: 1.05, unit: "" },
    };

    test("returns true for value within range", () => {
      expect(service.isInRange(1.045, testRange)).toBe(true);
      expect(service.isInRange(1.04, testRange)).toBe(true); // At minimum
      expect(service.isInRange(1.05, testRange)).toBe(true); // At maximum
    });

    test("returns false for value outside range", () => {
      expect(service.isInRange(1.035, testRange)).toBe(false);
      expect(service.isInRange(1.055, testRange)).toBe(false);
    });

    test("handles invalid range", () => {
      expect(service.isInRange(1.045, null)).toBe(false);
      expect(service.isInRange(1.045, {})).toBe(false);
      expect(service.isInRange(1.045, { minimum: null })).toBe(false);
      expect(service.isInRange(1.045, { maximum: null })).toBe(false);
    });
  });

  describe("formatStyleRange", () => {
    test("formats range with different min and max", () => {
      const range = {
        minimum: { value: 1.04, unit: "" },
        maximum: { value: 1.05, unit: "" },
      };

      expect(service.formatStyleRange(range, 3)).toBe("1.040-1.050");
    });

    test("formats range with same min and max", () => {
      const range = {
        minimum: { value: 5.0, unit: "%" },
        maximum: { value: 5.0, unit: "%" },
      };

      expect(service.formatStyleRange(range, 1)).toBe("5.0%");
    });

    test("formats range with units", () => {
      const range = {
        minimum: { value: 18, unit: "IBU" },
        maximum: { value: 25, unit: "IBU" },
      };

      expect(service.formatStyleRange(range, 0)).toBe("18-25IBU");
    });

    test("handles invalid range", () => {
      expect(service.formatStyleRange(null)).toBe("-");
      expect(service.formatStyleRange({})).toBe("-");
      expect(service.formatStyleRange({ minimum: null })).toBe("-");
    });

    test("uses default precision", () => {
      const range = {
        minimum: { value: 1.0405, unit: "" },
        maximum: { value: 1.0507, unit: "" },
      };

      expect(service.formatStyleRange(range)).toBe("1.0-1.1");
    });
  });

  describe("cache functionality", () => {
    test("isCacheValid returns true for fresh cache", () => {
      service.cacheTimestamp = 1000000;
      dateNowSpy.mockReturnValue(1000000 + 5 * 60 * 1000); // 5 minutes later

      expect(service.isCacheValid()).toBe(true);
    });

    test("isCacheValid returns false for expired cache", () => {
      service.cacheTimestamp = 1000000;
      dateNowSpy.mockReturnValue(1000000 + 15 * 60 * 1000); // 15 minutes later

      expect(service.isCacheValid()).toBe(false);
    });

    test("isCacheValid returns false when no timestamp", () => {
      service.cacheTimestamp = null;

      expect(service.isCacheValid()).toBeFalsy(); // Can be false or null
    });

    test("clearCache clears cache and timestamp", () => {
      service.stylesCache = mockBeerStyles;
      service.cacheTimestamp = 1000000;

      service.clearCache();

      expect(service.stylesCache).toBeNull();
      expect(service.cacheTimestamp).toBeNull();
    });
  });
});
