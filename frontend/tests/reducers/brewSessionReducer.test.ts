import {
  brewSessionReducer,
  createInitialBrewSessionState,
  createInitialCreateFormData,
  createInitialEditFormData,
  type BrewSessionAction,
  type BrewSessionState,
  type CreateBrewSessionFormData,
  type EditBrewSessionFormData,
} from '../../src/reducers/brewSessionReducer';
import type { Recipe, BrewSession } from '../../src/types';

describe('brewSessionReducer', () => {
  let initialCreateState: BrewSessionState;
  let initialEditState: BrewSessionState;

  beforeEach(() => {
    initialCreateState = createInitialBrewSessionState('create');
    initialEditState = createInitialBrewSessionState('edit');
  });

  describe('Initial State Factory Functions', () => {
    it('should create correct initial create state', () => {
      expect(initialCreateState).toEqual({
        // Data state
        session: null,
        recipe: null,
        
        // Form state
        formData: {
          recipe_id: null,
          name: '',
          brew_date: expect.any(String), // Current date
          status: 'planned',
          notes: '',
        },
        
        // Loading states
        loading: true,
        submitting: false,
        creating: false,
        
        // Error state
        error: '',
        
        // Operation mode
        mode: 'create',
      });

      // Verify the date format
      const formData = initialCreateState.formData as CreateBrewSessionFormData;
      expect(formData.brew_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should create correct initial edit state', () => {
      expect(initialEditState).toEqual({
        // Data state
        session: null,
        recipe: null,
        
        // Form state
        formData: {
          name: '',
          status: 'planned',
          brew_date: '',
          mash_temp: '',
          actual_og: '',
          actual_fg: '',
          actual_abv: '',
          actual_efficiency: '',
          fermentation_start_date: '',
          fermentation_end_date: '',
          packaging_date: '',
          tasting_notes: '',
          batch_rating: '',
        },
        
        // Loading states
        loading: true,
        submitting: false,
        creating: false,
        
        // Error state
        error: '',
        
        // Operation mode
        mode: 'edit',
      });
    });

    it('should create create form data with optional recipe ID', () => {
      const formDataWithRecipe = createInitialCreateFormData('recipe-123');
      
      expect(formDataWithRecipe.recipe_id).toBe('recipe-123');
      expect(formDataWithRecipe.name).toBe('');
      expect(formDataWithRecipe.status).toBe('planned');
    });

    it('should create edit form data', () => {
      const editFormData = createInitialEditFormData();
      
      expect(editFormData.name).toBe('');
      expect(editFormData.status).toBe('planned');
      expect(editFormData.mash_temp).toBe('');
      expect(editFormData.actual_og).toBe('');
    });
  });

  describe('Mode Setting Actions', () => {
    it('should handle SET_MODE to create', () => {
      const action: BrewSessionAction = {
        type: 'SET_MODE',
        payload: 'create',
      };

      const newState = brewSessionReducer(initialEditState, action);

      expect(newState.mode).toBe('create');
      expect(newState.formData).toEqual(createInitialCreateFormData());
    });

    it('should handle SET_MODE to edit', () => {
      const action: BrewSessionAction = {
        type: 'SET_MODE',
        payload: 'edit',
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.mode).toBe('edit');
      expect(newState.formData).toEqual(createInitialEditFormData());
    });
  });

  describe('Loading State Actions', () => {
    it('should handle SET_LOADING', () => {
      const action: BrewSessionAction = {
        type: 'SET_LOADING',
        payload: true,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.loading).toBe(true);
    });

    it('should handle SET_SUBMITTING', () => {
      const action: BrewSessionAction = {
        type: 'SET_SUBMITTING',
        payload: true,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.submitting).toBe(true);
      expect(newState.creating).toBe(true); // Should sync
    });

    it('should handle SET_CREATING', () => {
      const action: BrewSessionAction = {
        type: 'SET_CREATING',
        payload: true,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.creating).toBe(true);
      expect(newState.submitting).toBe(true); // Should sync
    });

    it('should sync creating and submitting states', () => {
      let state = initialCreateState;

      // Set submitting to false
      state = brewSessionReducer(state, {
        type: 'SET_SUBMITTING',
        payload: false,
      });

      expect(state.submitting).toBe(false);
      expect(state.creating).toBe(false);

      // Set creating to true
      state = brewSessionReducer(state, {
        type: 'SET_CREATING',
        payload: true,
      });

      expect(state.creating).toBe(true);
      expect(state.submitting).toBe(true);
    });
  });

  describe('Data Actions', () => {
    it('should handle SET_SESSION', () => {
      const mockSession: BrewSession = {
        session_id: 'session-123',
        user_id: 'user-123',
        recipe_id: 'recipe-123',
        name: 'Test Brew Session',
        status: 'fermenting',
        brew_date: '2024-01-15',
        actual_og: 1.055,
        actual_fg: 1.012,
        actual_abv: 5.6,
        notes: 'Great session',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-16T10:00:00Z',
      };

      const action: BrewSessionAction = {
        type: 'SET_SESSION',
        payload: mockSession,
      };

      const newState = brewSessionReducer(initialEditState, action);

      expect(newState.session).toEqual(mockSession);
    });

    it('should handle SET_RECIPE', () => {
      const mockRecipe: Recipe = {
        id: 'recipe-123',
        recipe_id: 'recipe-123',
        user_id: 'user-123',
        username: 'testuser',
        name: 'Test IPA',
        style: 'American IPA',
        batch_size: 5,
        batch_size_unit: 'gal',
        efficiency: 75,
        boil_time: 60,
        ingredients: [],
        is_public: false,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const action: BrewSessionAction = {
        type: 'SET_RECIPE',
        payload: mockRecipe,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.recipe).toEqual(mockRecipe);
    });
  });

  describe('Form Actions', () => {
    it('should handle SET_FORM_DATA for create form', () => {
      const createFormData: CreateBrewSessionFormData = {
        recipe_id: 'recipe-456',
        name: 'New Brew Session',
        brew_date: '2024-02-01',
        status: 'in-progress',
        notes: 'Starting brew day',
      };

      const action: BrewSessionAction = {
        type: 'SET_FORM_DATA',
        payload: createFormData,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.formData).toEqual(createFormData);
    });

    it('should handle SET_FORM_DATA for edit form', () => {
      const editFormData: EditBrewSessionFormData = {
        name: 'Updated Session',
        status: 'fermenting',
        brew_date: '2024-01-15',
        mash_temp: '152',
        actual_og: '1.055',
        actual_fg: '1.012',
        actual_abv: '5.6',
        actual_efficiency: '78',
        fermentation_start_date: '2024-01-16',
        fermentation_end_date: '2024-01-30',
        packaging_date: '2024-02-01',
        tasting_notes: 'Excellent hop character',
        batch_rating: '9',
      };

      const action: BrewSessionAction = {
        type: 'SET_FORM_DATA',
        payload: editFormData,
      };

      const newState = brewSessionReducer(initialEditState, action);

      expect(newState.formData).toEqual(editFormData);
    });

    it('should handle UPDATE_FORM_FIELD', () => {
      const action: BrewSessionAction = {
        type: 'UPDATE_FORM_FIELD',
        payload: {
          field: 'name',
          value: 'Updated Brew Session Name',
        },
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect((newState.formData as CreateBrewSessionFormData).name).toBe('Updated Brew Session Name');
    });

    it('should handle multiple form field updates', () => {
      let state = initialEditState;

      const updates = [
        { field: 'actual_og', value: '1.055' },
        { field: 'actual_fg', value: '1.012' },
        { field: 'batch_rating', value: '8' },
      ];

      updates.forEach(update => {
        state = brewSessionReducer(state, {
          type: 'UPDATE_FORM_FIELD',
          payload: update,
        });
      });

      const formData = state.formData as EditBrewSessionFormData;
      expect(formData.actual_og).toBe('1.055');
      expect(formData.actual_fg).toBe('1.012');
      expect(formData.batch_rating).toBe('8');
    });

    it('should handle RESET_FORM for create mode', () => {
      const modifiedCreateState = {
        ...initialCreateState,
        formData: {
          recipe_id: 'recipe-123',
          name: 'Modified Name',
          brew_date: '2024-02-01',
          status: 'in-progress' as const,
          notes: 'Modified notes',
        },
      };

      const action: BrewSessionAction = {
        type: 'RESET_FORM',
      };

      const newState = brewSessionReducer(modifiedCreateState, action);

      expect(newState.formData).toEqual(createInitialCreateFormData());
    });

    it('should handle RESET_FORM for edit mode', () => {
      const modifiedEditState = {
        ...initialEditState,
        formData: {
          name: 'Modified Name',
          status: 'fermenting' as const,
          brew_date: '2024-01-15',
          mash_temp: '152',
          actual_og: '1.055',
          actual_fg: '1.012',
          actual_abv: '5.6',
          actual_efficiency: '78',
          fermentation_start_date: '2024-01-16',
          fermentation_end_date: '',
          packaging_date: '',
          tasting_notes: 'Great beer',
          batch_rating: '9',
        },
      };

      const action: BrewSessionAction = {
        type: 'RESET_FORM',
      };

      const newState = brewSessionReducer(modifiedEditState, action);

      expect(newState.formData).toEqual(createInitialEditFormData());
    });
  });

  describe('Error Actions', () => {
    it('should handle SET_ERROR', () => {
      const errorMessage = 'Failed to save brew session';

      const action: BrewSessionAction = {
        type: 'SET_ERROR',
        payload: errorMessage,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.error).toBe(errorMessage);
    });

    it('should handle CLEAR_ERROR', () => {
      const stateWithError = {
        ...initialCreateState,
        error: 'Previous error',
      };

      const action: BrewSessionAction = {
        type: 'CLEAR_ERROR',
      };

      const newState = brewSessionReducer(stateWithError, action);

      expect(newState.error).toBe('');
    });
  });

  describe('Combined Actions', () => {
    it('should handle FETCH_START', () => {
      const stateWithError = {
        ...initialCreateState,
        error: 'Previous error',
      };

      const action: BrewSessionAction = {
        type: 'FETCH_START',
      };

      const newState = brewSessionReducer(stateWithError, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe('');
    });

    it('should handle FETCH_SUCCESS with session', () => {
      const mockSession: BrewSession = {
        session_id: 'session-123',
        user_id: 'user-123',
        recipe_id: 'recipe-123',
        name: 'Test Session',
        status: 'completed',
        brew_date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const action: BrewSessionAction = {
        type: 'FETCH_SUCCESS',
        payload: {
          session: mockSession,
        },
      };

      const newState = brewSessionReducer(initialEditState, action);

      expect(newState.loading).toBe(false);
      expect(newState.session).toEqual(mockSession);
    });

    it('should handle FETCH_SUCCESS with recipe', () => {
      const mockRecipe: Recipe = {
        id: 'recipe-123',
        recipe_id: 'recipe-123',
        user_id: 'user-123',
        username: 'testuser',
        name: 'Test Recipe',
        style: 'IPA',
        batch_size: 5,
        batch_size_unit: 'gal',
        efficiency: 75,
        boil_time: 60,
        ingredients: [],
        is_public: false,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const action: BrewSessionAction = {
        type: 'FETCH_SUCCESS',
        payload: {
          recipe: mockRecipe,
        },
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.loading).toBe(false);
      expect(newState.recipe).toEqual(mockRecipe);
    });

    it('should handle FETCH_SUCCESS with both session and recipe', () => {
      const mockSession: BrewSession = {
        session_id: 'session-123',
        user_id: 'user-123',
        recipe_id: 'recipe-123',
        name: 'Test Session',
        status: 'fermenting',
        brew_date: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const mockRecipe: Recipe = {
        id: 'recipe-123',
        recipe_id: 'recipe-123',
        user_id: 'user-123',
        username: 'testuser',
        name: 'Test Recipe',
        style: 'IPA',
        batch_size: 5,
        batch_size_unit: 'gal',
        efficiency: 75,
        boil_time: 60,
        ingredients: [],
        is_public: false,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const action: BrewSessionAction = {
        type: 'FETCH_SUCCESS',
        payload: {
          session: mockSession,
          recipe: mockRecipe,
        },
      };

      const newState = brewSessionReducer(initialEditState, action);

      expect(newState.loading).toBe(false);
      expect(newState.session).toEqual(mockSession);
      expect(newState.recipe).toEqual(mockRecipe);
    });

    it('should handle FETCH_ERROR', () => {
      const errorMessage = 'Failed to fetch brew session';

      const action: BrewSessionAction = {
        type: 'FETCH_ERROR',
        payload: errorMessage,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
    });

    it('should handle SUBMIT_START', () => {
      const stateWithError = {
        ...initialCreateState,
        error: 'Previous error',
      };

      const action: BrewSessionAction = {
        type: 'SUBMIT_START',
      };

      const newState = brewSessionReducer(stateWithError, action);

      expect(newState.submitting).toBe(true);
      expect(newState.creating).toBe(true);
      expect(newState.error).toBe('');
    });

    it('should handle SUBMIT_SUCCESS', () => {
      const stateWithSubmitting = {
        ...initialCreateState,
        submitting: true,
        creating: true,
      };

      const action: BrewSessionAction = {
        type: 'SUBMIT_SUCCESS',
      };

      const newState = brewSessionReducer(stateWithSubmitting, action);

      expect(newState.submitting).toBe(false);
      expect(newState.creating).toBe(false);
    });

    it('should handle SUBMIT_ERROR', () => {
      const stateWithSubmitting = {
        ...initialCreateState,
        submitting: true,
        creating: true,
      };

      const errorMessage = 'Failed to create brew session';

      const action: BrewSessionAction = {
        type: 'SUBMIT_ERROR',
        payload: errorMessage,
      };

      const newState = brewSessionReducer(stateWithSubmitting, action);

      expect(newState.submitting).toBe(false);
      expect(newState.creating).toBe(false);
      expect(newState.error).toBe(errorMessage);
    });
  });

  describe('Reset Actions', () => {
    it('should handle RESET_STATE', () => {
      const modifiedState = {
        session: { session_id: 'session-123' } as BrewSession,
        recipe: { id: 'recipe-123' } as Recipe,
        formData: {
          recipe_id: 'recipe-123',
          name: 'Modified Name',
          brew_date: '2024-02-01',
          status: 'in-progress' as const,
          notes: 'Modified notes',
        },
        loading: false,
        submitting: true,
        creating: true,
        error: 'Some error',
        mode: 'create' as const,
      };

      const action: BrewSessionAction = {
        type: 'RESET_STATE',
      };

      const newState = brewSessionReducer(modifiedState, action);

      expect(newState).toEqual(createInitialBrewSessionState('create'));
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete create workflow', () => {
      let state = initialCreateState;

      // 1. Load recipe data
      const mockRecipe: Recipe = {
        id: 'recipe-123',
        recipe_id: 'recipe-123',
        user_id: 'user-123',
        username: 'testuser',
        name: 'Test IPA Recipe',
        style: 'American IPA',
        batch_size: 5,
        batch_size_unit: 'gal',
        efficiency: 75,
        boil_time: 60,
        ingredients: [],
        is_public: false,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      state = brewSessionReducer(state, {
        type: 'FETCH_SUCCESS',
        payload: { recipe: mockRecipe },
      });

      expect(state.recipe).toEqual(mockRecipe);
      expect(state.loading).toBe(false);

      // 2. Update form data
      state = brewSessionReducer(state, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'name', value: 'Test IPA Brew Session - 2024-01-15' },
      });

      state = brewSessionReducer(state, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'status', value: 'planned' },
      });

      const formData = state.formData as CreateBrewSessionFormData;
      expect(formData.name).toBe('Test IPA Brew Session - 2024-01-15');
      expect(formData.status).toBe('planned');

      // 3. Submit
      state = brewSessionReducer(state, {
        type: 'SUBMIT_START',
      });

      expect(state.submitting).toBe(true);
      expect(state.creating).toBe(true);

      // 4. Success
      state = brewSessionReducer(state, {
        type: 'SUBMIT_SUCCESS',
      });

      expect(state.submitting).toBe(false);
      expect(state.creating).toBe(false);
    });

    it('should handle complete edit workflow', () => {
      let state = initialEditState;

      // 1. Load session data
      const mockSession: BrewSession = {
        session_id: 'session-123',
        user_id: 'user-123',
        recipe_id: 'recipe-123',
        name: 'Existing Brew Session',
        status: 'fermenting',
        brew_date: '2024-01-15',
        actual_og: 1.055,
        actual_fg: 1.012,
        mash_temp: 152,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-16T10:00:00Z',
      };

      state = brewSessionReducer(state, {
        type: 'FETCH_SUCCESS',
        payload: { session: mockSession },
      });

      expect(state.session).toEqual(mockSession);
      expect(state.loading).toBe(false);

      // 2. Populate form with session data
      const editFormData: EditBrewSessionFormData = {
        name: mockSession.name,
        status: mockSession.status,
        brew_date: '2024-01-15',
        mash_temp: '152',
        actual_og: '1.055',
        actual_fg: '1.012',
        actual_abv: '',
        actual_efficiency: '',
        fermentation_start_date: '',
        fermentation_end_date: '',
        packaging_date: '',
        tasting_notes: '',
        batch_rating: '',
      };

      state = brewSessionReducer(state, {
        type: 'SET_FORM_DATA',
        payload: editFormData,
      });

      expect(state.formData).toEqual(editFormData);

      // 3. Update form fields
      state = brewSessionReducer(state, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'status', value: 'completed' },
      });

      state = brewSessionReducer(state, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'batch_rating', value: '9' },
      });

      const updatedFormData = state.formData as EditBrewSessionFormData;
      expect(updatedFormData.status).toBe('completed');
      expect(updatedFormData.batch_rating).toBe('9');

      // 4. Submit update
      state = brewSessionReducer(state, {
        type: 'SUBMIT_START',
      });

      expect(state.submitting).toBe(true);

      // 5. Update session with new data
      const updatedSession = {
        ...mockSession,
        status: 'completed' as const,
        batch_rating: 9,
      };

      state = brewSessionReducer(state, {
        type: 'SET_SESSION',
        payload: updatedSession,
      });

      state = brewSessionReducer(state, {
        type: 'SUBMIT_SUCCESS',
      });

      expect(state.session).toEqual(updatedSession);
      expect(state.submitting).toBe(false);
    });

    it('should handle error scenarios', () => {
      let state = initialCreateState;

      // 1. Fetch error
      state = brewSessionReducer(state, {
        type: 'FETCH_ERROR',
        payload: 'Recipe not found',
      });

      expect(state.loading).toBe(false);
      expect(state.error).toBe('Recipe not found');

      // 2. Clear error and retry
      state = brewSessionReducer(state, {
        type: 'CLEAR_ERROR',
      });

      expect(state.error).toBe('');

      // 3. Submit error
      state = brewSessionReducer(state, {
        type: 'SUBMIT_START',
      });

      state = brewSessionReducer(state, {
        type: 'SUBMIT_ERROR',
        payload: 'Validation failed',
      });

      expect(state.submitting).toBe(false);
      expect(state.creating).toBe(false);
      expect(state.error).toBe('Validation failed');
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state', () => {
      const action: BrewSessionAction = {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'name', value: 'New Name' },
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState).not.toBe(initialCreateState);
      expect(newState.formData).not.toBe(initialCreateState.formData);
      expect((initialCreateState.formData as CreateBrewSessionFormData).name).toBe('');
    });

    it('should create new objects for nested updates', () => {
      const action: BrewSessionAction = {
        type: 'SET_LOADING',
        payload: false,
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState).not.toBe(initialCreateState);
      expect(newState.formData).toBe(initialCreateState.formData); // Unchanged reference
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = brewSessionReducer(initialCreateState, unknownAction);

      expect(newState).toBe(initialCreateState);
    });

    it('should handle null payloads gracefully', () => {
      const actions: BrewSessionAction[] = [
        { type: 'SET_SESSION', payload: null },
        { type: 'SET_RECIPE', payload: null },
      ];

      actions.forEach(action => {
        const newState = brewSessionReducer(initialCreateState, action);
        expect(newState).toBeDefined();
      });
    });

    it('should handle empty FETCH_SUCCESS payload', () => {
      const action: BrewSessionAction = {
        type: 'FETCH_SUCCESS',
        payload: {},
      };

      const newState = brewSessionReducer(initialCreateState, action);

      expect(newState.loading).toBe(false);
      expect(newState.session).toBe(initialCreateState.session);
      expect(newState.recipe).toBe(initialCreateState.recipe);
    });

    it('should handle form field updates for all form types', () => {
      const createFields = ['recipe_id', 'name', 'brew_date', 'status', 'notes'];
      const editFields = ['name', 'status', 'brew_date', 'mash_temp', 'actual_og', 'actual_fg', 'tasting_notes'];

      createFields.forEach(field => {
        const action: BrewSessionAction = {
          type: 'UPDATE_FORM_FIELD',
          payload: { field, value: 'test-value' },
        };

        const newState = brewSessionReducer(initialCreateState, action);
        expect((newState.formData as any)[field]).toBe('test-value');
      });

      editFields.forEach(field => {
        const action: BrewSessionAction = {
          type: 'UPDATE_FORM_FIELD',
          payload: { field, value: 'test-value' },
        };

        const newState = brewSessionReducer(initialEditState, action);
        expect((newState.formData as any)[field]).toBe('test-value');
      });
    });
  });

  describe('Mode-Specific Behavior', () => {
    it('should maintain mode-specific form structure after updates', () => {
      // Create mode should maintain CreateBrewSessionFormData structure
      const createState = brewSessionReducer(initialCreateState, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'notes', value: 'Test notes' },
      });

      const createFormData = createState.formData as CreateBrewSessionFormData;
      expect(createFormData.notes).toBe('Test notes');
      expect(createFormData.recipe_id).toBeDefined();
      expect((createFormData as any).mash_temp).toBeUndefined(); // Edit-only field

      // Edit mode should maintain EditBrewSessionFormData structure
      const editState = brewSessionReducer(initialEditState, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'mash_temp', value: '154' },
      });

      const editFormData = editState.formData as EditBrewSessionFormData;
      expect(editFormData.mash_temp).toBe('154');
      expect(editFormData.tasting_notes).toBeDefined();
      expect((editFormData as any).recipe_id).toBeUndefined(); // Create-only field
    });

    it('should reset to appropriate form type based on mode', () => {
      // Modify create state and reset
      let createState = brewSessionReducer(initialCreateState, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'name', value: 'Modified Name' },
      });

      createState = brewSessionReducer(createState, {
        type: 'RESET_FORM',
      });

      expect(createState.formData).toEqual(createInitialCreateFormData());

      // Modify edit state and reset
      let editState = brewSessionReducer(initialEditState, {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'mash_temp', value: '155' },
      });

      editState = brewSessionReducer(editState, {
        type: 'RESET_FORM',
      });

      expect(editState.formData).toEqual(createInitialEditFormData());
    });
  });
});