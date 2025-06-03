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
      expect(getSrmColour(30)).toBe("#600903"); // Dark
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
});
