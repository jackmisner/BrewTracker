// reducers/userSettingsReducer.ts

// Form data interfaces (from UserSettings.tsx)
export interface ProfileForm {
  username: string;
  email: string;
}

export interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface DeleteForm {
  password: string;
  confirmation: string;
  preserve_public_recipes: boolean;
}

export interface PreferencesForm {
  default_batch_size: number;
  preferred_units: "imperial" | "metric";
  timezone: string;
  email_notifications: boolean;
  brew_reminders: boolean;
}

export interface PrivacyForm {
  contribute_anonymous_data: boolean;
  share_yeast_performance: boolean;
  share_recipe_metrics: boolean;
  public_recipes_default: boolean;
}

// Tab types
export type TabId = "account" | "preferences" | "privacy" | "security";

// Full user settings type from service
export type FullUserSettings = Awaited<
  ReturnType<typeof import("../services").Services.userSettings.getUserSettings>
>;

// Combined state interface
export interface UserSettingsState {
  // Core data
  settings: FullUserSettings | null;
  activeTab: TabId;

  // UI state
  loading: boolean;
  saving: boolean;
  error: string;
  successMessage: string;
  hasUnsavedChanges: boolean;

  // Form states
  profileForm: ProfileForm;
  passwordForm: PasswordForm;
  deleteForm: DeleteForm;
  preferencesForm: PreferencesForm;
  privacyForm: PrivacyForm;

  // Original form values for comparison
  originalProfileForm: ProfileForm;
  originalPreferencesForm: PreferencesForm;
  originalPrivacyForm: PrivacyForm;
}

// Action types for all user settings operations
export type UserSettingsAction =
  // Initialization actions
  | { type: "INITIALIZE_START" }
  | {
      type: "INITIALIZE_SUCCESS";
      payload: {
        settings: FullUserSettings;
        profileForm: ProfileForm;
        preferencesForm: PreferencesForm;
        privacyForm: PrivacyForm;
      };
    }
  | { type: "INITIALIZE_ERROR"; payload: string }

  // Tab navigation
  | { type: "SET_ACTIVE_TAB"; payload: TabId }

  // Form update actions
  | {
      type: "UPDATE_PROFILE_FIELD";
      payload: { field: keyof ProfileForm; value: any };
    }
  | {
      type: "UPDATE_PASSWORD_FIELD";
      payload: { field: keyof PasswordForm; value: any };
    }
  | {
      type: "UPDATE_DELETE_FIELD";
      payload: { field: keyof DeleteForm; value: any };
    }
  | {
      type: "UPDATE_PREFERENCES_FIELD";
      payload: { field: keyof PreferencesForm; value: any };
    }
  | {
      type: "UPDATE_PRIVACY_FIELD";
      payload: { field: keyof PrivacyForm; value: any };
    }

  // Bulk form updates
  | { type: "SET_PROFILE_FORM"; payload: ProfileForm }
  | { type: "SET_PREFERENCES_FORM"; payload: PreferencesForm }
  | { type: "SET_PRIVACY_FORM"; payload: PrivacyForm }

  // Update original forms (for save success)
  | { type: "UPDATE_ORIGINAL_PROFILE_FORM"; payload: ProfileForm }
  | { type: "UPDATE_ORIGINAL_PREFERENCES_FORM"; payload: PreferencesForm }
  | { type: "UPDATE_ORIGINAL_PRIVACY_FORM"; payload: PrivacyForm }

  // Reset actions
  | { type: "RESET_PASSWORD_FORM" }
  | { type: "RESET_DELETE_FORM" }

  // Save operations
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; payload: string }
  | { type: "SAVE_ERROR"; payload: string }

  // Utility actions
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_SUCCESS_MESSAGE"; payload: string }
  | { type: "CLEAR_SUCCESS_MESSAGE" }
  | { type: "SET_UNSAVED_CHANGES"; payload: boolean }
  | { type: "CLEAR_MESSAGES" };

// Initial state factory function
export const createInitialUserSettingsState = (): UserSettingsState => ({
  // Core data
  settings: null,
  activeTab: "account",

  // UI state
  loading: true,
  saving: false,
  error: "",
  successMessage: "",
  hasUnsavedChanges: false,

  // Form states
  profileForm: {
    username: "",
    email: "",
  },
  passwordForm: {
    current_password: "",
    new_password: "",
    confirm_password: "",
  },
  deleteForm: {
    password: "",
    confirmation: "",
    preserve_public_recipes: true,
  },
  preferencesForm: {
    default_batch_size: 5.0,
    preferred_units: "imperial",
    timezone: "UTC",
    email_notifications: true,
    brew_reminders: true,
  },
  privacyForm: {
    contribute_anonymous_data: false,
    share_yeast_performance: false,
    share_recipe_metrics: false,
    public_recipes_default: false,
  },

  // Original form values for comparison
  originalProfileForm: {
    username: "",
    email: "",
  },
  originalPreferencesForm: {
    default_batch_size: 5.0,
    preferred_units: "imperial",
    timezone: "UTC",
    email_notifications: true,
    brew_reminders: true,
  },
  originalPrivacyForm: {
    contribute_anonymous_data: false,
    share_yeast_performance: false,
    share_recipe_metrics: false,
    public_recipes_default: false,
  },
});

