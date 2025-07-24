import { ID, BaseEntity } from "./common";

// Enums for better type safety
export type IngredientType = "grain" | "hop" | "yeast" | "other";
export type GrainType =
  | "base_malt"
  | "roasted"
  | "caramel_crystal"
  | "smoked"
  | "adjunct_grain"
  | "specialty_malt";
export type HopUse =
  | "mash"
  | "first_wort"
  | "boil"
  | "whirlpool"
  | "dry_hop"
  | "hop_back";
export type YeastType = "lager" | "belgian_ale" | "english_ale" | "american_ale" | "wheat" | "wild";
export type IngredientUnit =
  | "oz"
  | "lb"
  | "g"
  | "kg"
  | "pkg"
  | "tsp"
  | "tbsp"
  | "ml"
  | "l";
export type BatchSizeUnit = "gal" | "l";

// Ingredient creation data interface
export interface CreateRecipeIngredientData {
  ingredient_id?: ID;
  name?: string;
  amount?: number | string;
  unit?: IngredientUnit | string;
  use?: string;
  time?: number;
  alpha_acid?: number;
  color?: number;
  potential?: number;
  grain_type?: GrainType;
  attenuation?: number;
}

// Form data for adding ingredients to recipes
export interface IngredientFormData {
  ingredient_id: string;
  amount: string;
  unit: string;
  use?: string;
  time?: number | string;
  alpha_acid?: string;
  color?: string;
}

// Ingredients organized by type for UI
export interface IngredientsByType {
  grain: Ingredient[];
  hop: Ingredient[];
  yeast: Ingredient[];
  other: Ingredient[];
}

// Base ingredient interface (from ingredients collection)
export interface Ingredient extends BaseEntity {
  ingredient_id: ID;
  name: string;
  type: IngredientType;
  description?: string;

  // Grain-specific properties
  potential?: number; // Potential gravity points per pound per gallon
  color?: number; // Color in Lovibond
  grain_type?: GrainType;

  // Hop-specific properties
  alpha_acid?: number; // Alpha acid percentage

  // Yeast-specific properties
  yeast_type?: YeastType;
  attenuation?: number; // Attenuation percentage (theoretical/manufacturer spec)
  manufacturer?: string;
  code?: string;
  alcohol_tolerance?: number;
  min_temperature?: number;
  max_temperature?: number;

  // Real-world attenuation tracking (for yeast only)
  actual_attenuation_average?: number; // Running average of actual attenuation
  actual_attenuation_count?: number; // Number of data points collected
  attenuation_confidence?: number; // Confidence score (0-1) based on data volume
  improved_attenuation_estimate?: number; // Best estimate combining theoretical and real-world data
  last_attenuation_update?: string; // When attenuation data was last updated
}

// Recipe ingredient (embedded in recipes)
export interface RecipeIngredient {
  id?: string; // Frontend-generated ID for state management
  ingredient_id: ID | null;
  name: string;
  type: IngredientType;
  grain_type?: GrainType;
  yeast_type?: YeastType;
  amount: number;
  unit: IngredientUnit;
  use?: string;
  time?: number; // Time in minutes (boil time, steep time, etc.)
  time_unit?: string;

  // Denormalized fields from base ingredient
  potential?: number;
  color?: number;
  alpha_acid?: number;
  attenuation?: number;
  improved_attenuation_estimate?: number;
}

// Recipe metrics/calculated values
export interface RecipeMetrics {
  og: number; // Original Gravity
  fg: number; // Final Gravity
  abv: number; // Alcohol by Volume
  ibu: number; // International Bitterness Units
  srm: number; // Standard Reference Method (color)
}

// Main recipe interface
export interface Recipe extends BaseEntity {
  recipe_id: ID;
  user_id?: ID;
  username?: string; // Added for public recipe listings
  name: string;
  style?: string;
  batch_size: number;
  batch_size_unit: BatchSizeUnit;
  description?: string;
  is_public: boolean;
  version?: number;
  parent_recipe_id?: ID;

  // Brewing parameters
  boil_time?: number; // in minutes
  efficiency?: number; // percentage
  notes?: string;

  // Calculated/estimated values
  estimated_og?: number;
  estimated_fg?: number;
  estimated_abv?: number;
  estimated_ibu?: number;
  estimated_srm?: number;

  // Ingredients
  ingredients: RecipeIngredient[];

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Available ingredients grouped by type (for UI dropdowns)
export interface AvailableIngredients {
  grain: Ingredient[];
  hop: Ingredient[];
  yeast: Ingredient[];
  other: Ingredient[];
}

// Recipe scaling data
export interface RecipeScalingData {
  scaledRecipe: Recipe;
  scalingFactor: number;
}

// Recipe validation result
export interface RecipeValidation {
  isValid: boolean;
  errors: string[];
}

// Recipe version history
export interface RecipeVersion {
  version: number;
  created_at: string;
  changes: string[];
  metrics?: RecipeMetrics;
}

// Recipe clone request
export interface RecipeCloneRequest {
  name?: string;
  is_public?: boolean;
}

// Recipe analysis data (simplified for recipe context)
export interface RecipeOverview {
  metrics: RecipeMetrics;
  grainBill: {
    totalWeight: number;
    baseGrains: number;
    specialtyGrains: number;
    percentages: Record<string, number>;
  };
  hopSchedule: {
    totalIbu: number;
    bittering: number;
    flavor: number;
    aroma: number;
  };
  yeastInfo: {
    count: number;
    estimatedAttenuation: number;
  };
}

// Recipe search/filter options
export interface RecipeSearchFilters {
  style?: string;
  search?: string;
  minOg?: number;
  maxOg?: number;
  minAbv?: number;
  maxAbv?: number;
  minIbu?: number;
  maxIbu?: number;
}

// Recipe formdata for API submission
export interface RecipeFormData
  extends Omit<Recipe, "recipe_id" | "created_at" | "updated_at"> {
  recipe_id?: ID;
}
