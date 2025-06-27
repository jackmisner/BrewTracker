import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { UnitProvider, useUnits } from "../../src/contexts/UnitContext";
import userSettingsServiceInstance from "../../src/services/UserSettingsService";

// Mock the UserSettingsService
jest.mock("../../src/services/UserSettingsService", () => ({
  getUserSettings: jest.fn(),
  updateSettings: jest.fn(),
}));

// Suppress console errors and warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe("UnitContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("UnitProvider", () => {
    it("provides default imperial units when no user settings available", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: {},
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.unitSystem).toBe("imperial");
      expect(result.current.getUnitSystemLabel()).toBe("Imperial");
      expect(result.current.getUnitSystemIcon()).toBe("🇺🇸");
    });

    it("loads metric units from user settings", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.unitSystem).toBe("metric");
      expect(result.current.getUnitSystemLabel()).toBe("Metric");
      expect(result.current.getUnitSystemIcon()).toBe("🌍");
    });

    it("falls back to imperial on settings load error", async () => {
      userSettingsServiceInstance.getUserSettings.mockRejectedValue(
        new Error("Settings service error")
      );

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.unitSystem).toBe("imperial");
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to load unit preferences, using default:",
        expect.any(Error)
      );
    });

    it("shows loading state initially", () => {
      userSettingsServiceInstance.getUserSettings.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      expect(result.current.loading).toBe(true);
    });
  });

  describe("useUnits hook", () => {
    it("throws error when used outside provider", () => {
      expect(() => {
        renderHook(() => useUnits());
      }).toThrow("useUnits must be used within a UnitProvider");
    });
  });

  describe("updateUnitSystem", () => {
    it("updates unit system and persists to backend", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "imperial" },
      });
      userSettingsServiceInstance.updateSettings.mockResolvedValue({});

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateUnitSystem("metric");
      });

      expect(result.current.unitSystem).toBe("metric");
      expect(userSettingsServiceInstance.updateSettings).toHaveBeenCalledWith({
        preferred_units: "metric",
      });
    });

    it("reverts changes on backend error", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "imperial" },
      });
      userSettingsServiceInstance.updateSettings.mockRejectedValue(
        new Error("Update failed")
      );

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateUnitSystem("metric");
      });

      expect(result.current.unitSystem).toBe("imperial");
      expect(result.current.error).toBe("Failed to save unit preference");
      expect(console.error).toHaveBeenCalledWith(
        "Failed to update unit system:",
        expect.any(Error)
      );
    });
  });

  describe("getPreferredUnit", () => {
    it("returns correct metric units", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getPreferredUnit("weight")).toBe("kg");
      expect(result.current.getPreferredUnit("hop_weight")).toBe("g");
      expect(result.current.getPreferredUnit("volume")).toBe("l");
      expect(result.current.getPreferredUnit("temperature")).toBe("c");
      expect(result.current.getPreferredUnit("other")).toBe("g");
      expect(result.current.getPreferredUnit("yeast")).toBe("pkg");
    });

    it("returns correct imperial units", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "imperial" },
      });
      userSettingsServiceInstance.updateSettings.mockResolvedValue({});

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getPreferredUnit("weight")).toBe("lb");
      expect(result.current.getPreferredUnit("hop_weight")).toBe("oz");
      expect(result.current.getPreferredUnit("volume")).toBe("gal");
      expect(result.current.getPreferredUnit("temperature")).toBe("f");
      expect(result.current.getPreferredUnit("other")).toBe("oz");
      expect(result.current.getPreferredUnit("yeast")).toBe("pkg");
    });

    it("returns default unit for unknown type", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getPreferredUnit("unknown")).toBe("kg");
    });
  });

  describe("convertUnit", () => {
    let unitUtils;

    beforeEach(async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unitUtils = result.current;
    });

    describe("weight conversions", () => {
      it("converts kg to lb", () => {
        const result = unitUtils.convertUnit(1, "kg", "lb");
        expect(result.value).toBeCloseTo(2.20462, 5);
        expect(result.unit).toBe("lb");
      });

      it("converts lb to kg", () => {
        const result = unitUtils.convertUnit(2.20462, "lb", "kg");
        expect(result.value).toBeCloseTo(1, 5);
        expect(result.unit).toBe("kg");
      });

      it("converts g to oz", () => {
        const result = unitUtils.convertUnit(28.3495, "g", "oz");
        expect(result.value).toBeCloseTo(1, 5);
        expect(result.unit).toBe("oz");
      });

      it("converts oz to g", () => {
        const result = unitUtils.convertUnit(1, "oz", "g");
        expect(result.value).toBeCloseTo(28.3495, 5);
        expect(result.unit).toBe("g");
      });

      it("converts kg to g", () => {
        const result = unitUtils.convertUnit(1, "kg", "g");
        expect(result.value).toBe(1000);
        expect(result.unit).toBe("g");
      });

      it("converts g to kg", () => {
        const result = unitUtils.convertUnit(1000, "g", "kg");
        expect(result.value).toBe(1);
        expect(result.unit).toBe("kg");
      });

      it("converts lb to oz", () => {
        const result = unitUtils.convertUnit(1, "lb", "oz");
        expect(result.value).toBe(16);
        expect(result.unit).toBe("oz");
      });

      it("converts oz to lb", () => {
        const result = unitUtils.convertUnit(16, "oz", "lb");
        expect(result.value).toBe(1);
        expect(result.unit).toBe("lb");
      });
    });

    describe("volume conversions", () => {
      it("converts gal to l", () => {
        const result = unitUtils.convertUnit(1, "gal", "l");
        expect(result.value).toBeCloseTo(3.78541, 5);
        expect(result.unit).toBe("l");
      });

      it("converts l to gal", () => {
        const result = unitUtils.convertUnit(3.78541, "l", "gal");
        expect(result.value).toBeCloseTo(1, 5);
        expect(result.unit).toBe("gal");
      });

      it("converts ml to l", () => {
        const result = unitUtils.convertUnit(1000, "ml", "l");
        expect(result.value).toBe(1);
        expect(result.unit).toBe("l");
      });

      it("converts l to ml", () => {
        const result = unitUtils.convertUnit(1, "l", "ml");
        expect(result.value).toBe(1000);
        expect(result.unit).toBe("ml");
      });
    });

    describe("temperature conversions", () => {
      it("converts f to c", () => {
        const result = unitUtils.convertUnit(32, "f", "c");
        expect(result.value).toBe(0);
        expect(result.unit).toBe("c");
      });

      it("converts c to f", () => {
        const result = unitUtils.convertUnit(0, "c", "f");
        expect(result.value).toBe(32);
        expect(result.unit).toBe("f");
      });

      it("converts 212°F to 100°C", () => {
        const result = unitUtils.convertUnit(212, "f", "c");
        expect(result.value).toBe(100);
        expect(result.unit).toBe("c");
      });

      it("converts 100°C to 212°F", () => {
        const result = unitUtils.convertUnit(100, "c", "f");
        expect(result.value).toBe(212);
        expect(result.unit).toBe("f");
      });
    });

    describe("edge cases", () => {
      it("returns same unit when from and to are identical", () => {
        const result = unitUtils.convertUnit(5, "kg", "kg");
        expect(result.value).toBe(5);
        expect(result.unit).toBe("kg");
      });

      it("handles invalid numeric values", () => {
        const result = unitUtils.convertUnit("invalid", "kg", "lb");
        expect(result.value).toBe(0);
        expect(result.unit).toBe("lb");
      });

      it("handles unknown unit conversions", () => {
        const result = unitUtils.convertUnit(5, "unknown", "also_unknown");
        expect(result.value).toBe(5);
        expect(result.unit).toBe("unknown");
        expect(console.warn).toHaveBeenCalledWith(
          "No conversion available from unknown to also_unknown"
        );
      });
    });
  });

  describe("convertForDisplay", () => {
    let unitUtils;

    beforeEach(async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unitUtils = result.current;
    });

    it("converts from storage to preferred display unit", () => {
      const result = unitUtils.convertForDisplay(2.20462, "lb", "weight");
      expect(result.value).toBeCloseTo(1, 5);
      expect(result.unit).toBe("kg");
    });
  });

  describe("convertForStorage", () => {
    let unitUtils;

    beforeEach(async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unitUtils = result.current;
    });

    it("converts volume to gal for storage", () => {
      const result = unitUtils.convertForStorage(3.78541, "l", "volume");
      expect(result.value).toBeCloseTo(1, 5);
      expect(result.unit).toBe("gal");
    });

    it("converts weight to lb for storage", () => {
      const result = unitUtils.convertForStorage(1, "kg", "weight");
      expect(result.value).toBeCloseTo(2.20462, 5);
      expect(result.unit).toBe("lb");
    });

    it("converts hop_weight to g for storage", () => {
      const result = unitUtils.convertForStorage(1, "oz", "hop_weight");
      expect(result.value).toBeCloseTo(28.3495, 5);
      expect(result.unit).toBe("g");
    });

    it("converts temperature to f for storage", () => {
      const result = unitUtils.convertForStorage(0, "c", "temperature");
      expect(result.value).toBe(32);
      expect(result.unit).toBe("f");
    });

    it("returns same unit for unknown measurement type", () => {
      const result = unitUtils.convertForStorage(5, "unknown", "unknown_type");
      expect(result.value).toBe(5);
      expect(result.unit).toBe("unknown");
    });
  });

  describe("formatValue", () => {
    let unitUtils;

    beforeEach(async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unitUtils = result.current;
    });

    it("formats volume with appropriate precision", () => {
      expect(unitUtils.formatValue(0.5, "l", "volume")).toBe("0.5 l");
      expect(unitUtils.formatValue(5.0, "l", "volume")).toBe("5 l");
    });

    it("formats weight with appropriate precision", () => {
      expect(unitUtils.formatValue(5.5, "g", "hop_weight")).toBe("5.5 g");
      expect(unitUtils.formatValue(0.5, "oz", "hop_weight")).toBe("0.5 oz");
      expect(unitUtils.formatValue(5.0, "kg", "weight")).toBe("5 kg");
    });

    it("formats temperature with no decimal places", () => {
      expect(unitUtils.formatValue(65.7, "f", "temperature")).toBe("66 f");
      expect(unitUtils.formatValue(18.9, "c", "temperature")).toBe("19 c");
    });

    it("handles invalid values", () => {
      expect(unitUtils.formatValue("invalid", "kg", "weight")).toBe("0 kg");
    });

    it("removes trailing zeros", () => {
      expect(unitUtils.formatValue(5.0, "kg", "weight")).toBe("5 kg");
      expect(unitUtils.formatValue(5.1, "kg", "weight")).toBe("5.1 kg");
    });
  });

  describe("getCommonUnits", () => {
    it("returns metric weight units", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const units = result.current.getCommonUnits("weight");
      expect(units).toEqual([
        { value: "kg", label: "kg", description: "Kilograms" },
        { value: "g", label: "g", description: "Grams" },
      ]);
    });

    it("returns metric volume units", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const units = result.current.getCommonUnits("volume");
      expect(units).toEqual([
        { value: "l", label: "L", description: "Liters" },
        { value: "ml", label: "mL", description: "Milliliters" },
      ]);
    });

    it("returns imperial units when system is imperial", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "imperial" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const weightUnits = result.current.getCommonUnits("weight");
      expect(weightUnits).toEqual([
        { value: "lb", label: "lb", description: "Pounds" },
        { value: "oz", label: "oz", description: "Ounces" },
      ]);
    });

    it("returns empty array for unknown measurement type", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const units = result.current.getCommonUnits("unknown");
      expect(units).toEqual([]);
    });
  });

  describe("convertBatch", () => {
    let unitUtils;

    beforeEach(async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unitUtils = result.current;
    });

    it("scales ingredients proportionally", () => {
      const ingredients = [
        { name: "Pale Malt", amount: "5", unit: "lb" },
        { name: "Crystal Malt", amount: "1", unit: "lb" },
      ];

      const result = unitUtils.convertBatch(
        ingredients,
        5, // from 5 gallon batch
        10, // to 10 gallon batch
        "gal",
        "gal"
      );

      expect(result).toEqual([
        { name: "Pale Malt", amount: 10, unit: "lb" },
        { name: "Crystal Malt", amount: 2, unit: "lb" },
      ]);
    });

    it("scales and converts units", () => {
      const ingredients = [
        { name: "Pale Malt", amount: "2.268", unit: "kg" }, // ~5 lbs
      ];

      const result = unitUtils.convertBatch(
        ingredients,
        19, // from 19L batch
        38, // to 38L batch (double)
        "l",
        "l"
      );

      expect(parseFloat(result[0].amount)).toBeCloseTo(4.536, 2); // Should be ~10 lbs in kg
      expect(result[0].unit).toBe("kg");
    });
  });

  describe("getTypicalBatchSizes", () => {
    it("returns metric batch sizes", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const sizes = result.current.getTypicalBatchSizes();
      expect(sizes).toEqual([
        { value: 19, label: "19 L (5 gal)" },
        { value: 23, label: "23 L (6 gal)" },
        { value: 38, label: "38 L (10 gal)" },
      ]);
    });

    it("returns imperial batch sizes", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "imperial" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const sizes = result.current.getTypicalBatchSizes();
      expect(sizes).toEqual([
        { value: 5, label: "5 gal" },
        { value: 6, label: "6 gal" },
        { value: 10, label: "10 gal" },
      ]);
    });
  });

  describe("error handling", () => {
    it("can clear errors", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setError("Test error");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Test error");
      });

      act(() => {
        result.current.setError(null);
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe("integration tests", () => {
    it("provides complete context value with all methods", async () => {
      userSettingsServiceInstance.getUserSettings.mockResolvedValue({
        settings: { preferred_units: "metric" },
      });

      const wrapper = ({ children }) => <UnitProvider>{children}</UnitProvider>;
      const { result } = renderHook(() => useUnits(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify all expected methods and properties are available
      const expectedProperties = [
        "unitSystem",
        "loading",
        "error",
        "updateUnitSystem",
        "setError",
        "getPreferredUnit",
        "convertUnit",
        "convertForDisplay",
        "convertForStorage",
        "formatValue",
        "getUnitSystemLabel",
        "getUnitSystemIcon",
        "getCommonUnits",
        "convertBatch",
        "getTypicalBatchSizes",
      ];

      expectedProperties.forEach((prop) => {
        expect(result.current).toHaveProperty(prop);
      });
    });
  });
});
