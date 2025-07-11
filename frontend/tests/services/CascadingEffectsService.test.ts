import CascadingEffectsService from '../../src/services/CascadingEffectsService';
import { RecipeIngredient, RecipeMetrics } from '../../src/types';

// Mock the Services dependency
jest.mock('../../src/services/index', () => ({
  Services: {
    metrics: {
      calculateMetrics: jest.fn()
    }
  }
}));

describe('CascadingEffectsService', () => {
  let service: CascadingEffectsService;

  const mockRecipe = {
    batch_size: 5,
    batch_size_unit: 'gal' as const,
    efficiency: 75,
    boil_time: 60,
  };

  const mockCurrentMetrics: RecipeMetrics = {
    og: 1.055,
    fg: 1.014,
    abv: 5.4,
    ibu: 35,
    srm: 4.2,
  };

  const mockNewMetrics: RecipeMetrics = {
    og: 1.065,
    fg: 1.016,
    abv: 6.4,
    ibu: 35,
    srm: 5.2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CascadingEffectsService();
    
    // Mock Services.metrics.calculateMetrics to return predictable results
    const { Services } = require('../../src/services/index');
    Services.metrics.calculateMetrics.mockResolvedValue(mockNewMetrics);
  });

  describe('calculateCascadingEffects', () => {
    it('should create a service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CascadingEffectsService);
    });

    it('should handle basic ingredient changes', async () => {
      const ingredientChanges = [
        {
          ingredientId: 'grain-1',
          ingredientName: 'Pale Malt 2-Row',
          field: 'amount',
          currentValue: 10,
          suggestedValue: 12
        }
      ];

      const mockIngredients: RecipeIngredient[] = [
        {
          id: 'grain-1',
          ingredient_id: 'grain-1',
          name: 'Pale Malt 2-Row',
          type: 'grain',
          grain_type: 'base_malt',
          amount: 10,
          unit: 'lb',
          potential: 1.037,
          color: 2,
        }
      ];

      const effects = await service.calculateCascadingEffects(
        mockRecipe,
        mockIngredients,
        ingredientChanges,
        mockCurrentMetrics
      );

      expect(effects).toBeDefined();
      expect(effects.impacts).toBeDefined();
      expect(effects.impacts.og).toBeDefined();
      expect(effects.impacts.abv).toBeDefined();
    });

    it('should handle empty ingredient changes', async () => {
      const mockIngredients: RecipeIngredient[] = [];
      const ingredientChanges = [];

      const effects = await service.calculateCascadingEffects(
        mockRecipe,
        mockIngredients,
        ingredientChanges,
        mockCurrentMetrics
      );

      expect(effects).toBeDefined();
    });
  });
});