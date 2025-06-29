// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BeerXMLImportExport from '../../src/components/BeerXML/BeerXMLImportExport';
import beerXMLService from '../../src/services/BeerXML/BeerXMLService';

// Mock the BeerXML service
jest.mock('../../src/services/BeerXML/BeerXMLService', () => ({
  validateFile: jest.fn(),
  readFileContent: jest.fn(),
  parseBeerXML: jest.fn(),
  matchIngredients: jest.fn(),
  exportRecipe: jest.fn(),
  downloadBeerXML: jest.fn(),
}));

// Mock the IngredientMatchingReview component
jest.mock('../../src/components/BeerXML/IngredientMatchingReview', () => {
  return function MockIngredientMatchingReview({ onComplete, onCancel }: any) {
    return (
      <div data-testid="ingredient-matching-review">
        <h3>Ingredient Matching Review</h3>
        <button
          onClick={() => onComplete({ ingredients: [{ id: '1', name: 'Matched Ingredient' }], createdIngredients: [] })}
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
      recipe: {
        name: 'Imported IPA',
        style: 'IPA',
        batch_size: 5,
      },
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
    it('parses BeerXML file successfully', async () => {
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

      expect(screen.getByText('Found 1 recipe(s)')).toBeInTheDocument();
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
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<BeerXMLImportExport mode="import" />);

      const fileInput = screen.getByTestId('beerxml-file-input');
      await user.upload(fileInput, mockFile);

      const parseButton = screen.getByText('Parse BeerXML File');
      await user.click(parseButton);

      await waitFor(() => {
        expect(screen.getByText('Found 1 recipe(s)')).toBeInTheDocument();
      });
    });

    it('displays recipe preview', () => {
      expect(screen.getByText('Recipe Preview')).toBeInTheDocument();
      expect(screen.getByText('Imported IPA')).toBeInTheDocument();
      expect(screen.getByText('IPA')).toBeInTheDocument();
      expect(screen.getByText('5.0 gal')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // ingredient count
    });

    it('displays ingredient summary', () => {
      expect(screen.getByText('Ingredients')).toBeInTheDocument();
      expect(screen.getByText('1 grain')).toBeInTheDocument();
      expect(screen.getByText('1 hop')).toBeInTheDocument();
    });

    it('handles multiple recipes selection', async () => {
      const user = userEvent.setup();
      const multipleRecipes = [
        ...mockParsedRecipes,
        {
          recipe: { name: 'Second Recipe', style: 'Stout', batch_size: 10 },
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

      await waitFor(() => {
        expect(screen.getByText('Found 2 recipe(s)')).toBeInTheDocument();
      });

      expect(screen.getByText('Select recipe to import:')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Change selection
      await user.selectOptions(select, '1');
      expect(screen.getByText('Second Recipe')).toBeInTheDocument();
    });

    it('starts ingredient matching process', async () => {
      const user = userEvent.setup();

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

      expect(beerXMLService.matchIngredients).toHaveBeenCalledWith(mockParsedRecipes[0].ingredients);
    });

    it('displays ingredient matching loading state', async () => {
      const user = userEvent.setup();
      (beerXMLService.matchIngredients as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

      expect(screen.getByText('Matching Ingredients...')).toBeInTheDocument();
      expect(importButton).toBeDisabled();
    });

    it('handles ingredient matching errors', async () => {
      const user = userEvent.setup();
      (beerXMLService.matchIngredients as jest.Mock).mockRejectedValue(new Error('Matching failed'));

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

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

      await waitFor(() => {
        expect(screen.getByText('Found 1 recipe(s)')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

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

      await waitFor(() => {
        expect(screen.getByText('Import Recipe')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getAllByTestId('complete-matching')).toHaveLength(2); // Due to test isolation issues
      });

      const completeButtons = screen.getAllByTestId('complete-matching');
      const completeButton = completeButtons[completeButtons.length - 1]; // Use the last (most recent) one
      await user.click(completeButton);

      expect(onImport).toHaveBeenCalledWith({
        recipe: mockParsedRecipes[0].recipe,
        ingredients: [{ id: '1', name: 'Matched Ingredient' }],
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

      await waitFor(() => {
        expect(screen.getByText('Import Recipe')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

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

      await waitFor(() => {
        expect(screen.getByText('Import Recipe')).toBeInTheDocument();
      });

      const importButton = screen.getByText('Import Recipe');
      await user.click(importButton);

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
});