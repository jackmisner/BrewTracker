// This file contains utility functions for formatting various values

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

// Get color hex code from SRM value
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
export function getIbuDescription(ibu) {
  if (ibu < 5) return "No Perceived Bitterness";
  if (ibu < 10) return "Very Low Bitterness";
  if (ibu < 20) return "Low Bitterness";
  if (ibu < 30) return "Moderate Bitterness";
  if (ibu < 40) return "Strong Bitterness";
  if (ibu < 60) return "Very Strong Bitterness";
  return "Extremely Bitter";
}

export function getAbvDescription(abv) {
  if (abv < 3.0) return "Session Beer";
  if (abv < 5.0) return "Standard";
  if (abv < 7.5) return "High ABV";
  if (abv < 10.0) return "Very High ABV";
  return "Extremely High ABV";
}
export function getSrmDescription(srm) {
  if (srm < 2) return "Pale Straw";
  if (srm < 4) return "Straw";
  if (srm < 6) return "Pale Gold";
  if (srm < 8) return "Gold";
  if (srm < 10) return "Amber";
  if (srm < 13) return "Copper";
  if (srm < 17) return "Brown";
  if (srm < 20) return "Dark Brown";
  if (srm < 24) return "Black Brown";
  if (srm < 29) return "Black";
  return "Opaque Black";
}
export function getBalanceDescription(ratio) {
  if (ratio < 0.3) return "Very Malty";
  if (ratio < 0.6) return "Malty";
  if (ratio < 0.8) return "Balanced (Malt)";
  if (ratio < 1.2) return "Balanced";
  if (ratio < 1.5) return "Balanced (Hoppy)";
  if (ratio < 2.0) return "Hoppy";
  return "Very Hoppy";
}
