// reducers/ingredientManagerReducer.ts

import { Ingredient, IngredientType } from "@/types";

// Form data interfaces (from IngredientManager.tsx)
export interface IngredientFormData {
  name: string;
  type: IngredientType;
  description: string;
  // Grain-specific fields
  grain_type: string;
  potential: string;
  color: string;
  // Hop-specific fields
  alpha_acid: string;
  // Yeast-specific fields
  yeast_type: string;
  attenuation: string;
  manufacturer: string;
  code: string;
  alcohol_tolerance: string;
  min_temperature: string;
  max_temperature: string;
}

export interface IngredientWithSearch extends Ingredient {
  searchScore?: number;
  searchMatches?: any[];
}

export interface GroupedIngredients {
  grain: IngredientWithSearch[];
  hop: IngredientWithSearch[];
  yeast: IngredientWithSearch[];
  other: IngredientWithSearch[];
}

export interface ExpandedSections {
  [key: string]: boolean;
}

// Combined state interface
export interface IngredientManagerState {
  // Form state
  formData: IngredientFormData;

  // UI state
  loading: boolean;
  error: string;
  success: string;

  // Data state
  existingIngredients: Ingredient[];
  groupedIngredients: GroupedIngredients;
  searchQuery: string;
  filteredResults: GroupedIngredients;
  expandedSections: ExpandedSections;

  // Constants
  defaultExpandedState: ExpandedSections;
}

// Action types for all ingredient manager operations
export type IngredientManagerAction =
  // Form actions
  | {
      type: "UPDATE_FORM_FIELD";
      payload: { field: keyof IngredientFormData; value: any };
    }
  | { type: "UPDATE_FORM_TYPE"; payload: IngredientType }
  | { type: "RESET_FORM" }
  | { type: "SET_FORM_DATA"; payload: IngredientFormData }

  // UI state actions
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_SUCCESS"; payload: string }
  | { type: "CLEAR_SUCCESS" }
  | { type: "CLEAR_MESSAGES" }

  // Data actions
  | { type: "SET_EXISTING_INGREDIENTS"; payload: Ingredient[] }
  | { type: "SET_GROUPED_INGREDIENTS"; payload: GroupedIngredients }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_FILTERED_RESULTS"; payload: GroupedIngredients }
  | { type: "TOGGLE_SECTION"; payload: string }
  | { type: "SET_EXPANDED_SECTIONS"; payload: ExpandedSections }

  // Compound actions for ingredient operations
  | { type: "SUBMIT_START" }
  | {
      type: "SUBMIT_SUCCESS";
      payload: {
        message: string;
        ingredients: Ingredient[];
        grouped: GroupedIngredients;
      };
    }
  | { type: "SUBMIT_ERROR"; payload: string }

  // Search and filtering actions
  | { type: "SEARCH_START" }
  | {
      type: "SEARCH_COMPLETE";
      payload: { results: GroupedIngredients; expandSections: boolean };
    }
  | { type: "CLEAR_SEARCH" };

// Initial state factory function
export const createInitialIngredientManagerState =
  (): IngredientManagerState => ({
    // Form state
    formData: {
      name: "",
      type: "grain",
      description: "",
      // Grain-specific fields
      grain_type: "",
      potential: "",
      color: "",
      // Hop-specific fields
      alpha_acid: "",
      // Yeast-specific fields
      yeast_type: "",
      attenuation: "",
      manufacturer: "",
      code: "",
      alcohol_tolerance: "",
      min_temperature: "",
      max_temperature: "",
    },

    // UI state
    loading: false,
    error: "",
    success: "",

    // Data state
    existingIngredients: [],
    groupedIngredients: {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
    },
    searchQuery: "",
    filteredResults: {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
    },
    expandedSections: {
      grain: false,
      hop: false,
      yeast: false,
      other: false,
    },

    // Constants
    defaultExpandedState: {
      grain: false,
      hop: false,
      yeast: false,
      other: false,
    },
  });

// Reducer function
export const ingredientManagerReducer = (
  state: IngredientManagerState,
  action: IngredientManagerAction
): IngredientManagerState => {
  switch (action.type) {
    case "UPDATE_FORM_FIELD":
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.payload.field]: action.payload.value,
        },
        // Clear messages when user starts typing
        error: state.error ? "" : state.error,
        success: state.success ? "" : state.success,
      };

    case "UPDATE_FORM_TYPE":
      return {
        ...state,
        formData: {
          ...state.formData,
          type: action.payload,
          // Clear type-specific fields when switching types
          grain_type: "",
          potential: "",
          color: "",
          alpha_acid: "",
          yeast_type: "",
          attenuation: "",
          manufacturer: "",
          code: "",
          alcohol_tolerance: "",
          min_temperature: "",
          max_temperature: "",
        },
      };

    case "RESET_FORM":
      return {
        ...state,
        formData: {
          name: "",
          type: "grain",
          description: "",
          grain_type: "",
          potential: "",
          color: "",
          alpha_acid: "",
          yeast_type: "",
          attenuation: "",
          manufacturer: "",
          code: "",
          alcohol_tolerance: "",
          min_temperature: "",
          max_temperature: "",
        },
        error: "",
        success: "",
      };

    case "SET_FORM_DATA":
      return {
        ...state,
        formData: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: "",
      };

    case "SET_SUCCESS":
      return {
        ...state,
        success: action.payload,
      };

    case "CLEAR_SUCCESS":
      return {
        ...state,
        success: "",
      };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        error: "",
        success: "",
      };

    case "SET_EXISTING_INGREDIENTS":
      return {
        ...state,
        existingIngredients: action.payload,
      };

    case "SET_GROUPED_INGREDIENTS":
      return {
        ...state,
        groupedIngredients: action.payload,
      };

    case "SET_SEARCH_QUERY":
      return {
        ...state,
        searchQuery: action.payload,
      };

    case "SET_FILTERED_RESULTS":
      return {
        ...state,
        filteredResults: action.payload,
      };

    case "TOGGLE_SECTION":
      return {
        ...state,
        expandedSections: {
          ...state.expandedSections,
          [action.payload]: !state.expandedSections[action.payload],
        },
      };

    case "SET_EXPANDED_SECTIONS":
      return {
        ...state,
        expandedSections: action.payload,
      };

    case "SUBMIT_START":
      return {
        ...state,
        loading: true,
        error: "",
        success: "",
      };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        loading: false,
        success: action.payload.message,
        existingIngredients: action.payload.ingredients,
        groupedIngredients: action.payload.grouped,
        filteredResults: action.payload.grouped,
        // Reset form after successful submission
        formData: {
          name: "",
          type: "grain",
          description: "",
          grain_type: "",
          potential: "",
          color: "",
          alpha_acid: "",
          yeast_type: "",
          attenuation: "",
          manufacturer: "",
          code: "",
          alcohol_tolerance: "",
          min_temperature: "",
          max_temperature: "",
        },
      };

    case "SUBMIT_ERROR":
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case "SEARCH_START":
      return {
        ...state,
        // Keep current state, search results will be updated separately
      };

    case "SEARCH_COMPLETE":
      return {
        ...state,
        filteredResults: action.payload.results,
        expandedSections: action.payload.expandSections
          ? {
              grain: true,
              hop: true,
              yeast: true,
              other: true,
            }
          : state.expandedSections,
      };

    case "CLEAR_SEARCH":
      return {
        ...state,
        searchQuery: "",
        filteredResults: state.groupedIngredients,
        expandedSections: state.defaultExpandedState,
      };

    default:
      return state;
  }
};
