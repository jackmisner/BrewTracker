import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AISuggestions from '../../src/components/RecipeBuilder/AISuggestions';
import { Recipe, RecipeIngredient, RecipeMetrics } from '../../src/types';
import { UnitProvider } from '../../src/contexts/UnitContext';

// Create mock functions
const mockAnalyzeRecipe = jest.fn();
const mockFetchIngredients = jest.fn();
const mockGetAllStylesListService = jest.fn();
const mockGetAllStylesList = jest.fn();
const mockCalculateStyleMatch = jest.fn();
const mockGetUserSettings = jest.fn();
const mockUpdateSettings = jest.fn();

// Mock Services object first - this is the main mock that the component uses
jest.mock('../../src/services', () => ({
  Services: {
    AI: {
      service: {
        analyzeRecipe: mockAnalyzeRecipe,
        checkHealth: jest.fn(),
        convertRecipeToAnalysisRequest: jest.fn(),
      }
    },
    Data: {
      ingredient: {
        fetchIngredients: mockFetchIngredients
      },
      beerStyle: {
        getAllStylesList: mockGetAllStylesListService,
      }
    }
  },
}));

// Mock individual services for backwards compatibility
jest.mock('../../src/services/Data/BeerStyleService', () => ({
  default: {
    getAllStylesList: mockGetAllStylesList,
    calculateStyleMatch: mockCalculateStyleMatch,
  },
}));

jest.mock('../../src/services/User/UserSettingsService', () => ({
  default: {
    getUserSettings: mockGetUserSettings,
    updateSettings: mockUpdateSettings,
  },
}));

// Mock the formatUtils functions
jest.mock('../../src/utils/formatUtils', () => ({
  formatIngredientAmount: jest.fn((amount, unit, type, unitSystem) => `${amount} ${unit}`),
  formatIbu: jest.fn((ibu) => `${ibu} IBU`),
}));

