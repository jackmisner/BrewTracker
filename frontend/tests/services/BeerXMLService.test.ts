import BeerXMLService from '../../src/services/BeerXML/BeerXMLService';
import ApiService from '../../src/services/api';

// Mock ApiService
jest.mock('../../src/services/api', () => ({
  beerxml: {
    export: jest.fn(),
    parse: jest.fn(),
    matchIngredients: jest.fn(),
    createIngredients: jest.fn(),
  },
}));

// Mock FileReader for file operations
const mockFileReader = {
  readAsText: jest.fn(),
  onload: null as any,
  onerror: null as any,
  result: null as any,
};

Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockFileReader),
});

// Mock URL and document for download functionality
Object.defineProperty(global, 'URL', {
  writable: true,
  value: {
    createObjectURL: jest.fn(),
    revokeObjectURL: jest.fn(),
  },
});

Object.defineProperty(global, 'Blob', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({})),
});

const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();

Object.defineProperty(global, 'document', {
  writable: true,
  value: {
    createElement: jest.fn().mockReturnValue({
      href: '',
      download: '',
      style: { display: '' },
      click: mockClick,
    }),
    body: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
  },
});

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFileReader.onload = null;
  mockFileReader.onerror = null;
  mockFileReader.result = null;
});

describe('BeerXMLService', () => {
  const mockRecipeId = 'recipe-123';
  const mockXmlContent = '<?xml version="1.0"?><RECIPES><RECIPE><NAME>Test IPA</NAME></RECIPE></RECIPES>';
  
  const mockExportResponse = {
    data: {
      xml_content: mockXmlContent,
      filename: 'test-recipe.xml',
    },
  };

  const mockParseResponse = {
    data: {
      recipes: [
        {
          name: 'Test IPA',
          style: 'American IPA',
          batch_size: 5,
          ingredients: [
            { name: 'Pale Malt', type: 'grain', amount: 8, unit: 'lb' },
            { name: 'Cascade', type: 'hop', amount: 1, unit: 'oz' },
          ],
        },
      ],
    },
  };

  const mockMatchingResponse = {
    data: {
      matching_results: [
        {
          imported: { name: 'Cascade', type: 'hop' },
          bestMatch: { ingredient: { id: 'hop-1' }, confidence: 0.9 },
          matches: [],
          confidence: 0.9,
        },
      ],
    },
  };

  const mockFile = new File([mockXmlContent], 'test-recipe.xml', { type: 'text/xml' });

  describe('Export Functionality', () => {
    beforeEach(() => {
      (ApiService.beerxml.export as jest.Mock).mockResolvedValue(mockExportResponse);
    });

    it('exports recipe successfully', async () => {
      const result = await BeerXMLService.exportRecipe(mockRecipeId);

      expect(ApiService.beerxml.export).toHaveBeenCalledWith(mockRecipeId);
      expect(result).toEqual({
        xmlContent: mockXmlContent,
        filename: 'test-recipe.xml',
      });
    });

    it('handles alternative response format (xml instead of xml_content)', async () => {
      const alternativeResponse = {
        data: {
          xml: mockXmlContent,
          filename: 'test-recipe.xml',
        },
      };
      (ApiService.beerxml.export as jest.Mock).mockResolvedValue(alternativeResponse);

      const result = await BeerXMLService.exportRecipe(mockRecipeId);

      expect(result.xmlContent).toBe(mockXmlContent);
    });

    it('handles export errors gracefully', async () => {
      const error = new Error('Export failed');
      (ApiService.beerxml.export as jest.Mock).mockRejectedValue(error);

      await expect(BeerXMLService.exportRecipe(mockRecipeId)).rejects.toThrow(
        'Failed to export recipe: Export failed'
      );

      expect(console.error).toHaveBeenCalledWith('Error exporting recipe:', error);
    });

    it('handles server error responses', async () => {
      const serverError = {
        response: {
          data: { error: 'Recipe not found' },
          statusText: 'Not Found',
        },
        message: undefined,
      };
      (ApiService.beerxml.export as jest.Mock).mockRejectedValue(serverError);

      await expect(BeerXMLService.exportRecipe(mockRecipeId)).rejects.toThrow(
        'Failed to export recipe: undefined'
      );
    });
  });

  describe('Parsing Functionality', () => {
    beforeEach(() => {
      (ApiService.beerxml.parse as jest.Mock).mockResolvedValue(mockParseResponse);
    });

    it('parses BeerXML content successfully', async () => {
      const result = await BeerXMLService.parseBeerXML(mockXmlContent);

      expect(ApiService.beerxml.parse).toHaveBeenCalledWith({
        xml_content: mockXmlContent,
      });
      expect(result).toEqual(mockParseResponse.data.recipes);
    });

    it('validates XML content before parsing', async () => {
      await expect(BeerXMLService.parseBeerXML('')).rejects.toThrow(
        'Failed to parse BeerXML: Invalid XML content'
      );

      await expect(BeerXMLService.parseBeerXML('<invalid>xml')).rejects.toThrow(
        'Failed to parse BeerXML: Not a valid BeerXML file - missing RECIPES or RECIPE elements'
      );
    });

    it('detects malformed XML', async () => {
      const malformedXml = '<RECIPES><RECIPE><NAME>Test</RECIPE'; // Missing final >
      
      await expect(BeerXMLService.parseBeerXML(malformedXml)).rejects.toThrow(
        'Failed to parse BeerXML: Malformed XML - mismatched brackets'
      );
    });

    it('handles parsing errors from backend', async () => {
      const error = new Error('Parse failed');
      (ApiService.beerxml.parse as jest.Mock).mockRejectedValue(error);

      await expect(BeerXMLService.parseBeerXML(mockXmlContent)).rejects.toThrow(
        'Failed to parse BeerXML: Parse failed'
      );

      expect(console.error).toHaveBeenCalledWith('Error parsing BeerXML:', error);
    });

    it('accepts valid BeerXML with RECIPE element', async () => {
      const singleRecipeXml = '<?xml version="1.0"?><RECIPE><NAME>Test</NAME></RECIPE>';
      
      await expect(BeerXMLService.parseBeerXML(singleRecipeXml)).resolves.toBeDefined();
      expect(ApiService.beerxml.parse).toHaveBeenCalled();
    });
  });

  describe('Ingredient Matching', () => {
    beforeEach(() => {
      (ApiService.beerxml.matchIngredients as jest.Mock).mockResolvedValue(mockMatchingResponse);
    });

    it('matches ingredients successfully', async () => {
      const ingredients = [
        { name: 'Cascade', type: 'hop', amount: 1, unit: 'oz' },
        { name: 'Pale Malt', type: 'grain', amount: 8, unit: 'lb' },
      ];

      const result = await BeerXMLService.matchIngredients(ingredients as any);

      expect(ApiService.beerxml.matchIngredients).toHaveBeenCalledWith({
        unmatched_ingredients: [
          { name: 'Cascade', type: 'hop' },
          { name: 'Pale Malt', type: 'grain' },
        ],
      });
      expect(result).toEqual(mockMatchingResponse.data.matching_results);
    });

    it('handles alternative response format (matched_ingredients)', async () => {
      const alternativeResponse = {
        data: {
          matched_ingredients: [{ id: 'match-1' }],
        },
      };
      (ApiService.beerxml.matchIngredients as jest.Mock).mockResolvedValue(alternativeResponse);

      const result = await BeerXMLService.matchIngredients([{ name: 'Test', type: 'hop' } as any]);

      expect(result).toEqual([{ id: 'match-1' }]);
    });

    it('handles matching errors gracefully', async () => {
      const error = new Error('Matching failed');
      (ApiService.beerxml.matchIngredients as jest.Mock).mockRejectedValue(error);

      await expect(BeerXMLService.matchIngredients([])).rejects.toThrow(
        'Failed to match ingredients: Matching failed'
      );

      expect(console.error).toHaveBeenCalledWith('Error matching ingredients:', error);
    });
  });

  describe('Ingredient Creation', () => {
    const mockCreateResponse = {
      data: {
        created_ingredients: [
          { ingredient_id: 'new-1', name: 'New Hop', type: 'hop' },
          { ingredient_id: 'new-2', name: 'New Grain', type: 'grain' },
        ],
      },
    };

    beforeEach(() => {
      (ApiService.beerxml.createIngredients as jest.Mock).mockResolvedValue(mockCreateResponse);
    });

    it('creates ingredients successfully', async () => {
      const ingredientsData = [
        { name: 'New Hop', type: 'hop', alpha_acid: 5.5 },
        { name: 'New Grain', type: 'grain', color: 3 },
      ];

      const result = await BeerXMLService.createIngredients(ingredientsData);

      expect(ApiService.beerxml.createIngredients).toHaveBeenCalledWith({
        ingredients: ingredientsData,
      });
      expect(result).toEqual(mockCreateResponse.data.created_ingredients);
    });

    it('handles creation errors gracefully', async () => {
      const error = new Error('Creation failed');
      (ApiService.beerxml.createIngredients as jest.Mock).mockRejectedValue(error);

      await expect(BeerXMLService.createIngredients([])).rejects.toThrow(
        'Failed to create ingredients: Creation failed'
      );

      expect(console.error).toHaveBeenCalledWith('Error creating ingredients:', error);
    });
  });

  describe('File Validation', () => {
    it('validates file type correctly', () => {
      const validFile = new File(['content'], 'recipe.xml', { type: 'text/xml' });
      const invalidFile = new File(['content'], 'recipe.txt', { type: 'text/plain' });

      expect(BeerXMLService.validateFile(validFile)).toEqual({
        valid: true,
        errors: [],
      });

      expect(BeerXMLService.validateFile(invalidFile)).toEqual({
        valid: false,
        errors: ['File must be one of: .xml'],
      });
    });

    it('validates file size correctly', () => {
      const largeFileContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const largeFile = new File([largeFileContent], 'recipe.xml', { type: 'text/xml' });

      const result = BeerXMLService.validateFile(largeFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File size must be less than 10MB');
    });

    it('detects empty files', () => {
      const emptyFile = new File([], 'recipe.xml', { type: 'text/xml' });

      const result = BeerXMLService.validateFile(emptyFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('handles null file input', () => {
      const result = BeerXMLService.validateFile(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No file provided');
    });

    it('handles multiple validation errors', () => {
      const invalidFile = new File([], 'recipe.txt', { type: 'text/plain' });

      const result = BeerXMLService.validateFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('File must be one of: .xml');
      expect(result.errors).toContain('File is empty');
    });
  });

  describe('XML Content Validation', () => {
    it('validates XML content structure', () => {
      expect(() => BeerXMLService.validateBeerXML(mockXmlContent)).not.toThrow();
    });

    it('rejects invalid content types', () => {
      expect(() => BeerXMLService.validateBeerXML(null as any)).toThrow(
        'Invalid XML content'
      );

      expect(() => BeerXMLService.validateBeerXML(123 as any)).toThrow(
        'Invalid XML content'
      );
    });

    it('rejects empty content', () => {
      expect(() => BeerXMLService.validateBeerXML('')).toThrow(
        'Invalid XML content'
      );

      expect(() => BeerXMLService.validateBeerXML('   ')).toThrow(
        'XML content is empty'
      );
    });

    it('validates BeerXML structure', () => {
      expect(() => BeerXMLService.validateBeerXML('<html>not beerxml</html>')).toThrow(
        'Not a valid BeerXML file - missing RECIPES or RECIPE elements'
      );
    });

    it('detects bracket mismatches', () => {
      const mismatchedXml = '<RECIPES><RECIPE><NAME>Test</NAME></RECIPE'; // Missing final >
      
      expect(() => BeerXMLService.validateBeerXML(mismatchedXml)).toThrow(
        'Malformed XML - mismatched brackets'
      );
    });
  });

  describe('File Reading', () => {
    it('tests file reading functionality is available', () => {
      // Test that the method exists and can be called
      expect(typeof BeerXMLService.readFileContent).toBe('function');
      
      // Test basic functionality by checking that it returns a promise
      const result = BeerXMLService.readFileContent(mockFile);
      expect(result).toBeInstanceOf(Promise);
    });

    it('returns promise-based interface', () => {
      // Verify the function signature and interface
      const promise = BeerXMLService.readFileContent(mockFile);
      expect(promise).toHaveProperty('then');
      expect(promise).toHaveProperty('catch');
    });

    it('uses FileReader API for file processing', () => {
      // Verify that FileReader is used (constructor should be called)
      BeerXMLService.readFileContent(mockFile);
      expect(global.FileReader).toHaveBeenCalled();
    });
  });

  describe('File Download', () => {
    beforeEach(() => {
      (global.URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url');
    });

    it('downloads BeerXML file successfully', () => {
      const result = BeerXMLService.downloadBeerXML(mockXmlContent, 'test-recipe.xml');

      expect(global.Blob).toHaveBeenCalledWith([mockXmlContent], {
        type: 'application/xml;charset=utf-8',
      });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(result).toBe(true);
    });

    it('uses default filename when none provided', () => {
      BeerXMLService.downloadBeerXML(mockXmlContent);

      const mockElement = (document.createElement as jest.Mock).mock.results[0].value;
      expect(mockElement.download).toBe('recipe.xml');
    });

    it('handles download errors gracefully', () => {
      (global.Blob as jest.Mock).mockImplementation(() => {
        throw new Error('Blob creation failed');
      });

      expect(() => BeerXMLService.downloadBeerXML(mockXmlContent)).toThrow(
        'Failed to download BeerXML file'
      );

      expect(console.error).toHaveBeenCalledWith(
        'Error downloading file:',
        expect.any(Error)
      );
    });
  });

  describe('Filename Generation', () => {
    it('generates safe filename from recipe name', () => {
      expect(BeerXMLService.generateFilename('Test IPA Recipe')).toBe('test_ipa_recipe_recipe.xml');
    });

    it('removes special characters', () => {
      expect(BeerXMLService.generateFilename('Test@Recipe#2023!')).toBe('testrecipe2023_recipe.xml');
    });

    it('handles very long names', () => {
      const longName = 'A'.repeat(100);
      const result = BeerXMLService.generateFilename(longName);
      
      expect(result.length).toBeLessThanOrEqual(62); // 50 chars + '_recipe.xml'
      expect(result.endsWith('_recipe.xml')).toBe(true);
    });

    it('uses default filename for empty input', () => {
      expect(BeerXMLService.generateFilename('')).toBe('recipe.xml');
      expect(BeerXMLService.generateFilename(undefined)).toBe('recipe.xml');
    });
  });

  describe('Complete Import Workflow', () => {
    beforeEach(() => {
      (ApiService.beerxml.parse as jest.Mock).mockResolvedValue(mockParseResponse);
      (ApiService.beerxml.matchIngredients as jest.Mock).mockResolvedValue(mockMatchingResponse);
      
      // Mock the readFileContent method to avoid FileReader issues
      jest.spyOn(BeerXMLService, 'readFileContent').mockResolvedValue(mockXmlContent);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('processes import file through complete workflow', async () => {
      const result = await BeerXMLService.processImportFile(mockFile);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        name: 'Test IPA',
        matchingResults: mockMatchingResponse.data.matching_results,
      }));
      expect(BeerXMLService.readFileContent).toHaveBeenCalledWith(mockFile);
    });

    it('handles file validation errors', async () => {
      const invalidFile = new File([], 'recipe.txt', { type: 'text/plain' });

      await expect(BeerXMLService.processImportFile(invalidFile)).rejects.toThrow(
        'File must be one of: .xml; File is empty'
      );
    });

    it('handles recipes with no ingredients', async () => {
      const noIngredientsResponse = {
        data: {
          recipes: [
            { name: 'Empty Recipe', ingredients: [] },
            { name: 'No Ingredients Property' },
          ],
        },
      };
      (ApiService.beerxml.parse as jest.Mock).mockResolvedValue(noIngredientsResponse);

      const result = await BeerXMLService.processImportFile(mockFile);

      expect(result).toHaveLength(2);
      expect(ApiService.beerxml.matchIngredients).not.toHaveBeenCalled();
    });

    it('handles no recipes found', async () => {
      (ApiService.beerxml.parse as jest.Mock).mockResolvedValue({ data: { recipes: [] } });

      await expect(BeerXMLService.processImportFile(mockFile)).rejects.toThrow(
        'No valid recipes found in BeerXML file'
      );
    });
  });

  describe('Import Summary Generation', () => {
    const mockRecipes = [
      {
        name: 'Recipe 1',
        ingredients: [
          { type: 'grain', name: 'Pale Malt' },
          { type: 'hop', name: 'Cascade' },
          { type: 'yeast', name: 'US-05' },
        ],
        matchingResults: [
          { bestMatch: { id: 'match-1' }, confidence: 0.9 },
          { bestMatch: null, confidence: 0.3 },
          { bestMatch: { id: 'match-2' }, confidence: 0.6 },
        ],
      },
      {
        name: 'Recipe 2',
        ingredients: [
          { type: 'adjunct', name: 'Corn Sugar' },
          { type: 'other', name: 'Irish Moss' },
        ],
        matchingResults: [
          { bestMatch: null, confidence: 0.2 },
          { bestMatch: { id: 'match-3' }, confidence: 0.85 },
        ],
      },
    ];

    it('generates correct import summary', () => {
      const summary = BeerXMLService.getImportSummary(mockRecipes as any);

      expect(summary).toEqual({
        totalRecipes: 2,
        totalIngredients: 5,
        ingredientsByType: {
          grain: 1,
          hop: 1,
          yeast: 1,
          other: 2, // adjunct is mapped to other
        },
        matchingStats: {
          matched: 2, // confidence > 0.7
          newRequired: 3, // confidence <= 0.7 or no bestMatch
          highConfidence: 2, // confidence > 0.8
        },
      });
    });

    it('handles recipes without ingredients', () => {
      const recipesWithoutIngredients = [
        { name: 'Recipe 1' },
        { name: 'Recipe 2', ingredients: null },
      ];

      const summary = BeerXMLService.getImportSummary(recipesWithoutIngredients as any);

      expect(summary.totalIngredients).toBe(0);
      expect(summary.ingredientsByType).toEqual({
        grain: 0,
        hop: 0,
        yeast: 0,
        other: 0,
      });
    });

    it('handles recipes without matching results', () => {
      const recipesWithoutMatching = [
        {
          name: 'Recipe 1',
          ingredients: [{ type: 'grain', name: 'Test' }],
        },
      ];

      const summary = BeerXMLService.getImportSummary(recipesWithoutMatching as any);

      expect(summary.matchingStats).toEqual({
        matched: 0,
        newRequired: 0,
        highConfidence: 0,
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors with response data', () => {
      const error = {
        response: {
          data: { error: 'Custom error message' },
          statusText: 'Bad Request',
        },
      };

      const result = BeerXMLService.handleApiError(error);

      expect(result.message).toBe('Server error: Custom error message');
    });

    it('handles API errors with status text only', () => {
      const error = {
        response: {
          data: {},
          statusText: 'Internal Server Error',
        },
      };

      const result = BeerXMLService.handleApiError(error);

      expect(result.message).toBe('Server error: Internal Server Error');
    });

    it('handles network errors', () => {
      const error = {
        request: {},
        message: 'Network Error',
      };

      const result = BeerXMLService.handleApiError(error);

      expect(result.message).toBe('Network error: Unable to connect to server');
    });

    it('handles unexpected errors', () => {
      const error = {
        message: 'Something went wrong',
      };

      const result = BeerXMLService.handleApiError(error);

      expect(result.message).toBe('Unexpected error: Something went wrong');
    });
  });

  describe('Service Instantiation', () => {
    it('exports a singleton instance', () => {
      // Test that the service is properly instantiated and configured
      expect(BeerXMLService.validateFile).toBeDefined();
      expect(BeerXMLService.exportRecipe).toBeDefined();
      expect(BeerXMLService.parseBeerXML).toBeDefined();
      expect(BeerXMLService.matchIngredients).toBeDefined();
    });

    it('has correct configuration constants', () => {
      // Test file validation behavior to ensure constants are set correctly
      const tooLargeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'test.xml');
      const result = BeerXMLService.validateFile(tooLargeFile);
      
      expect(result.errors).toContain('File size must be less than 10MB');
    });
  });
});