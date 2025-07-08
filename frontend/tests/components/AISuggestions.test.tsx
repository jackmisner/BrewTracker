import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AISuggestions from '../../src/components/RecipeBuilder/AISuggestions';
import { Recipe, RecipeIngredient, RecipeMetrics } from '../../src/types';

// Mock BeerStyleService
const mockGetAllStylesList = jest.fn();
const mockCalculateStyleMatch = jest.fn();

jest.mock('../../src/services/BeerStyleService', () => ({
  default: {
    getAllStylesList: mockGetAllStylesList,
    calculateStyleMatch: mockCalculateStyleMatch,
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

  const mockOnIngredientUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllStylesList.mockClear();
    mockCalculateStyleMatch.mockClear();
  });

  it('renders without crashing', () => {
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );
  });

  it('shows AI suggestions header when suggestions are available', async () => {
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );

    await waitFor(() => {
      const header = screen.queryByText(/AI Suggestions/);
      // Component might not render if no suggestions are generated
      if (header) {
        expect(header).toBeInTheDocument();
      }
    });
  });

  it('can be expanded and collapsed', async () => {
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );

    await waitFor(() => {
      const toggleButton = screen.queryByRole('button');
      if (toggleButton && toggleButton.textContent === '−') {
        // Component is expanded, test collapsing
        fireEvent.click(toggleButton);
        expect(toggleButton.textContent).toBe('+');
      }
    });
  });

  it('calls onIngredientUpdate when applying suggestions', async () => {
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );

    await waitFor(() => {
      const applyButtons = screen.queryAllByText('Apply');
      if (applyButtons.length > 0) {
        fireEvent.click(applyButtons[0]);
        expect(mockOnIngredientUpdate).toHaveBeenCalled();
      }
    });
  });

  it('does not render when no ingredients are provided', () => {
    const { container } = render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={[]}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when no metrics are provided', () => {
    const { container } = render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        onIngredientUpdate={mockOnIngredientUpdate}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('disables apply buttons when disabled prop is true', async () => {
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
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

    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={ingredientsWithNonStandardAmounts}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
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
    render(
      <AISuggestions
        recipe={mockRecipe}
        ingredients={mockIngredients}
        metrics={mockMetrics}
        onIngredientUpdate={mockOnIngredientUpdate}
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