// reducers/fermentationReducer.ts
import { FermentationEntry } from "@/types";

// Form data interface
export interface FormData {
  gravity: string;
  temperature: string;
  ph: string;
  notes: string;
}

// Editing cell interface
export interface EditingCell {
  entryIndex: number | null;
  field: string | null;
}

// Fermentation stats interface with defaults
export interface FermentationStatsWithDefaults {
  duration_days?: number;
  gravity_drop?: number;
  average_temperature?: number;
  current_attenuation?: number;
  projected_fg?: number;
  gravity?: {
    initial: number | null;
    current: number | null;
    drop: number | null;
    attenuation: number | null;
  };
  temperature?: {
    min: number | null;
    max: number | null;
    avg: number | null;
  };
  ph?: {
    min: number | null;
    max: number | null;
    avg: number | null;
    data: number[];
  };
}

// Combined state interface
export interface FermentationState {
  // Data state
  fermentationData: FermentationEntry[];
  stats: FermentationStatsWithDefaults | null;

  // UI state
  loading: boolean;
  error: string;
  submitting: boolean;
  showForm: boolean;
  initialOGSet: boolean;

  // Form state
  formData: FormData;

  // Editing state machine
  editing: {
    isEditing: boolean;
    entryIndex: number | null;
    field: string | null;
    value: string;
    originalValue: string;
    validationError: string;
  };
}

// Action types for all fermentation tracker operations
export type FermentationAction =
  // Loading actions
  | { type: "LOAD_START" }
  | {
      type: "LOAD_SUCCESS";
      payload: {
        data: FermentationEntry[];
        stats: FermentationStatsWithDefaults | null;
      };
    }
  | { type: "LOAD_ERROR"; payload: string }

  // Form actions
  | { type: "TOGGLE_FORM" }
  | {
      type: "UPDATE_FORM_FIELD";
      payload: { field: keyof FormData; value: string };
    }
  | { type: "RESET_FORM" }
  | { type: "SET_INITIAL_OG"; payload: string }

  // Submission actions
  | { type: "SUBMIT_START" }
  | {
      type: "SUBMIT_SUCCESS";
      payload: {
        data: FermentationEntry[];
        stats: FermentationStatsWithDefaults | null;
      };
    }
  | { type: "SUBMIT_ERROR"; payload: string }

  // Editing actions
  | {
      type: "START_EDIT";
      payload: {
        entryIndex: number;
        field: string;
        value: string;
        originalValue: string;
      };
    }
  | { type: "UPDATE_EDIT_VALUE"; payload: string }
  | { type: "VALIDATE_EDIT"; payload: string }
  | {
      type: "SAVE_EDIT_SUCCESS";
      payload: {
        data: FermentationEntry[];
        stats: FermentationStatsWithDefaults | null;
      };
    }
  | { type: "SAVE_EDIT_ERROR"; payload: string }
  | { type: "CANCEL_EDIT" }

  // Delete actions
  | {
      type: "DELETE_ENTRY_SUCCESS";
      payload: {
        data: FermentationEntry[];
        stats: FermentationStatsWithDefaults | null;
      };
    }
  | { type: "DELETE_ENTRY_ERROR"; payload: string }

  // Utility actions
  | { type: "CLEAR_ERROR" }
  | { type: "SET_ERROR"; payload: string };

// Initial state factory function
export const createInitialFermentationState = (): FermentationState => ({
  // Data state
  fermentationData: [],
  stats: null,

  // UI state
  loading: true,
  error: "",
  submitting: false,
  showForm: false,
  initialOGSet: false,

  // Form state
  formData: {
    gravity: "",
    temperature: "",
    ph: "",
    notes: "",
  },

  // Editing state machine
  editing: {
    isEditing: false,
    entryIndex: null,
    field: null,
    value: "",
    originalValue: "",
    validationError: "",
  },
});

