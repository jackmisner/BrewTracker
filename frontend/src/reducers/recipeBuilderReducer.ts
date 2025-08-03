// reducers/recipeBuilderReducer.ts
import {
  Recipe,
  RecipeIngredient,
  RecipeMetrics,
  IngredientsByType,
  StyleAnalysis,
  StyleSuggestion,
  BatchSizeUnit,
} from "../types";

// Combined state interface that includes style analysis
export interface RecipeBuilderState {
  // Core data
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  availableIngredients: IngredientsByType;
  metrics: RecipeMetrics;

  // UI state
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;

  // Operation flags
  calculatingMetrics: boolean;
  addingIngredient: boolean;
  updatingIngredient: boolean;

  // Style analysis state (previously separate useState)
  styleAnalysis: StyleAnalysis | null;
  styleSuggestions: StyleSuggestion[];
}

// Action types for all recipe builder operations
export type RecipeBuilderAction =
  // Initialization actions
  | { type: 'INITIALIZE_START'; payload: { unitSystem: string } }
  | { type: 'INITIALIZE_SUCCESS'; payload: { recipe: Recipe; ingredients: RecipeIngredient[]; availableIngredients: IngredientsByType; metrics: RecipeMetrics } }
  | { type: 'INITIALIZE_ERROR'; payload: string }

  // Recipe update actions
  | { type: 'UPDATE_RECIPE_FIELD'; payload: { field: keyof Recipe; value: any } }
  | { type: 'BULK_UPDATE_RECIPE'; payload: Array<{ field: keyof Recipe; value: any }> }

  // Ingredient actions
  | { type: 'ADD_INGREDIENT_START' }
  | { type: 'ADD_INGREDIENT_SUCCESS'; payload: { ingredient: RecipeIngredient; sortedIngredients: RecipeIngredient[] } }
  | { type: 'ADD_INGREDIENT_ERROR'; payload: string }
  | { type: 'UPDATE_INGREDIENT_START' }
  | { type: 'UPDATE_INGREDIENT_SUCCESS'; payload: { ingredient: RecipeIngredient; sortedIngredients: RecipeIngredient[] } }
  | { type: 'UPDATE_INGREDIENT_ERROR'; payload: string }
  | { type: 'BULK_UPDATE_INGREDIENTS_START' }
  | { type: 'BULK_UPDATE_INGREDIENTS_SUCCESS'; payload: RecipeIngredient[] }
  | { type: 'BULK_UPDATE_INGREDIENTS_ERROR'; payload: string }
  | { type: 'REMOVE_INGREDIENT_SUCCESS'; payload: RecipeIngredient[] }
  | { type: 'REMOVE_INGREDIENT_ERROR'; payload: string }
  | { type: 'IMPORT_INGREDIENTS_START' }
  | { type: 'IMPORT_INGREDIENTS_SUCCESS'; payload: RecipeIngredient[] }
  | { type: 'IMPORT_INGREDIENTS_ERROR'; payload: string }
  | { type: 'REPLACE_INGREDIENTS_START' }
  | { type: 'REPLACE_INGREDIENTS_SUCCESS'; payload: RecipeIngredient[] }
  | { type: 'REPLACE_INGREDIENTS_ERROR'; payload: string }

  // Metrics calculation actions
  | { type: 'CALCULATE_METRICS_START' }
  | { type: 'CALCULATE_METRICS_SUCCESS'; payload: RecipeMetrics }
  | { type: 'CALCULATE_METRICS_ERROR'; payload: string }

  // Recipe scaling actions
  | { type: 'SCALE_RECIPE_SUCCESS'; payload: { recipe: Recipe; ingredients: RecipeIngredient[] } }
  | { type: 'SCALE_RECIPE_ERROR'; payload: string }

  // Save actions
  | { type: 'SAVE_RECIPE_START' }
  | { type: 'SAVE_RECIPE_SUCCESS'; payload: Recipe }
  | { type: 'SAVE_RECIPE_ERROR'; payload: string }

  // Style analysis actions
  | { type: 'UPDATE_STYLE_ANALYSIS'; payload: StyleAnalysis | null }
  | { type: 'UPDATE_STYLE_SUGGESTIONS'; payload: StyleSuggestion[] }

  // Utility actions
  | { type: 'CLEAR_ERROR' }
  | { type: 'CANCEL_OPERATIONS' }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'REFRESH_AVAILABLE_INGREDIENTS'; payload: IngredientsByType }
  | { type: 'IMPORT_RECIPE_DATA'; payload: Partial<Recipe> }

