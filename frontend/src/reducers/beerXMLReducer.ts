// reducers/beerXMLReducer.ts

import {
  BeerXMLImportState,
  BeerXMLExportState,
  ParsedBeerXMLRecipe,
  IngredientMatchResult,
  BeerXMLExportResult,
} from "../types/beerxml";

// Combined state interface
export interface BeerXMLState {
  // Import state
  import: BeerXMLImportState;
  
  // Export state
  export: BeerXMLExportState;
}

// Action types for all BeerXML operations
export type BeerXMLAction =
  // Import actions
  | { type: 'IMPORT_START' }
  | { type: 'IMPORT_SUCCESS'; payload: { recipes: ParsedBeerXMLRecipe[]; warnings: string[] } }
  | { type: 'IMPORT_ERROR'; payload: string }
  | { type: 'IMPORT_PROGRESS'; payload: number }
  | { type: 'SET_UPLOADED_FILE'; payload: File | null }
  | { type: 'SELECT_RECIPE'; payload: ParsedBeerXMLRecipe | null }
  | { type: 'SET_MATCHING_RESULTS'; payload: IngredientMatchResult[] }
  | { type: 'SHOW_MATCHING_REVIEW'; payload: boolean }
  | { type: 'CLEAR_IMPORT_ERROR' }
  | { type: 'RESET_IMPORT_STATE' }

  // Export actions
  | { type: 'EXPORT_START' }
  | { type: 'EXPORT_SUCCESS'; payload: BeerXMLExportResult }
  | { type: 'EXPORT_ERROR'; payload: string }
  | { type: 'EXPORT_PROGRESS'; payload: number }
  | { type: 'CLEAR_EXPORT_ERROR' }
  | { type: 'RESET_EXPORT_STATE' }

  // Combined actions
  | { type: 'RESET_ALL_STATE' };

// Initial state factory function
export const createInitialBeerXMLState = (): BeerXMLState => ({
  import: {
    isImporting: false,
    uploadedFile: null,
    parsedRecipes: [],
    selectedRecipe: null,
    matchingResults: [],
    showMatchingReview: false,
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

// Reducer function
export const beerXMLReducer = (
  state: BeerXMLState,
  action: BeerXMLAction
): BeerXMLState => {
  switch (action.type) {
    // Import actions
    case 'IMPORT_START':
      return {
        ...state,
        import: {
          ...state.import,
          isImporting: true,
          error: null,
          importProgress: 0,
        },
      };

    case 'IMPORT_SUCCESS':
      return {
        ...state,
        import: {
          ...state.import,
          isImporting: false,
          parsedRecipes: action.payload.recipes,
          warnings: action.payload.warnings,
          importProgress: 100,
        },
      };

    case 'IMPORT_ERROR':
      return {
        ...state,
        import: {
          ...state.import,
          isImporting: false,
          error: action.payload,
          importProgress: 0,
        },
      };

    case 'IMPORT_PROGRESS':
      return {
        ...state,
        import: {
          ...state.import,
          importProgress: action.payload,
        },
      };

    case 'SET_UPLOADED_FILE':
      return {
        ...state,
        import: {
          ...state.import,
          uploadedFile: action.payload,
          error: null,
        },
      };

    case 'SELECT_RECIPE':
      return {
        ...state,
        import: {
          ...state.import,
          selectedRecipe: action.payload,
        },
      };

    case 'SET_MATCHING_RESULTS':
      return {
        ...state,
        import: {
          ...state.import,
          matchingResults: action.payload,
        },
      };

    case 'SHOW_MATCHING_REVIEW':
      return {
        ...state,
        import: {
          ...state.import,
          showMatchingReview: action.payload,
        },
      };

    case 'CLEAR_IMPORT_ERROR':
      return {
        ...state,
        import: {
          ...state.import,
          error: null,
        },
      };

    case 'RESET_IMPORT_STATE':
      return {
        ...state,
        import: {
          isImporting: false,
          uploadedFile: null,
          parsedRecipes: [],
          selectedRecipe: null,
          matchingResults: [],
          showMatchingReview: false,
          importProgress: 0,
          error: null,
          warnings: [],
        },
      };

    // Export actions
    case 'EXPORT_START':
      return {
        ...state,
        export: {
          ...state.export,
          isExporting: true,
          error: null,
          exportProgress: 0,
        },
      };

    case 'EXPORT_SUCCESS':
      return {
        ...state,
        export: {
          ...state.export,
          isExporting: false,
          lastExportResult: action.payload,
          exportProgress: 100,
        },
      };

    case 'EXPORT_ERROR':
      return {
        ...state,
        export: {
          ...state.export,
          isExporting: false,
          error: action.payload,
          exportProgress: 0,
        },
      };

    case 'EXPORT_PROGRESS':
      return {
        ...state,
        export: {
          ...state.export,
          exportProgress: action.payload,
        },
      };

    case 'CLEAR_EXPORT_ERROR':
      return {
        ...state,
        export: {
          ...state.export,
          error: null,
        },
      };

    case 'RESET_EXPORT_STATE':
      return {
        ...state,
        export: {
          isExporting: false,
          exportProgress: 0,
          error: null,
          lastExportResult: null,
        },
      };

    // Combined actions
    case 'RESET_ALL_STATE':
      return createInitialBeerXMLState();

    default:
      return state;
  }
};