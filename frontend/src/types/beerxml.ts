/**
 * TypeScript interfaces for BeerXML import/export functionality
 */

import {
  Recipe,
  Ingredient,
  IngredientFormData,
  IngredientType,
  RecipeIngredient,
} from "./recipe";

// Parsed BeerXML Recipe Data
export interface ParsedBeerXMLRecipe {
  name: string;
  type?: string;
  brewer?: string;
  batch_size?: number;
  boil_size?: number;
  boil_time?: number;
  efficiency?: number;
  hops?: ParsedBeerXMLHop[];
  fermentables?: ParsedBeerXMLFermentable[];
  yeasts?: ParsedBeerXMLYeast[];
  miscs?: ParsedBeerXMLMisc[];
  waters?: ParsedBeerXMLWater[];
  mash?: ParsedBeerXMLMash;
  notes?: string;
  og?: number;
  fg?: number;
  ibu?: number;
  srm?: number;
  abv?: number;
  est_og?: number;
  est_fg?: number;
  est_color?: number;
  ibu_method?: string;
  est_abv?: number;
  carbonation?: number;
  forced_carbonation?: boolean;
  priming_sugar_name?: string;
  carbonation_temp?: number;
  priming_sugar_equiv?: number;
  keg_priming_factor?: number;
}

// BeerXML Ingredient Types
export interface ParsedBeerXMLFermentable {
  name: string;
  type?: string;
  amount?: number;
  yield?: number;
  color?: number;
  add_after_boil?: boolean;
  origin?: string;
  supplier?: string;
  notes?: string;
  coarse_fine_diff?: number;
  moisture?: number;
  diastatic_power?: number;
  protein?: number;
  max_in_batch?: number;
  recommend_mash?: boolean;
  ibu_gal_per_lb?: number;
}

export interface ParsedBeerXMLHop {
  name: string;
  alpha?: number;
  amount?: number;
  use?: string;
  time?: number;
  notes?: string;
  type?: string;
  form?: string;
  beta?: number;
  hsi?: number;
  origin?: string;
  substitutes?: string;
  humulene?: number;
  caryophyllene?: number;
  cohumulone?: number;
  myrcene?: number;
}

export interface ParsedBeerXMLYeast {
  name: string;
  type?: string;
  form?: string;
  amount?: number;
  amount_is_weight?: boolean;
  laboratory?: string;
  product_id?: string;
  min_temperature?: number;
  max_temperature?: number;
  flocculation?: string;
  attenuation?: number;
  notes?: string;
  best_for?: string;
  max_reuse?: number;
  times_cultured?: number;
  add_to_secondary?: boolean;
}

export interface ParsedBeerXMLMisc {
  name: string;
  type?: string;
  use?: string;
  time?: number;
  amount?: number;
  amount_is_weight?: boolean;
  use_for?: string;
  notes?: string;
}

export interface ParsedBeerXMLWater {
  name: string;
  amount?: number;
  calcium?: number;
  bicarbonate?: number;
  sulfate?: number;
  chloride?: number;
  sodium?: number;
  magnesium?: number;
  ph?: number;
  notes?: string;
}

export interface ParsedBeerXMLMash {
  name?: string;
  grain_temp?: number;
  tun_temp?: number;
  sparge_temp?: number;
  ph?: number;
  tun_weight?: number;
  tun_specific_heat?: number;
  equip_adjust?: boolean;
  notes?: string;
  mash_steps?: ParsedBeerXMLMashStep[];
}

export interface ParsedBeerXMLMashStep {
  name: string;
  type: string;
  infuse_amount?: number;
  step_temp: number;
  step_time: number;
  ramp_time?: number;
  end_temp?: number;
  description?: string;
  water_grain_ratio?: number;
  decoction_amt?: string;
  infuse_temp?: number;
}

// BeerXML Import/Export Result Types
export interface BeerXMLImportData {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  metadata: BeerXMLMetadata;
  createdIngredients: Ingredient[];
}

export interface BeerXMLMetadata {
  originalFilename?: string;
  importedAt?: string;
  beerxmlVersion?: string;
  sourceApplication?: string;
  warnings?: string[];
  ingredientMappings?: IngredientMapping[];
}

export interface IngredientMapping {
  originalName: string;
  mappedTo: Ingredient | null;
  action: "use_existing" | "create_new" | "skip";
  confidence: number;
  reasons?: string[];
}

export interface BeerXMLExportResult {
  success: boolean;
  filename?: string;
  error?: string;
  beerxmlContent?: string;
}

// Ingredient Matching Types
export interface IngredientMatchResult {
  imported: {
    ingredient_id: string;
    name: string;
    type: IngredientType;
    amount: number;
    unit: string;
    use?: string;
    time?: number;
    alpha_acid?: number;
    color?: number;
    attenuation?: number;
  };
  best_match?: {
    ingredient: Ingredient;
    confidence: number;
  };
  bestMatch?: {
    ingredient: Ingredient;
    confidence: number;
  };
  matches: Array<{
    ingredient: Ingredient;
    confidence: number;
    reasons: string[];
  }>;
  confidence: number;
  requiresNewIngredient?: boolean;
  suggestedIngredientData?: IngredientFormData;
}

export interface IngredientMatchingDecision {
  imported: IngredientMatchResult["imported"];
  action: "use_existing" | "create_new";
  selectedMatch: Ingredient | null;
  newIngredientData: IngredientFormData | null;
  confidence: number;
}

// BeerXML Component State Types
export interface BeerXMLImportState {
  isImporting: boolean;
  uploadedFile: File | null;
  parsedRecipes: ParsedBeerXMLRecipe[];
  selectedRecipe: ParsedBeerXMLRecipe | null;
  matchingResults: IngredientMatchResult[];
  showMatchingReview: boolean;
  showUnitConversionChoice: boolean;
  recipeUnitSystem: string | null;
  userUnitSystem: string | null;
  importProgress: number;
  error: string | null;
  warnings: string[];
}

export interface BeerXMLExportState {
  isExporting: boolean;
  exportProgress: number;
  error: string | null;
  lastExportResult: BeerXMLExportResult | null;
}
