import { RecipeMetrics } from './index';

/**
 * AI and Recipe Analysis Types
 * Types for AI-powered recipe analysis, suggestions, and optimization features
 */

/**
 * Interface for ingredient change predictions
 */
export interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  // For adding new ingredients
  isNewIngredient?: boolean;
  newIngredientData?: any;
}

/**
 * Interface for predicted metric changes
 */
export interface MetricChange {
  metric: keyof RecipeMetrics;
  currentValue: number;
  predictedValue: number;
  change: number;
  changePercent: number;
}

/**
 * Interface for cascading effects analysis
 */
export interface CascadingEffects {
  predictedMetrics: RecipeMetrics;
  metricChanges: MetricChange[];
  impacts: {
    og: MetricChange;
    fg: MetricChange;
    abv: MetricChange;
    ibu: MetricChange;
    srm: MetricChange;
  };
}

/**
 * Style characteristics analysis
 */
export interface StyleCharacteristics {
  isHopForward: boolean;
  isMaltForward: boolean;
  isBalanced: boolean;
  isDark: boolean;
  isLight: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  primaryFlavors: string[];
  secondaryFlavors: string[];
  keywords: string[];
}

/**
 * Style compliance analysis results
 */
export interface StyleCompliance {
  og: { inRange: boolean; deviation: number; target: number; priority: number; currentValue: number };
  fg: { inRange: boolean; deviation: number; target: number; priority: number; currentValue: number };
  abv: { inRange: boolean; deviation: number; target: number; priority: number; currentValue: number };
  ibu: { inRange: boolean; deviation: number; target: number; priority: number; currentValue: number };
  srm: { inRange: boolean; deviation: number; target: number; priority: number; currentValue: number };
  overallScore: number;
  criticalIssues: string[];
  improvementAreas: string[];
}

/**
 * Style optimization target
 */
export interface StyleOptimizationTarget {
  metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm';
  currentValue: number;
  targetValue: number;
  priority: number;
  reasoning: string;
  impactType: 'critical' | 'important' | 'nice-to-have';
}