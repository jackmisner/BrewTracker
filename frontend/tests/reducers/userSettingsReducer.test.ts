import {
  userSettingsReducer,
  createInitialUserSettingsState,
  type UserSettingsAction,
  type UserSettingsState,
  type TabId,
} from '../../src/reducers/userSettingsReducer';

describe('userSettingsReducer', () => {
  let initialState: UserSettingsState;

  beforeEach(() => {
    initialState = createInitialUserSettingsState();
  });

  describe('Initial State', () => {
    it('should create correct initial state', () => {
      expect(initialState).toEqual({
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
    });
  });

  describe('Tab Navigation Actions', () => {
    it('should handle SET_ACTIVE_TAB', () => {
      const action: UserSettingsAction = {
        type: 'SET_ACTIVE_TAB',
        payload: 'preferences',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.activeTab).toBe('preferences');
      expect(newState).not.toBe(initialState); // Immutability check
    });

    it('should handle all valid tab IDs', () => {
      const validTabs: TabId[] = ['account', 'preferences', 'privacy', 'security'];

      validTabs.forEach(tab => {
        const action: UserSettingsAction = {
          type: 'SET_ACTIVE_TAB',
          payload: tab,
        };

        const newState = userSettingsReducer(initialState, action);
        expect(newState.activeTab).toBe(tab);
      });
    });
  });

  describe('Initialization Actions', () => {
    it('should handle INITIALIZE_START', () => {
      const action: UserSettingsAction = {
        type: 'INITIALIZE_START',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe(''); // Should clear error when loading starts
    });

    it('should handle INITIALIZE_SUCCESS', () => {
      const mockSettings = {
        user: {
          username: 'testuser',
          email: 'test@example.com',
          created_at: '2024-01-01T12:00:00Z',
          last_login: '2024-01-15T12:00:00Z',
        },
        settings: {
          default_batch_size: 19.0,
          preferred_units: 'metric' as const,
          timezone: 'America/New_York',
          email_notifications: false,
          brew_reminders: false,
          contribute_anonymous_data: true,
          share_yeast_performance: true,
          share_recipe_metrics: true,
          public_recipes_default: true,
        },
      };

      const profileData = {
        username: 'testuser',
        email: 'test@example.com',
      };

      const preferencesData = {
        default_batch_size: 19.0,
        preferred_units: 'metric' as const,
        timezone: 'America/New_York',
        email_notifications: false,
        brew_reminders: false,
      };

      const privacyData = {
        contribute_anonymous_data: true,
        share_yeast_performance: true,
        share_recipe_metrics: true,
        public_recipes_default: true,
      };

      const action: UserSettingsAction = {
        type: 'INITIALIZE_SUCCESS',
        payload: {
          settings: mockSettings,
          profileForm: profileData,
          preferencesForm: preferencesData,
          privacyForm: privacyData,
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.settings).toEqual(mockSettings);
      expect(newState.profileForm).toEqual(profileData);
      expect(newState.preferencesForm).toEqual(preferencesData);
      expect(newState.privacyForm).toEqual(privacyData);
      expect(newState.originalProfileForm).toEqual(profileData);
      expect(newState.originalPreferencesForm).toEqual(preferencesData);
      expect(newState.originalPrivacyForm).toEqual(privacyData);
      expect(newState.loading).toBe(false);
      expect(newState.hasUnsavedChanges).toBe(false);
    });

    it('should handle INITIALIZE_ERROR', () => {
      const action: UserSettingsAction = {
        type: 'INITIALIZE_ERROR',
        payload: 'Failed to load settings',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.error).toBe('Failed to load settings');
      expect(newState.loading).toBe(false);
    });
  });

  describe('Save Actions', () => {
    it('should handle SAVE_START', () => {
      const action: UserSettingsAction = {
        type: 'SAVE_START',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.saving).toBe(true);
      expect(newState.error).toBe('');
      expect(newState.successMessage).toBe('');
    });

    it('should handle SAVE_SUCCESS', () => {
      const action: UserSettingsAction = {
        type: 'SAVE_SUCCESS',
        payload: 'Settings saved successfully',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.saving).toBe(false);
      expect(newState.successMessage).toBe('Settings saved successfully');
      expect(newState.hasUnsavedChanges).toBe(false);
    });

    it('should handle SAVE_ERROR', () => {
      const action: UserSettingsAction = {
        type: 'SAVE_ERROR',
        payload: 'Failed to save settings',
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.saving).toBe(false);
      expect(newState.error).toBe('Failed to save settings');
    });
  });

  describe('Form Update Actions', () => {
    it('should handle UPDATE_PROFILE_FIELD', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PROFILE_FIELD',
        payload: {
          field: 'username',
          value: 'newusername',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.profileForm.username).toBe('newusername');
      expect(newState.hasUnsavedChanges).toBe(true);
    });

    it('should handle UPDATE_PASSWORD_FIELD', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PASSWORD_FIELD',
        payload: {
          field: 'current_password',
          value: 'OldPass123!',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.passwordForm.current_password).toBe('OldPass123!');
      // Password changes don't mark unsaved changes
      expect(newState.hasUnsavedChanges).toBe(false);
    });

    it('should handle UPDATE_DELETE_FIELD', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_DELETE_FIELD',
        payload: {
          field: 'password',
          value: 'TestPass123!',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.deleteForm.password).toBe('TestPass123!');
    });

    it('should handle UPDATE_PREFERENCES_FIELD', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PREFERENCES_FIELD',
        payload: {
          field: 'preferred_units',
          value: 'metric',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.preferencesForm.preferred_units).toBe('metric');
      expect(newState.hasUnsavedChanges).toBe(true);
    });

    it('should handle UPDATE_PRIVACY_FIELD', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PRIVACY_FIELD',
        payload: {
          field: 'contribute_anonymous_data',
          value: true,
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.privacyForm.contribute_anonymous_data).toBe(true);
      expect(newState.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Bulk Form Update Actions', () => {
    it('should handle SET_PROFILE_FORM', () => {
      const profileData = {
        username: 'newuser',
        email: 'new@example.com',
      };

      const action: UserSettingsAction = {
        type: 'SET_PROFILE_FORM',
        payload: profileData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.profileForm).toEqual(profileData);
      expect(newState.hasUnsavedChanges).toBe(true);
    });

    it('should handle SET_PREFERENCES_FORM', () => {
      const preferencesData = {
        default_batch_size: 19.0,
        preferred_units: 'metric' as const,
        timezone: 'Europe/London',
        email_notifications: false,
        brew_reminders: false,
      };

      const action: UserSettingsAction = {
        type: 'SET_PREFERENCES_FORM',
        payload: preferencesData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.preferencesForm).toEqual(preferencesData);
      expect(newState.hasUnsavedChanges).toBe(true);
    });

    it('should handle SET_PRIVACY_FORM', () => {
      const privacyData = {
        contribute_anonymous_data: true,
        share_yeast_performance: true,
        share_recipe_metrics: true,
        public_recipes_default: true,
      };

      const action: UserSettingsAction = {
        type: 'SET_PRIVACY_FORM',
        payload: privacyData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.privacyForm).toEqual(privacyData);
      expect(newState.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Update Original Forms Actions', () => {
    it('should handle UPDATE_ORIGINAL_PROFILE_FORM', () => {
      const profileData = {
        username: 'updateduser',
        email: 'updated@example.com',
      };

      const action: UserSettingsAction = {
        type: 'UPDATE_ORIGINAL_PROFILE_FORM',
        payload: profileData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.originalProfileForm).toEqual(profileData);
    });

    it('should handle UPDATE_ORIGINAL_PREFERENCES_FORM', () => {
      const preferencesData = {
        default_batch_size: 23.0,
        preferred_units: 'metric' as const,
        timezone: 'Asia/Tokyo',
        email_notifications: false,
        brew_reminders: true,
      };

      const action: UserSettingsAction = {
        type: 'UPDATE_ORIGINAL_PREFERENCES_FORM',
        payload: preferencesData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.originalPreferencesForm).toEqual(preferencesData);
    });

    it('should handle UPDATE_ORIGINAL_PRIVACY_FORM', () => {
      const privacyData = {
        contribute_anonymous_data: true,
        share_yeast_performance: false,
        share_recipe_metrics: true,
        public_recipes_default: false,
      };

      const action: UserSettingsAction = {
        type: 'UPDATE_ORIGINAL_PRIVACY_FORM',
        payload: privacyData,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.originalPrivacyForm).toEqual(privacyData);
    });
  });

  describe('Reset Actions', () => {
    it('should handle RESET_PASSWORD_FORM', () => {
      const stateWithPassword = {
        ...initialState,
        passwordForm: {
          current_password: 'OldPass123!',
          new_password: 'NewPass123!',
          confirm_password: 'NewPass123!',
        },
      };

      const action: UserSettingsAction = {
        type: 'RESET_PASSWORD_FORM',
      };

      const newState = userSettingsReducer(stateWithPassword, action);

      expect(newState.passwordForm).toEqual({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    });

    it('should handle RESET_DELETE_FORM', () => {
      const stateWithDelete = {
        ...initialState,
        deleteForm: {
          password: 'TestPass123!',
          confirmation: 'DELETE',
          preserve_public_recipes: false,
        },
      };

      const action: UserSettingsAction = {
        type: 'RESET_DELETE_FORM',
      };

      const newState = userSettingsReducer(stateWithDelete, action);

      expect(newState.deleteForm).toEqual({
        password: '',
        confirmation: '',
        preserve_public_recipes: true,
      });
    });
  });

  describe('Error and Message Handling Actions', () => {
    it('should handle SET_ERROR', () => {
      const errorMessage = 'Failed to save settings';

      const action: UserSettingsAction = {
        type: 'SET_ERROR',
        payload: errorMessage,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.error).toBe(errorMessage);
    });

    it('should handle CLEAR_ERROR', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error message',
      };

      const action: UserSettingsAction = {
        type: 'CLEAR_ERROR',
      };

      const newState = userSettingsReducer(stateWithError, action);

      expect(newState.error).toBe('');
    });

    it('should handle SET_SUCCESS_MESSAGE', () => {
      const successMessage = 'Settings saved successfully';

      const action: UserSettingsAction = {
        type: 'SET_SUCCESS_MESSAGE',
        payload: successMessage,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.successMessage).toBe(successMessage);
    });

    it('should handle CLEAR_SUCCESS_MESSAGE', () => {
      const stateWithSuccess = {
        ...initialState,
        successMessage: 'Previous success message',
      };

      const action: UserSettingsAction = {
        type: 'CLEAR_SUCCESS_MESSAGE',
      };

      const newState = userSettingsReducer(stateWithSuccess, action);

      expect(newState.successMessage).toBe('');
    });

    it('should handle SET_UNSAVED_CHANGES', () => {
      const action: UserSettingsAction = {
        type: 'SET_UNSAVED_CHANGES',
        payload: true,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.hasUnsavedChanges).toBe(true);
    });

    it('should handle CLEAR_MESSAGES', () => {
      const stateWithMessages = {
        ...initialState,
        error: 'Error message',
        successMessage: 'Success message',
      };

      const action: UserSettingsAction = {
        type: 'CLEAR_MESSAGES',
      };

      const newState = userSettingsReducer(stateWithMessages, action);

      expect(newState.error).toBe('');
      expect(newState.successMessage).toBe('');
    });
  });


  describe('Immutability', () => {
    it('should not mutate the original state', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PROFILE_FIELD',
        payload: {
          field: 'username',
          value: 'newusername',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.profileForm).not.toBe(initialState.profileForm);
      expect(initialState.profileForm.username).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = userSettingsReducer(initialState, unknownAction);

      expect(newState).toBe(initialState); // Should return same reference for unknown actions
    });
  });
});