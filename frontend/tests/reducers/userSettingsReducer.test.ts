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
        // UI state
        activeTab: 'profile',
        loading: false,
        saving: false,
        error: '',

        // User data
        userSettings: null,

        // Form states
        profileForm: {
          first_name: '',
          last_name: '',
          email: '',
        },
        passwordForm: {
          current_password: '',
          new_password: '',
          confirm_password: '',
        },
        deleteForm: {
          password: '',
          confirmation: '',
        },
        preferencesForm: {
          unit_system: 'imperial',
          default_batch_size: 5.0,
          default_batch_size_unit: 'gal',
          default_efficiency: 75,
          email_notifications: true,
          public_recipes: false,
        },
        privacyForm: {
          data_retention_days: 365,
          analytics_enabled: true,
          marketing_emails: false,
        },

        // Form validation
        formErrors: {
          profile: {},
          password: {},
          delete: {},
          preferences: {},
          privacy: {},
        },
        touchedFields: {
          profile: {},
          password: {},
          delete: {},
          preferences: {},
          privacy: {},
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
      const validTabs: TabId[] = ['profile', 'password', 'preferences', 'privacy', 'delete'];

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

  describe('Loading State Actions', () => {
    it('should handle SET_LOADING', () => {
      const action: UserSettingsAction = {
        type: 'SET_LOADING',
        payload: true,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe(''); // Should clear error when loading starts
    });

    it('should handle SET_SAVING', () => {
      const action: UserSettingsAction = {
        type: 'SET_SAVING',
        payload: true,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.saving).toBe(true);
      expect(newState.error).toBe(''); // Should clear error when saving starts
    });

    it('should clear error when starting loading or saving', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error message',
      };

      const loadingAction: UserSettingsAction = {
        type: 'SET_LOADING',
        payload: true,
      };

      const savingAction: UserSettingsAction = {
        type: 'SET_SAVING',
        payload: true,
      };

      expect(userSettingsReducer(stateWithError, loadingAction).error).toBe('');
      expect(userSettingsReducer(stateWithError, savingAction).error).toBe('');
    });
  });

  describe('User Data Actions', () => {
    it('should handle SET_USER_SETTINGS', () => {
      const mockUserSettings = {
        id: 'user123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        unit_system: 'metric' as const,
        default_batch_size: 20.0,
        default_batch_size_unit: 'l' as const,
        default_efficiency: 80,
        email_notifications: false,
        public_recipes: true,
        data_retention_days: 730,
        analytics_enabled: false,
        marketing_emails: true,
      };

      const action: UserSettingsAction = {
        type: 'SET_USER_SETTINGS',
        payload: mockUserSettings,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.userSettings).toEqual(mockUserSettings);
      // Should populate forms with user data
      expect(newState.profileForm).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });
      expect(newState.preferencesForm).toEqual({
        unit_system: 'metric',
        default_batch_size: 20.0,
        default_batch_size_unit: 'l',
        default_efficiency: 80,
        email_notifications: false,
        public_recipes: true,
      });
      expect(newState.privacyForm).toEqual({
        data_retention_days: 730,
        analytics_enabled: false,
        marketing_emails: true,
      });
    });
  });

  describe('Form Update Actions', () => {
    it('should handle UPDATE_PROFILE_FORM', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PROFILE_FORM',
        payload: {
          field: 'first_name',
          value: 'Jane',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.profileForm.first_name).toBe('Jane');
      expect(newState.touchedFields.profile.first_name).toBe(true);
    });

    it('should handle UPDATE_PASSWORD_FORM', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PASSWORD_FORM',
        payload: {
          field: 'current_password',
          value: 'oldpass123',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.passwordForm.current_password).toBe('oldpass123');
      expect(newState.touchedFields.password.current_password).toBe(true);
    });

    it('should handle UPDATE_DELETE_FORM', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_DELETE_FORM',
        payload: {
          field: 'password',
          value: 'confirmpass123',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.deleteForm.password).toBe('confirmpass123');
      expect(newState.touchedFields.delete.password).toBe(true);
    });

    it('should handle UPDATE_PREFERENCES_FORM', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PREFERENCES_FORM',
        payload: {
          field: 'unit_system',
          value: 'metric',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.preferencesForm.unit_system).toBe('metric');
      expect(newState.touchedFields.preferences.unit_system).toBe(true);
    });

    it('should handle UPDATE_PRIVACY_FORM', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PRIVACY_FORM',
        payload: {
          field: 'analytics_enabled',
          value: false,
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.privacyForm.analytics_enabled).toBe(false);
      expect(newState.touchedFields.privacy.analytics_enabled).toBe(true);
    });
  });

  describe('Form Validation Actions', () => {
    it('should handle SET_FORM_ERRORS', () => {
      const errors = {
        first_name: 'First name is required',
        email: 'Invalid email format',
      };

      const action: UserSettingsAction = {
        type: 'SET_FORM_ERRORS',
        payload: {
          form: 'profile',
          errors,
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.formErrors.profile).toEqual(errors);
    });

    it('should handle CLEAR_FORM_ERRORS', () => {
      const stateWithErrors = {
        ...initialState,
        formErrors: {
          ...initialState.formErrors,
          profile: {
            first_name: 'Error message',
            email: 'Another error',
          },
        },
      };

      const action: UserSettingsAction = {
        type: 'CLEAR_FORM_ERRORS',
        payload: 'profile',
      };

      const newState = userSettingsReducer(stateWithErrors, action);

      expect(newState.formErrors.profile).toEqual({});
    });

    it('should handle SET_FIELD_TOUCHED', () => {
      const action: UserSettingsAction = {
        type: 'SET_FIELD_TOUCHED',
        payload: {
          form: 'password',
          field: 'new_password',
          touched: true,
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.touchedFields.password.new_password).toBe(true);
    });
  });

  describe('Error Handling Actions', () => {
    it('should handle SET_ERROR', () => {
      const errorMessage = 'Failed to save settings';

      const action: UserSettingsAction = {
        type: 'SET_ERROR',
        payload: errorMessage,
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState.error).toBe(errorMessage);
      expect(newState.loading).toBe(false);
      expect(newState.saving).toBe(false);
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
  });

  describe('Form Reset Actions', () => {
    it('should handle RESET_FORM for profile', () => {
      const modifiedState = {
        ...initialState,
        profileForm: {
          first_name: 'Modified',
          last_name: 'User',
          email: 'modified@example.com',
        },
        touchedFields: {
          ...initialState.touchedFields,
          profile: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        formErrors: {
          ...initialState.formErrors,
          profile: {
            email: 'Invalid email',
          },
        },
      };

      const action: UserSettingsAction = {
        type: 'RESET_FORM',
        payload: 'profile',
      };

      const newState = userSettingsReducer(modifiedState, action);

      expect(newState.profileForm).toEqual(initialState.profileForm);
      expect(newState.touchedFields.profile).toEqual({});
      expect(newState.formErrors.profile).toEqual({});
    });

    it('should handle RESET_ALL_FORMS', () => {
      const modifiedState = {
        ...initialState,
        profileForm: { first_name: 'Modified', last_name: 'User', email: 'test@example.com' },
        passwordForm: { current_password: 'old', new_password: 'new', confirm_password: 'new' },
        touchedFields: {
          profile: { first_name: true },
          password: { current_password: true },
          delete: {},
          preferences: {},
          privacy: {},
        },
        formErrors: {
          profile: { email: 'Error' },
          password: { current_password: 'Error' },
          delete: {},
          preferences: {},
          privacy: {},
        },
      };

      const action: UserSettingsAction = {
        type: 'RESET_ALL_FORMS',
      };

      const newState = userSettingsReducer(modifiedState, action);

      expect(newState.profileForm).toEqual(initialState.profileForm);
      expect(newState.passwordForm).toEqual(initialState.passwordForm);
      expect(newState.deleteForm).toEqual(initialState.deleteForm);
      expect(newState.preferencesForm).toEqual(initialState.preferencesForm);
      expect(newState.privacyForm).toEqual(initialState.privacyForm);
      expect(newState.touchedFields).toEqual(initialState.touchedFields);
      expect(newState.formErrors).toEqual(initialState.formErrors);
    });
  });

  describe('Success Actions', () => {
    it('should handle PROFILE_UPDATE_SUCCESS', () => {
      const stateWithChanges = {
        ...initialState,
        saving: true,
        error: 'Previous error',
      };

      const action: UserSettingsAction = {
        type: 'PROFILE_UPDATE_SUCCESS',
      };

      const newState = userSettingsReducer(stateWithChanges, action);

      expect(newState.saving).toBe(false);
      expect(newState.error).toBe('');
    });

    it('should handle PASSWORD_UPDATE_SUCCESS', () => {
      const stateWithChanges = {
        ...initialState,
        saving: true,
        passwordForm: {
          current_password: 'old',
          new_password: 'new',
          confirm_password: 'new',
        },
      };

      const action: UserSettingsAction = {
        type: 'PASSWORD_UPDATE_SUCCESS',
      };

      const newState = userSettingsReducer(stateWithChanges, action);

      expect(newState.saving).toBe(false);
      expect(newState.error).toBe('');
      expect(newState.passwordForm).toEqual(initialState.passwordForm); // Should reset password form
    });

    it('should handle PREFERENCES_UPDATE_SUCCESS', () => {
      const stateWithChanges = {
        ...initialState,
        saving: true,
        error: 'Previous error',
      };

      const action: UserSettingsAction = {
        type: 'PREFERENCES_UPDATE_SUCCESS',
      };

      const newState = userSettingsReducer(stateWithChanges, action);

      expect(newState.saving).toBe(false);
      expect(newState.error).toBe('');
    });

    it('should handle PRIVACY_UPDATE_SUCCESS', () => {
      const stateWithChanges = {
        ...initialState,
        saving: true,
        error: 'Previous error',
      };

      const action: UserSettingsAction = {
        type: 'PRIVACY_UPDATE_SUCCESS',
      };

      const newState = userSettingsReducer(stateWithChanges, action);

      expect(newState.saving).toBe(false);
      expect(newState.error).toBe('');
    });
  });

  describe('Immutability', () => {
    it('should not mutate the original state', () => {
      const action: UserSettingsAction = {
        type: 'UPDATE_PROFILE_FORM',
        payload: {
          field: 'first_name',
          value: 'New Name',
        },
      };

      const newState = userSettingsReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.profileForm).not.toBe(initialState.profileForm);
      expect(newState.touchedFields).not.toBe(initialState.touchedFields);
      expect(initialState.profileForm.first_name).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = userSettingsReducer(initialState, unknownAction);

      expect(newState).toBe(initialState); // Should return same reference for unknown actions
    });

    it('should handle null/undefined payloads gracefully', () => {
      const actionWithNullPayload: UserSettingsAction = {
        type: 'SET_USER_SETTINGS',
        payload: null,
      };

      const newState = userSettingsReducer(initialState, actionWithNullPayload);

      expect(newState.userSettings).toBe(null);
    });
  });
});