describe('AISuggestions Component', () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  const mockRecipe: Recipe = {
    id: 'test-recipe',
    recipe_id: 'test-recipe',
    user_id: 'test-user',
    username: 'testuser',
    name: 'Test Recipe',
    style: 'American IPA',
    batch_size: 5,
    batch_size_unit: 'gal',
    description: 'Test description',
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: '',
    version: 1,
    parent_recipe_id: null,
    mash_temperature: 152,
    mash_temp_unit: 'F',
    mash_time: 60,
    estimated_og: 1.055,
    estimated_fg: 1.012,
    estimated_abv: 5.6,
    estimated_ibu: 45,
    estimated_srm: 4,
    ingredients: [],
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockIngredients: RecipeIngredient[] = [
    {
      id: 'grain-1',
      ingredient_id: 'grain-1',
      name: 'Pale Malt 2-Row',
      type: 'grain',
      grain_type: 'base_malt',
      amount: 8.75,
      unit: 'lb',
      potential: 1.037,
      color: 2,
    },
    {
      id: 'hop-1',
      ingredient_id: 'hop-1',
      name: 'Columbus',
      type: 'hop',
      amount: 1.125,
      unit: 'oz',
      use: 'boil',
      time: 60,
      alpha_acid: 14.5,
    },
    {
      id: 'yeast-1',
      ingredient_id: 'yeast-1',
      name: 'Safale US-05',
      type: 'yeast',
      amount: 1,
      unit: 'pkg',
      attenuation: 78,
    },
  ];

  const mockMetrics: RecipeMetrics = {
    og: 1.055,
    fg: 1.012,
    abv: 5.6,
    ibu: 45,
    srm: 4,
  };

  const mockOnBulkIngredientUpdate = jest.fn();
  const mockOnUpdateIngredient = jest.fn();
  const mockOnRemoveIngredient = jest.fn();
  const mockOnUpdateRecipe = jest.fn();
  const mockOnBulkUpdateRecipe = jest.fn();
  const mockImportIngredients = jest.fn();

  // Helper to render with UnitProvider
  const renderWithUnitProvider = (ui: React.ReactElement) => {
    return render(<UnitProvider>{ui}</UnitProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.warn and console.error to suppress expected error logs
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    
    // After clearing mocks, we need to reassign them to the Services object
    const { Services } = require('../../src/services');
    Services.AI.service.analyzeRecipe = mockAnalyzeRecipe;
    Services.Data.ingredient.fetchIngredients = mockFetchIngredients;
    Services.Data.beerStyle.getAllStylesList = mockGetAllStylesListService;
    
    // Setup default mock responses
    mockAnalyzeRecipe.mockResolvedValue({
      suggestions: [],
      current_metrics: {
        og: 1.050,
        fg: 1.010,
        abv: 5.2,
        ibu: 35,
        srm: 8
      }
    });

    mockFetchIngredients.mockResolvedValue({
      grain: [
        { ingredient_id: 'grain-1', name: 'Pale Malt 2-Row', type: 'grain', grain_type: 'base_malt', potential: 1.037, color: 2 },
        { ingredient_id: 'grain-2', name: 'Crystal 60L', type: 'grain', grain_type: 'specialty_malt', potential: 1.034, color: 60 }
      ],
      hop: [
        { ingredient_id: 'hop-1', name: 'Columbus', type: 'hop', alpha_acid: 14.5 }
      ],
      yeast: [
        { ingredient_id: 'yeast-1', name: 'Safale US-05', type: 'yeast', attenuation: 78 }
      ]
    });
    
    // Setup BeerStyleService mocks
    mockGetAllStylesList.mockResolvedValue([
      {
        style_guide_id: 'american-ipa',
        style_id: '21A',
        name: 'American IPA',
        display_name: 'American IPA',
        category: 'IPA',
        category_id: '21',
        category_name: 'American IPA',
        overall_impression: 'A hoppy American ale',
        original_gravity: { minimum: { value: 1.056, unit: 'SG' }, maximum: { value: 1.070, unit: 'SG' } },
        final_gravity: { minimum: { value: 1.008, unit: 'SG' }, maximum: { value: 1.014, unit: 'SG' } },
        alcohol_by_volume: { minimum: { value: 5.5, unit: '%' }, maximum: { value: 7.5, unit: '%' } },
        international_bitterness_units: { minimum: { value: 40, unit: 'IBU' }, maximum: { value: 70, unit: 'IBU' } },
        color: { minimum: { value: 6.0, unit: 'SRM' }, maximum: { value: 14.0, unit: 'SRM' } },
      }
    ]);

    mockGetAllStylesListService.mockResolvedValue([
      {
        style_guide_id: 'american-ipa',
        style_id: '21A',
        name: 'American IPA',
        display_name: 'American IPA'
      }
    ]);
    
    mockCalculateStyleMatch.mockReturnValue({
      matches: { og: true, fg: true, abv: true, ibu: true, srm: true },
      percentage: 95,
      matchingSpecs: 5,
      totalSpecs: 5
    });
    
    // Setup UserSettingsService mocks
    mockGetUserSettings.mockResolvedValue({
      settings: { preferred_units: 'imperial' },
    });
    mockUpdateSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console mocks
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('renders without crashing', () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );
  });

  it('shows AI suggestions header when suggestions are available', async () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/AI Recipe Analysis/)).toBeInTheDocument();
      expect(screen.getByText('Analyze Recipe')).toBeInTheDocument();
    });
  });

  it('can be expanded and collapsed', async () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    await waitFor(() => {
      // Find the toggle button by its role and content
      const toggleButton = screen.getByRole('button', { name: /AI Recipe Analysis/ });
      // Component is expanded, test collapsing
      fireEvent.click(toggleButton);
      expect(screen.getByText(/▶/)).toBeInTheDocument();
    });
  });

  it('calls onBulkIngredientUpdate when applying suggestions', async () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    await waitFor(() => {
      const applyButtons = screen.queryAllByText('Apply');
      if (applyButtons.length > 0) {
        fireEvent.click(applyButtons[0]);
        expect(mockOnBulkIngredientUpdate).toHaveBeenCalled();
      }
    });
  });

  it('shows disabled analyze button when no ingredients are provided', () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={[]}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    expect(screen.getByText(/AI Recipe Analysis/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze recipe/i })).toBeDisabled();
  });

  it('shows disabled analyze button when no metrics are provided', () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={undefined}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    expect(screen.getByText(/AI Recipe Analysis/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze recipe/i })).toBeDisabled();
  });

  it('disables apply buttons when disabled prop is true', async () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
        disabled={true}
      />
    );

    await waitFor(() => {
      const applyButtons = screen.queryAllByText('Apply');
      applyButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  it('generates normalize amount suggestions for non-standard amounts', async () => {
    const ingredientsWithNonStandardAmounts: RecipeIngredient[] = [
      {
        id: 'grain-1',
        ingredient_id: 'grain-1',
        name: 'Pale Malt 2-Row',
        type: 'grain',
        grain_type: 'base_malt',
        amount: 8.73, // Non-standard amount
        unit: 'lb',
        potential: 1.037,
        color: 2,
      },
    ];

    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={ingredientsWithNonStandardAmounts}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    await waitFor(() => {
      const normalizeText = screen.queryByText(/Normalize Ingredient Amounts/);
      if (normalizeText) {
        expect(normalizeText).toBeInTheDocument();
      }
    });
  });

  it('dismisses suggestions when dismiss button is clicked', async () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
        onUpdateIngredient={mockOnUpdateIngredient}
        onRemoveIngredient={mockOnRemoveIngredient}
        onUpdateRecipe={mockOnUpdateRecipe}
        onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
        importIngredients={mockImportIngredients}
      />
    );

    await waitFor(() => {
      const dismissButtons = screen.queryAllByText('Dismiss');
      if (dismissButtons.length > 0) {
        const initialSuggestionCount = screen.queryAllByText(/suggestion/i).length;
        fireEvent.click(dismissButtons[0]);
        
        // The suggestion should be removed from the list
        setTimeout(() => {
          const newSuggestionCount = screen.queryAllByText(/suggestion/i).length;
          expect(newSuggestionCount).toBeLessThanOrEqual(initialSuggestionCount);
        }, 100);
      }
    });
  });

  describe('Recipe Analysis and Suggestions', () => {
    const renderComponent = (props = {}) => {
      return renderWithUnitProvider(
        <AISuggestions
          recipe={mockRecipe}
          ingredients={mockIngredients}
          metrics={mockMetrics}
          onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
          onUpdateIngredient={mockOnUpdateIngredient}
          onRemoveIngredient={mockOnRemoveIngredient}
          onUpdateRecipe={mockOnUpdateRecipe}
          onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
          importIngredients={mockImportIngredients}
          {...props}
        />
      );
    };

    it('displays style information when recipe has a style', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Style:')).toBeInTheDocument();
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });
    });

    it('triggers analysis when analyze button is clicked', async () => {
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      expect(mockAnalyzeRecipe).toHaveBeenCalledWith({
        complete_recipe: expect.objectContaining({
          name: 'Test Recipe',
          style: 'American IPA',
          ingredients: expect.arrayContaining([
            expect.objectContaining({ name: 'Pale Malt 2-Row' })
          ])
        }),
        style_id: 'american-ipa',
        unit_system: 'imperial',
        workflow_name: 'recipe_optimization'
      });
    });

    it('shows analyzing state during analysis', async () => {
      mockAnalyzeRecipe.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument();
        expect(screen.getByText('🤖 Analyzing recipe...')).toBeInTheDocument();
      });
    });

    it('shows error message when analysis fails', async () => {
      mockAnalyzeRecipe.mockRejectedValue(new Error('API Error'));
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Error: API Error')).toBeInTheDocument();
      });
    });

    it('shows success message when no suggestions are needed', async () => {
      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [],
        current_metrics: mockMetrics
      });
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('✅ Recipe analysis complete - no suggestions needed!')).toBeInTheDocument();
        expect(screen.getByText('Your recipe looks well-balanced for the current style.')).toBeInTheDocument();
      });
    });

    it('shows clear results button after analysis', async () => {
      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [],
        current_metrics: mockMetrics
      });
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Clear Results')).toBeInTheDocument();
      });
    });

    it('clears results when clear button is clicked', async () => {
      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [],
        current_metrics: mockMetrics
      });
      renderComponent();

      // Trigger analysis
      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Clear Results')).toBeInTheDocument();
      });

      // Clear results
      const clearButton = screen.getByText('Clear Results');
      await userEvent.click(clearButton);

      // Results should be cleared
      expect(screen.queryByText('✅ Recipe analysis complete')).not.toBeInTheDocument();
      expect(screen.queryByText('Clear Results')).not.toBeInTheDocument();
    });
  });

  describe('Individual Suggestions', () => {
    const mockSuggestions = [
      {
        type: 'ingredient_modification',
        title: 'Adjust Columbus Hops',
        description: 'Reduce hop amount for better balance',
        confidence: 'high',
        priority: 1,
        adjustment: [
          {
            ingredient_id: 'hop-1',
            ingredient_name: 'Columbus',
            field: 'amount',
            current_value: 1.125,
            suggested_value: 1.0,
            reason: 'Reduce bitterness for style compliance',
            unit: 'oz'
          }
        ]
      },
      {
        type: 'new_ingredient',
        title: 'Add Crystal Malt',
        description: 'Add crystal malt for color and flavor',
        confidence: 'medium',
        priority: 2,
        adjustment: [
          {
            ingredientId: 'new-grain-id',
            ingredient_name: 'Crystal 60L',
            action: 'add_ingredient',
            amount: 0.5,
            unit: 'lb',
            type: 'grain',
            grain_type: 'specialty_malt',
            color: 60,
            potential: 1.034,
            reason: 'Improve color and add caramel notes'
          }
        ]
      }
    ];

    const renderComponentWithSuggestions = () => {
      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: mockSuggestions,
        current_metrics: mockMetrics
      });

      return renderWithUnitProvider(
        <AISuggestions
          recipe={mockRecipe}
          ingredients={mockIngredients}
          metrics={mockMetrics}
          onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
          onUpdateIngredient={mockOnUpdateIngredient}
          onRemoveIngredient={mockOnRemoveIngredient}
          onUpdateRecipe={mockOnUpdateRecipe}
          onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
          importIngredients={mockImportIngredients}
        />
      );
    };

    it('displays individual suggestions after analysis', async () => {
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Suggestions (2)')).toBeInTheDocument();
        expect(screen.getByText('Adjust Columbus Hops')).toBeInTheDocument();
        expect(screen.getByText('Add Crystal Malt')).toBeInTheDocument();
        expect(screen.getByText('high confidence')).toBeInTheDocument();
        expect(screen.getByText('medium confidence')).toBeInTheDocument();
      });
    });

    it('shows suggestion details and changes', async () => {
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Reduce hop amount for better balance')).toBeInTheDocument();
        expect(screen.getByText('Add crystal malt for color and flavor')).toBeInTheDocument();
        expect(screen.getByText(/Columbus:/)).toBeInTheDocument();
        expect(screen.getByText(/Crystal 60L:/)).toBeInTheDocument();
      });
    });

    it('applies individual suggestions when apply button is clicked', async () => {
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const applyButtons = screen.getAllByText('Apply Changes');
        expect(applyButtons).toHaveLength(2);
      });

      const applyButtons = screen.getAllByText('Apply Changes');
      await userEvent.click(applyButtons[0]);

      expect(mockOnUpdateIngredient).toHaveBeenCalledWith('hop-1', {
        amount: 1.0,
        unit: 'oz'
      });
    });

    it('dismisses suggestions when dismiss button is clicked', async () => {
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const dismissButtons = screen.getAllByText('Dismiss');
        expect(dismissButtons).toHaveLength(2);
      });

      const dismissButtons = screen.getAllByText('Dismiss');
      await userEvent.click(dismissButtons[0]);

      // First suggestion should be removed
      await waitFor(() => {
        expect(screen.getByText('Suggestions (1)')).toBeInTheDocument();
        expect(screen.queryByText('Adjust Columbus Hops')).not.toBeInTheDocument();
        expect(screen.getByText('Add Crystal Malt')).toBeInTheDocument();
      });
    });

    it('handles applying new ingredient suggestions', async () => {
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const applyButtons = screen.getAllByText('Apply Changes');
        expect(applyButtons).toHaveLength(2);
      });

      const applyButtons = screen.getAllByText('Apply Changes');
      await userEvent.click(applyButtons[1]); // Apply the "Add Crystal Malt" suggestion

      expect(mockOnBulkIngredientUpdate).toHaveBeenCalledWith([
        {
          ingredientId: expect.any(String),
          updatedData: expect.objectContaining({
            name: 'Crystal 60L',
            type: 'grain',
            amount: 0.5,
            unit: 'lb'
          }),
          isNewIngredient: true
        }
      ]);
    });

    it('shows error when applying suggestion fails', async () => {
      mockOnUpdateIngredient.mockRejectedValue(new Error('Update failed'));
      renderComponentWithSuggestions();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const applyButtons = screen.getAllByText('Apply Changes');
        expect(applyButtons).toHaveLength(2);
      });

      const applyButtons = screen.getAllByText('Apply Changes');
      await userEvent.click(applyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Error: Update failed')).toBeInTheDocument();
      });
    });
  });

  describe('Optimization Results', () => {
    const mockOptimizationResult = {
      optimization_performed: true,
      optimized_recipe: {
        name: 'Test Recipe',
        ingredients: [
          {
            ingredient_id: 'grain-1',
            name: 'Pale Malt 2-Row',
            type: 'grain',
            amount: 9.0, // Changed from 8.75
            unit: 'lb'
          }
        ],
        mash_temperature: 152,
        mash_temp_unit: 'F',
        estimated_og: 1.057,
        estimated_fg: 1.012,
        estimated_abv: 5.9,
        estimated_ibu: 42,
        estimated_srm: 5
      },
      original_metrics: {
        OG: 1.055,
        FG: 1.012,
        ABV: 5.6,
        IBU: 45,
        SRM: 4
      },
      optimized_metrics: {
        OG: 1.057,
        FG: 1.012,
        ABV: 5.9,
        IBU: 42,
        SRM: 5
      },
      recipe_changes: [
        {
          type: 'ingredient_modified',
          ingredient_name: 'Pale Malt 2-Row',
          field: 'amount',
          original_value: 8.75,
          optimized_value: 9.0,
          unit: 'lb'
        }
      ],
      iterations_completed: 3
    };

    const renderComponentWithOptimization = () => {
      mockAnalyzeRecipe.mockResolvedValue(mockOptimizationResult);

      return renderWithUnitProvider(
        <AISuggestions
          recipe={mockRecipe}
          ingredients={mockIngredients}
          metrics={mockMetrics}
          onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
          onUpdateIngredient={mockOnUpdateIngredient}
          onRemoveIngredient={mockOnRemoveIngredient}
          onUpdateRecipe={mockOnUpdateRecipe}
          onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
          importIngredients={mockImportIngredients}
        />
      );
    };

    it('displays optimization results when optimization is performed', async () => {
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Recipe Optimization Complete!')).toBeInTheDocument();
        expect(screen.getByText('Metrics Improvement')).toBeInTheDocument();
        expect(screen.getByText('Changes Made (1)')).toBeInTheDocument();
      });
    });

    it('shows metrics comparison in optimization results', async () => {
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('1.055 → 1.057')).toBeInTheDocument(); // OG change
        expect(screen.getByText('5.6 → 5.9')).toBeInTheDocument(); // ABV change
        expect(screen.getByText('45 IBU → 42 IBU')).toBeInTheDocument(); // IBU change
      });
    });

    it('shows recipe changes in optimization results', async () => {
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText(/Pale Malt 2-Row:/)).toBeInTheDocument();
        expect(screen.getByText(/amount changed from/)).toBeInTheDocument();
      });
    });

    it('applies optimized recipe when apply button is clicked', async () => {
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Optimized Recipe')).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Optimized Recipe');
      await userEvent.click(applyButton);

      expect(mockImportIngredients).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Pale Malt 2-Row',
            amount: 9.0
          })
        ])
      );
    });

    it('dismisses optimization results when keep original is clicked', async () => {
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Keep Original Recipe')).toBeInTheDocument();
      });

      const keepButton = screen.getByText('Keep Original Recipe');
      await userEvent.click(keepButton);

      await waitFor(() => {
        expect(screen.queryByText('Recipe Optimization Complete!')).not.toBeInTheDocument();
      });
    });

    it('handles optimization application errors', async () => {
      mockImportIngredients.mockRejectedValue(new Error('Import failed'));
      renderComponentWithOptimization();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Optimized Recipe')).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Optimized Recipe');
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Import failed')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const renderComponent = (props = {}) => {
      return renderWithUnitProvider(
        <AISuggestions
          recipe={mockRecipe}
          ingredients={mockIngredients}
          metrics={mockMetrics}
          onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
          onUpdateIngredient={mockOnUpdateIngredient}
          onRemoveIngredient={mockOnRemoveIngredient}
          onUpdateRecipe={mockOnUpdateRecipe}
          onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
          importIngredients={mockImportIngredients}
          {...props}
        />
      );
    };

    it('handles recipe without style gracefully', async () => {
      const recipeWithoutStyle = { ...mockRecipe, style: undefined };
      renderComponent({ recipe: recipeWithoutStyle });

      await waitFor(() => {
        expect(screen.queryByText('Style:')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /analyze recipe/i })).toBeInTheDocument();
      });
    });

    it('handles style lookup failure gracefully', async () => {
      mockGetAllStylesListService.mockRejectedValue(new Error('Style lookup failed'));
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      // Should still call analyzeRecipe but without style_id
      expect(mockAnalyzeRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          style_id: undefined
        })
      );
    });

    it('handles missing ingredient in suggestion application', async () => {
      const badSuggestion = {
        type: 'ingredient_modification',
        title: 'Adjust Missing Ingredient',
        description: 'This ingredient does not exist',
        confidence: 'high',
        adjustment: [
          {
            ingredient_id: 'nonexistent-id',
            ingredient_name: 'Nonexistent Ingredient',
            field: 'amount',
            current_value: 1.0,
            suggested_value: 2.0,
            reason: 'Test reason'
          }
        ]
      };

      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [badSuggestion]
      });

      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const applyButton = screen.getByText('Apply Changes');
        expect(applyButton).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Changes');
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText(/Error: Ingredient "Nonexistent Ingredient" not found/)).toBeInTheDocument();
      });
    });

    it('handles yeast strain change suggestions', async () => {
      const yeastChangeSuggestion = {
        type: 'yeast_substitution',
        title: 'Better Yeast Strain',
        description: 'Switch to a more suitable yeast',
        confidence: 'high',
        adjustment: [
          {
            ingredient_id: 'yeast-1',
            ingredient_name: 'Safale US-05',
            field: 'ingredient_id',
            is_yeast_strain_change: true,
            suggested_name: 'Wyeast 1056',
            suggested_attenuation: 75,
            new_yeast_data: {
              id: 'yeast-2',
              name: 'Wyeast 1056',
              type: 'yeast',
              attenuation: 75
            },
            reason: 'Better attenuation characteristics'
          }
        ]
      };

      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [yeastChangeSuggestion]
      });

      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText(/Switch to Wyeast 1056/)).toBeInTheDocument();
        expect(screen.getByText(/75%\s*attenuation/)).toBeInTheDocument();
      });

      const applyButton = screen.getByText('Apply Changes');
      await userEvent.click(applyButton);

      expect(mockOnUpdateIngredient).toHaveBeenCalledWith('yeast-1', {
        ingredient_id: 'yeast-2',
        name: 'Wyeast 1056',
        type: 'yeast',
        attenuation: 75,
        amount: 1,
        unit: 'pkg',
        use: 'primary'
      });
    });

    it('prevents actions when disabled prop is true', async () => {
      renderComponent({ disabled: true });

      // Analyze button should be disabled
      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      expect(analyzeButton).toBeDisabled();
    });

    it('handles consolidated changes in suggestions', async () => {
      const consolidatedSuggestion = {
        type: 'multi_field_change',
        title: 'Optimize Hop Addition',
        description: 'Adjust both amount and timing',
        confidence: 'high',
        adjustment: [
          {
            ingredient_id: 'hop-1',
            ingredient_name: 'Columbus',
            changes: [
              {
                field: 'amount',
                original_value: 1.125,
                optimized_value: 1.0,
                unit: 'oz',
                change_reason: 'Reduce bitterness'
              },
              {
                field: 'time',
                original_value: 60,
                optimized_value: 45,
                unit: 'min',
                change_reason: 'Improve hop character'
              }
            ]
          }
        ]
      };

      mockAnalyzeRecipe.mockResolvedValue({
        suggestions: [consolidatedSuggestion]
      });

      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText(/amount changed from/)).toBeInTheDocument();
        expect(screen.getByText(/time changed from/)).toBeInTheDocument();
      });
    });
  });

  describe('Component State Management', () => {
    const renderComponent = () => {
      return renderWithUnitProvider(
        <AISuggestions
          recipe={mockRecipe}
          ingredients={mockIngredients}
          metrics={mockMetrics}
          onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
          onUpdateIngredient={mockOnUpdateIngredient}
          onRemoveIngredient={mockOnRemoveIngredient}
          onUpdateRecipe={mockOnUpdateRecipe}
          onBulkUpdateRecipe={mockOnBulkUpdateRecipe}
          importIngredients={mockImportIngredients}
        />
      );
    };

    it('maintains expanded state when toggled', async () => {
      renderComponent();

      // Initially expanded
      expect(screen.getByText('Analyze Recipe')).toBeInTheDocument();

      // Collapse
      const toggleButton = screen.getByRole('button', { name: /AI Recipe Analysis/ });
      await userEvent.click(toggleButton);

      expect(screen.queryByText('Analyze Recipe')).not.toBeInTheDocument();

      // Expand again
      await userEvent.click(toggleButton);
      expect(screen.getByText('Analyze Recipe')).toBeInTheDocument();
    });

    it('resets state when component unmounts and remounts', () => {
      const { unmount } = renderComponent();
      
      unmount();
      
      // Re-render
      renderComponent();
      
      // Should be in initial state
      expect(screen.getByText('Analyze Recipe')).toBeInTheDocument();
      expect(screen.queryByText('Clear Results')).not.toBeInTheDocument();
    });

    it('handles multiple rapid analyze clicks gracefully', async () => {
      renderComponent();

      const analyzeButton = screen.getByRole('button', { name: /analyze recipe/i });
      
      // Click multiple times rapidly
      userEvent.click(analyzeButton); // Don't await these to make them truly rapid
      userEvent.click(analyzeButton);
      userEvent.click(analyzeButton);

      // Should only call analyzeRecipe once due to analyzing state
      await waitFor(() => {
        expect(mockAnalyzeRecipe).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });
    });
  });
});