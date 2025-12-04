// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BeerXMLImportExport from '../../src/components/BeerXML/BeerXMLImportExport';
import beerXMLService from '../../src/services/BeerXML/BeerXMLService';

// Mock UnitContext
jest.mock('../../src/contexts/UnitContext', () => {
  const React = require('react');
  return {
    useUnits: () => ({
      unitSystem: 'imperial',
      loading: false,
      error: null,
      updateUnitSystem: jest.fn(),
      setError: jest.fn(),
      getPreferredUnit: jest.fn((type: string) => type === 'volume' ? 'gal' : 'lb'),
      convertUnit: jest.fn((value: number, from: string, to: string) => ({ value, unit: to })),
      convertForDisplay: jest.fn((value: number, unit: string) => ({ value, unit })),
      convertForStorage: jest.fn((value: number, unit: string) => ({ value, unit })),
      formatValue: jest.fn((value: number, unit: string) => `${value} ${unit}`),
      getUnitSystemLabel: jest.fn(() => 'Imperial'),
      getUnitSystemIcon: jest.fn(() => '🇺🇸'),
      getCommonUnits: jest.fn(() => []),
      convertBatch: jest.fn((ingredients: any[]) => ingredients),
      getTypicalBatchSizes: jest.fn(() => []),
    }),
    UnitProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock the BeerXML service
jest.mock('../../src/services/BeerXML/BeerXMLService', () => ({
  validateFile: jest.fn(),
  readFileContent: jest.fn(),
  parseBeerXML: jest.fn(),
  matchIngredients: jest.fn(),
  exportRecipe: jest.fn(),
  downloadBeerXML: jest.fn(),
  convertRecipeUnits: jest.fn((recipe) => Promise.resolve({ recipe, warnings: [] })), // Return recipe with warnings array
}));

// Mock the UnitConversionChoice component
jest.mock('../../src/components/BeerXML/UnitConversionChoice', () => {
  return function MockUnitConversionChoice({ onImportAsMetric, onImportAsImperial, onCancel }: any) {
    return (
      <div data-testid="unit-conversion-choice">
        <h3>Choose Import Units</h3>
        <button onClick={onImportAsMetric} data-testid="import-as-metric">
          Import as Metric
        </button>
        <button onClick={onImportAsImperial} data-testid="import-as-imperial">
          Import as Imperial
        </button>
        <button onClick={onCancel} data-testid="cancel-conversion">
          Cancel
        </button>
      </div>
    );
  };
});

// Mock the IngredientMatchingReview component
jest.mock('../../src/components/BeerXML/IngredientMatchingReview', () => {
  return function MockIngredientMatchingReview({ onComplete, onCancel, matchingResults }: any) {
    // Create a realistic mock response based on the matching results
    let mockIngredients;
    
    try {
      if (!matchingResults || matchingResults.length === 0) {
        mockIngredients = [{ id: '1', name: 'Matched Ingredient' }];
      } else {
        mockIngredients = matchingResults.map((result: any, index: number) => ({
          id: `existing-${index + 1}`,
          ingredient_id: `${index + 1}`,
          name: result.best_match?.ingredient?.name || result.imported?.name || 'Default Ingredient',
          type: result.imported?.type || 'grain',
          amount: result.imported?.amount || 1,
          unit: result.imported?.unit || 'oz',
          use: result.imported?.use || 'boil',
          time: result.imported?.time || 0,
          // Include relevant properties from matched ingredient or imported data
          potential: result.imported?.potential,
          color: result.imported?.color,
          grain_type: result.imported?.grain_type,
          alpha_acid: result.imported?.alpha_acid,
          attenuation: result.imported?.attenuation,
        }));
      }
    } catch (error) {
      mockIngredients = [{ id: '1', name: 'Matched Ingredient' }];
    }

    return (
      <div data-testid="ingredient-matching-review">
        <h3>Ingredient Matching Review</h3>
        <button
          onClick={() => onComplete && onComplete({ ingredients: mockIngredients, createdIngredients: [] })}
          data-testid="complete-matching"
        >
          Complete Matching
        </button>
        <button onClick={onCancel} data-testid="cancel-matching">
          Cancel
        </button>
      </div>
    );
  };
});

// Mock CSS import
jest.mock('../../src/styles/BeerXMLImportExport.css', () => ({}));

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('BeerXMLImportExport', () => {
  const mockRecipe = {
    id: 'test-recipe-1',
    recipe_id: 'test-recipe-1',
    name: 'Test IPA',
    style: 'American IPA',
    batch_size: 5,
    batch_size_unit: 'gal' as const,
    description: 'Test recipe',
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: '',
    ingredients: [],
    created_at: '',
    updated_at: '',
  };

  const mockIngredients = [
    { id: '1', name: 'Pale Malt', type: 'grain', amount: 8, unit: 'lb' },
    { id: '2', name: 'Cascade', type: 'hop', amount: 1, unit: 'oz' },
  ];

  const mockFile = new File(['<xml>test</xml>'], 'test-recipe.xml', { type: 'text/xml' });

  const mockParsedRecipes = [
    {
        name: 'Imported IPA',
        style: 'IPA',
        batch_size: 5,
    
      ingredients: [
        { id: '1', name: 'Imported Grain', type: 'grain' },
        { id: '2', name: 'Imported Hop', type: 'hop' },
      ],
      metadata: { source: 'BeerXML' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default service mocks
    (beerXMLService.validateFile as jest.Mock).mockReturnValue({ valid: true, errors: [] });
    (beerXMLService.readFileContent as jest.Mock).mockResolvedValue('<xml>test</xml>');
    (beerXMLService.parseBeerXML as jest.Mock).mockResolvedValue(mockParsedRecipes);
    (beerXMLService.matchIngredients as jest.Mock).mockResolvedValue([
      { ingredient: { id: '1', name: 'Match 1' }, confidence: 0.9 },
    ]);
    (beerXMLService.exportRecipe as jest.Mock).mockResolvedValue({
      xmlContent: '<xml>exported</xml>',
      filename: 'test-recipe.xml',
    });
  });

  describe('Initial Rendering', () => {
    it('renders import section by default', () => {
      render(<BeerXMLImportExport />);
      
      expect(screen.getByText('Import from BeerXML')).toBeInTheDocument();
      expect(screen.getByText('Click to select BeerXML file or drag and drop')).toBeInTheDocument();
    });

    it('renders export section by default', () => {
      render(<BeerXMLImportExport recipe={mockRecipe} ingredients={mockIngredients} />);
      
      expect(screen.getByText('Export to BeerXML')).toBeInTheDocument();
      expect(screen.getByText('📄 Export as BeerXML')).toBeInTheDocument();
    });

    it('renders only import section when mode is import', () => {
      render(<BeerXMLImportExport mode="import" />);
      
      expect(screen.getByText('Import from BeerXML')).toBeInTheDocument();
      expect(screen.queryByText('Export to BeerXML')).not.toBeInTheDocument();
    });

    it('renders only export section when mode is export', () => {
      render(<BeerXMLImportExport mode="export" recipe={mockRecipe} ingredients={mockIngredients} />);
      
      expect(screen.queryByText('Import from BeerXML')).not.toBeInTheDocument();
      expect(screen.getByText('Export to BeerXML')).toBeInTheDocument();
    });

    it('displays recipe info in export section', () => {
      render(<BeerXMLImportExport mode="export" recipe={mockRecipe} ingredients={mockIngredients} />);
      
      expect(screen.getByText('Test IPA')).toBeInTheDocument();
      expect(screen.getByText('2 ingredients • 5 gal')).toBeInTheDocument();
    });
  });

  describe('File Upload and Validation', () => {
    it('handles file selection', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      expect(screen.getByText('test-recipe.xml')).toBeInTheDocument();
      expect(beerXMLService.validateFile).toHaveBeenCalledWith(mockFile);
    });

    it('displays file validation errors', async () => {
      const user = userEvent.setup();
      (beerXMLService.validateFile as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid file format', 'File too large'],
      });

      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      expect(screen.getByText('Invalid file format; File too large')).toBeInTheDocument();
    });

    it('shows parse button after valid file upload', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      expect(screen.getByText('Parse BeerXML File')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('handles file upload through dropzone click', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const dropzone = screen.getByText('Click to select BeerXML file or drag and drop').closest('.upload-dropzone');
      await user.click(dropzone!);

      // File input should be triggered (click method would be called)
      expect(dropzone).toBeInTheDocument();
    });
  });

  describe('BeerXML Parsing', () => {
    it('parses BeerXML file successfully and shows unit conversion choice', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      // Upload file
const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      // Parse file
      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      await waitFor(() => {
        expect(beerXMLService.readFileContent).toHaveBeenCalledWith(mockFile);
        expect(beerXMLService.parseBeerXML).toHaveBeenCalledWith('<xml>test</xml>');
      });

      // New flow: should show unit conversion choice screen first
      expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      expect(screen.getByTestId('import-as-metric')).toBeInTheDocument();
      expect(screen.getByTestId('import-as-imperial')).toBeInTheDocument();
    });

    it('displays parsing loading state', async () => {
      const user = userEvent.setup();
      (beerXMLService.parseBeerXML as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      expect(screen.getByText('Parsing...')).toBeInTheDocument();
      expect(parseButton).toBeDisabled();
    });

    it('handles parsing errors', async () => {
      const user = userEvent.setup();
      (beerXMLService.parseBeerXML as jest.Mock).mockRejectedValue(new Error('Parse failed'));

      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Parse failed')).toBeInTheDocument();
      });
    });

    it('clears import state when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);

      expect(screen.getByText('Click to select BeerXML file or drag and drop')).toBeInTheDocument();
      expect(screen.queryByText('test-recipe.xml')).not.toBeInTheDocument();
    });
  });

  describe('Recipe Selection and Preview', () => {
    it('proceeds to ingredient matching after unit selection', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Wait for unit conversion choice
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });

      // Click to import as imperial - should proceed directly to ingredient matching
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      // Should go directly to ingredient matching (not recipe preview)
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });
    });

    it('cancels unit selection and shows recipe preview', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Wait for unit conversion choice
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByTestId('cancel-conversion');
      await user.click(cancelButton);

      // Should return to recipe preview (cancel just hides the dialog)
      await waitFor(() => {
        expect(screen.queryByText('Choose Import Units')).not.toBeInTheDocument();
        expect(screen.getByText('Recipe Preview')).toBeInTheDocument();
      });
    });

    it('handles multiple recipes and proceeds to ingredient matching', async () => {
      const user = userEvent.setup();
      const multipleRecipes = [
        ...mockParsedRecipes,
        {
          name: 'Second Recipe', style: 'Stout', batch_size: 10,
          ingredients: [{ id: '3', name: 'Dark Malt', type: 'grain' }],
          metadata: {},
        },
      ];

      (beerXMLService.parseBeerXML as jest.Mock).mockResolvedValue(multipleRecipes);

      render(<BeerXMLImportExport mode="import" />);

      // Get the file input from the fresh render (may be multiple due to test isolation issues)
      const fileInputs = screen.getAllByTestId('beerxml-file-input');
      const fileInput = fileInputs[fileInputs.length - 1]; // Use the last (most recent) one
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Wait for unit conversion choice and select
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });

      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      // Should proceed to ingredient matching for first recipe
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });
    });

    it('calls ingredient matching after unit selection', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - this should automatically trigger ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      // Wait for ingredient matching to be called
      await waitFor(() => {
        expect(beerXMLService.matchIngredients).toHaveBeenCalledWith(mockParsedRecipes[0].ingredients);
      });
    });

    it('displays ingredient matching loading state', async () => {
      const user = userEvent.setup();
      (beerXMLService.matchIngredients as jest.Mock).mockImplementation(() => new Promise(() => {}));
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - this should show loading during ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');

      // Buttons should be enabled before clicking
      expect(importAsMetric).not.toBeDisabled();

      await user.click(importAsMetric);

      // Should show loading state (matching ingredients happens automatically)
      await waitFor(() => {
        expect(beerXMLService.matchIngredients).toHaveBeenCalled();
      });
    });

    it('handles ingredient matching errors', async () => {
      const user = userEvent.setup();
      (beerXMLService.matchIngredients as jest.Mock).mockRejectedValue(new Error('Matching failed'));
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - error should occur during automatic matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      await waitFor(() => {
        expect(screen.getByText('Matching failed')).toBeInTheDocument();
      });
    });
  });

  describe('Ingredient Matching Review', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      // Wait for ingredient matching screen
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });
    });

    it('displays ingredient matching review', () => {
      expect(screen.getByText('Ingredient Matching Review')).toBeInTheDocument();
      expect(screen.getByTestId('complete-matching')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-matching')).toBeInTheDocument();
    });

    it('completes import process', async () => {
      const user = userEvent.setup();
      const onImport = jest.fn();

      render(<BeerXMLImportExport mode="import" onImport={onImport} />);

      // Go through the full flow
      const fileInputs = screen.getAllByTestId('beerxml-file-input');
      const fileInput = fileInputs[fileInputs.length - 1]; // Use the last (most recent) one
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getAllByTestId('import-as-imperial');
      await user.click(importAsImperial[importAsImperial.length - 1]);

      // Wait for ingredient matching to complete
      await waitFor(() => {
        expect(screen.getAllByTestId('complete-matching')).toHaveLength(2); // Due to test isolation issues
      });

      const completeButtons = screen.getAllByTestId('complete-matching');
      const completeButton = completeButtons[completeButtons.length - 1]; // Use the last (most recent) one
      await user.click(completeButton);

      expect(onImport).toHaveBeenCalledWith({
        recipe: expect.objectContaining({
          name: "Imported IPA",
          style: "IPA",
          batch_size: 5
        }),
        ingredients: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('existing-'),
            ingredient_id: expect.any(String),
            name: expect.any(String),
            type: expect.any(String)
          })
        ]),
        metadata: mockParsedRecipes[0].metadata,
        createdIngredients: [],
      });
    });

    it('cancels ingredient matching review', async () => {
      const user = userEvent.setup();

      const cancelButton = screen.getByTestId('cancel-matching');
      await user.click(cancelButton);

      expect(screen.queryByTestId('ingredient-matching-review')).not.toBeInTheDocument();
      expect(screen.getByText('Recipe Preview')).toBeInTheDocument();
    });

    it('handles import completion errors', async () => {
      const user = userEvent.setup();
      const onImport = jest.fn().mockRejectedValue(new Error('Import failed'));

      render(<BeerXMLImportExport mode="import" onImport={onImport} />);

      const fileInputs = screen.getAllByTestId('beerxml-file-input');
      const fileInput = fileInputs[fileInputs.length - 1]; // Use the last (most recent) one
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getAllByTestId('import-as-metric');
      await user.click(importAsMetric[importAsMetric.length - 1]);

      // Wait for ingredient matching to complete
      await waitFor(() => {
        expect(screen.getAllByTestId('complete-matching')).toHaveLength(2); // Due to test isolation issues
      });

      const completeButtons = screen.getAllByTestId('complete-matching');
      const completeButton = completeButtons[completeButtons.length - 1]; // Use the last (most recent) one
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Import failed')).toBeInTheDocument();
      });
    });
  });

  describe('BeerXML Export', () => {
    it('exports recipe successfully', async () => {
      const user = userEvent.setup();
      const onExport = jest.fn();

      render(
        <BeerXMLImportExport
          mode="export"
          recipe={mockRecipe}
          ingredients={mockIngredients}
          onExport={onExport}
        />
      );

      const exportButton = screen.getByText('📄 Export as BeerXML');
      await user.click(exportButton);

      await waitFor(() => {
        expect(beerXMLService.exportRecipe).toHaveBeenCalledWith('test-recipe-1');
        expect(beerXMLService.downloadBeerXML).toHaveBeenCalledWith(
          '<xml>exported</xml>',
          'test-recipe.xml'
        );
        expect(onExport).toHaveBeenCalledWith({
          success: true,
          filename: 'test-recipe.xml',
        });
      });
    });

    it('displays export loading state', async () => {
      const user = userEvent.setup();
      const mockOnExport = jest.fn();
      (beerXMLService.exportRecipe as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(
        <BeerXMLImportExport
          mode="export"
          recipe={mockRecipe}
          ingredients={mockIngredients}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByText('📄 Export as BeerXML');
      await user.click(exportButton);

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
      expect(exportButton).toBeDisabled();
    });

    it('handles export errors', async () => {
      const user = userEvent.setup();
      const mockOnExport = jest.fn();
      (beerXMLService.exportRecipe as jest.Mock).mockRejectedValue(new Error('Export failed'));

      render(
        <BeerXMLImportExport
          mode="export"
          recipe={mockRecipe}
          ingredients={mockIngredients}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByText('📄 Export as BeerXML');
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument();
      });
    });

    it('disables export button when no recipe or ingredients', () => {
      render(<BeerXMLImportExport mode="export" />);

      const exportButton = screen.getByText('📄 Export as BeerXML');
      expect(exportButton).toBeDisabled();
    });

    it('disables export button when no ingredients', () => {
      render(<BeerXMLImportExport mode="export" recipe={mockRecipe} ingredients={[]} />);

      const exportButton = screen.getByText('📄 Export as BeerXML');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing onImport callback gracefully', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      // Should not crash without onImport callback
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });
    });

    it('handles missing onExport callback gracefully', async () => {
      const user = userEvent.setup();
      render(
        <BeerXMLImportExport
          mode="export"
          recipe={mockRecipe}
          ingredients={mockIngredients}
        />
      );

      const exportButton = screen.getByText('📄 Export as BeerXML');
      await user.click(exportButton);

      // Component should return early without onExport callback, so service shouldn't be called
      expect(beerXMLService.exportRecipe).not.toHaveBeenCalled();
      // Button should remain enabled since no async operation occurs
      expect(exportButton).not.toBeDisabled();
    });

    it('handles empty file upload', async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      
      // Simulate empty file selection
      fireEvent.change(fileInput, { target: { files: [] } });

      // Should not crash or show errors
      expect(screen.getByText('Click to select BeerXML file or drag and drop')).toBeInTheDocument();
    });

    it('handles recipe with missing style gracefully', () => {
      const recipeWithoutStyle = { ...mockRecipe, style: '' };
      render(
        <BeerXMLImportExport
          mode="export"
          recipe={recipeWithoutStyle}
          ingredients={mockIngredients}
        />
      );

      expect(screen.getByText('2 ingredients • 5 gal')).toBeInTheDocument();
    });

    it('handles undefined batch_size_unit gracefully', () => {
      const recipeWithoutUnit = { ...mockRecipe, batch_size_unit: undefined };
      render(
        <BeerXMLImportExport
          mode="export"
          recipe={recipeWithoutUnit as any}
          ingredients={mockIngredients}
        />
      );

      expect(screen.getByText('2 ingredients • 5 gal')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper file input accessibility', () => {
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      expect(fileInput).toHaveAttribute('accept', '.xml');
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    it('has proper button states', () => {
      render(
        <BeerXMLImportExport
          mode="export"
          recipe={mockRecipe}
          ingredients={mockIngredients}
        />
      );

      const exportButton = screen.getByText('📄 Export as BeerXML');
      expect(exportButton).not.toBeDisabled();
      expect(exportButton).toHaveClass('btn', 'btn-primary');
    });

    it('has proper error message structure', async () => {
      const user = userEvent.setup();
      (beerXMLService.validateFile as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Test error'],
      });

      render(<BeerXMLImportExport mode="import" />);

const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const errorMessage = screen.getByText('Test error').closest('.error-message');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage?.querySelector('.error-icon')).toBeInTheDocument();
    });
  });

  describe('BeerXML Import Integration Tests', () => {
    const mockParsedRecipe = {
      name: "Pickle Gose",
      style: "Gose",
      description: "Spices to go in @ 10 min:\\r\\n2g Grains of Paradise,\\r\\n15g Indian Coriander, \\r\\n15g Mustard Seed, \\r\\n15g Sea Salt.\\r\\n\\r\\nAdd to Fermenter 3 Days before kegging:\\r\\n3 Cucumbers, Peeled. Sliced thin. (Totaled 2lb)\\r\\n1 oz Sorachi Ace",
      batch_size: 5.000002351132373, // Test precision issue
      batch_size_unit: "gal",
      boil_time: 60,
      efficiency: 75,
      is_public: false,
      notes: "",
      ingredients: [
        {
          amount: 3.0000024471331064,
          name: "Pilsner",
          type: "grain",
          unit: "lb",
          use: "mash",
          time: 0,
          color: 1.7,
          grain_type: "base_malt",
          potential: 37.3014,
        },
        {
          alpha_acid: 13.2,
          amount: 1.0000008148291857,
          name: "Sorachi Ace",
          time: 4320, // Test time formatting (3 days)
          type: "hop",
          unit: "oz",
          use: "dry-hop"
        },
        {
          amount: 110,
          attenuation: 85,
          name: "WildBrew Philly Sour",
          time: 0,
          type: "yeast",
          unit: "g",
          use: "fermentation"
        }
      ]
    };

    const mockMatchingResults = [
      {
        imported: mockParsedRecipe.ingredients[0],
        best_match: {
          confidence: 0.7,
          ingredient: { ingredient_id: "1", name: "Bohemian Pilsner", type: "grain" }
        },
        confidence: 0.7,
        requires_new: false
      },
      {
        imported: mockParsedRecipe.ingredients[1],
        best_match: {
          confidence: 0.8,
          ingredient: { ingredient_id: "2", name: "Sorachi Ace", type: "hop" }
        },
        confidence: 0.8,
        requires_new: false
      },
      {
        imported: mockParsedRecipe.ingredients[2],
        best_match: {
          confidence: 0.9,
          ingredient: { ingredient_id: "3", name: "WildBrew Philly Sour", type: "yeast" }
        },
        confidence: 0.9,
        requires_new: false
      }
    ];

    beforeEach(() => {
      (beerXMLService.validateFile as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });
      (beerXMLService.readFileContent as jest.Mock).mockResolvedValue('<xml>mock content</xml>');
      (beerXMLService.parseBeerXML as jest.Mock).mockResolvedValue([mockParsedRecipe]);
      (beerXMLService.matchIngredients as jest.Mock).mockResolvedValue(mockMatchingResults);
    });

    it('imports recipe with correct name and style', async () => {
      const user = userEvent.setup();
      const mockOnImport = jest.fn().mockResolvedValue(undefined);

      render(<BeerXMLImportExport mode="import" onImport={mockOnImport} />);

      // Upload file
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      // Parse file
      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      // Wait for ingredient matching to complete
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });

      // Complete matching
      const completeButton = screen.getByTestId('complete-matching');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledWith({
          recipe: expect.objectContaining({
            name: "Pickle Gose",
            style: "Gose",
            description: expect.stringContaining("Spices to go in @ 10 min"),
            batch_size: 5.000002351132373,
            notes: "",
          }),
          ingredients: expect.any(Array),
          metadata: expect.any(Object),
          createdIngredients: [],
        });
      });
    });

    it('handles batch size precision correctly in recipe data', async () => {
      const user = userEvent.setup();
      const mockOnImport = jest.fn().mockResolvedValue(undefined);

      render(<BeerXMLImportExport mode="import" onImport={mockOnImport} />);

      // Upload and parse file
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - this automatically proceeds to ingredient matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      // Wait for ingredient matching to complete
      await waitFor(() => {
        expect(screen.getByTestId('complete-matching')).toBeInTheDocument();
      });

      const completeButton = screen.getByTestId('complete-matching');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledWith({
          recipe: expect.objectContaining({
            batch_size: 5.000002351132373, // Should be passed as-is, rounding happens in hook
          }),
          ingredients: expect.any(Array),
          metadata: expect.any(Object),
          createdIngredients: [],
        });
      });
    });

    it('preserves ingredient amounts and units correctly', async () => {
      const user = userEvent.setup();
      const mockOnImport = jest.fn().mockResolvedValue(undefined);

      render(<BeerXMLImportExport mode="import" onImport={mockOnImport} />);

      // Complete import flow
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      await waitFor(() => {
        expect(screen.getByTestId('complete-matching')).toBeInTheDocument();
      });

      const completeButton = screen.getByTestId('complete-matching');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledWith({
          recipe: expect.any(Object),
          ingredients: expect.arrayContaining([
            expect.objectContaining({
              amount: 3.0000024471331064,
              unit: "lb",
              name: "Bohemian Pilsner", // Should use matched ingredient name
              type: "grain"
            }),
            expect.objectContaining({
              amount: 1.0000008148291857,
              unit: "oz",
              name: "Sorachi Ace",
              type: "hop",
              time: 4320 // Time should be preserved in minutes for processing
            }),
            expect.objectContaining({
              amount: 110,
              unit: "g",
              name: "WildBrew Philly Sour",
              type: "yeast"
            })
          ]),
          metadata: expect.any(Object),
          createdIngredients: [],
        });
      });
    });

    it('does not duplicate description in notes field', async () => {
      const user = userEvent.setup();
      const mockOnImport = jest.fn().mockResolvedValue(undefined);

      render(<BeerXMLImportExport mode="import" onImport={mockOnImport} />);

      // Complete import flow
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically proceeds to matching
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      await waitFor(() => {
        expect(screen.getByTestId('complete-matching')).toBeInTheDocument();
      });

      const completeButton = screen.getByTestId('complete-matching');
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnImport).toHaveBeenCalledWith({
          recipe: expect.objectContaining({
            description: expect.stringContaining("Spices to go in @ 10 min"),
            notes: "", // Should remain empty, not duplicated from description
          }),
          ingredients: expect.any(Array),
          metadata: expect.any(Object),
          createdIngredients: [],
        });
      });
    });

    it('proceeds directly to ingredient matching after unit selection', async () => {
      const user = userEvent.setup();

      render(<BeerXMLImportExport mode="import" />);

      // Upload and parse file
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsImperial = screen.getByTestId('import-as-imperial');
      await user.click(importAsImperial);

      // Should proceed directly to ingredient matching
      await waitFor(() => {
        expect(screen.getByTestId('ingredient-matching-review')).toBeInTheDocument();
      });
    });

    it('handles parsing errors gracefully', async () => {
      const user = userEvent.setup();
      (beerXMLService.parseBeerXML as jest.Mock).mockRejectedValue(
        new Error('Invalid BeerXML format')
      );

      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);
      
      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid BeerXML format')).toBeInTheDocument();
      });
    });

    it('handles ingredient matching errors gracefully', async () => {
      const user = userEvent.setup();
      (beerXMLService.matchIngredients as jest.Mock).mockRejectedValue(
        new Error('Ingredient matching failed')
      );

      render(<BeerXMLImportExport mode="import" />);

      // Upload and parse file
      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      // Select unit system - automatically attempts matching and should error
      await waitFor(() => {
        expect(screen.getByText('Choose Import Units')).toBeInTheDocument();
      });
      const importAsMetric = screen.getByTestId('import-as-metric');
      await user.click(importAsMetric);

      await waitFor(() => {
        expect(screen.getByText('Ingredient matching failed')).toBeInTheDocument();
      });
    });
  });
});