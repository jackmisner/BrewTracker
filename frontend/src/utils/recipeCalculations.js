/**
 * This file contains utility functions for client-side recipe calculations.
 * These functions mirror the server-side calculations in helpers.py.
 */

// Convert weight to pounds for calculations
export function convertToPounds(amount, unit) {
  if (unit === "oz") {
    return amount / 16.0;
  } else if (unit === "g") {
    return amount / 453.592;
  } else if (unit === "kg") {
    return amount * 2.20462;
  } else if (unit === "lb") {
    return amount;
  }
  return amount; // Default to assuming pounds if unit not recognized
}

// Convert weight to ounces for calculations
export function convertToOunces(amount, unit) {
  if (unit === "g") {
    return amount / 28.3495;
  } else if (unit === "kg") {
    return amount * 35.274;
  } else if (unit === "lb") {
    return amount * 16.0;
  } else if (unit === "oz") {
    return amount;
  }
  return amount; // Default to assuming ounces if unit not recognized
}

// Calculate Original Gravity
export function calculateOG(recipeIngredients, batchSize, efficiency) {
  let totalPoints = 0.0;
  const grains = recipeIngredients.filter((i) => i.ingredient_type === "grain");
  console.log('efficiency:', efficiency);
  // Use passed efficiency if provided, otherwise default to 75
  const brewingEfficiency = efficiency !== undefined ? efficiency : 75;
  
  for (const grain of grains) {
    // Get grain potential - use a default if not available
    const potential = grain.associated_metrics.potential || 36; // Default to typical base malt potential if no value
    const weightLb = convertToPounds(parseFloat(grain.amount), grain.unit);
    totalPoints += weightLb * potential * (brewingEfficiency / 100);
  }

  // Calculate gravity points per gallon, then convert to specific gravity
  const gravityPoints = totalPoints / batchSize;
  const og = 1.0 + gravityPoints / 1000.0;

  return parseFloat(og.toFixed(3));
}

// Calculate Final Gravity based on yeast attenuation
export function calculateFG(recipeIngredients, og) {
  // Find yeast with highest attenuation
  let maxAttenuation = 0; // Default attenuation if no yeast is specified

  const yeasts = recipeIngredients.filter((i) => i.ingredient_type === "yeast");
  for (const yeast of yeasts) {
    // Get yeast attenuation - use a default if not available
    const attenuation = yeast.associated_metrics.attenuation || 0; // Default to 0% attenuation if no yeast specified
    if (attenuation > maxAttenuation) {
      maxAttenuation = attenuation;
    }
    // console.log("attenuation:", attenuation);
  }

  // Calculate FG using attenuation
  const fg = parseFloat(og) - (parseFloat(og) - 1.0) * (maxAttenuation / 100.0);
  return parseFloat(fg.toFixed(3));
}

// Calculate ABV using OG and FG
export function calculateABV(og, fg, useSimplifiedFormula = true) {
  const parsedOg = parseFloat(og);
  const parsedFg = parseFloat(fg);

  const abv = useSimplifiedFormula
    ? (parsedOg - parsedFg) * 131.25
    : ((76.08 * (parsedOg - parsedFg)) / (1.775 - parsedOg)) *
      (parsedFg / 0.794);

  return parseFloat(abv.toFixed(1));
}

// Calculate IBUs using a simplified Tinseth formula
export function calculateIBU(recipeIngredients, og, batchSize, boilTime = 60) {
  let totalIBU = 0.0;

  const hops = recipeIngredients.filter((i) => i.ingredient_type === "hop");

  for (const hop of hops) {
    // Skip if not used in boil or has no time
    if (
      !hop.use ||
      (hop.use !== "boil" && hop.use !== "whirlpool") ||
      !hop.time
    ) {
      continue;
    }

    // Get hop alpha acid - use a default if not available
    const alphaAcid = hop.associated_metrics.alpha_acid || 5.0; // Default to 5% alpha acid
    // console.log("alphaAcid:", alphaAcid);
    const weightOz = convertToOunces(parseFloat(hop.amount), hop.unit);
    const time = parseFloat(hop.time);

    // Utilization calculations
    const utilizationFactor = hop.use === "whirlpool" ? 0.3 : 1.0;
    const gravityFactor = 1.65 * Math.pow(0.000125, parseFloat(og) - 1.0);
    const timeFactor = (1.0 - Math.pow(2.718, -0.04 * time)) / 4.15;
    const utilization = gravityFactor * timeFactor * utilizationFactor;

    // IBU calculation
    const aau = weightOz * alphaAcid;
    const ibuContribution = (aau * utilization * 74.9) / batchSize;
    totalIBU += ibuContribution;
  }

  return parseFloat(totalIBU.toFixed(1));
}

// Calculate SRM color using MCU method
export function calculateSRM(recipeIngredients, batchSize) {
  let totalMCU = 0.0;

  const grains = recipeIngredients.filter((i) => i.ingredient_type === "grain");

  for (const grain of grains) {
    // Get grain colour - use a default if not available
    const colour = grain.associated_metrics.colour || 2.0; // Default to typical base malt colour
    // console.log("colour:", colour);
    const weightLb = convertToPounds(parseFloat(grain.amount), grain.unit);
    const mcuContribution = colour * weightLb;
    totalMCU += mcuContribution;
  }

  const mcu = totalMCU / batchSize;
  const srm = 1.4922 * Math.pow(mcu, 0.6859);

  return parseFloat(srm.toFixed(1));
}

// Format gravity values (like "1.048")
export function formatGravity(gravity) {
  return gravity ? parseFloat(gravity).toFixed(3) : "1.000";
}

// Format ABV values (like "5.2%")
export function formatAbv(abv) {
  return abv ? `${parseFloat(abv).toFixed(1)}%` : "0.0%";
}

// Format IBU values (like "35")
export function formatIbu(ibu) {
  return ibu ? Math.round(ibu).toString() : "0";
}

// Format SRM values (like "12.3")
export function formatSrm(srm) {
  return srm ? parseFloat(srm).toFixed(1) : "0.0";
}

// Get colour hex code from SRM value
export function getSrmColour(srm) {
  if (!srm || srm <= 0) return "#FFE699";
  if (srm > 0 && srm <= 2) return "#FFE699";
  if (srm > 2 && srm <= 3) return "#FFCA5A";
  if (srm > 3 && srm <= 4) return "#FFBF42";
  if (srm > 4 && srm <= 6) return "#FBB123";
  if (srm > 6 && srm <= 8) return "#F39C00";
  if (srm > 8 && srm <= 10) return "#E58500";
  if (srm > 10 && srm <= 13) return "#CF6900";
  if (srm > 13 && srm <= 17) return "#BB5100";
  if (srm > 17 && srm <= 20) return "#A13700";
  if (srm > 20 && srm <= 24) return "#8E2900";
  if (srm > 24 && srm <= 29) return "#701400";
  if (srm > 29 && srm <= 35) return "#600903";
  return "#3D0708"; // for srm > 35
}
