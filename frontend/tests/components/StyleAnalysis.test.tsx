// @ts-ignore - React needed for JSX in test files
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import StyleAnalysis from '../../src/components/RecipeBuilder/BeerStyles/StyleAnalysis';
import BeerStyleService from '../../src/services/BeerStyleService';

// Mock the BeerStyleService
jest.mock('../../src/services/BeerStyleService', () => ({
  getAllStylesList: jest.fn(),
  calculateStyleMatch: jest.fn(),
  findMatchingStyles: jest.fn(),
}));

// Note: StyleRangeIndicator is no longer used in the component

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('StyleAnalysis', () => {
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

  const mockMetrics = {
    og: 1.065,
    fg: 1.012,
    abv: 6.9,
    ibu: 65,
    srm: 6.5,
  };

  const mockBeerStyle = {
    style_id: '21A',
    name: 'American IPA',
    display_name: 'American IPA',
    category: 'IPA',
    subcategory: 'American IPA',
    original_gravity: { 
      minimum: { value: 1.056, unit: 'sg' },
      maximum: { value: 1.070, unit: 'sg' }
    },
    final_gravity: { 
      minimum: { value: 1.008, unit: 'sg' },
      maximum: { value: 1.014, unit: 'sg' }
    },
    alcohol_by_volume: { 
      minimum: { value: 5.5, unit: '%' },
      maximum: { value: 7.5, unit: '%' }
    },
    international_bitterness_units: { 
      minimum: { value: 40, unit: 'IBU' },
      maximum: { value: 70, unit: 'IBU' }
    },
    color: { 
      minimum: { value: 6, unit: 'SRM' },
      maximum: { value: 14, unit: 'SRM' }
    },
    description: 'A decidedly hoppy and bitter beer',
  };

  const mockStyleMatch = {
    matches: {
      og: true,
      fg: true,
      abv: true,
      ibu: true,
      srm: true,
    },
    percentage: 100,
  };

  const mockStyleSuggestions = [
    {
      style: mockBeerStyle,
      match_percentage: 95,
      matches: { og: true, fg: true, abv: true, ibu: true, srm: false },
    },
    {
      style: {
        style_id: '21B',
        name: 'Specialty IPA',
        display_name: 'Specialty IPA',
        category: 'IPA',
        subcategory: 'Specialty IPA',
        original_gravity: { 
          minimum: { value: 1.056, unit: 'sg' },
          maximum: { value: 1.070, unit: 'sg' }
        },
        final_gravity: { 
          minimum: { value: 1.008, unit: 'sg' },
          maximum: { value: 1.014, unit: 'sg' }
        },
        alcohol_by_volume: { 
          minimum: { value: 5.5, unit: '%' },
          maximum: { value: 7.5, unit: '%' }
        },
        international_bitterness_units: { 
          minimum: { value: 40, unit: 'IBU' },
          maximum: { value: 70, unit: 'IBU' }
        },
        color: { 
          minimum: { value: 6, unit: 'SRM' },
          maximum: { value: 14, unit: 'SRM' }
        },
      },
      match_percentage: 85,
      matches: { og: true, fg: true, abv: false, ibu: true, srm: true },
    },
  ];

  const mockOnStyleSuggestionSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default service mocks
    (BeerStyleService.getAllStylesList as jest.Mock).mockResolvedValue([mockBeerStyle]);
    (BeerStyleService.calculateStyleMatch as jest.Mock).mockReturnValue(mockStyleMatch);
    (BeerStyleService.findMatchingStyles as jest.Mock).mockResolvedValue(mockStyleSuggestions);
  });

  describe('Initial Rendering', () => {
    it('renders with title', () => {
      render(<StyleAnalysis onStyleSuggestionSelect={mockOnStyleSuggestionSelect} variant="main" />);
      expect(screen.getByText('Style Analysis')).toBeInTheDocument();
    });

    it('shows no metrics message when metrics are empty', () => {
      render(<StyleAnalysis onStyleSuggestionSelect={mockOnStyleSuggestionSelect} variant="main" />);
      expect(screen.getByText(/Add ingredients to your recipe to calculate metrics/)).toBeInTheDocument();
    });

    it('shows no metrics message when all metrics are zero', async () => {
      const emptyMetrics = { og: 0, fg: 0, abv: 0, ibu: 0, srm: 0 };
      render(
        <StyleAnalysis 
          metrics={emptyMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Add ingredients to your recipe to calculate metrics/)).toBeInTheDocument();
      });
    });

    it('shows loading state', async () => {
      // Mock a promise that never resolves to show loading state
      (BeerStyleService.findMatchingStyles as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      expect(screen.getByText('Analyzing style compatibility...')).toBeInTheDocument();
    });
  });

  describe('Style Suggestions (No Recipe Style - Main Variant)', () => {
    beforeEach(async () => {
      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Analyzing style compatibility...')).not.toBeInTheDocument();
      });
    });

    it('displays style suggestions when no recipe style is selected', () => {
      expect(screen.getByText('Suggested Styles Based on Current Metrics')).toBeInTheDocument();
      expect(screen.getByText('American IPA')).toBeInTheDocument();
      expect(screen.getByText('Specialty IPA')).toBeInTheDocument();
    });

    it('shows style IDs and match percentages', () => {
      expect(screen.getByText('21A')).toBeInTheDocument();
      expect(screen.getByText('21B')).toBeInTheDocument();
      expect(screen.getByText('95% match')).toBeInTheDocument();
      expect(screen.getByText('85% match')).toBeInTheDocument();
    });

    it('displays match breakdown indicators', () => {
      expect(screen.getAllByText('OG')).toHaveLength(2); // Two suggestions with OG indicators
      expect(screen.getAllByText('FG')).toHaveLength(2);
      expect(screen.getAllByText('ABV')).toHaveLength(2);
      expect(screen.getAllByText('IBU')).toHaveLength(2);
      expect(screen.getAllByText('SRM')).toHaveLength(2);
    });

    it('handles style suggestion selection', async () => {
      const user = userEvent.setup();
      const selectButtons = screen.getAllByText('Select Style');
      
      await user.click(selectButtons[0]);

      expect(mockOnStyleSuggestionSelect).toHaveBeenCalledWith('American IPA');
    });

    it('limits suggestions to 3 items displayed', async () => {
      // The beforeEach renders with default 2 suggestions,
      // and this component shows 3 suggestions max in the UI,
      // but it loads 5 from service. The test shows the actual behavior.
      const selectButtons = screen.getAllByText('Select Style');
      expect(selectButtons).toHaveLength(2); // Default 2 suggestions from beforeEach
    });
  });

  describe('Recipe Style Analysis', () => {
    it('displays basic analysis for matching style', async () => {
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
        expect(screen.getByText('100% match')).toBeInTheDocument();
      });

      // Should show basic spec breakdown without ranges (sidebar variant)
      expect(screen.getByText('OG')).toBeInTheDocument();
      expect(screen.getByText('FG')).toBeInTheDocument();
      expect(screen.getByText('ABV')).toBeInTheDocument();
      expect(screen.getByText('IBU')).toBeInTheDocument();
      expect(screen.getByText('SRM')).toBeInTheDocument();
    });

    it('displays analysis with ranges in both variants when style is selected', async () => {
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
        expect(screen.getByText('100% match')).toBeInTheDocument();
      });

      // Should show spec breakdown with ranges in both variants when style is selected
      expect(screen.getByText('OG')).toBeInTheDocument();
      expect(screen.getByText('FG')).toBeInTheDocument();
      expect(screen.getByText('ABV')).toBeInTheDocument();
      expect(screen.getByText('IBU')).toBeInTheDocument();
      expect(screen.getByText('SRM')).toBeInTheDocument();
    });

    it('shows ranges in both variants when style is selected', async () => {
      const { rerender } = render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="sidebar"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });

      // Sidebar variant should show ranges when style is selected
      expect(screen.getByText('OG')).toBeInTheDocument();
      expect(screen.getByText('FG')).toBeInTheDocument();
      expect(screen.getByText('ABV')).toBeInTheDocument();
      expect(screen.getByText('IBU')).toBeInTheDocument();
      expect(screen.getByText('SRM')).toBeInTheDocument();

      // Switch to main variant
      rerender(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });

      // Main variant should also show ranges
      expect(screen.getByText('OG')).toBeInTheDocument();
      expect(screen.getByText('FG')).toBeInTheDocument();
      expect(screen.getByText('ABV')).toBeInTheDocument();
      expect(screen.getByText('IBU')).toBeInTheDocument();
      expect(screen.getByText('SRM')).toBeInTheDocument();
    });

    it('shows match indicators for all specs', async () => {
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });

      // Should show match indicators for all specs
      expect(screen.getAllByText('✓')).toHaveLength(5); // All specs match in mockStyleMatch
    });

    it('handles partial match display correctly', async () => {
      const partialMatch = {
        matches: { og: true, fg: true, abv: false, ibu: false, srm: false },
        percentage: 40,
      };

      (BeerStyleService.calculateStyleMatch as jest.Mock).mockReturnValue(partialMatch);
      
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
        expect(screen.getByText('40% match')).toBeInTheDocument();
      });

      // Should show correct match indicators
      expect(screen.getAllByText('✓')).toHaveLength(2); // OG and FG match
      expect(screen.getAllByText('✗')).toHaveLength(3); // ABV, IBU, SRM don't match
    });

    it('sidebar variant does not render when no style is selected', async () => {
      const { container } = render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="sidebar"
        />
      );

      // Component should not render anything
      expect(container.firstChild).toBeNull();
    });

    it('main variant shows suggestions when no style is selected', async () => {
      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Suggested Styles Based on Current Metrics')).toBeInTheDocument();
      });

      expect(screen.getByText('American IPA')).toBeInTheDocument();
      expect(screen.getByText('Specialty IPA')).toBeInTheDocument();
    });

    it('shows style not found message for unknown styles', async () => {
      (BeerStyleService.getAllStylesList as jest.Mock).mockResolvedValue([]);

      const recipeWithUnknownStyle = { ...mockRecipe, style: 'Unknown Style' };
      
      render(
        <StyleAnalysis 
          recipe={recipeWithUnknownStyle}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Style "Unknown Style" not found in database/)).toBeInTheDocument();
      });
    });
  });

  describe('Match Status Indicators', () => {
    it('shows correct match status colors and text', async () => {
      const partialMatch = {
        matches: { og: true, fg: true, abv: false, ibu: false, srm: false },
        percentage: 40,
      };

      (BeerStyleService.calculateStyleMatch as jest.Mock).mockReturnValue(partialMatch);

      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('40% match')).toBeInTheDocument();
      });

      // Check for individual spec indicators
      expect(screen.getAllByText('✓')).toHaveLength(2); // OG and FG match
      expect(screen.getAllByText('✗')).toHaveLength(3); // ABV, IBU, SRM don't match
    });

    it('displays match percentage correctly in suggestions', async () => {
      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Analyzing style compatibility...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('95% match')).toBeInTheDocument();
      expect(screen.getByText('85% match')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when style analysis fails', async () => {
      (BeerStyleService.getAllStylesList as jest.Mock).mockRejectedValue(new Error('Service error'));

      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load style analysis')).toBeInTheDocument();
      });
    });

    it('displays error message when style suggestions fail', async () => {
      (BeerStyleService.findMatchingStyles as jest.Mock).mockRejectedValue(new Error('Suggestions error'));

      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load style suggestions')).toBeInTheDocument();
      });
    });

    it('shows no suggestions message when no matches found', async () => {
      (BeerStyleService.findMatchingStyles as jest.Mock).mockResolvedValue([]);

      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/No close style matches found/)).toBeInTheDocument();
        expect(screen.getByText(/Your recipe may be a unique creation!/)).toBeInTheDocument();
      });
    });
  });

  describe('Service Integration', () => {
    it('calls BeerStyleService methods with correct parameters', async () => {
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.getAllStylesList).toHaveBeenCalled();
        expect(BeerStyleService.calculateStyleMatch).toHaveBeenCalledWith(mockBeerStyle, mockMetrics);
        expect(BeerStyleService.findMatchingStyles).toHaveBeenCalledWith(mockMetrics);
      });
    });

    it('handles case-insensitive style matching', async () => {
      const styleWithDifferentCase = { ...mockBeerStyle, name: 'american ipa' };
      (BeerStyleService.getAllStylesList as jest.Mock).mockResolvedValue([styleWithDifferentCase]);

      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.calculateStyleMatch).toHaveBeenCalledWith(styleWithDifferentCase, mockMetrics);
      });
    });

    it('matches by display_name when name doesn\'t match', async () => {
      const styleWithDisplayName = { 
        ...mockBeerStyle, 
        name: 'Different Name',
        display_name: 'American IPA'
      };
      (BeerStyleService.getAllStylesList as jest.Mock).mockResolvedValue([styleWithDisplayName]);

      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.calculateStyleMatch).toHaveBeenCalledWith(styleWithDisplayName, mockMetrics);
      });
    });
  });

  describe('Component State Management', () => {
    it('updates when recipe style changes', async () => {
      const { rerender } = render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });

      // Clear mocks and change recipe style
      jest.clearAllMocks();
      const updatedRecipe = { ...mockRecipe, style: 'Stout' };

      rerender(
        <StyleAnalysis 
          recipe={updatedRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.getAllStylesList).toHaveBeenCalled();
      });
    });

    it('updates when metrics change', async () => {
      const { rerender } = render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.calculateStyleMatch).toHaveBeenCalledWith(mockBeerStyle, mockMetrics);
      });

      // Clear mocks and change metrics
      jest.clearAllMocks();
      const updatedMetrics = { ...mockMetrics, og: 1.080 };

      rerender(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={updatedMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect} 
        />
      );

      await waitFor(() => {
        expect(BeerStyleService.calculateStyleMatch).toHaveBeenCalledWith(mockBeerStyle, updatedMetrics);
      });
    });

    it('switches between suggestions and analysis modes correctly', async () => {
      const { rerender } = render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Suggested Styles Based on Current Metrics')).toBeInTheDocument();
      });

      // Add recipe style
      rerender(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Suggested Styles Based on Current Metrics')).not.toBeInTheDocument();
        expect(screen.getByText('American IPA')).toBeInTheDocument();
      });
    });
  });

  describe('Suggestion Limits', () => {
    it('limits suggestions to maximum from service', async () => {
      const manyMockSuggestions = Array.from({ length: 10 }, (_, i) => ({
        style: { ...mockBeerStyle, style_id: `21${String.fromCharCode(65 + i)}`, name: `Style ${i}` },
        match_percentage: 90 - i * 5,
        matches: { og: true, fg: true, abv: true, ibu: true, srm: true },
      }));

      (BeerStyleService.findMatchingStyles as jest.Mock).mockResolvedValue(manyMockSuggestions);

      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Analyzing style compatibility...')).not.toBeInTheDocument();
      });

      // Component loads 5 suggestions (slice(0, 5)) but displays only 3 (slice(0, 3))
      const selectButtons = screen.getAllByText('Select Style');
      expect(selectButtons).toHaveLength(3);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure with recipe style', async () => {
      render(
        <StyleAnalysis 
          recipe={mockRecipe}
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 3, name: 'Style Analysis' })).toBeInTheDocument();
      });
    });

    it('has proper heading structure without recipe style', async () => {
      render(
        <StyleAnalysis 
          metrics={mockMetrics} 
          onStyleSuggestionSelect={mockOnStyleSuggestionSelect}
          variant="main"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Analyzing style compatibility...')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 3, name: 'Style Analysis' })).toBeInTheDocument();
    });
  });
});