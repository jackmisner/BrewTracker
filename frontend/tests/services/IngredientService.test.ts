import IngredientService from "../../src/services/IngredientService";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("IngredientService", () => {
  let ingredientService: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    ingredientService = IngredientService;
    ingredientService.clearCache();
    jest.clearAllMocks();

    // Mock console.warn and console.error
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console mocks
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("groupIngredientsByType", () => {
    test("groups ingredients correctly", () => {
      const ingredients = [
        { ingredient_id: 1, name: "Pale Malt", type: "grain" },
        { ingredient_id: 2, name: "Cascade", type: "hop" },
        { ingredient_id: 3, name: "US-05", type: "yeast" },
        { ingredient_id: 4, name: "Irish Moss", type: "adjunct" },
        { ingredient_id: 5, name: "Honey", type: "other" },
      ];

      const grouped = ingredientService.groupIngredientsByType(ingredients);

      expect(grouped).toEqual({
        grain: [{ ingredient_id: 1, name: "Pale Malt", type: "grain" }],
        hop: [{ ingredient_id: 2, name: "Cascade", type: "hop" }],
        yeast: [{ ingredient_id: 3, name: "US-05", type: "yeast" }],
        other: [
          { ingredient_id: 4, name: "Irish Moss", type: "adjunct" },
          { ingredient_id: 5, name: "Honey", type: "other" },
        ],
      });
    });

    test("handles unknown ingredient types", () => {
      const ingredients = [
        { ingredient_id: 1, name: "Unknown", type: "mystery" },
      ];

      const grouped = ingredientService.groupIngredientsByType(ingredients);

      expect(grouped.other).toContainEqual({
        ingredient_id: 1,
        name: "Unknown",
        type: "mystery",
      });
    });

    test("handles empty array", () => {
      const grouped = ingredientService.groupIngredientsByType([]);

      expect(grouped).toEqual({
        grain: [],
        hop: [],
        yeast: [],
        other: [],
      });
    });
  });

  describe("createRecipeIngredient", () => {
    const availableIngredients = {
      grain: [
        {
          ingredient_id: 1,
          name: "Pale Malt",
          potential: 1.037,
          color: 2,
          grain_type: "base_malt",
        },
      ],
      hop: [
        {
          ingredient_id: 2,
          name: "Cascade",
          alpha_acid: 5.5,
        },
      ],
      yeast: [
        {
          ingredient_id: 3,
          name: "US-05",
          attenuation: 81,
        },
      ],
    };

    test("creates grain ingredient correctly", () => {
      const ingredientData = {
        ingredient_id: 1,
        amount: 10,
        unit: "lb",
        color: 3, // Override color
      };

      const result = ingredientService.createRecipeIngredient(
        "grain",
        ingredientData,
        availableIngredients
      );

      expect(result).toMatchObject({
        ingredient_id: 1,
        name: "Pale Malt",
        type: "grain",
        amount: 10,
        unit: "lb",
        potential: 1.037,
        color: 3, // Should use overridden color
        grain_type: "base_malt",
      });
      expect(result.id).toBeDefined();
    });

    test("creates hop ingredient correctly", () => {
      const ingredientData = {
        ingredient_id: 2,
        amount: 1,
        unit: "oz",
        use: "boil",
        time: 60,
        time_unit: "minutes",
        alpha_acid: 6.0, // Override alpha acid
      };

      const result = ingredientService.createRecipeIngredient(
        "hop",
        ingredientData,
        availableIngredients
      );

      expect(result).toMatchObject({
        ingredient_id: 2,
        name: "Cascade",
        type: "hop",
        amount: 1,
        unit: "oz",
        use: "boil",
        time: 60,
        alpha_acid: 6.0, // Should use overridden value
      });
    });

    test("creates yeast ingredient correctly", () => {
      const ingredientData = {
        ingredient_id: 3,
        amount: 1,
        unit: "pkg",
      };

      const result = ingredientService.createRecipeIngredient(
        "yeast",
        ingredientData,
        availableIngredients
      );

      expect(result).toMatchObject({
        ingredient_id: 3,
        name: "US-05",
        type: "yeast",
        amount: 1,
        unit: "pkg",
        attenuation: 81,
      });
    });
  });

  describe("scaleIngredients", () => {
    test("scales ingredient amounts correctly", () => {
      const ingredients = [
        { id: 1, amount: 10, unit: "lb" },
        { id: 2, amount: 1, unit: "oz" },
        { id: 3, amount: 0.5, unit: "tsp" },
      ];

      const scalingFactor = 2;
      const scaled = ingredientService.scaleIngredients(
        ingredients,
        scalingFactor
      );

      expect(scaled).toEqual([
        { id: 1, amount: 20, unit: "lb" },
        { id: 2, amount: 2, unit: "oz" },
        { id: 3, amount: 1, unit: "tsp" },
      ]);
    });

    test("handles scaling down", () => {
      const ingredients = [{ id: 1, amount: 10, unit: "lb" }];
      const scalingFactor = 0.5;

      const scaled = ingredientService.scaleIngredients(
        ingredients,
        scalingFactor
      );

      expect(scaled[0].amount).toBe(5);
    });
  });

  describe("sortIngredients", () => {
    test("sorts ingredients by type and specific criteria", () => {
      const ingredients = [
        { id: 1, type: "yeast", name: "US-05" },
        { id: 2, type: "hop", name: "Cascade", use: "dry hop", time: 7 },
        {
          id: 3,
          type: "grain",
          name: "Crystal 40",
          grain_type: "caramel_crystal",
        },
        { id: 4, type: "hop", name: "Centennial", use: "boil", time: 60 },
        { id: 5, type: "grain", name: "Pale Malt", grain_type: "base_malt" },
        { id: 6, type: "hop", name: "Citra", use: "boil", time: 15 },
      ];

      const sorted = ingredientService.sortIngredients(ingredients);

      // Check type order: grain, hop, yeast
      expect(sorted[0].type).toBe("grain");
      expect(sorted[1].type).toBe("grain");
      expect(sorted[2].type).toBe("hop");
      expect(sorted[3].type).toBe("hop");
      expect(sorted[4].type).toBe("hop");
      expect(sorted[5].type).toBe("yeast");

      // Check grain sorting (base malt first)
      expect(sorted[0].grain_type).toBe("base_malt");
      expect(sorted[1].grain_type).toBe("caramel_crystal");

      // Check hop sorting (boil before dry hop, higher time first)
      const hopSection = sorted.slice(2, 5);
      const boilHops = hopSection.filter((h) => h.use === "boil");
      expect(boilHops[0].time).toBeGreaterThan(boilHops[1].time);
    });
  });

  describe("validateIngredientData", () => {
    test("validates valid ingredient data", () => {
      const ingredientData = {
        ingredient_id: 1,
        amount: 10,
        unit: "lb",
      };

      const result = ingredientService.validateIngredientData(
        "grain",
        ingredientData
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates hop-specific requirements", () => {
      const hopData = {
        ingredient_id: 1,
        amount: 1,
        unit: "oz",
        use: "boil",
        time: 60,
      };

      const result = ingredientService.validateIngredientData("hop", hopData);

      expect(result.isValid).toBe(true);
    });

    test("catches validation errors", () => {
      const invalidData = {
        ingredient_id: null,
        amount: 0,
        unit: "",
      };

      const result = ingredientService.validateIngredientData(
        "grain",
        invalidData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Ingredient selection is required");
      expect(result.errors).toContain("Amount must be greater than 0");
      expect(result.errors).toContain("Unit is required");
    });

    test("validates hop-specific errors", () => {
      const hopData = {
        ingredient_id: 1,
        amount: 1,
        unit: "oz",
        use: "boil",
        // Missing time for boil hop
      };

      const result = ingredientService.validateIngredientData("hop", hopData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Boil time is required for boil hops");
    });

    test("allows hop with time: 0 for late additions", () => {
      const hopData = {
        ingredient_id: 1,
        amount: 1,
        unit: "oz",
        use: "boil",
        time: 0, // Late addition/flameout hop
      };

      const result = ingredientService.validateIngredientData("hop", hopData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("formatIngredientsForApi", () => {
    test("formats ingredients correctly for API", () => {
      const ingredients = [
        {
          id: "test-1",
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
          id: "test-2",
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

      const formatted = ingredientService.formatIngredientsForApi(ingredients);

      expect(formatted).toEqual([
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

    test("handles null or undefined input", () => {
      expect(ingredientService.formatIngredientsForApi(null)).toEqual([]);
      expect(ingredientService.formatIngredientsForApi(undefined)).toEqual([]);
      expect(ingredientService.formatIngredientsForApi([])).toEqual([]);
    });
  });

  describe("fetchIngredients", () => {
    test("fetches and caches ingredients", async () => {
      const mockIngredients = [
        { ingredient_id: 1, name: "Pale Malt", type: "grain" },
        { ingredient_id: 2, name: "Cascade", type: "hop" },
      ];

      (ApiService.ingredients.getAll as jest.Mock).mockResolvedValue({
        data: mockIngredients,
      });

      const result = await ingredientService.fetchIngredients();

      expect(ApiService.ingredients.getAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        grain: [{ ingredient_id: 1, name: "Pale Malt", type: "grain" }],
        hop: [{ ingredient_id: 2, name: "Cascade", type: "hop" }],
        yeast: [],
        other: [],
      });

      // Second call should use cache
      const cachedResult = await ingredientService.fetchIngredients();
      expect(ApiService.ingredients.getAll).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(cachedResult).toEqual(result);
    });

    test("handles API errors", async () => {
      (ApiService.ingredients.getAll as jest.Mock).mockRejectedValue(new Error("API Error"));

      await expect(ingredientService.fetchIngredients()).rejects.toThrow(
        "Failed to load ingredients"
      );
    });
  });
});
