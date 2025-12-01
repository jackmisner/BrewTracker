import {
  beerXMLReducer,
  createInitialBeerXMLState,
  type BeerXMLAction,
  type BeerXMLState,
} from '../../src/reducers/beerXMLReducer';
import type {
  ParsedBeerXMLRecipe,
  IngredientMatchResult,
  BeerXMLExportResult,
} from '../../src/types/beerxml';

describe('beerXMLReducer', () => {
  let initialState: BeerXMLState;

  beforeEach(() => {
    initialState = createInitialBeerXMLState();
  });

  describe('Initial State', () => {
    it('should create correct initial state', () => {
      expect(initialState).toEqual({
        import: {
          isImporting: false,
          uploadedFile: null,
          parsedRecipes: [],
          selectedRecipe: null,
          matchingResults: [],
          showMatchingReview: false,
          showUnitConversionChoice: false,
          recipeUnitSystem: null,
          userUnitSystem: null,
          importProgress: 0,
          error: null,
          warnings: [],
        },
        export: {
          isExporting: false,
          exportProgress: 0,
          error: null,
          lastExportResult: null,
        },
      });
    });
  });

  describe('Import Actions', () => {
    it('should handle IMPORT_START', () => {
      const stateWithError = {
        ...initialState,
        import: {
          ...initialState.import,
          error: 'Previous error',
          importProgress: 50,
        },
      };

      const action: BeerXMLAction = {
        type: 'IMPORT_START',
      };

      const newState = beerXMLReducer(stateWithError, action);

      expect(newState.import.isImporting).toBe(true);
      expect(newState.import.error).toBe(null);
      expect(newState.import.importProgress).toBe(0);
    });

    it('should handle IMPORT_SUCCESS', () => {
      const mockRecipes: ParsedBeerXMLRecipe[] = [
        {
          name: 'Test IPA',
          style: 'American IPA',
          batch_size: 5,
          batch_size_unit: 'gal',
          ingredients: [],
        },
        {
          name: 'Test Stout',
          style: 'Imperial Stout',
          batch_size: 5,
          batch_size_unit: 'gal',
          ingredients: [],
        },
      ];

      const warnings = ['Warning: Missing hop utilization'];

      const action: BeerXMLAction = {
        type: 'IMPORT_SUCCESS',
        payload: {
          recipes: mockRecipes,
          warnings,
        },
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.isImporting).toBe(false);
      expect(newState.import.parsedRecipes).toEqual(mockRecipes);
      expect(newState.import.warnings).toEqual(warnings);
      expect(newState.import.importProgress).toBe(100);
    });

    it('should handle IMPORT_ERROR', () => {
      const errorMessage = 'Failed to parse BeerXML file';
      const stateWithProgress = {
        ...initialState,
        import: {
          ...initialState.import,
          isImporting: true,
          importProgress: 50,
        },
      };

      const action: BeerXMLAction = {
        type: 'IMPORT_ERROR',
        payload: errorMessage,
      };

      const newState = beerXMLReducer(stateWithProgress, action);

      expect(newState.import.isImporting).toBe(false);
      expect(newState.import.error).toBe(errorMessage);
      expect(newState.import.importProgress).toBe(0);
    });

    it('should handle IMPORT_PROGRESS', () => {
      const action: BeerXMLAction = {
        type: 'IMPORT_PROGRESS',
        payload: 75,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.importProgress).toBe(75);
    });

    it('should handle SET_UPLOADED_FILE', () => {
      const mockFile = new File(['<xml>content</xml>'], 'recipe.xml', {
        type: 'application/xml',
      });

      const stateWithError = {
        ...initialState,
        import: {
          ...initialState.import,
          error: 'Previous error',
        },
      };

      const action: BeerXMLAction = {
        type: 'SET_UPLOADED_FILE',
        payload: mockFile,
      };

      const newState = beerXMLReducer(stateWithError, action);

      expect(newState.import.uploadedFile).toBe(mockFile);
      expect(newState.import.error).toBe(null); // Should clear error
    });

    it('should handle SET_UPLOADED_FILE with null', () => {
      const stateWithFile = {
        ...initialState,
        import: {
          ...initialState.import,
          uploadedFile: new File(['content'], 'test.xml'),
        },
      };

      const action: BeerXMLAction = {
        type: 'SET_UPLOADED_FILE',
        payload: null,
      };

      const newState = beerXMLReducer(stateWithFile, action);

      expect(newState.import.uploadedFile).toBe(null);
    });

    it('should handle SELECT_RECIPE', () => {
      const mockRecipe: ParsedBeerXMLRecipe = {
        name: 'Selected Recipe',
        style: 'Pale Ale',
        batch_size: 5,
        batch_size_unit: 'gal',
        ingredients: [],
      };

      const action: BeerXMLAction = {
        type: 'SELECT_RECIPE',
        payload: mockRecipe,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.selectedRecipe).toEqual(mockRecipe);
    });

    it('should handle SELECT_RECIPE with null', () => {
      const stateWithSelected = {
        ...initialState,
        import: {
          ...initialState.import,
          selectedRecipe: {
            name: 'Previous Recipe',
            style: 'IPA',
            batch_size: 5,
            batch_size_unit: 'gal',
            ingredients: [],
          },
        },
      };

      const action: BeerXMLAction = {
        type: 'SELECT_RECIPE',
        payload: null,
      };

      const newState = beerXMLReducer(stateWithSelected, action);

      expect(newState.import.selectedRecipe).toBe(null);
    });

    it('should handle SET_MATCHING_RESULTS', () => {
      const mockMatchingResults: IngredientMatchResult[] = [
        {
          originalName: 'Pale Malt',
          matchedIngredient: {
            _id: '1',
            name: 'Pale Malt (2-row)',
            type: 'grain',
          },
          confidence: 0.95,
          alternatives: [],
        },
      ];

      const action: BeerXMLAction = {
        type: 'SET_MATCHING_RESULTS',
        payload: mockMatchingResults,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.matchingResults).toEqual(mockMatchingResults);
    });

    it('should handle SHOW_MATCHING_REVIEW', () => {
      const action: BeerXMLAction = {
        type: 'SHOW_MATCHING_REVIEW',
        payload: true,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.showMatchingReview).toBe(true);

      const hideAction: BeerXMLAction = {
        type: 'SHOW_MATCHING_REVIEW',
        payload: false,
      };

      const hiddenState = beerXMLReducer(newState, hideAction);

      expect(hiddenState.import.showMatchingReview).toBe(false);
    });

    it('should handle CLEAR_IMPORT_ERROR', () => {
      const stateWithError = {
        ...initialState,
        import: {
          ...initialState.import,
          error: 'Import error message',
        },
      };

      const action: BeerXMLAction = {
        type: 'CLEAR_IMPORT_ERROR',
      };

      const newState = beerXMLReducer(stateWithError, action);

      expect(newState.import.error).toBe(null);
    });

    it('should handle RESET_IMPORT_STATE', () => {
      const modifiedImportState = {
        ...initialState,
        import: {
          isImporting: true,
          uploadedFile: new File(['content'], 'test.xml'),
          parsedRecipes: [{ name: 'Test', style: 'IPA', batch_size: 5, batch_size_unit: 'gal', ingredients: [] }],
          selectedRecipe: { name: 'Selected', style: 'Stout', batch_size: 5, batch_size_unit: 'gal', ingredients: [] },
          matchingResults: [{ originalName: 'Test', matchedIngredient: null, confidence: 0, alternatives: [] }],
          showMatchingReview: true,
          importProgress: 75,
          error: 'Error message',
          warnings: ['Warning'],
        },
      };

      const action: BeerXMLAction = {
        type: 'RESET_IMPORT_STATE',
      };

      const newState = beerXMLReducer(modifiedImportState, action);

      expect(newState.import).toEqual(initialState.import);
      expect(newState.export).toBe(modifiedImportState.export); // Export state unchanged
    });
  });

  describe('Export Actions', () => {
    it('should handle EXPORT_START', () => {
      const stateWithError = {
        ...initialState,
        export: {
          ...initialState.export,
          error: 'Previous error',
          exportProgress: 50,
        },
      };

      const action: BeerXMLAction = {
        type: 'EXPORT_START',
      };

      const newState = beerXMLReducer(stateWithError, action);

      expect(newState.export.isExporting).toBe(true);
      expect(newState.export.error).toBe(null);
      expect(newState.export.exportProgress).toBe(0);
    });

    it('should handle EXPORT_SUCCESS', () => {
      const mockExportResult: BeerXMLExportResult = {
        success: true,
        filename: 'my-recipe.xml',
        xmlContent: '<recipe>...</recipe>',
      };

      const action: BeerXMLAction = {
        type: 'EXPORT_SUCCESS',
        payload: mockExportResult,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.export.isExporting).toBe(false);
      expect(newState.export.lastExportResult).toEqual(mockExportResult);
      expect(newState.export.exportProgress).toBe(100);
    });

    it('should handle EXPORT_ERROR', () => {
      const errorMessage = 'Failed to export recipe';
      const stateWithProgress = {
        ...initialState,
        export: {
          ...initialState.export,
          isExporting: true,
          exportProgress: 80,
        },
      };

      const action: BeerXMLAction = {
        type: 'EXPORT_ERROR',
        payload: errorMessage,
      };

      const newState = beerXMLReducer(stateWithProgress, action);

      expect(newState.export.isExporting).toBe(false);
      expect(newState.export.error).toBe(errorMessage);
      expect(newState.export.exportProgress).toBe(0);
    });

    it('should handle EXPORT_PROGRESS', () => {
      const action: BeerXMLAction = {
        type: 'EXPORT_PROGRESS',
        payload: 60,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.export.exportProgress).toBe(60);
    });

    it('should handle CLEAR_EXPORT_ERROR', () => {
      const stateWithError = {
        ...initialState,
        export: {
          ...initialState.export,
          error: 'Export error message',
        },
      };

      const action: BeerXMLAction = {
        type: 'CLEAR_EXPORT_ERROR',
      };

      const newState = beerXMLReducer(stateWithError, action);

      expect(newState.export.error).toBe(null);
    });

    it('should handle RESET_EXPORT_STATE', () => {
      const modifiedExportState = {
        ...initialState,
        export: {
          isExporting: true,
          exportProgress: 75,
          error: 'Export error',
          lastExportResult: {
            success: true,
            filename: 'test.xml',
            xmlContent: '<recipe>...</recipe>',
          },
        },
      };

      const action: BeerXMLAction = {
        type: 'RESET_EXPORT_STATE',
      };

      const newState = beerXMLReducer(modifiedExportState, action);

      expect(newState.export).toEqual(initialState.export);
      expect(newState.import).toBe(modifiedExportState.import); // Import state unchanged
    });
  });

  describe('Combined Actions', () => {
    it('should handle RESET_ALL_STATE', () => {
      const modifiedState = {
        import: {
          isImporting: true,
          uploadedFile: new File(['content'], 'test.xml'),
          parsedRecipes: [{ name: 'Test', style: 'IPA', batch_size: 5, batch_size_unit: 'gal', ingredients: [] }],
          selectedRecipe: null,
          matchingResults: [],
          showMatchingReview: true,
          importProgress: 50,
          error: 'Import error',
          warnings: ['Warning'],
        },
        export: {
          isExporting: true,
          exportProgress: 75,
          error: 'Export error',
          lastExportResult: {
            success: false,
            filename: 'failed.xml',
          },
        },
      };

      const action: BeerXMLAction = {
        type: 'RESET_ALL_STATE',
      };

      const newState = beerXMLReducer(modifiedState, action);

      expect(newState).toEqual(createInitialBeerXMLState());
    });
  });

  describe('Complex Workflows', () => {
    it('should handle complete import workflow', () => {
      let state = initialState;

      // 1. Upload file
      const mockFile = new File(['<xml>content</xml>'], 'recipe.xml');
      state = beerXMLReducer(state, {
        type: 'SET_UPLOADED_FILE',
        payload: mockFile,
      });

      expect(state.import.uploadedFile).toBe(mockFile);

      // 2. Start import
      state = beerXMLReducer(state, {
        type: 'IMPORT_START',
      });

      expect(state.import.isImporting).toBe(true);

      // 3. Update progress
      state = beerXMLReducer(state, {
        type: 'IMPORT_PROGRESS',
        payload: 50,
      });

      expect(state.import.importProgress).toBe(50);

      // 4. Complete parsing
      const mockRecipes: ParsedBeerXMLRecipe[] = [
        {
          name: 'Imported IPA',
          style: 'American IPA',
          batch_size: 5,
          batch_size_unit: 'gal',
          ingredients: [],
        },
      ];

      state = beerXMLReducer(state, {
        type: 'IMPORT_SUCCESS',
        payload: {
          recipes: mockRecipes,
          warnings: [],
        },
      });

      expect(state.import.isImporting).toBe(false);
      expect(state.import.parsedRecipes).toEqual(mockRecipes);

      // 5. Select recipe
      state = beerXMLReducer(state, {
        type: 'SELECT_RECIPE',
        payload: mockRecipes[0],
      });

      expect(state.import.selectedRecipe).toEqual(mockRecipes[0]);

      // 6. Show matching review
      state = beerXMLReducer(state, {
        type: 'SHOW_MATCHING_REVIEW',
        payload: true,
      });

      expect(state.import.showMatchingReview).toBe(true);

      // 7. Complete import (reset)
      state = beerXMLReducer(state, {
        type: 'RESET_IMPORT_STATE',
      });

      expect(state.import).toEqual(initialState.import);
    });

    it('should handle export workflow', () => {
      let state = initialState;

      // 1. Start export
      state = beerXMLReducer(state, {
        type: 'EXPORT_START',
      });

      expect(state.export.isExporting).toBe(true);

      // 2. Update progress
      state = beerXMLReducer(state, {
        type: 'EXPORT_PROGRESS',
        payload: 80,
      });

      expect(state.export.exportProgress).toBe(80);

      // 3. Complete export
      const exportResult: BeerXMLExportResult = {
        success: true,
        filename: 'exported-recipe.xml',
        xmlContent: '<recipe>...</recipe>',
      };

      state = beerXMLReducer(state, {
        type: 'EXPORT_SUCCESS',
        payload: exportResult,
      });

      expect(state.export.isExporting).toBe(false);
      expect(state.export.lastExportResult).toEqual(exportResult);
      expect(state.export.exportProgress).toBe(100);
    });

    it('should handle error scenarios', () => {
      let state = initialState;

      // Import error
      state = beerXMLReducer(state, {
        type: 'IMPORT_START',
      });

      state = beerXMLReducer(state, {
        type: 'IMPORT_ERROR',
        payload: 'File format not supported',
      });

      expect(state.import.isImporting).toBe(false);
      expect(state.import.error).toBe('File format not supported');

      // Export error
      state = beerXMLReducer(state, {
        type: 'EXPORT_START',
      });

      state = beerXMLReducer(state, {
        type: 'EXPORT_ERROR',
        payload: 'Recipe data incomplete',
      });

      expect(state.export.isExporting).toBe(false);
      expect(state.export.error).toBe('Recipe data incomplete');
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state', () => {
      const action: BeerXMLAction = {
        type: 'IMPORT_PROGRESS',
        payload: 50,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.import).not.toBe(initialState.import);
      expect(newState.export).toBe(initialState.export); // Unchanged section should share reference
      expect(initialState.import.importProgress).toBe(0);
    });

    it('should create new nested objects when modified', () => {
      const action: BeerXMLAction = {
        type: 'EXPORT_PROGRESS',
        payload: 75,
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.export).not.toBe(initialState.export);
      expect(newState.import).toBe(initialState.import); // Unchanged section should share reference
    });
  });

  describe('Unit Conversion Actions', () => {
    it('should handle SHOW_UNIT_CONVERSION_CHOICE', () => {
      const action: BeerXMLAction = {
        type: 'SHOW_UNIT_CONVERSION_CHOICE',
        payload: {
          recipeUnitSystem: 'metric',
          userUnitSystem: 'imperial',
        },
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState.import.showUnitConversionChoice).toBe(true);
      expect(newState.import.recipeUnitSystem).toBe('metric');
      expect(newState.import.userUnitSystem).toBe('imperial');
    });

    it('should handle HIDE_UNIT_CONVERSION_CHOICE', () => {
      const stateWithChoice = {
        ...initialState,
        import: {
          ...initialState.import,
          showUnitConversionChoice: true,
          recipeUnitSystem: 'metric',
          userUnitSystem: 'imperial',
        },
      };

      const action: BeerXMLAction = {
        type: 'HIDE_UNIT_CONVERSION_CHOICE',
      };

      const newState = beerXMLReducer(stateWithChoice, action);

      expect(newState.import.showUnitConversionChoice).toBe(false);
      expect(newState.import.recipeUnitSystem).toBe(null);
      expect(newState.import.userUnitSystem).toBe(null);
    });

    it('should preserve immutability for unit conversion actions', () => {
      const action: BeerXMLAction = {
        type: 'SHOW_UNIT_CONVERSION_CHOICE',
        payload: {
          recipeUnitSystem: 'metric',
          userUnitSystem: 'imperial',
        },
      };

      const newState = beerXMLReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.import).not.toBe(initialState.import);
      expect(newState.export).toBe(initialState.export); // Unchanged section should share reference
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown action types', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION' } as any;

      const newState = beerXMLReducer(initialState, unknownAction);

      expect(newState).toBe(initialState);
    });

    it('should handle empty arrays and null values gracefully', () => {
      const actions: BeerXMLAction[] = [
        {
          type: 'IMPORT_SUCCESS',
          payload: { recipes: [], warnings: [] },
        },
        {
          type: 'SET_MATCHING_RESULTS',
          payload: [],
        },
        {
          type: 'SELECT_RECIPE',
          payload: null,
        },
      ];

      actions.forEach(action => {
        const newState = beerXMLReducer(initialState, action);
        expect(newState).toBeDefined();
      });
    });

    it('should handle progress values at boundaries', () => {
      const progressValues = [0, 50, 100, -1, 101];

      progressValues.forEach(progress => {
        const importAction: BeerXMLAction = {
          type: 'IMPORT_PROGRESS',
          payload: progress,
        };

        const exportAction: BeerXMLAction = {
          type: 'EXPORT_PROGRESS',
          payload: progress,
        };

        const importState = beerXMLReducer(initialState, importAction);
        const exportState = beerXMLReducer(initialState, exportAction);

        expect(importState.import.importProgress).toBe(progress);
        expect(exportState.export.exportProgress).toBe(progress);
      });
    });
  });
});