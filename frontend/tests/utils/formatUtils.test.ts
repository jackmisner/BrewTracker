import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
  getSrmColour,
  getIbuDescription,
  getAbvDescription,
  getSrmDescription,
  getBalanceDescription,
  formatWeight,
  formatVolume,
  formatTemperature,
  formatBatchSize,
  formatIngredientAmount,
  formatTime,
  getUnitAbbreviation,
  formatEfficiency,
  formatPercentage,
  formatAttenuation,
  formatGrainWeight,
  formatIngredientAmountWithContext,
  convertUnit,
  getAppropriateUnit,
  formatValueStandalone,
} from "../../src/utils/formatUtils";

describe("formatUtils", () => {
  describe("formatGravity", () => {
    test("formats gravity values correctly", () => {
      expect(formatGravity(1.048)).toBe("1.048");
      expect(formatGravity(1.05)).toBe("1.050");
      expect(formatGravity("1.065")).toBe("1.065");
    });

    test("handles edge cases", () => {
      expect(formatGravity(null)).toBe("1.000");
      expect(formatGravity(undefined)).toBe("1.000");
      expect(formatGravity(0)).toBe("1.000");
    });
  });

  describe("formatAbv", () => {
    test("formats ABV values correctly", () => {
      expect(formatAbv(5.234)).toBe("5.2%");
      expect(formatAbv(12.0)).toBe("12.0%");
      expect(formatAbv("7.89")).toBe("7.9%");
    });

    test("handles edge cases", () => {
      expect(formatAbv(null)).toBe("0.0%");
      expect(formatAbv(undefined)).toBe("0.0%");
      expect(formatAbv(0)).toBe("0.0%");
    });
  });

  describe("formatIbu", () => {
    test("formats IBU values correctly", () => {
      expect(formatIbu(35.7)).toBe("36");
      expect(formatIbu(42)).toBe("42");
      expect(formatIbu("60.2")).toBe("60");
    });

    test("handles edge cases", () => {
      expect(formatIbu(null)).toBe("0");
      expect(formatIbu(undefined)).toBe("0");
      expect(formatIbu(0)).toBe("0");
    });
  });

  describe("formatSrm", () => {
    test("formats SRM values correctly", () => {
      expect(formatSrm(12.345)).toBe("12.3");
      expect(formatSrm(8)).toBe("8.0");
      expect(formatSrm("25.67")).toBe("25.7");
    });

    test("handles edge cases", () => {
      expect(formatSrm(null)).toBe("0.0");
      expect(formatSrm(undefined)).toBe("0.0");
      expect(formatSrm(0)).toBe("0.0");
    });
  });

  describe("getSrmColour", () => {
    test("returns correct colors for SRM ranges", () => {
      expect(getSrmColour(0)).toBe("#FFE699"); // Pale
      expect(getSrmColour(1)).toBe("#FFE699"); // Pale straw
      expect(getSrmColour(3)).toBe("#FFCA5A"); // Straw
      expect(getSrmColour(6)).toBe("#FBB123"); // Gold
      expect(getSrmColour(10)).toBe("#E58500"); // Amber
      expect(getSrmColour(20)).toBe("#A13700"); // Brown
      expect(getSrmColour(30)).toBe("#6A1200"); // Dark
      expect(getSrmColour(40)).toBe("#3D0708"); // Black
    });

    test("handles edge cases", () => {
      expect(getSrmColour(null)).toBe("#FFE699");
      expect(getSrmColour(undefined)).toBe("#FFE699");
      expect(getSrmColour(-1)).toBe("#FFE699");
    });
  });

  describe("getIbuDescription", () => {
    test("returns correct descriptions for IBU ranges", () => {
      expect(getIbuDescription(2)).toBe("No Perceived Bitterness");
      expect(getIbuDescription(8)).toBe("Very Low Bitterness");
      expect(getIbuDescription(15)).toBe("Low Bitterness");
      expect(getIbuDescription(25)).toBe("Moderate Bitterness");
      expect(getIbuDescription(35)).toBe("Strong Bitterness");
      expect(getIbuDescription(50)).toBe("Very Strong Bitterness");
      expect(getIbuDescription(80)).toBe("Extremely Bitter");
    });
  });

  describe("getAbvDescription", () => {
    test("returns correct descriptions for ABV ranges", () => {
      expect(getAbvDescription(2.5)).toBe("Session Beer");
      expect(getAbvDescription(4.2)).toBe("Standard");
      expect(getAbvDescription(6.5)).toBe("High ABV");
      expect(getAbvDescription(9.0)).toBe("Very High ABV");
      expect(getAbvDescription(12.0)).toBe("Extremely High ABV");
    });
  });

  describe("getSrmDescription", () => {
    test("returns correct descriptions for SRM ranges", () => {
      expect(getSrmDescription(1)).toBe("Pale Straw");
      expect(getSrmDescription(3)).toBe("Straw");
      expect(getSrmDescription(5)).toBe("Pale Gold");
      expect(getSrmDescription(7)).toBe("Gold");
      expect(getSrmDescription(9)).toBe("Amber");
      expect(getSrmDescription(12)).toBe("Copper");
      expect(getSrmDescription(15)).toBe("Brown");
      expect(getSrmDescription(18)).toBe("Dark Brown");
      expect(getSrmDescription(22)).toBe("Black Brown");
      expect(getSrmDescription(27)).toBe("Black");
      expect(getSrmDescription(35)).toBe("Opaque Black");
    });
  });

  describe("getBalanceDescription", () => {
    test("returns correct balance descriptions", () => {
      expect(getBalanceDescription(0.2)).toBe("Very Malty");
      expect(getBalanceDescription(0.5)).toBe("Malty");
      expect(getBalanceDescription(0.7)).toBe("Balanced (Malt)");
      expect(getBalanceDescription(1.0)).toBe("Balanced");
      expect(getBalanceDescription(1.3)).toBe("Balanced (Hoppy)");
      expect(getBalanceDescription(1.8)).toBe("Hoppy");
      expect(getBalanceDescription(2.5)).toBe("Very Hoppy");
    });
  });

  describe("formatWeight", () => {
    test("formats weight in imperial system", () => {
      expect(formatWeight(500, "g", "imperial")).toBe("1.1 lb");
      expect(formatWeight(14, "oz", "imperial")).toBe("14 oz");
      expect(formatWeight(2.5, "lb", "imperial")).toBe("2.5 lb");
    });

    test("formats weight in metric system", () => {
      expect(formatWeight(500, "g", "metric")).toBe("500 g");
      expect(formatWeight(1500, "g", "metric")).toBe("1.5 kg");
      expect(formatWeight(2.5, "kg", "metric")).toBe("2.5 kg");
    });

    test("handles edge cases", () => {
      expect(formatWeight(null, "g", "metric")).toBe("-");
      expect(formatWeight(undefined, "g", "metric")).toBe("-");
      expect(formatWeight(0, "g", "metric")).toBe("0 g");
    });
  });

  describe("formatVolume", () => {
    test("formats volume in imperial system", () => {
      expect(formatVolume(5, "gal", "imperial")).toBe("5 gal");
      expect(formatVolume(500, "ml", "imperial")).toBe("0.13 gal");
    });

    test("formats volume in metric system", () => {
      expect(formatVolume(500, "ml", "metric")).toBe("500 ml");
      expect(formatVolume(1500, "ml", "metric")).toBe("1.5 l");
      expect(formatVolume(5, "l", "metric")).toBe("5 l");
    });

    test("handles edge cases", () => {
      expect(formatVolume(null, "l", "metric")).toBe("-");
      expect(formatVolume(undefined, "l", "metric")).toBe("-");
      expect(formatVolume(0, "l", "metric")).toBe("0 ml");
    });
  });

  describe("formatTemperature", () => {
    test("formats temperature in imperial system", () => {
      expect(formatTemperature(20, "c", "imperial")).toBe("68°F");
      expect(formatTemperature(100, "f", "imperial")).toBe("100°F");
    });

    test("formats temperature in metric system", () => {
      expect(formatTemperature(68, "f", "metric")).toBe("20°C");
      expect(formatTemperature(25, "c", "metric")).toBe("25°C");
    });

    test("handles edge cases", () => {
      expect(formatTemperature(null, "c", "metric")).toBe("-");
      expect(formatTemperature(undefined, "c", "metric")).toBe("-");
      expect(formatTemperature(0, "c", "metric")).toBe("0°C");
    });
  });

  describe("formatBatchSize", () => {
    test("formats batch size in imperial system", () => {
      expect(formatBatchSize(5, "gal", "imperial")).toBe("5.0 gal");
      expect(formatBatchSize(20, "l", "imperial")).toBe("5.3 gal");
    });

    test("formats batch size in metric system", () => {
      expect(formatBatchSize(5, "gal", "metric")).toBe("18.9 L");
      expect(formatBatchSize(20, "l", "metric")).toBe("20.0 L");
    });

    test("handles edge cases", () => {
      expect(formatBatchSize(null, "gal", "imperial")).toBe("-");
      expect(formatBatchSize(undefined, "gal", "imperial")).toBe("-");
      expect(formatBatchSize(0, "gal", "imperial")).toBe("0.0 gal");
    });
  });

  describe("formatIngredientAmount", () => {
    test("formats ingredient amounts correctly", () => {
      expect(formatIngredientAmount(500, "g", "grain", "metric")).toBe("500 g");
      expect(formatIngredientAmount(2, "lb", "grain", "imperial")).toBe("2 lb");
      expect(formatIngredientAmount(1, "pkg", "yeast", "metric")).toBe("1 pkg");
      expect(formatIngredientAmount(2.5, "tsp", "spice", "imperial")).toBe(
        "2.5 tsp"
      );
    });

    test("handles edge cases", () => {
      expect(formatIngredientAmount(null, "g", "grain", "metric")).toBe("-");
      expect(formatIngredientAmount(undefined, "g", "grain", "metric")).toBe(
        "-"
      );
      expect(formatIngredientAmount(0, "g", "grain", "metric")).toBe("0 g");
    });
  });

  describe("getUnitAbbreviation", () => {
    test("returns correct abbreviations", () => {
      expect(getUnitAbbreviation("gram")).toBe("g");
      expect(getUnitAbbreviation("grams")).toBe("g");
      expect(getUnitAbbreviation("kilogram")).toBe("kg");
      expect(getUnitAbbreviation("ounce")).toBe("oz");
      expect(getUnitAbbreviation("pound")).toBe("lb");
      expect(getUnitAbbreviation("liter")).toBe("l");
      expect(getUnitAbbreviation("gallon")).toBe("gal");
      expect(getUnitAbbreviation("celsius")).toBe("C");
      expect(getUnitAbbreviation("fahrenheit")).toBe("F");
    });

    test("returns original unit if no abbreviation found", () => {
      expect(getUnitAbbreviation("pkg")).toBe("pkg");
      expect(getUnitAbbreviation("unknown")).toBe("unknown");
    });
  });


  describe("formatTime", () => {
    test("formats minutes correctly", () => {
      expect(formatTime(0)).toBe("-");
      expect(formatTime(5)).toBe("5 min");
      expect(formatTime(15)).toBe("15 min");
      expect(formatTime(30)).toBe("30 min");
      expect(formatTime(59)).toBe("59 min");
    });

    test("formats days correctly", () => {
      expect(formatTime(1440)).toBe("1 day"); // Exactly 1 day
      expect(formatTime(2880)).toBe("2 days"); // 2 days
      expect(formatTime(4320)).toBe("3 days"); // 3 days (dry hop case)
      expect(formatTime(10080)).toBe("7 days"); // 1 week
      expect(formatTime(14400)).toBe("10 days");
    });

    test("handles string inputs", () => {
      expect(formatTime("60")).toBe("60 min");
      expect(formatTime("1440")).toBe("1 day");
      expect(formatTime("4320")).toBe("3 days");
    });

    test("handles edge cases", () => {
      expect(formatTime(null)).toBe("-");
      expect(formatTime(undefined)).toBe("-");
      expect(formatTime("")).toBe("-");
      expect(formatTime("invalid")).toBe("-");
      expect(formatTime(NaN)).toBe("-");
    });

    test("rounds to nearest whole unit", () => {

      expect(formatTime(1500)).toBe("1 day"); // 1500 minutes rounds to 1 day
      expect(formatTime(2000)).toBe("1 day"); // 2000 minutes rounds to 1 day
      expect(formatTime(2160)).toBe("2 days"); // 2160 minutes rounds to 2 days
    });
  });

  describe("formatEfficiency", () => {
    test("formats efficiency values correctly", () => {
      expect(formatEfficiency(75)).toBe("75.0%");
      expect(formatEfficiency(80.5)).toBe("80.5%");
      expect(formatEfficiency("72")).toBe("72.0%");
    });

    test("handles edge cases", () => {
      expect(formatEfficiency(null)).toBe("0.0%");
      expect(formatEfficiency(undefined)).toBe("0.0%");
      expect(formatEfficiency(0)).toBe("0.0%");
    });
  });

  describe("formatPercentage", () => {
    test("formats percentage values correctly", () => {
      expect(formatPercentage(50, 1)).toBe("50.0%");
      expect(formatPercentage(33.333, 2)).toBe("33.33%");
      expect(formatPercentage(100, 0)).toBe("100%");
    });

    test("handles edge cases", () => {
      expect(formatPercentage(null, 1)).toBe("0.0%");
      expect(formatPercentage(undefined, 1)).toBe("0.0%");
      expect(formatPercentage(0, 1)).toBe("0.0%");
    });
  });

  describe("formatAttenuation", () => {
    test("formats attenuation values correctly", () => {
      expect(formatAttenuation(75)).toBe("75.0%");
      expect(formatAttenuation(80.5)).toBe("80.5%");
      expect(formatAttenuation("72")).toBe("72.0%");
    });

    test("handles edge cases", () => {
      expect(formatAttenuation(null)).toBe("0.0%");
      expect(formatAttenuation(undefined)).toBe("0.0%");
      expect(formatAttenuation(0)).toBe("0.0%");
    });
  });

  describe("formatGrainWeight", () => {
    test("formats grain weight in imperial system", () => {
      expect(formatGrainWeight(1000, "g", "imperial")).toBe("2.2 lb");
      expect(formatGrainWeight(2, "kg", "imperial")).toBe("4.4 lb");
    });

    test("formats grain weight in metric system", () => {
      // Adjusted expectations based on actual conversion behavior
      expect(formatGrainWeight(2.2, "lb", "metric")).toBe("997.9 g"); // 2.2 lb converts to ~998g, not 1kg
      expect(formatGrainWeight(16, "oz", "metric")).toBe("453.59 g"); // 16 oz converts to ~454g
    });

    test("handles edge cases", () => {
      expect(formatGrainWeight(null, "g", "metric")).toBe("-");
      expect(formatGrainWeight(undefined, "g", "metric")).toBe("-");
      expect(formatGrainWeight(0, "g", "metric")).toBe("0 g");
    });
  });

  describe("convertUnit", () => {
    test("converts kg to lb correctly", () => {
      const result = convertUnit(1, "kg", "lb");
      expect(result.value).toBeCloseTo(2.2, 1);
      expect(result.unit).toBe("lb");
    });

    test("converts g to oz correctly", () => {
      const result = convertUnit(28.35, "g", "oz");
      expect(result.value).toBeCloseTo(1, 1);
      expect(result.unit).toBe("oz");
    });

    test("converts gallon to liter correctly", () => {
      const result = convertUnit(1, "gal", "l");
      expect(result.value).toBeCloseTo(3.785, 1);
      expect(result.unit).toBe("l");
    });

    test("handles same unit conversion", () => {
      const result = convertUnit(5, "kg", "kg");
      expect(result.value).toBe(5);
      expect(result.unit).toBe("kg");
    });

    test("handles invalid input", () => {
      const result = convertUnit("invalid", "kg", "lb");
      expect(result.value).toBe(0);
      expect(result.unit).toBe("lb");
    });
  });

  describe("getAppropriateUnit", () => {
    test("gets appropriate unit for grain in imperial", () => {
      const result = getAppropriateUnit("imperial", "weight", 0.5);
      expect(result).toBe("oz"); // Less than 1 lb, so should be oz
    });

    test("gets appropriate unit for grain in metric", () => {
      const result = getAppropriateUnit("metric", "weight", 500);
      expect(result).toBe("g"); // Less than 1000g, so should be g
    });

    test("keeps larger amounts in original unit", () => {
      const result = getAppropriateUnit("imperial", "weight", 2);
      expect(result).toBe("lb"); // Greater than 1, so should be lb
    });

    test("gets appropriate unit for volume", () => {
      expect(getAppropriateUnit("metric", "volume", 500)).toBe("ml");
      expect(getAppropriateUnit("metric", "volume", 1500)).toBe("l");
      expect(getAppropriateUnit("imperial", "volume", 1)).toBe("gal");
    });
  });

  describe("formatValueStandalone", () => {
    test("formats values for weight", () => {
      expect(formatValueStandalone(2.2, "lb", "weight")).toBe("2.2 lb");
      expect(formatValueStandalone(1, "kg", "weight")).toBe("1 kg");
    });

    test("formats values for volume", () => {
      expect(formatValueStandalone(1, "gal", "volume")).toBe("1 gal");
      expect(formatValueStandalone(3.785, "l", "volume")).toBe("3.8 l");
    });

    test("handles edge cases", () => {
      expect(formatValueStandalone("invalid", "kg", "weight")).toBe("0 kg");
      expect(formatValueStandalone(0, "kg", "weight")).toBe("0 kg");
    });
  });

  describe("formatIngredientAmountWithContext", () => {
    test("formats ingredient amounts with context", () => {
      const result = formatIngredientAmountWithContext(
        2.2, "lb", "grain", "imperial", { batch_size: 5, batch_size_unit: "gal" }
      );
      expect(result).toContain("2.2 lb");
    });

    test("handles different ingredient types", () => {
      const hopResult = formatIngredientAmountWithContext(
        1, "oz", "hop", "imperial", { batch_size: 5, batch_size_unit: "gal" }
      );
      expect(hopResult).toContain("1 oz");

      const yeastResult = formatIngredientAmountWithContext(
        1, "pkg", "yeast", "imperial", { batch_size: 5, batch_size_unit: "gal" }
      );
      expect(yeastResult).toContain("1 pkg");
    });

    test("handles edge cases", () => {
      const result = formatIngredientAmountWithContext(
        null, "lb", "grain", "imperial", { batch_size: 5, batch_size_unit: "gal" }
      );
      expect(result).toBe("-");
    });
  });
});
