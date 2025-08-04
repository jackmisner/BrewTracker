import {
  ingredientManagerReducer,
  createInitialIngredientManagerState,
  type IngredientManagerAction,
  type IngredientManagerState,
  type IngredientFormData,
  type IngredientWithSearch,
} from '../../src/reducers/ingredientManagerReducer';
import type { Ingredient } from '../../src/types';

describe('ingredientManagerReducer', () => {
  let initialState: IngredientManagerState;

  beforeEach(() => {
    initialState = createInitialIngredientManagerState();
  });

  describe('Initial State', () => {
    it('should create correct initial state', () => {
      expect(initialState).toEqual({
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
    });
  });

  describe('Data Management Actions', () => {
    const mockIngredients: Ingredient[] = [
      {
        _id: '1',
        name: 'Pale Malt',
        type: 'grain',
        grain_type: 'base',
        potential: 1.036,
        color: 2,
      },
      {
        _id: '2',
        name: 'Cascade',
        type: 'hop',
        alpha_acid: 5.5,
      },
    ];

    const mockGroupedIngredients = {
      grain: [mockIngredients[0]],
      hop: [mockIngredients[1]],
      yeast: [],
      other: [],
    };

    it('should handle SET_EXISTING_INGREDIENTS', () => {
      const action: IngredientManagerAction = {
        type: 'SET_EXISTING_INGREDIENTS',
        payload: mockIngredients,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.existingIngredients).toEqual(mockIngredients);
    });

    it('should handle SET_GROUPED_INGREDIENTS', () => {
      const action: IngredientManagerAction = {
        type: 'SET_GROUPED_INGREDIENTS',
        payload: mockGroupedIngredients,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.groupedIngredients).toEqual(mockGroupedIngredients);
    });

    it('should handle SET_FILTERED_RESULTS', () => {
      const action: IngredientManagerAction = {
        type: 'SET_FILTERED_RESULTS',
        payload: mockGroupedIngredients,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.filteredResults).toEqual(mockGroupedIngredients);
    });

    it('should handle SUBMIT_SUCCESS', () => {
      const action: IngredientManagerAction = {
        type: 'SUBMIT_SUCCESS',
        payload: {
          message: 'Ingredient added successfully!',
          ingredients: mockIngredients,
          grouped: mockGroupedIngredients,
        },
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.existingIngredients).toEqual(mockIngredients);
      expect(newState.groupedIngredients).toEqual(mockGroupedIngredients);
      expect(newState.loading).toBe(false);
      expect(newState.success).toBe('Ingredient added successfully!');
      expect(newState.formData.name).toBe(''); // Should reset form
    });
  });

  describe('Loading State Actions', () => {
    it('should handle SET_LOADING', () => {
      const action: IngredientManagerAction = {
        type: 'SET_LOADING',
        payload: true,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.loading).toBe(true);
    });

    it('should handle SUBMIT_START', () => {
      const action: IngredientManagerAction = {
        type: 'SUBMIT_START',
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe('');
      expect(newState.success).toBe('');
    });
  });

  describe('UI State Actions', () => {
    it('should handle SET_SEARCH_QUERY', () => {
      const action: IngredientManagerAction = {
        type: 'SET_SEARCH_QUERY',
        payload: 'cascade',
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.searchQuery).toBe('cascade');
    });

    it('should handle TOGGLE_SECTION', () => {
      const action: IngredientManagerAction = {
        type: 'TOGGLE_SECTION',
        payload: 'grain',
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.expandedSections.grain).toBe(true); // Was false initially
    });

    it('should handle SET_EXPANDED_SECTIONS', () => {
      const newSections = {
        grain: true,
        hop: true,
        yeast: false,
        other: false,
      };

      const action: IngredientManagerAction = {
        type: 'SET_EXPANDED_SECTIONS',
        payload: newSections,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.expandedSections).toEqual(newSections);
    });
  });

  describe('Form Management Actions', () => {
    it('should handle UPDATE_FORM_FIELD', () => {
      const action: IngredientManagerAction = {
        type: 'UPDATE_FORM_FIELD',
        payload: {
          field: 'name',
          value: 'New Ingredient Name',
        },
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.formData.name).toBe('New Ingredient Name');
    });

    it('should handle multiple form field updates', () => {
      let state = initialState;

      const actions: IngredientManagerAction[] = [
        {
          type: 'UPDATE_FORM_FIELD',
          payload: { field: 'name', value: 'Pilsner Malt' },
        },
        {
          type: 'UPDATE_FORM_FIELD',
          payload: { field: 'type', value: 'grain' },
        },
        {
          type: 'UPDATE_FORM_FIELD',
          payload: { field: 'potential', value: '1.037' },
        },
      ];

      actions.forEach(action => {
        state = ingredientManagerReducer(state, action);
      });

      expect(state.formData.name).toBe('Pilsner Malt');
      expect(state.formData.type).toBe('grain');
      expect(state.formData.potential).toBe('1.037');
    });

    it('should handle RESET_FORM', () => {
      const modifiedState = {
        ...initialState,
        formData: {
          name: 'Modified Name',
          type: 'hop' as const,
          description: 'Modified description',
          grain_type: 'specialty',
          potential: '1.040',
          color: '10',
          alpha_acid: '5.5',
          yeast_type: 'ale',
          attenuation: '75',
          manufacturer: 'Test',
          code: 'T123',
          alcohol_tolerance: '12',
          min_temperature: '18',
          max_temperature: '22',
        },
        error: 'Some error',
        success: 'Some success',
      };

      const action: IngredientManagerAction = {
        type: 'RESET_FORM',
      };

      const newState = ingredientManagerReducer(modifiedState, action);

      expect(newState.formData).toEqual(initialState.formData);
      expect(newState.error).toBe('');
      expect(newState.success).toBe('');
    });
  });

  describe('Message Actions', () => {
    it('should handle SET_ERROR', () => {
      const errorMessage = 'Failed to save ingredient';

      const action: IngredientManagerAction = {
        type: 'SET_ERROR',
        payload: errorMessage,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.error).toBe(errorMessage);
    });

    it('should handle CLEAR_ERROR', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error message',
      };

      const action: IngredientManagerAction = {
        type: 'CLEAR_ERROR',
      };

      const newState = ingredientManagerReducer(stateWithError, action);

      expect(newState.error).toBe('');
    });

    it('should handle SET_SUCCESS', () => {
      const successMessage = 'Operation completed successfully!';

      const action: IngredientManagerAction = {
        type: 'SET_SUCCESS',
        payload: successMessage,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.success).toBe(successMessage);
    });

    it('should handle CLEAR_SUCCESS', () => {
      const stateWithSuccess = {
        ...initialState,
        success: 'Success message',
      };

      const action: IngredientManagerAction = {
        type: 'CLEAR_SUCCESS',
      };

      const newState = ingredientManagerReducer(stateWithSuccess, action);

      expect(newState.success).toBe('');
    });

    it('should handle CLEAR_MESSAGES', () => {
      const stateWithMessages = {
        ...initialState,
        error: 'Error message',
        success: 'Success message',
      };

      const action: IngredientManagerAction = {
        type: 'CLEAR_MESSAGES',
      };

      const newState = ingredientManagerReducer(stateWithMessages, action);

      expect(newState.error).toBe('');
      expect(newState.success).toBe('');
    });
  });

  describe('Form Type Update Actions', () => {
    it('should handle UPDATE_FORM_TYPE', () => {
      const action: IngredientManagerAction = {
        type: 'UPDATE_FORM_TYPE',
        payload: 'hop',
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.formData.type).toBe('hop');
      // Should clear type-specific fields
      expect(newState.formData.grain_type).toBe('');
      expect(newState.formData.potential).toBe('');
      expect(newState.formData.color).toBe('');
      expect(newState.formData.alpha_acid).toBe('');
    });

    it('should handle SET_FORM_DATA', () => {
      const formData: IngredientFormData = {
        name: 'Test Ingredient',
        type: 'yeast',
        description: 'Test description',
        grain_type: '',
        potential: '',
        color: '',
        alpha_acid: '',
        yeast_type: 'ale',
        attenuation: '75',
        manufacturer: 'Test Manufacturer',
        code: 'T123',
        alcohol_tolerance: '12',
        min_temperature: '18',
        max_temperature: '22',
      };

      const action: IngredientManagerAction = {
        type: 'SET_FORM_DATA',
        payload: formData,
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.formData).toEqual(formData);
    });
  });

  describe('Search and Filter Actions', () => {
    it('should handle SEARCH_START', () => {
      const state = ingredientManagerReducer(initialState, {
        type: 'SEARCH_START',
      });

      // SEARCH_START doesn't modify state in current implementation
      expect(state).toEqual(initialState);
    });

    it('should handle SEARCH_COMPLETE', () => {
      const mockResults = {
        grain: [{
          _id: '1',
          name: 'Pale Malt',
          type: 'grain' as const,
          searchScore: 1.0,
        }],
        hop: [],
        yeast: [],
        other: [],
      };

      const action: IngredientManagerAction = {
        type: 'SEARCH_COMPLETE',
        payload: {
          results: mockResults,
          expandSections: true,
        },
      };

      const state = ingredientManagerReducer(initialState, action);

      expect(state.filteredResults).toEqual(mockResults);
      expect(state.expandedSections).toEqual({
        grain: true,
        hop: true,
        yeast: true,
        other: true,
      });
    });

    it('should handle CLEAR_SEARCH', () => {
      const stateWithSearch = {
        ...initialState,
        searchQuery: 'test search',
        filteredResults: {
          grain: [{ _id: '1', name: 'Test', type: 'grain' as const }],
          hop: [],
          yeast: [],
          other: [],
        },
        expandedSections: {
          grain: true,
          hop: true,
          yeast: true,
          other: true,
        },
      };

      const state = ingredientManagerReducer(stateWithSearch, {
        type: 'CLEAR_SEARCH',
      });

      expect(state.searchQuery).toBe('');
      expect(state.filteredResults).toEqual(state.groupedIngredients);
      expect(state.expandedSections).toEqual(state.defaultExpandedState);
    });
  });

  describe('Submit Actions', () => {
    it('should handle SUBMIT_ERROR', () => {
      const stateWithLoading = {
        ...initialState,
        loading: true,
      };

      const action: IngredientManagerAction = {
        type: 'SUBMIT_ERROR',
        payload: 'Failed to submit',
      };

      const newState = ingredientManagerReducer(stateWithLoading, action);

      expect(newState.loading).toBe(false);
      expect(newState.error).toBe('Failed to submit');
    });
  });

  describe('Section Management', () => {
    it('should toggle sections correctly', () => {
      expect(initialState.expandedSections.grain).toBe(false);

      const state = ingredientManagerReducer(initialState, {
        type: 'TOGGLE_SECTION',
        payload: 'grain',
      });

      expect(state.expandedSections.grain).toBe(true);

      const stateToggled = ingredientManagerReducer(state, {
        type: 'TOGGLE_SECTION',
        payload: 'grain',
      });

      expect(stateToggled.expandedSections.grain).toBe(false);
    });

    it('should handle all section types', () => {
      const sections = ['grain', 'hop', 'yeast', 'other'] as const;

      sections.forEach(section => {
        const state = ingredientManagerReducer(initialState, {
          type: 'TOGGLE_SECTION',
          payload: section,
        });

        expect(state.expandedSections[section]).toBe(true); // Should toggle from false to true
      });
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state', () => {
      const action: IngredientManagerAction = {
        type: 'UPDATE_FORM_FIELD',
        payload: { field: 'name', value: 'New Name' },
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.formData).not.toBe(initialState.formData);
      expect(initialState.formData.name).toBe('');
    });

    it('should create new objects for nested updates', () => {
      const action: IngredientManagerAction = {
        type: 'TOGGLE_SECTION',
        payload: 'grain',
      };

      const newState = ingredientManagerReducer(initialState, action);

      expect(newState.expandedSections).not.toBe(initialState.expandedSections);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = ingredientManagerReducer(initialState, unknownAction);

      expect(newState).toBe(initialState);
    });
  });
});