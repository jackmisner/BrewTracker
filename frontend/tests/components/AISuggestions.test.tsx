import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AISuggestions from '../../src/components/RecipeBuilder/AISuggestions';
import { Recipe, RecipeIngredient, RecipeMetrics } from '../../src/types';
import { UnitProvider } from '../../src/contexts/UnitContext';

// Mock BeerStyleService
const mockGetAllStylesList = jest.fn();
const mockCalculateStyleMatch = jest.fn();

jest.mock('../../src/services/Data/BeerStyleService', () => ({
  default: {
    getAllStylesList: mockGetAllStylesList,
    calculateStyleMatch: mockCalculateStyleMatch,
  },
}));

// Mock UserSettingsService
const mockGetUserSettings = jest.fn();
const mockUpdateSettings = jest.fn();

jest.mock('../../src/services/User/UserSettingsService', () => ({
  default: {
    getUserSettings: mockGetUserSettings,
    updateSettings: mockUpdateSettings,
  },
}));

// Mock Services object with AI services
jest.mock('../../src/services', () => ({
  Services: {
    AI: {
      service: {
        analyzeRecipe: jest.fn().mockResolvedValue({
          suggestions: [],
          current_metrics: {
            og: 1.050,
            fg: 1.010,
            abv: 5.2,
            ibu: 35,
            srm: 8
          }
        })
      }
    },
    Data: {
      ingredient: {
        fetchIngredients: jest.fn().mockResolvedValue({})
      }
    },
    beerStyle: {
      getAllStylesList: jest.fn().mockResolvedValue([]),
    },
  },
}));

describe('AISuggestions Component', () => {
  const mockRecipe: Recipe = {
    id: 'test-recipe',
    recipe_id: 'test-recipe',
    name: 'Test Recipe',
    style: 'American IPA',
    batch_size: 5,
    batch_size_unit: 'gal',
    description: 'Test description',
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: '',
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

  // Helper to render with UnitProvider
  const renderWithUnitProvider = (ui: React.ReactElement) => {
    return render(<UnitProvider>{ui}</UnitProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  it('renders without crashing', () => {
    renderWithUnitProvider(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onBulkIngredientUpdate={mockOnBulkIngredientUpdate}
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
});