// Reducer function
export const fermentationReducer = (
  state: FermentationState,
  action: FermentationAction
): FermentationState => {
  switch (action.type) {
    case "LOAD_START":
      return {
        ...state,
        loading: true,
        error: "",
      };

    case "LOAD_SUCCESS":
      return {
        ...state,
        fermentationData: action.payload.data,
        stats: action.payload.stats,
        loading: false,
        error: "",
      };

    case "LOAD_ERROR":
      return {
        ...state,
        loading: false,
        error: action.payload,
        fermentationData: [],
        stats: null,
      };

    case "TOGGLE_FORM":
      return {
        ...state,
        showForm: !state.showForm,
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
        submitting: false,
        formData: {
          gravity: "",
          temperature: "",
          ph: "",
          notes: "",
        },
        showForm: false,
      };

    case "SET_INITIAL_OG":
      return {
        ...state,
        formData: {
          ...state.formData,
          gravity: action.payload,
        },
        showForm: true,
        initialOGSet: true,
      };

    case "SUBMIT_START":
      return {
        ...state,
        submitting: true,
        error: "",
      };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        fermentationData: action.payload.data,
        stats: action.payload.stats,
        submitting: false,
        formData: {
          gravity: "",
          temperature: "",
          ph: "",
          notes: "",
        },
        showForm: false,
        error: "",
      };

    case "SUBMIT_ERROR":
      return {
        ...state,
        submitting: false,
        error: action.payload,
      };

    case "START_EDIT":
      return {
        ...state,
        editing: {
          isEditing: true,
          entryIndex: action.payload.entryIndex,
          field: action.payload.field,
          value: action.payload.value,
          originalValue: action.payload.originalValue,
          validationError: "",
        },
      };

    case "UPDATE_EDIT_VALUE":
      return {
        ...state,
        editing: {
          ...state.editing,
          value: action.payload,
        },
      };

    case "VALIDATE_EDIT":
      return {
        ...state,
        editing: {
          ...state.editing,
          validationError: action.payload,
        },
      };

    case "SAVE_EDIT_SUCCESS":
      return {
        ...state,
        fermentationData: action.payload.data,
        stats: action.payload.stats,
        editing: {
          isEditing: false,
          entryIndex: null,
          field: null,
          value: "",
          originalValue: "",
          validationError: "",
        },
      };

    case "SAVE_EDIT_ERROR":
      return {
        ...state,
        editing: {
          ...state.editing,
          validationError: action.payload,
        },
      };

    case "CANCEL_EDIT":
      return {
        ...state,
        editing: {
          isEditing: false,
          entryIndex: null,
          field: null,
          value: "",
          originalValue: "",
          validationError: "",
        },
      };

    case "DELETE_ENTRY_SUCCESS":
      return {
        ...state,
        fermentationData: action.payload.data,
        stats: action.payload.stats,
        error: "",
      };

    case "DELETE_ENTRY_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: "",
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
};

// Validation helper function
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  value?: any;
}

export const validateField = (
  field: string,
  value: string,
  unitSystem: "metric" | "imperial"
): ValidationResult => {
  const trimmedValue = typeof value === "string" ? value.trim() : value;

  switch (field) {
    case "gravity":
      if (!trimmedValue) {
        return { isValid: true, value: null };
      }
      const gravity = parseFloat(trimmedValue);
      if (isNaN(gravity) || gravity < 0.99 || gravity > 1.2) {
        return {
          isValid: false,
          error: "Gravity must be between 0.990 and 1.200",
        };
      }
      return { isValid: true, value: gravity };

    case "temperature":
      if (!trimmedValue) {
        return { isValid: true, value: null };
      }
      const temp = parseFloat(trimmedValue);
      if (isNaN(temp)) {
        return { isValid: false, error: "Temperature must be a number" };
      }
      // Validate reasonable temperature ranges
      const minTemp = unitSystem === "metric" ? -10 : 14; // -10°C or 14°F
      const maxTemp = unitSystem === "metric" ? 50 : 122; // 50°C or 122°F
      if (temp < minTemp || temp > maxTemp) {
        return {
          isValid: false,
          error: `Temperature must be between ${minTemp}° and ${maxTemp}°${
            unitSystem === "metric" ? "C" : "F"
          }`,
        };
      }
      return { isValid: true, value: temp };

    case "ph":
      if (!trimmedValue) {
        return { isValid: true, value: null };
      }
      const ph = parseFloat(trimmedValue);
      if (isNaN(ph) || ph < 0 || ph > 14) {
        return {
          isValid: false,
          error: "pH must be between 0 and 14",
        };
      }
      return { isValid: true, value: ph };

    case "notes":
      return { isValid: true, value: trimmedValue || null };

    case "entry_date":
      if (!trimmedValue) {
        return { isValid: false, error: "Date is required" };
      }
      // Parse date in YYYY-MM-DD format
      const dateMatch = trimmedValue.match(/^\d{4}-\d{2}-\d{2}$/);
      if (!dateMatch) {
        return { isValid: false, error: "Date must be in YYYY-MM-DD format" };
      }
      const testDate = new Date(trimmedValue + "T00:00:00");
      if (isNaN(testDate.getTime())) {
        return { isValid: false, error: "Invalid date" };
      }
      // Check if date is not too far in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      testDate.setHours(0, 0, 0, 0);
      if (testDate > tomorrow) {
        return { isValid: false, error: "Date cannot be in the future" };
      }
      return { isValid: true, value: trimmedValue };

    case "entry_time":
      if (!trimmedValue) {
        return { isValid: false, error: "Time is required" };
      }
      // Parse time in HH:MM format
      const timeMatch = trimmedValue.match(
        /^([01]?[0-9]|2[0-3]):([0-5]?[0-9])$/
      );
      if (!timeMatch) {
        return { isValid: false, error: "Time must be in HH:MM format" };
      }
      return { isValid: true, value: trimmedValue };

    default:
      return { isValid: true, value: trimmedValue };
  }
};
