// reducers/aiSuggestionsReducer.ts

// Interfaces imported from AISuggestions component
export interface Suggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  changes: IngredientChange[];
  priority?: number;
  styleImpact?: string;
  impactType?: "critical" | "important" | "nice-to-have";
}

export interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: "amount" | "time" | "use" | "ingredient_id";
  currentValue: any;
  suggestedValue: any;
  reason: string;
  // CRITICAL FIX: Add unit field to preserve backend unit suggestions
  unit?: string; // Unit from backend suggestion (g/oz for base units)
  // For adding new ingredients
  isNewIngredient?: boolean;
  newIngredientData?: any; // CreateRecipeIngredientData type would be imported from types
  // For consolidated changes (multiple field changes for same ingredient)
  changes?: Array<{
    field: string;
    original_value: any;
    optimized_value: any;
    unit?: string;
    change_reason: string;
  }>;
}

export interface OptimizationResult {
  performed: boolean;
  originalMetrics: any;
  optimizedMetrics: any;
  optimizedRecipe: any;
  recipeChanges: any[];
  iterationsCompleted: number;
}

// Combined state interface
export interface AISuggestionsState {
  // Core data
  suggestions: Suggestion[];
  optimizationResult: OptimizationResult | null;

  // UI state
  analyzing: boolean;
  isExpanded: boolean;
  hasAnalyzed: boolean;
  error: string | null;

  // Applied suggestions tracking
  appliedSuggestions: Set<string>;
}

// Action types for all AI suggestions operations
export type AISuggestionsAction =
  // Analysis actions
  | { type: "START_ANALYSIS" }
  | {
      type: "ANALYSIS_SUCCESS";
      payload: {
        suggestions: Suggestion[];
        optimizationResult?: OptimizationResult;
      };
    }
  | { type: "ANALYSIS_ERROR"; payload: string }
  | { type: "ANALYSIS_COMPLETE" }

  // Suggestion management
  | { type: "SET_SUGGESTIONS"; payload: Suggestion[] }
  | { type: "CLEAR_SUGGESTIONS" }
  | { type: "ADD_APPLIED_SUGGESTION"; payload: string }
  | { type: "REMOVE_APPLIED_SUGGESTION"; payload: string }
  | { type: "RESET_APPLIED_SUGGESTIONS" }

  // UI state actions
  | { type: "SET_EXPANDED"; payload: boolean }
  | { type: "TOGGLE_EXPANDED" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "CLEAR_ERROR" }

  // Optimization result actions
  | { type: "SET_OPTIMIZATION_RESULT"; payload: OptimizationResult | null }
  | { type: "CLEAR_OPTIMIZATION_RESULT" }

  // Reset actions
  | { type: "RESET_STATE" }
  | { type: "RESET_ANALYSIS_STATE" };

// Initial state factory function
export const createInitialAISuggestionsState = (): AISuggestionsState => ({
  // Core data
  suggestions: [],
  optimizationResult: null,

  // UI state
  analyzing: false,
  isExpanded: true,
  hasAnalyzed: false,
  error: null,

  // Applied suggestions tracking
  appliedSuggestions: new Set<string>(),
});

// Reducer function
export const aiSuggestionsReducer = (
  state: AISuggestionsState,
  action: AISuggestionsAction
): AISuggestionsState => {
  switch (action.type) {
    // Analysis actions
    case "START_ANALYSIS":
      return {
        ...state,
        analyzing: true,
        error: null,
        suggestions: [],
        optimizationResult: null,
      };

    case "ANALYSIS_SUCCESS":
      return {
        ...state,
        analyzing: false,
        hasAnalyzed: true,
        suggestions: action.payload.suggestions,
        optimizationResult: action.payload.optimizationResult || null,
      };

    case "ANALYSIS_ERROR":
      return {
        ...state,
        analyzing: false,
        error: action.payload,
      };

    case "ANALYSIS_COMPLETE":
      return {
        ...state,
        analyzing: false,
        hasAnalyzed: true,
      };

    // Suggestion management
    case "SET_SUGGESTIONS":
      return {
        ...state,
        suggestions: action.payload,
      };

    case "CLEAR_SUGGESTIONS":
      return {
        ...state,
        suggestions: [],
      };

    case "ADD_APPLIED_SUGGESTION":
      return {
        ...state,
        appliedSuggestions: new Set([
          ...state.appliedSuggestions,
          action.payload,
        ]),
      };

    case "REMOVE_APPLIED_SUGGESTION":
      const newAppliedSuggestions = new Set(state.appliedSuggestions);
      newAppliedSuggestions.delete(action.payload);
      return {
        ...state,
        appliedSuggestions: newAppliedSuggestions,
      };

    case "RESET_APPLIED_SUGGESTIONS":
      return {
        ...state,
        appliedSuggestions: new Set<string>(),
      };

    // UI state actions
    case "SET_EXPANDED":
      return {
        ...state,
        isExpanded: action.payload,
      };

    case "TOGGLE_EXPANDED":
      return {
        ...state,
        isExpanded: !state.isExpanded,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    // Optimization result actions
    case "SET_OPTIMIZATION_RESULT":
      return {
        ...state,
        optimizationResult: action.payload,
      };

    case "CLEAR_OPTIMIZATION_RESULT":
      return {
        ...state,
        optimizationResult: null,
      };

    // Reset actions
    case "RESET_STATE":
      return createInitialAISuggestionsState();

    case "RESET_ANALYSIS_STATE":
      return {
        ...state,
        analyzing: false,
        hasAnalyzed: false,
        suggestions: [],
        optimizationResult: null,
        error: null,
        appliedSuggestions: new Set<string>(),
      };

    default:
      return state;
  }
};
