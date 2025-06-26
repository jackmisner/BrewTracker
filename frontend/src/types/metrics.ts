import { Recipe, RecipeIngredient } from './recipe';
import { UnitSystem } from './units';

// Core brewing metrics
export interface BrewingMetrics {
  og: number; // Original Gravity (specific gravity)
  fg: number; // Final Gravity (specific gravity)  
  abv: number; // Alcohol by Volume (percentage)
  ibu: number; // International Bitterness Units
  srm: number; // Standard Reference Method (color)
}

// Extended metrics with additional calculations
export interface ExtendedMetrics extends BrewingMetrics {
  calories_per_12oz?: number;
  apparent_attenuation?: number;
  real_attenuation?: number;
  alcohol_by_weight?: number;
  total_sugars?: number;
  residual_sugars?: number;
}

// Grain bill analysis
export interface GrainBillAnalysis {
  total_weight: number;
  total_weight_unit: string;
  base_grain_percentage: number;
  specialty_grain_percentage: number;
  grain_breakdown: Array<{
    ingredient: RecipeIngredient;
    percentage: number;
    weight: number;
    weight_unit: string;
    gravity_contribution: number;
    color_contribution: number;
  }>;
  estimated_efficiency: number;
  mash_gravity: number;
}

// Hop schedule analysis
export interface HopScheduleAnalysis {
  total_ibu: number;
  bittering_ibu: number;
  flavor_ibu: number;
  aroma_ibu: number;
  total_hop_weight: number;
  total_hop_weight_unit: string;
  hop_breakdown: Array<{
    ingredient: RecipeIngredient;
    ibu_contribution: number;
    weight: number;
    weight_unit: string;
    alpha_acid_units: number;
    utilization: number;
  }>;
  hop_flavor_ratio: number; // Ratio of late addition hops
  hop_aroma_ratio: number; // Ratio of aroma/dry hops
}

// Yeast analysis
export interface YeastAnalysis {
  estimated_attenuation: number;
  estimated_cell_count?: number;
  alcohol_tolerance?: number;
  temperature_range?: {
    min: number;
    max: number;
    unit: string;
  };
  yeast_strains: Array<{
    ingredient: RecipeIngredient;
    manufacturer?: string;
    code?: string;
    attenuation?: number;
  }>;
}

// Water chemistry requirements (basic)
export interface WaterChemistry {
  estimated_ph: number;
  mineral_requirements?: {
    calcium: number;
    magnesium: number;
    sulfate: number;
    chloride: number;
    bicarbonate: number;
  };
}

// Complete recipe analysis
export interface RecipeAnalysis {
  metrics: ExtendedMetrics;
  grain_bill: GrainBillAnalysis;
  hop_schedule: HopScheduleAnalysis;
  yeast: YeastAnalysis;
  water?: WaterChemistry;
  efficiency_notes?: string[];
  recommendations?: string[];
}

// Metrics calculation request
export interface MetricsCalculationRequest {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  unit_system?: UnitSystem;
}

// Metrics calculation response
export interface MetricsCalculationResponse {
  metrics: BrewingMetrics;
  analysis?: RecipeAnalysis;
  calculation_notes?: string[];
  warnings?: string[];
}

// Brewing efficiency data
export interface EfficiencyData {
  brewhouse_efficiency: number;
  mash_efficiency: number;
  lauter_efficiency: number;
  boil_efficiency: number;
  fermentation_efficiency: number;
}

// Color calculation data
export interface ColorCalculation {
  srm: number;
  ebc: number; // European Brewery Convention
  lovibond: number;
  hex_color: string;
  description: string; // e.g., "Light Amber", "Dark Brown"
}

// IBU calculation methods
export type IbuCalculationMethod = 'tinseth' | 'rager' | 'garetz' | 'daniels';

// IBU calculation parameters
export interface IbuCalculationParams {
  method: IbuCalculationMethod;
  boil_gravity?: number;
  elevation?: number; // For Garetz method
  pellet_factor?: number;
}

// Gravity calculation data
export interface GravityCalculation {
  og: number;
  fg: number;
  potential_points: number;
  actual_points: number;
  efficiency: number;
  attenuation: number;
}

// Recipe scaling factors
export interface ScalingFactors {
  volume_factor: number;
  grain_factor: number;
  hop_factor: number;
  yeast_factor: number;
  time_factor: number; // For boil times, mash times, etc.
}

// Metrics validation
export interface MetricsValidation {
  is_valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

// Brewing constants used in calculations
export interface BrewingConstants {
  WATER_DENSITY: number; // kg/L at room temperature
  ALCOHOL_DENSITY: number; // kg/L
  SUCROSE_POTENTIAL: number; // Gravity points per pound per gallon
  GALLON_TO_LITER: number;
  POUND_TO_KG: number;
  FAHRENHEIT_TO_CELSIUS_OFFSET: number;
}

// Unit conversion helpers for metrics
export interface MetricsUnitConversion {
  gravity: {
    specific_gravity: number;
    plato: number;
    brix: number;
  };
  color: {
    srm: number;
    ebc: number;
    lovibond: number;
  };
  temperature: {
    fahrenheit: number;
    celsius: number;
    kelvin: number;
  };
}