// Reducer function
export const userSettingsReducer = (
  state: UserSettingsState,
  action: UserSettingsAction
): UserSettingsState => {
  switch (action.type) {
    case "INITIALIZE_START":
      return {
        ...state,
        loading: true,
        error: "",
      };

    case "INITIALIZE_SUCCESS":
      return {
        ...state,
        settings: action.payload.settings,
        profileForm: action.payload.profileForm,
        preferencesForm: action.payload.preferencesForm,
        privacyForm: action.payload.privacyForm,
        // Store original values for comparison
        originalProfileForm: action.payload.profileForm,
        originalPreferencesForm: action.payload.preferencesForm,
        originalPrivacyForm: action.payload.privacyForm,
        loading: false,
        hasUnsavedChanges: false,
      };

    case "INITIALIZE_ERROR":
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case "SET_ACTIVE_TAB":
      return {
        ...state,
        activeTab: action.payload,
      };

    case "UPDATE_PROFILE_FIELD":
      return {
        ...state,
        profileForm: {
          ...state.profileForm,
          [action.payload.field]: action.payload.value,
        },
        hasUnsavedChanges: true,
      };

    case "UPDATE_PASSWORD_FIELD":
      return {
        ...state,
        passwordForm: {
          ...state.passwordForm,
          [action.payload.field]: action.payload.value,
        },
      };

    case "UPDATE_DELETE_FIELD":
      return {
        ...state,
        deleteForm: {
          ...state.deleteForm,
          [action.payload.field]: action.payload.value,
        },
      };

    case "UPDATE_PREFERENCES_FIELD":
      return {
        ...state,
        preferencesForm: {
          ...state.preferencesForm,
          [action.payload.field]: action.payload.value,
        },
        hasUnsavedChanges: true,
      };

    case "UPDATE_PRIVACY_FIELD":
      return {
        ...state,
        privacyForm: {
          ...state.privacyForm,
          [action.payload.field]: action.payload.value,
        },
        hasUnsavedChanges: true,
      };

    case "SET_PROFILE_FORM":
      return {
        ...state,
        profileForm: action.payload,
        hasUnsavedChanges: true,
      };

    case "SET_PREFERENCES_FORM":
      return {
        ...state,
        preferencesForm: action.payload,
        hasUnsavedChanges: true,
      };

    case "SET_PRIVACY_FORM":
      return {
        ...state,
        privacyForm: action.payload,
        hasUnsavedChanges: true,
      };

    case "UPDATE_ORIGINAL_PROFILE_FORM":
      return {
        ...state,
        originalProfileForm: action.payload,
      };

    case "UPDATE_ORIGINAL_PREFERENCES_FORM":
      return {
        ...state,
        originalPreferencesForm: action.payload,
      };

    case "UPDATE_ORIGINAL_PRIVACY_FORM":
      return {
        ...state,
        originalPrivacyForm: action.payload,
      };

    case "RESET_PASSWORD_FORM":
      return {
        ...state,
        passwordForm: {
          current_password: "",
          new_password: "",
          confirm_password: "",
        },
      };

    case "RESET_DELETE_FORM":
      return {
        ...state,
        deleteForm: {
          password: "",
          confirmation: "",
          preserve_public_recipes: true,
        },
      };

    case "SAVE_START":
      return {
        ...state,
        saving: true,
        error: "",
        successMessage: "",
      };

    case "SAVE_SUCCESS":
      return {
        ...state,
        saving: false,
        successMessage: action.payload,
        hasUnsavedChanges: false,
      };

    case "SAVE_ERROR":
      return {
        ...state,
        saving: false,
        error: action.payload,
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

    case "SET_SUCCESS_MESSAGE":
      return {
        ...state,
        successMessage: action.payload,
      };

    case "CLEAR_SUCCESS_MESSAGE":
      return {
        ...state,
        successMessage: "",
      };

    case "SET_UNSAVED_CHANGES":
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        error: "",
        successMessage: "",
      };

    default:
      return state;
  }
};
