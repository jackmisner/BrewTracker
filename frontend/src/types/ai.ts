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
  reason?: string;
  // For adding new ingredients
  isNewIngredient?: boolean;
  newIngredientData?: {
    name?: string;
    amount?: number | string;
    type?: string;
    grain_type?: string;
    color?: number;
    use?: string;
    unit?: string;
  };
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

/**
 * Adjustment phase priorities based on expert brewing methodology
 */
export enum AdjustmentPhase {
  BASE_GRAVITY = 1,    // OG corrections via base malt adjustments
  COLOR_BALANCE = 2,   // SRM corrections via specialty grain modifications  
  ALCOHOL_CONTENT = 3, // ABV through yeast selection and gravity management
  HOP_BALANCE = 4      // IBU adjustments, usually last to avoid cascading changes
}

/**
 * Adjustment strategy for incremental recipe changes
 */
export interface AdjustmentStrategy {
  phase: AdjustmentPhase;
  targetMetric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm';
  approach: 'incremental' | 'ingredient_swap' | 'timing_change' | 'addition';
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  estimatedImpact: number; // Expected change in target metric
  cascadingEffects: string[]; // Other metrics that will be affected
}

/**
 * Ingredient adjustment recommendation
 */
export interface IngredientAdjustment {
  strategy: AdjustmentStrategy;
  ingredientChanges: IngredientChange[];
  expectedResults: RecipeMetrics;
  validationChecks: string[]; // Things to verify after applying
}

/**
 * Multi-step adjustment plan following expert methodology
 */
export interface AdjustmentPlan {
  phases: IngredientAdjustment[];
  totalSteps: number;
  estimatedCompliance: number; // Predicted style compliance after all steps
  dependencies: string[]; // Adjustments that depend on others
  warnings: string[]; // Potential issues or conflicts
}