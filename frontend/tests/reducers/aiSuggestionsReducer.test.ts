import {
  aiSuggestionsReducer,
  createInitialAISuggestionsState,
  type AISuggestionsAction,
  type AISuggestionsState,
  type Suggestion,
  type IngredientChange,
  type OptimizationResult,
} from '../../src/reducers/aiSuggestionsReducer';

describe('aiSuggestionsReducer', () => {
  let initialState: AISuggestionsState;

  beforeEach(() => {
    initialState = createInitialAISuggestionsState();
  });

  describe('Initial State', () => {
    it('should create correct initial state', () => {
      expect(initialState).toEqual({
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
    });
  });

  describe('Analysis Actions', () => {
    it('should handle START_ANALYSIS', () => {
      const stateWithData = {
        ...initialState,
        suggestions: [{ id: '1', type: 'test', title: 'Test', description: 'Test desc', confidence: 'high' as const, changes: [] }],
        optimizationResult: { performed: true, originalMetrics: {}, optimizedMetrics: {}, optimizedRecipe: {}, recipeChanges: [], iterationsCompleted: 1 },
        error: 'Previous error',
      };

      const action: AISuggestionsAction = {
        type: 'START_ANALYSIS',
      };

      const newState = aiSuggestionsReducer(stateWithData, action);

      expect(newState.analyzing).toBe(true);
      expect(newState.error).toBe(null);
      expect(newState.suggestions).toEqual([]);
      expect(newState.optimizationResult).toBe(null);
    });

    it('should handle ANALYSIS_SUCCESS with suggestions', () => {
      const mockSuggestions: Suggestion[] = [
        {
          id: 'suggestion-1',
          type: 'hop_adjustment',
          title: 'Increase hop bitterness',
          description: 'Add more hops to reach target IBU',
          confidence: 'high',
          changes: [],
          priority: 1,
          styleImpact: 'Improves bitterness balance',
          impactType: 'important',
        },
        {
          id: 'suggestion-2',
          type: 'malt_modification',
          title: 'Adjust base malt',
          description: 'Reduce base malt for lower OG',
          confidence: 'medium',
          changes: [],
          priority: 2,
          impactType: 'nice-to-have',
        },
      ];

      const action: AISuggestionsAction = {
        type: 'ANALYSIS_SUCCESS',
        payload: {
          suggestions: mockSuggestions,
        },
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.analyzing).toBe(false);
      expect(newState.hasAnalyzed).toBe(true);
      expect(newState.suggestions).toEqual(mockSuggestions);
      expect(newState.optimizationResult).toBe(null);
    });

    it('should handle ANALYSIS_SUCCESS with optimization result', () => {
      const mockOptimizationResult: OptimizationResult = {
        performed: true,
        originalMetrics: { OG: 1.050, FG: 1.010, ABV: 5.2, IBU: 40, SRM: 8 },
        optimizedMetrics: { OG: 1.055, FG: 1.012, ABV: 5.6, IBU: 45, SRM: 8 },
        optimizedRecipe: { ingredients: [] },
        recipeChanges: [
          {
            type: 'ingredient_modified',
            ingredient_name: 'Pale Malt',
            field: 'amount',
            original_value: 10,
            optimized_value: 11,
            unit: 'lb',
          },
        ],
        iterationsCompleted: 3,
      };

      const mockSuggestions: Suggestion[] = [
        {
          id: 'opt-1',
          type: 'optimization_summary',
          title: 'Recipe Optimized',
          description: 'Recipe has been optimized for style compliance',
          confidence: 'high',
          changes: [],
        },
      ];

      const action: AISuggestionsAction = {
        type: 'ANALYSIS_SUCCESS',
        payload: {
          suggestions: mockSuggestions,
          optimizationResult: mockOptimizationResult,
        },
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.analyzing).toBe(false);
      expect(newState.hasAnalyzed).toBe(true);
      expect(newState.suggestions).toEqual(mockSuggestions);
      expect(newState.optimizationResult).toEqual(mockOptimizationResult);
    });

    it('should handle ANALYSIS_ERROR', () => {
      const stateWithAnalyzing = {
        ...initialState,
        analyzing: true,
      };

      const errorMessage = 'Failed to analyze recipe';

      const action: AISuggestionsAction = {
        type: 'ANALYSIS_ERROR',
        payload: errorMessage,
      };

      const newState = aiSuggestionsReducer(stateWithAnalyzing, action);

      expect(newState.analyzing).toBe(false);
      expect(newState.error).toBe(errorMessage);
    });

    it('should handle ANALYSIS_COMPLETE', () => {
      const stateWithAnalyzing = {
        ...initialState,
        analyzing: true,
      };

      const action: AISuggestionsAction = {
        type: 'ANALYSIS_COMPLETE',
      };

      const newState = aiSuggestionsReducer(stateWithAnalyzing, action);

      expect(newState.analyzing).toBe(false);
      expect(newState.hasAnalyzed).toBe(true);
    });
  });

  describe('Suggestion Management Actions', () => {
    const mockSuggestions: Suggestion[] = [
      {
        id: 'suggestion-1',
        type: 'hop_adjustment',
        title: 'Increase hops',
        description: 'Add more hops',
        confidence: 'high',
        changes: [],
      },
      {
        id: 'suggestion-2',
        type: 'malt_adjustment',
        title: 'Reduce malt',
        description: 'Reduce base malt',
        confidence: 'medium',
        changes: [],
      },
    ];

    it('should handle SET_SUGGESTIONS', () => {
      const action: AISuggestionsAction = {
        type: 'SET_SUGGESTIONS',
        payload: mockSuggestions,
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.suggestions).toEqual(mockSuggestions);
    });

    it('should handle CLEAR_SUGGESTIONS', () => {
      const stateWithSuggestions = {
        ...initialState,
        suggestions: mockSuggestions,
      };

      const action: AISuggestionsAction = {
        type: 'CLEAR_SUGGESTIONS',
      };

      const newState = aiSuggestionsReducer(stateWithSuggestions, action);

      expect(newState.suggestions).toEqual([]);
    });

    it('should handle ADD_APPLIED_SUGGESTION', () => {
      const action: AISuggestionsAction = {
        type: 'ADD_APPLIED_SUGGESTION',
        payload: 'suggestion-1',
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.appliedSuggestions.has('suggestion-1')).toBe(true);
    });

    it('should handle ADD_APPLIED_SUGGESTION with existing suggestions', () => {
      const stateWithApplied = {
        ...initialState,
        appliedSuggestions: new Set(['suggestion-1']),
      };

      const action: AISuggestionsAction = {
        type: 'ADD_APPLIED_SUGGESTION',
        payload: 'suggestion-2',
      };

      const newState = aiSuggestionsReducer(stateWithApplied, action);

      expect(newState.appliedSuggestions.has('suggestion-1')).toBe(true);
      expect(newState.appliedSuggestions.has('suggestion-2')).toBe(true);
      expect(newState.appliedSuggestions.size).toBe(2);
    });

    it('should handle REMOVE_APPLIED_SUGGESTION', () => {
      const stateWithApplied = {
        ...initialState,
        appliedSuggestions: new Set(['suggestion-1', 'suggestion-2']),
      };

      const action: AISuggestionsAction = {
        type: 'REMOVE_APPLIED_SUGGESTION',
        payload: 'suggestion-1',
      };

      const newState = aiSuggestionsReducer(stateWithApplied, action);

      expect(newState.appliedSuggestions.has('suggestion-1')).toBe(false);
      expect(newState.appliedSuggestions.has('suggestion-2')).toBe(true);
      expect(newState.appliedSuggestions.size).toBe(1);
    });

    it('should handle REMOVE_APPLIED_SUGGESTION for non-existent suggestion', () => {
      const stateWithApplied = {
        ...initialState,
        appliedSuggestions: new Set(['suggestion-1']),
      };

      const action: AISuggestionsAction = {
        type: 'REMOVE_APPLIED_SUGGESTION',
        payload: 'non-existent',
      };

      const newState = aiSuggestionsReducer(stateWithApplied, action);

      expect(newState.appliedSuggestions.has('suggestion-1')).toBe(true);
      expect(newState.appliedSuggestions.size).toBe(1);
    });

    it('should handle RESET_APPLIED_SUGGESTIONS', () => {
      const stateWithApplied = {
        ...initialState,
        appliedSuggestions: new Set(['suggestion-1', 'suggestion-2', 'suggestion-3']),
      };

      const action: AISuggestionsAction = {
        type: 'RESET_APPLIED_SUGGESTIONS',
      };

      const newState = aiSuggestionsReducer(stateWithApplied, action);

      expect(newState.appliedSuggestions.size).toBe(0);
    });
  });

  describe('UI State Actions', () => {
    it('should handle SET_EXPANDED', () => {
      const action: AISuggestionsAction = {
        type: 'SET_EXPANDED',
        payload: false,
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.isExpanded).toBe(false);
    });

    it('should handle TOGGLE_EXPANDED', () => {
      expect(initialState.isExpanded).toBe(true);

      const action: AISuggestionsAction = {
        type: 'TOGGLE_EXPANDED',
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.isExpanded).toBe(false);

      const toggledAgain = aiSuggestionsReducer(newState, action);

      expect(toggledAgain.isExpanded).toBe(true);
    });

    it('should handle SET_ERROR', () => {
      const errorMessage = 'Analysis failed';

      const action: AISuggestionsAction = {
        type: 'SET_ERROR',
        payload: errorMessage,
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.error).toBe(errorMessage);
    });

    it('should handle SET_ERROR with null', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error',
      };

      const action: AISuggestionsAction = {
        type: 'SET_ERROR',
        payload: null,
      };

      const newState = aiSuggestionsReducer(stateWithError, action);

      expect(newState.error).toBe(null);
    });

    it('should handle CLEAR_ERROR', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error message',
      };

      const action: AISuggestionsAction = {
        type: 'CLEAR_ERROR',
      };

      const newState = aiSuggestionsReducer(stateWithError, action);

      expect(newState.error).toBe(null);
    });
  });

  describe('Optimization Result Actions', () => {
    const mockOptimizationResult: OptimizationResult = {
      performed: true,
      originalMetrics: { OG: 1.050, FG: 1.010, ABV: 5.2, IBU: 40, SRM: 8 },
      optimizedMetrics: { OG: 1.055, FG: 1.012, ABV: 5.6, IBU: 45, SRM: 8 },
      optimizedRecipe: { ingredients: [] },
      recipeChanges: [],
      iterationsCompleted: 2,
    };

    it('should handle SET_OPTIMIZATION_RESULT', () => {
      const action: AISuggestionsAction = {
        type: 'SET_OPTIMIZATION_RESULT',
        payload: mockOptimizationResult,
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.optimizationResult).toEqual(mockOptimizationResult);
    });

    it('should handle SET_OPTIMIZATION_RESULT with null', () => {
      const stateWithResult = {
        ...initialState,
        optimizationResult: mockOptimizationResult,
      };

      const action: AISuggestionsAction = {
        type: 'SET_OPTIMIZATION_RESULT',
        payload: null,
      };

      const newState = aiSuggestionsReducer(stateWithResult, action);

      expect(newState.optimizationResult).toBe(null);
    });

    it('should handle CLEAR_OPTIMIZATION_RESULT', () => {
      const stateWithResult = {
        ...initialState,
        optimizationResult: mockOptimizationResult,
      };

      const action: AISuggestionsAction = {
        type: 'CLEAR_OPTIMIZATION_RESULT',
      };

      const newState = aiSuggestionsReducer(stateWithResult, action);

      expect(newState.optimizationResult).toBe(null);
    });
  });

  describe('Reset Actions', () => {
    it('should handle RESET_STATE', () => {
      const modifiedState = {
        suggestions: [{ id: '1', type: 'test', title: 'Test', description: 'Test', confidence: 'high' as const, changes: [] }],
        optimizationResult: { performed: true, originalMetrics: {}, optimizedMetrics: {}, optimizedRecipe: {}, recipeChanges: [], iterationsCompleted: 1 },
        analyzing: true,
        isExpanded: false,
        hasAnalyzed: true,
        error: 'Error message',
        appliedSuggestions: new Set(['suggestion-1', 'suggestion-2']),
      };

      const action: AISuggestionsAction = {
        type: 'RESET_STATE',
      };

      const newState = aiSuggestionsReducer(modifiedState, action);

      expect(newState).toEqual(createInitialAISuggestionsState());
    });

    it('should handle RESET_ANALYSIS_STATE', () => {
      const modifiedState = {
        suggestions: [{ id: '1', type: 'test', title: 'Test', description: 'Test', confidence: 'high' as const, changes: [] }],
        optimizationResult: { performed: true, originalMetrics: {}, optimizedMetrics: {}, optimizedRecipe: {}, recipeChanges: [], iterationsCompleted: 1 },
        analyzing: true,
        isExpanded: false, // This should be preserved
        hasAnalyzed: true,
        error: 'Error message',
        appliedSuggestions: new Set(['suggestion-1', 'suggestion-2']),
      };

      const action: AISuggestionsAction = {
        type: 'RESET_ANALYSIS_STATE',
      };

      const newState = aiSuggestionsReducer(modifiedState, action);

      expect(newState.analyzing).toBe(false);
      expect(newState.hasAnalyzed).toBe(false);
      expect(newState.suggestions).toEqual([]);
      expect(newState.optimizationResult).toBe(null);
      expect(newState.error).toBe(null);
      expect(newState.appliedSuggestions.size).toBe(0);
      expect(newState.isExpanded).toBe(false); // UI state preserved
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete analysis workflow', () => {
      let state = initialState;

      // 1. Start analysis
      state = aiSuggestionsReducer(state, {
        type: 'START_ANALYSIS',
      });

      expect(state.analyzing).toBe(true);
      expect(state.suggestions).toEqual([]);

      // 2. Complete with suggestions
      const mockSuggestions: Suggestion[] = [
        {
          id: 'suggestion-1',
          type: 'hop_adjustment',
          title: 'Increase hops',
          description: 'Add more hops for better balance',
          confidence: 'high',
          changes: [
            {
              ingredientId: 'hop-1',
              ingredientName: 'Cascade',
              field: 'amount',
              currentValue: 1,
              suggestedValue: 1.5,
              reason: 'Increase bitterness',
              unit: 'oz',
            },
          ],
        },
      ];

      state = aiSuggestionsReducer(state, {
        type: 'ANALYSIS_SUCCESS',
        payload: {
          suggestions: mockSuggestions,
        },
      });

      expect(state.analyzing).toBe(false);
      expect(state.hasAnalyzed).toBe(true);
      expect(state.suggestions).toEqual(mockSuggestions);

      // 3. Apply a suggestion
      state = aiSuggestionsReducer(state, {
        type: 'ADD_APPLIED_SUGGESTION',
        payload: 'suggestion-1',
      });

      expect(state.appliedSuggestions.has('suggestion-1')).toBe(true);

      // 4. Remove suggestion from list
      state = aiSuggestionsReducer(state, {
        type: 'SET_SUGGESTIONS',
        payload: [],
      });

      expect(state.suggestions).toEqual([]);

      // 5. Reset for new analysis
      state = aiSuggestionsReducer(state, {
        type: 'RESET_ANALYSIS_STATE',
      });

      expect(state.hasAnalyzed).toBe(false);
      expect(state.appliedSuggestions.size).toBe(0);
    });

    it('should handle optimization workflow', () => {
      let state = initialState;

      // 1. Start analysis
      state = aiSuggestionsReducer(state, {
        type: 'START_ANALYSIS',
      });

      // 2. Complete with optimization result
      const optimizationResult: OptimizationResult = {
        performed: true,
        originalMetrics: { OG: 1.050, FG: 1.010, ABV: 5.2, IBU: 35, SRM: 8 },
        optimizedMetrics: { OG: 1.055, FG: 1.012, ABV: 5.6, IBU: 40, SRM: 8 },
        optimizedRecipe: {
          ingredients: [
            { name: 'Pale Malt', amount: 11, unit: 'lb' },
            { name: 'Cascade', amount: 1.5, unit: 'oz' },
          ],
        },
        recipeChanges: [
          {
            type: 'ingredient_modified',
            ingredient_name: 'Pale Malt',
            field: 'amount',
            original_value: 10,
            optimized_value: 11,
            unit: 'lb',
          },
          {
            type: 'ingredient_modified',
            ingredient_name: 'Cascade',
            field: 'amount',
            original_value: 1,
            optimized_value: 1.5,
            unit: 'oz',
          },
        ],
        iterationsCompleted: 5,
      };

      state = aiSuggestionsReducer(state, {
        type: 'ANALYSIS_SUCCESS',
        payload: {
          suggestions: [],
          optimizationResult,
        },
      });

      expect(state.optimizationResult).toEqual(optimizationResult);
      expect(state.suggestions).toEqual([]);

      // 3. Clear optimization result
      state = aiSuggestionsReducer(state, {
        type: 'CLEAR_OPTIMIZATION_RESULT',
      });

      expect(state.optimizationResult).toBe(null);
    });

    it('should handle error recovery', () => {
      let state = initialState;

      // 1. Start analysis
      state = aiSuggestionsReducer(state, {
        type: 'START_ANALYSIS',
      });

      // 2. Encounter error
      state = aiSuggestionsReducer(state, {
        type: 'ANALYSIS_ERROR',
        payload: 'Network error',
      });

      expect(state.analyzing).toBe(false);
      expect(state.error).toBe('Network error');

      // 3. Clear error and retry
      state = aiSuggestionsReducer(state, {
        type: 'CLEAR_ERROR',
      });

      expect(state.error).toBe(null);

      // 4. Start analysis again
      state = aiSuggestionsReducer(state, {
        type: 'START_ANALYSIS',
      });

      expect(state.analyzing).toBe(true);
      expect(state.error).toBe(null); // Should remain cleared
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state', () => {
      const action: AISuggestionsAction = {
        type: 'SET_EXPANDED',
        payload: false,
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(initialState.isExpanded).toBe(true);
    });

    it('should create new Set instances for appliedSuggestions', () => {
      const action: AISuggestionsAction = {
        type: 'ADD_APPLIED_SUGGESTION',
        payload: 'suggestion-1',
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.appliedSuggestions).not.toBe(initialState.appliedSuggestions);
      expect(initialState.appliedSuggestions.size).toBe(0);
      expect(newState.appliedSuggestions.size).toBe(1);
    });

    it('should preserve references for unchanged data', () => {
      const stateWithSuggestions = {
        ...initialState,
        suggestions: [{ id: '1', type: 'test', title: 'Test', description: 'Test', confidence: 'high' as const, changes: [] }],
      };

      const action: AISuggestionsAction = {
        type: 'SET_EXPANDED',
        payload: false,
      };

      const newState = aiSuggestionsReducer(stateWithSuggestions, action);

      expect(newState.suggestions).toBe(stateWithSuggestions.suggestions); // Same reference for unchanged data
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = aiSuggestionsReducer(initialState, unknownAction);

      expect(newState).toBe(initialState);
    });

    it('should handle empty suggestions array', () => {
      const action: AISuggestionsAction = {
        type: 'SET_SUGGESTIONS',
        payload: [],
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.suggestions).toEqual([]);
    });

    it('should handle adding duplicate applied suggestions', () => {
      const stateWithApplied = {
        ...initialState,
        appliedSuggestions: new Set(['suggestion-1']),
      };

      const action: AISuggestionsAction = {
        type: 'ADD_APPLIED_SUGGESTION',
        payload: 'suggestion-1',
      };

      const newState = aiSuggestionsReducer(stateWithApplied, action);

      expect(newState.appliedSuggestions.size).toBe(1);
      expect(newState.appliedSuggestions.has('suggestion-1')).toBe(true);
    });

    it('should handle complex suggestion objects', () => {
      const complexSuggestion: Suggestion = {
        id: 'complex-1',
        type: 'multi_ingredient',
        title: 'Complex Multi-Ingredient Adjustment',
        description: 'This suggestion affects multiple ingredients with various changes',
        confidence: 'medium',
        priority: 1,
        styleImpact: 'Improves overall balance and style compliance',
        impactType: 'critical',
        changes: [
          {
            ingredientId: 'grain-1',
            ingredientName: 'Pale Malt',
            field: 'amount',
            currentValue: 10,
            suggestedValue: 11.5,
            reason: 'Increase base malt for higher OG',
            unit: 'lb',
            isNewIngredient: false,
          },
          {
            ingredientId: 'hop-1',
            ingredientName: 'Cascade',
            field: 'time',
            currentValue: 60,
            suggestedValue: 45,
            reason: 'Reduce boil time for less bitterness',
            unit: 'min',
            isNewIngredient: false,
          },
          {
            ingredientId: 'new-hop',
            ingredientName: 'Centennial',
            field: 'ingredient_id',
            currentValue: null,
            suggestedValue: 'hop-centennial-id',
            reason: 'Add late hop for aroma',
            unit: 'oz',
            isNewIngredient: true,
            newIngredientData: {
              name: 'Centennial',
              type: 'hop',
              amount: 1,
              unit: 'oz',
              time: 15,
              use: 'boil',
              alpha_acid: 10,
            },
          },
        ],
      };

      const action: AISuggestionsAction = {
        type: 'SET_SUGGESTIONS',
        payload: [complexSuggestion],
      };

      const newState = aiSuggestionsReducer(initialState, action);

      expect(newState.suggestions).toHaveLength(1);
      expect(newState.suggestions[0]).toEqual(complexSuggestion);
      expect(newState.suggestions[0].changes).toHaveLength(3);
    });
  });
});