// Initial state factory function
export const createInitialState = (unitSystem: 'metric' | 'imperial'): RecipeBuilderState => ({
  // Core data
  recipe: {
    id: "",
    recipe_id: "",
    name: "",
    style: "",
    batch_size: 0, // Use 0 as placeholder for new recipes
    batch_size_unit: (unitSystem === "metric" ? "l" : "gal") as BatchSizeUnit,
    description: "",
    boil_time: undefined,
    efficiency: undefined,
    mash_temperature: undefined,
    mash_temp_unit: unitSystem === "metric" ? "C" : "F",
    is_public: false,
    notes: "",
    ingredients: [],
    created_at: "",
    updated_at: "",
  },
  ingredients: [],
  availableIngredients: {
    grain: [],
    hop: [],
    yeast: [],
    other: [],
  },
  metrics: {
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  },

  // UI state
  loading: true,
  saving: false,
  error: null,
  hasUnsavedChanges: false,

  // Operation flags
  calculatingMetrics: false,
  addingIngredient: false,
  updatingIngredient: false,

  // Style analysis state
  styleAnalysis: null,
  styleSuggestions: [],
});

// Reducer function
export const recipeBuilderReducer = (
  state: RecipeBuilderState,
  action: RecipeBuilderAction
): RecipeBuilderState => {
  switch (action.type) {
    case 'INITIALIZE_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'INITIALIZE_SUCCESS':
      return {
        ...state,
        ...action.payload,
        loading: false,
        hasUnsavedChanges: false,
      };

    case 'INITIALIZE_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'UPDATE_RECIPE_FIELD':
      return {
        ...state,
        recipe: {
          ...state.recipe,
          [action.payload.field]: action.payload.value,
        },
        hasUnsavedChanges: true,
      };

    case 'BULK_UPDATE_RECIPE':
      let updatedRecipe = { ...state.recipe };
      for (const update of action.payload) {
        updatedRecipe = { ...updatedRecipe, [update.field]: update.value };
      }
      return {
        ...state,
        recipe: updatedRecipe,
        hasUnsavedChanges: true,
      };

    case 'ADD_INGREDIENT_START':
      return {
        ...state,
        addingIngredient: true,
        error: null,
      };

    case 'ADD_INGREDIENT_SUCCESS':
      return {
        ...state,
        ingredients: action.payload.sortedIngredients,
        hasUnsavedChanges: true,
        addingIngredient: false,
        calculatingMetrics: true,
      };

    case 'ADD_INGREDIENT_ERROR':
      return {
        ...state,
        error: action.payload,
        addingIngredient: false,
        calculatingMetrics: false,
      };

    case 'UPDATE_INGREDIENT_START':
      return {
        ...state,
        updatingIngredient: true,
        error: null,
      };

    case 'UPDATE_INGREDIENT_SUCCESS':
      return {
        ...state,
        ingredients: action.payload.sortedIngredients,
        hasUnsavedChanges: true,
        updatingIngredient: false,
        calculatingMetrics: true,
      };

    case 'UPDATE_INGREDIENT_ERROR':
      return {
        ...state,
        error: action.payload,
        updatingIngredient: false,
        calculatingMetrics: false,
      };

    case 'BULK_UPDATE_INGREDIENTS_START':
      return {
        ...state,
        updatingIngredient: true,
        error: null,
      };

    case 'BULK_UPDATE_INGREDIENTS_SUCCESS':
      return {
        ...state,
        ingredients: action.payload,
        hasUnsavedChanges: true,
        updatingIngredient: false,
        calculatingMetrics: true,
      };

    case 'BULK_UPDATE_INGREDIENTS_ERROR':
      return {
        ...state,
        error: action.payload,
        updatingIngredient: false,
        calculatingMetrics: false,
      };

    case 'REMOVE_INGREDIENT_SUCCESS':
      return {
        ...state,
        ingredients: action.payload,
        hasUnsavedChanges: true,
        calculatingMetrics: true,
      };

    case 'IMPORT_INGREDIENTS_START':
      return {
        ...state,
        addingIngredient: true,
        error: null,
      };

    case 'IMPORT_INGREDIENTS_SUCCESS':
      return {
        ...state,
        ingredients: action.payload,
        hasUnsavedChanges: true,
        addingIngredient: false,
        calculatingMetrics: true,
      };

    case 'IMPORT_INGREDIENTS_ERROR':
      return {
        ...state,
        error: action.payload,
        addingIngredient: false,
        calculatingMetrics: false,
      };

    case 'REPLACE_INGREDIENTS_START':
      return {
        ...state,
        updatingIngredient: true,
        error: null,
      };

    case 'REPLACE_INGREDIENTS_SUCCESS':
      return {
        ...state,
        ingredients: action.payload,
        hasUnsavedChanges: true,
        updatingIngredient: false,
        calculatingMetrics: true,
      };

    case 'REPLACE_INGREDIENTS_ERROR':
      return {
        ...state,
        error: action.payload,
        updatingIngredient: false,
        calculatingMetrics: false,
      };

    case 'REMOVE_INGREDIENT_ERROR':
      return {
        ...state,
        error: action.payload,
        calculatingMetrics: false,
      };

    case 'SCALE_RECIPE_ERROR':
      return {
        ...state,
        error: action.payload,
        calculatingMetrics: false,
      };

    case 'CALCULATE_METRICS_START':
      return {
        ...state,
        calculatingMetrics: true,
      };

    case 'CALCULATE_METRICS_SUCCESS':
      return {
        ...state,
        metrics: action.payload,
        calculatingMetrics: false,
      };

    case 'CALCULATE_METRICS_ERROR':
      return {
        ...state,
        calculatingMetrics: false,
        error: action.payload,
      };

    case 'SCALE_RECIPE_SUCCESS':
      return {
        ...state,
        recipe: action.payload.recipe,
        ingredients: action.payload.ingredients,
        hasUnsavedChanges: true,
        calculatingMetrics: true,
      };

    case 'SAVE_RECIPE_START':
      return {
        ...state,
        saving: true,
        error: null,
      };

    case 'SAVE_RECIPE_SUCCESS':
      return {
        ...state,
        recipe: action.payload,
        hasUnsavedChanges: false,
        saving: false,
      };

    case 'SAVE_RECIPE_ERROR':
      return {
        ...state,
        error: action.payload,
        saving: false,
      };

    case 'UPDATE_STYLE_ANALYSIS':
      return {
        ...state,
        styleAnalysis: action.payload,
      };

    case 'UPDATE_STYLE_SUGGESTIONS':
      return {
        ...state,
        styleSuggestions: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'CANCEL_OPERATIONS':
      return {
        ...state,
        calculatingMetrics: false,
        addingIngredient: false,
        updatingIngredient: false,
        error: null,
      };

    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    case 'REFRESH_AVAILABLE_INGREDIENTS':
      return {
        ...state,
        availableIngredients: action.payload,
      };

    case 'IMPORT_RECIPE_DATA':
      const cleanedRecipeData = { ...action.payload };

      // Round batch size to reasonable precision (2 decimal places)
      if (
        cleanedRecipeData.batch_size &&
        typeof cleanedRecipeData.batch_size === "number"
      ) {
        cleanedRecipeData.batch_size =
          Math.round(cleanedRecipeData.batch_size * 100) / 100;
      }

      return {
        ...state,
        recipe: { ...state.recipe, ...cleanedRecipeData },
        hasUnsavedChanges: true,
      };

    default:
      return state;
  }
};