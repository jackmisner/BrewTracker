import { ID, BaseEntity } from './common';
import { RecipeMetrics } from './recipe';

// Style range for min/max values with units
export interface StyleRange {
  minimum: {
    value: number;
    unit: string;
  };
  maximum: {
    value: number;
    unit: string;
  };
}

// Style range input/creation (before conversion to nested structure)
export interface StyleRangeInput {
  minimum: number;
  maximum: number;
  unit: string;
}

// Beer style guide (BJCP or other standards)
export interface BeerStyleGuide extends BaseEntity {
  style_guide_id: ID;
  
  // Basic identification
  name: string;
  category: string;
  category_id: string;
  style_id: string;
  
  // Descriptions
  category_description?: string;
  overall_impression?: string;
  aroma?: string;
  appearance?: string;
  flavor?: string;
  mouthfeel?: string;
  comments?: string;
  history?: string;
  style_comparison?: string;
  
  // Tags for categorization and search
  tags?: string[];
  
  // Style specifications with ranges
  original_gravity?: StyleRange;
  international_bitterness_units?: StyleRange;
  final_gravity?: StyleRange;
  alcohol_by_volume?: StyleRange;
  color?: StyleRange;
  
  // Additional information
  ingredients?: string;
  examples?: string; // Commercial examples
  
  // Metadata
  style_guide?: string; // e.g., "BJCP2021"
  type?: string; // e.g., "beer"
  version?: number;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Style match result when comparing recipe to style
export interface StyleMatchResult {
  matches: {
    og?: boolean;
    fg?: boolean;
    abv?: boolean;
    ibu?: boolean;
    srm?: boolean;
  };
  match_percentage: number;
  matching_specs: number;
  total_specs: number;
}

// Style targets (midpoints for recipe formulation)
export interface StyleTargets {
  og?: number;
  fg?: number;
  abv?: number;
  ibu?: number;
  srm?: number;
}

// Style suggestion with match percentage
export interface StyleSuggestion {
  style: BeerStyleGuide;
  match_percentage: number;
  matches: StyleMatchResult['matches'];
}

// Style analysis for a specific recipe
export interface StyleAnalysis {
  declared_style?: string;
  found: boolean;
  style_guide?: BeerStyleGuide;
  match_result?: StyleMatchResult;
  suggestions?: StyleTargets;
}

// Beer style search/filter options
export interface BeerStyleSearchFilters {
  query?: string;
  category?: string;
  style_guide?: string;
  tags?: string[];
  min_og?: number;
  max_og?: number;
  min_abv?: number;
  max_abv?: number;
  min_ibu?: number;
  max_ibu?: number;
}

// Style category grouping for UI
export interface StyleCategory {
  category_id: string;
  category: string;
  description?: string;
  styles: BeerStyleGuide[];
}

// Style comparison for recipe analysis
export interface StyleComparison {
  recipe_metrics: RecipeMetrics;
  style_ranges: {
    og: StyleRange;
    fg: StyleRange;
    abv: StyleRange;
    ibu: StyleRange;
    srm: StyleRange;
  };
  deviations: {
    og: number; // How far outside range (0 if in range)
    fg: number;
    abv: number;
    ibu: number;
    srm: number;
  };
  overall_match: number; // Overall match percentage
}

// Style formulation targets
export interface StyleFormulationTargets {
  style: BeerStyleGuide;
  targets: StyleTargets;
  recommended_ranges: {
    og: [number, number];
    fg: [number, number];
    abv: [number, number];
    ibu: [number, number];
    srm: [number, number];
  };
}

// Style guide metadata
export interface StyleGuideInfo {
  name: string;
  version: number;
  year: number;
  organization: string;
  categories: Array<{
    id: string;
    name: string;
    style_count: number;
  }>;
}

// Style preferences for user
export interface StylePreferences {
  favorite_styles: ID[];
  hidden_styles: ID[];
  custom_targets?: Record<ID, Partial<StyleTargets>>;
}