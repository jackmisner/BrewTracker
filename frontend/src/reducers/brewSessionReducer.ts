// reducers/brewSessionReducer.ts

import { Recipe, BrewSession, BrewSessionStatus } from "@/types";

// Form data interfaces matching the components
export interface CreateBrewSessionFormData {
  recipe_id: string | null;
  name: string;
  brew_date: string;
  status: BrewSessionStatus;
  notes: string;
}

export interface EditBrewSessionFormData {
  name: string;
  status: BrewSessionStatus;
  brew_date: string;
  mash_temp: string;
  actual_og: string;
  actual_fg: string;
  actual_abv: string;
  actual_efficiency: string;
  fermentation_start_date: string;
  fermentation_end_date: string;
  packaging_date: string;
  tasting_notes: string;
  batch_rating: string;
}

// Combined state interface supporting both Create and Edit operations
export interface BrewSessionState {
  // Data state
  session: BrewSession | null;
  recipe: Recipe | null;

  // Form state - union type to support both create and edit forms
  formData: CreateBrewSessionFormData | EditBrewSessionFormData;

  // Loading states
  loading: boolean;
  submitting: boolean; // For create/update operations
  creating: boolean; // Alias for submitting in create mode

  // Error state
  error: string;

  // Operation mode to differentiate behavior
  mode: "create" | "edit";
}

// Action types for all brew session operations
export type BrewSessionAction =
  // Mode setting
  | { type: "SET_MODE"; payload: "create" | "edit" }

  // Loading actions
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_CREATING"; payload: boolean }

  // Data actions
  | { type: "SET_SESSION"; payload: BrewSession | null }
  | { type: "SET_RECIPE"; payload: Recipe | null }

  // Form actions
  | {
      type: "SET_FORM_DATA";
      payload: CreateBrewSessionFormData | EditBrewSessionFormData;
    }
  | { type: "UPDATE_FORM_FIELD"; payload: { field: string; value: string } }
  | { type: "RESET_FORM" }

  // Error actions
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }

  // Combined actions
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: { session?: BrewSession; recipe?: Recipe };
    }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_ERROR"; payload: string }

  // Reset actions
  | { type: "RESET_STATE" };

// Initial state factory functions
export const createInitialCreateFormData = (
  recipeId?: string | null
): CreateBrewSessionFormData => ({
  recipe_id: recipeId || null,
  name: "",
  brew_date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
  status: "planned",
  notes: "",
});

export const createInitialEditFormData = (): EditBrewSessionFormData => ({
  name: "",
  status: "planned",
  brew_date: "",
  mash_temp: "",
  actual_og: "",
  actual_fg: "",
  actual_abv: "",
  actual_efficiency: "",
  fermentation_start_date: "",
  fermentation_end_date: "",
  packaging_date: "",
  tasting_notes: "",
  batch_rating: "",
});

export const createInitialBrewSessionState = (
  mode: "create" | "edit" = "create",
  recipeId?: string | null
): BrewSessionState => ({
  // Data state
  session: null,
  recipe: null,

  // Form state
  formData:
    mode === "create"
      ? createInitialCreateFormData(recipeId)
      : createInitialEditFormData(),

  // Loading states
  loading: true,
  submitting: false,
  creating: false,

  // Error state
  error: "",

  // Operation mode
  mode,
});

// Reducer function
export const brewSessionReducer = (
  state: BrewSessionState,
  action: BrewSessionAction
): BrewSessionState => {
  switch (action.type) {
    // Mode setting
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        formData:
          action.payload === "create"
            ? createInitialCreateFormData()
            : createInitialEditFormData(),
      };

    // Loading actions
    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };

    case "SET_SUBMITTING":
      return {
        ...state,
        submitting: action.payload,
        creating: action.payload, // Sync creating with submitting
      };

    case "SET_CREATING":
      return {
        ...state,
        creating: action.payload,
        submitting: action.payload, // Sync submitting with creating
      };

    // Data actions
    case "SET_SESSION":
      return {
        ...state,
        session: action.payload,
      };

    case "SET_RECIPE":
      return {
        ...state,
        recipe: action.payload,
      };

    // Form actions
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: action.payload,
      };

    case "UPDATE_FORM_FIELD":
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.payload.field]: action.payload.value,
        },
      };

    case "RESET_FORM":
      return {
        ...state,
        formData:
          state.mode === "create"
            ? createInitialCreateFormData()
            : createInitialEditFormData(),
      };

    // Error actions
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

    // Combined actions
    case "FETCH_START":
      return {
        ...state,
        loading: true,
        error: "",
      };

    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        session: action.payload.session || state.session,
        recipe: action.payload.recipe || state.recipe,
      };

    case "FETCH_ERROR":
      return {
        ...state,
        loading: false,
        error: action.payload,
      };

    case "SUBMIT_START":
      return {
        ...state,
        submitting: true,
        creating: true,
        error: "",
      };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        creating: false,
      };

    case "SUBMIT_ERROR":
      return {
        ...state,
        submitting: false,
        creating: false,
        error: action.payload,
      };

    // Reset actions
    case "RESET_STATE":
      return createInitialBrewSessionState(state.mode);

    default:
      return state;
  }
};
