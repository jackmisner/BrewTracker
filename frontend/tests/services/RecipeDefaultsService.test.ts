import React from "react";
import RecipeDefaultsService, {
  useRecipeDefaults,
} from "../../src/services/RecipeDefaultsService";
import { renderHook } from "@testing-library/react";

// Mock the UnitContext
const mockUseUnits = {
  unitSystem: "imperial",
  updateUnitSystem: jest.fn(),
  loading: false,
};

jest.mock("../../src/contexts/UnitContext", () => ({
  useUnits: () => mockUseUnits,
  UnitProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("RecipeDefaultsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to imperial as default for consistent test behavior
    mockUseUnits.unitSystem = "imperial";
  });

  describe("getDefaultBatchSize", () => {
    it("returns 5.0 gallons for imperial system", () => {
      const result = RecipeDefaultsService.getDefaultBatchSize("imperial");
      expect(result).toBe(5.0);
    });

    it("returns 19.0 liters for metric system", () => {
      const result = RecipeDefaultsService.getDefaultBatchSize("metric");
      expect(result).toBe(19.0);
    });

    it("defaults to imperial when no unit system provided", () => {
      const result = RecipeDefaultsService.getDefaultBatchSize();
      expect(result).toBe(5.0);
    });

    it("defaults to imperial for unknown unit system", () => {
      const result = RecipeDefaultsService.getDefaultBatchSize("unknown");
      expect(result).toBe(5.0);
    });
  });

  describe("getDefaultEfficiency", () => {
    it("returns 75% efficiency", () => {
      const result = RecipeDefaultsService.getDefaultEfficiency();
      expect(result).toBe(75.0);
    });

    it("returns consistent value on multiple calls", () => {
      const result1 = RecipeDefaultsService.getDefaultEfficiency();
      const result2 = RecipeDefaultsService.getDefaultEfficiency();
      expect(result1).toBe(result2);
    });
  });

  describe("getDefaultBoilTime", () => {
    it("returns 60 minutes", () => {
      const result = RecipeDefaultsService.getDefaultBoilTime();
      expect(result).toBe(60);
    });

    it("returns consistent value on multiple calls", () => {
      const result1 = RecipeDefaultsService.getDefaultBoilTime();
      const result2 = RecipeDefaultsService.getDefaultBoilTime();
      expect(result1).toBe(result2);
    });
  });

  describe("getDefaultRecipeData", () => {
    it("returns complete default recipe data for imperial", () => {
      const result = RecipeDefaultsService.getDefaultRecipeData("imperial");

      expect(result).toEqual({
        name: "",
        style: "",
        batch_size: 5.0,
        description: "",
        is_public: false,
        boil_time: 60,
        efficiency: 75.0,
        notes: "",
      });
    });

    it("returns complete default recipe data for metric", () => {
      const result = RecipeDefaultsService.getDefaultRecipeData("metric");

      expect(result).toEqual({
        name: "",
        style: "",
        batch_size: 19.0,
        description: "",
        is_public: false,
        boil_time: 60,
        efficiency: 75.0,
        notes: "",
      });
    });

    it("defaults to imperial when no unit system provided", () => {
      const result = RecipeDefaultsService.getDefaultRecipeData();

      expect(result.batch_size).toBe(5.0);
    });

    it("includes all required recipe fields", () => {
      const result = RecipeDefaultsService.getDefaultRecipeData("imperial");

      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("style");
      expect(result).toHaveProperty("batch_size");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("is_public");
      expect(result).toHaveProperty("boil_time");
      expect(result).toHaveProperty("efficiency");
      expect(result).toHaveProperty("notes");
    });

    it("returns new object on each call", () => {
      const result1 = RecipeDefaultsService.getDefaultRecipeData("imperial");
      const result2 = RecipeDefaultsService.getDefaultRecipeData("imperial");

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe("getSuggestedUnits", () => {
    it("returns imperial units", () => {
      const result = RecipeDefaultsService.getSuggestedUnits("imperial");

      expect(result).toEqual({
        grain: "lb",
        hop: "oz",
        yeast: "pkg",
        other: "oz",
        volume: "gal",
        temperature: "f",
      });
    });

    it("returns metric units", () => {
      const result = RecipeDefaultsService.getSuggestedUnits("metric");

      expect(result).toEqual({
        grain: "kg",
        hop: "g",
        yeast: "pkg",
        other: "g",
        volume: "l",
        temperature: "c",
      });
    });

    it("includes all ingredient types", () => {
      const result = RecipeDefaultsService.getSuggestedUnits("imperial");

      expect(result).toHaveProperty("grain");
      expect(result).toHaveProperty("hop");
      expect(result).toHaveProperty("yeast");
      expect(result).toHaveProperty("other");
      expect(result).toHaveProperty("volume");
      expect(result).toHaveProperty("temperature");
    });

    it("uses universal package unit for yeast", () => {
      const imperial = RecipeDefaultsService.getSuggestedUnits("imperial");
      const metric = RecipeDefaultsService.getSuggestedUnits("metric");

      expect(imperial.yeast).toBe("pkg");
      expect(metric.yeast).toBe("pkg");
    });
  });

  describe("getTypicalBatchSizes", () => {
    it("returns imperial batch sizes", () => {
      const result = RecipeDefaultsService.getTypicalBatchSizes("imperial");

      expect(result).toEqual([
        { value: 2.5, label: "2.5 gal", description: "Small test batch" },
        { value: 5, label: "5 gal", description: "Standard homebrew batch" },
        { value: 6, label: "6 gal", description: "Large batch" },
        { value: 10, label: "10 gal", description: "Very large batch" },
      ]);
    });

    it("returns metric batch sizes", () => {
      const result = RecipeDefaultsService.getTypicalBatchSizes("metric");

      expect(result).toEqual([
        {
          value: 10,
          label: "10 L (Small batch)",
          description: "Small test batch",
        },
        {
          value: 19,
          label: "19 L (5 gal)",
          description: "Standard homebrew batch",
        },
        { value: 23, label: "23 L (6 gal)", description: "Large batch" },
        { value: 38, label: "38 L (10 gal)", description: "Very large batch" },
      ]);
    });

    it("returns arrays with consistent structure", () => {
      const imperial = RecipeDefaultsService.getTypicalBatchSizes("imperial");
      const metric = RecipeDefaultsService.getTypicalBatchSizes("metric");

      expect(Array.isArray(imperial)).toBe(true);
      expect(Array.isArray(metric)).toBe(true);
      expect(imperial.length).toBe(4);
      expect(metric.length).toBe(4);

      imperial.forEach((size) => {
        expect(size).toHaveProperty("value");
        expect(size).toHaveProperty("label");
        expect(size).toHaveProperty("description");
      });

      metric.forEach((size) => {
        expect(size).toHaveProperty("value");
        expect(size).toHaveProperty("label");
        expect(size).toHaveProperty("description");
      });
    });

    it("returns increasing batch sizes", () => {
      const imperial = RecipeDefaultsService.getTypicalBatchSizes("imperial");
      const metric = RecipeDefaultsService.getTypicalBatchSizes("metric");

      for (let i = 1; i < imperial.length; i++) {
        expect((imperial[i] as HTMLInputElement).value).toBeGreaterThan(imperial[i - 1].value);
      }

      for (let i = 1; i < metric.length; i++) {
        expect((metric[i] as HTMLInputElement).value).toBeGreaterThan(metric[i - 1].value);
      }
    });
  });

  describe("getDefaultIngredientAmounts", () => {
    describe("grain calculations", () => {
      it("calculates grain amount for imperial 5 gallon batch", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          5.0,
          "imperial"
        );

        expect(result.amount).toBe("8.8"); // 5 * 1.75 = 8.75, rounded to 8.8
        expect(result.unit).toBe("lb");
      });

      it("calculates grain amount for metric 19 liter batch", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          19.0,
          "metric"
        );

        // 19L / 3.78541 = ~5.02 gal, * 1.75 = ~8.78 lb, / 2.20462 = ~3.98 kg
        expect(parseFloat(result.amount)).toBeCloseTo(4.0, 1);
        expect(result.unit).toBe("kg");
      });

      it("scales proportionally with batch size", () => {
        const result5gal = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          5.0,
          "imperial"
        );
        const result10gal = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          10.0,
          "imperial"
        );

        // Exact calculations:
        // 5 gal: 5 * 1.75 = 8.75, rounded to 1 decimal = 8.8
        // 10 gal: 10 * 1.75 = 17.5, rounded to 1 decimal = 17.5
        expect(result5gal.amount).toBe("8.8");
        expect(result10gal.amount).toBe("17.5");

        // Verify the ratio is approximately 2:1 (accounting for rounding)
        const ratio =
          parseFloat(result10gal.amount) / parseFloat(result5gal.amount);
        expect(ratio).toBeCloseTo(2, 1);
      });
    });

    describe("hop calculations", () => {
      it("calculates hop amount for imperial 5 gallon batch", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "hop",
          5.0,
          "imperial"
        );

        expect(result.amount).toBe("1.00"); // 5 * 0.2 = 1.0
        expect(result.unit).toBe("oz");
      });

      it("calculates hop amount for metric 19 liter batch", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "hop",
          19.0,
          "metric"
        );

        // 19L / 3.78541 = ~5.02 gal, * 0.2 = ~1.00 oz, * 28.3495 = ~28g
        expect(result.amount).toBe("28"); // Rounded to nearest gram
        expect(result.unit).toBe("g");
      });

      it("handles small batch sizes", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "hop",
          2.5,
          "imperial"
        );

        expect(result.amount).toBe("0.50"); // 2.5 * 0.2 = 0.5
        expect(result.unit).toBe("oz");
      });
    });

    describe("yeast calculations", () => {
      it("returns 1 package for any batch size", () => {
        const result5gal = RecipeDefaultsService.getDefaultIngredientAmounts(
          "yeast",
          5.0,
          "imperial"
        );
        const result10gal = RecipeDefaultsService.getDefaultIngredientAmounts(
          "yeast",
          10.0,
          "imperial"
        );
        const resultMetric = RecipeDefaultsService.getDefaultIngredientAmounts(
          "yeast",
          19.0,
          "metric"
        );

        expect(result5gal.amount).toBe("1");
        expect(result5gal.unit).toBe("pkg");
        expect(result10gal.amount).toBe("1");
        expect(result10gal.unit).toBe("pkg");
        expect(resultMetric.amount).toBe("1");
        expect(resultMetric.unit).toBe("pkg");
      });
    });

    describe("other ingredient calculations", () => {
      it("returns default amounts for other ingredients in imperial", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "other",
          5.0,
          "imperial"
        );

        expect(result.amount).toBe("0.5");
        expect(result.unit).toBe("oz");
      });

      it("returns default amounts for other ingredients in metric", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "other",
          19.0,
          "metric"
        );

        expect(result.amount).toBe("10");
        expect(result.unit).toBe("g");
      });

      it("handles unknown ingredient types", () => {
        const resultImperial =
          RecipeDefaultsService.getDefaultIngredientAmounts(
            "unknown",
            5.0,
            "imperial"
          );
        const resultMetric = RecipeDefaultsService.getDefaultIngredientAmounts(
          "unknown",
          19.0,
          "metric"
        );

        expect(resultImperial.amount).toBe("0.5");
        expect(resultImperial.unit).toBe("oz");
        expect(resultMetric.amount).toBe("10");
        expect(resultMetric.unit).toBe("g");
      });
    });

    describe("edge cases", () => {
      it("handles zero batch size", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          0,
          "imperial"
        );

        expect(result.amount).toBe("0.0");
        expect(result.unit).toBe("lb");
      });

      it("handles very large batch sizes", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          100,
          "imperial"
        );

        expect(parseFloat(result.amount)).toBe(175.0); // 100 * 1.75
        expect(result.unit).toBe("lb");
      });

      it("handles fractional batch sizes", () => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          3.5,
          "imperial"
        );

        expect(parseFloat(result.amount)).toBe(6.1); // 3.5 * 1.75 = 6.125, rounded to 6.1
        expect(result.unit).toBe("lb");
      });
    });
  });

  describe("useRecipeDefaults hook", () => {
    it("returns functions that use current unit system", () => {
      const { result } = renderHook(() => useRecipeDefaults());

      expect(typeof result.current.getDefaultRecipeData).toBe("function");
      expect(typeof result.current.getDefaultBatchSize).toBe("function");
      expect(typeof result.current.getSuggestedUnits).toBe("function");
      expect(typeof result.current.getTypicalBatchSizes).toBe("function");
      expect(typeof result.current.getDefaultIngredientAmounts).toBe(
        "function"
      );
    });

    it("uses imperial unit system from context", () => {
      mockUseUnits.unitSystem = "imperial";

      const { result } = renderHook(() => useRecipeDefaults());

      const recipeData = result.current.getDefaultRecipeData();
      const batchSize = result.current.getDefaultBatchSize();
      const units = result.current.getSuggestedUnits();

      expect(recipeData.batch_size).toBe(5.0);
      expect(batchSize).toBe(5.0);
      expect(units.grain).toBe("lb");

      // Reset for other tests
      mockUseUnits.unitSystem = "imperial";
    });

    it("uses metric unit system from context", () => {
      mockUseUnits.unitSystem = "metric";

      const { result } = renderHook(() => useRecipeDefaults());

      const recipeData = result.current.getDefaultRecipeData();
      const batchSize = result.current.getDefaultBatchSize();
      const units = result.current.getSuggestedUnits();

      expect(recipeData.batch_size).toBe(19.0);
      expect(batchSize).toBe(19.0);
      expect(units.grain).toBe("kg");

      // Reset for other tests
      mockUseUnits.unitSystem = "imperial";
    });

    it("getDefaultIngredientAmounts works with context unit system", () => {
      mockUseUnits.unitSystem = "metric";

      const { result } = renderHook(() => useRecipeDefaults());

      const grainAmount = result.current.getDefaultIngredientAmounts(
        "grain",
        19.0
      );

      expect(grainAmount.unit).toBe("kg");
      expect(parseFloat(grainAmount.amount)).toBeCloseTo(4.0, 1);

      // Reset for other tests
      mockUseUnits.unitSystem = "imperial";
    });

    it("returns typical batch sizes for current unit system", () => {
      mockUseUnits.unitSystem = "imperial";

      const { result } = renderHook(() => useRecipeDefaults());

      const batchSizes = result.current.getTypicalBatchSizes();

      expect(batchSizes).toHaveLength(4);
      expect((batchSizes[1] as HTMLInputElement).value).toBe(5);
      expect(batchSizes[1].label).toBe("5 gal");
    });

    it("updates when unit system changes", () => {
      const { result, rerender } = renderHook(() => useRecipeDefaults());

      // Start with imperial
      mockUseUnits.unitSystem = "imperial";
      rerender();

      let batchSize = result.current.getDefaultBatchSize();
      expect(batchSize).toBe(5.0);

      // Switch to metric
      mockUseUnits.unitSystem = "metric";
      rerender();

      batchSize = result.current.getDefaultBatchSize();
      expect(batchSize).toBe(19.0);

      // Reset for other tests
      mockUseUnits.unitSystem = "imperial";
    });
  });

  describe("unit conversions", () => {
    it("converts gallons to liters correctly for grain calculations", () => {
      const imperial5gal = RecipeDefaultsService.getDefaultIngredientAmounts(
        "grain",
        5.0,
        "imperial"
      );
      const metric19L = RecipeDefaultsService.getDefaultIngredientAmounts(
        "grain",
        19.0,
        "metric"
      );

      // 5 gallons ≈ 18.93 liters, so 19L should give similar amounts when converted
      const imperial5galInKg = parseFloat(imperial5gal.amount) / 2.20462;
      const metric19LInKg = parseFloat(metric19L.amount);

      expect(metric19LInKg).toBeCloseTo(imperial5galInKg, 0);
    });

    it("converts ounces to grams correctly for hop calculations", () => {
      const imperial = RecipeDefaultsService.getDefaultIngredientAmounts(
        "hop",
        5.0,
        "imperial"
      );
      const metric = RecipeDefaultsService.getDefaultIngredientAmounts(
        "hop",
        19.0,
        "metric"
      );

      // 1 oz ≈ 28.35g
      const imperialInGrams = parseFloat(imperial.amount) * 28.3495;
      const metricGrams = parseFloat(metric.amount);

      expect(metricGrams).toBeCloseTo(imperialInGrams, 0);
    });
  });

  describe("static method consistency", () => {
    it("getDefaultRecipeData uses other static methods correctly", () => {
      const recipeData = RecipeDefaultsService.getDefaultRecipeData("imperial");

      expect(recipeData.batch_size).toBe(
        RecipeDefaultsService.getDefaultBatchSize("imperial")
      );
      expect(recipeData.boil_time).toBe(
        RecipeDefaultsService.getDefaultBoilTime()
      );
      expect(recipeData.efficiency).toBe(
        RecipeDefaultsService.getDefaultEfficiency()
      );
    });

    it("maintains consistency across method calls", () => {
      const efficiency1 = RecipeDefaultsService.getDefaultEfficiency();
      const efficiency2 = RecipeDefaultsService.getDefaultEfficiency();
      const boilTime1 = RecipeDefaultsService.getDefaultBoilTime();
      const boilTime2 = RecipeDefaultsService.getDefaultBoilTime();

      expect(efficiency1).toBe(efficiency2);
      expect(boilTime1).toBe(boilTime2);
    });
  });

  describe("mathematical accuracy", () => {
    it("maintains precision in calculations", () => {
      const result = RecipeDefaultsService.getDefaultIngredientAmounts(
        "grain",
        3.5,
        "imperial"
      );

      // 3.5 * 1.75 = 6.125, should be formatted to 1 decimal place
      expect(result.amount).toBe("6.1");
    });

    it("rounds grain amounts appropriately", () => {
      const testCases = [
        { batch: 1, expected: "1.8" }, // 1 * 1.75 = 1.75 -> 1.8
        { batch: 2, expected: "3.5" }, // 2 * 1.75 = 3.5 -> 3.5
        { batch: 3, expected: "5.3" }, // 3 * 1.75 = 5.25 -> 5.3
      ];

      testCases.forEach(({ batch, expected }) => {
        const result = RecipeDefaultsService.getDefaultIngredientAmounts(
          "grain",
          batch,
          "imperial"
        );
        expect(result.amount).toBe(expected);
      });
    });

    it("rounds hop amounts appropriately", () => {
      const result = RecipeDefaultsService.getDefaultIngredientAmounts(
        "hop",
        3.7,
        "imperial"
      );

      // 3.7 * 0.2 = 0.74, should be formatted to 2 decimal places
      expect(result.amount).toBe("0.74");
    });
  });
});
