import SmartBaseMaltService from '../../src/services/SmartBaseMaltService';
import { Recipe, RecipeIngredient } from '../../src/types/recipe';

describe('SmartBaseMaltService', () => {
  let service: SmartBaseMaltService;

  beforeEach(() => {
    service = new SmartBaseMaltService();
  });

  describe('analyzeGrainBill', () => {
    it('should correctly analyze grain bill with base malts', () => {
      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: '2-Row',
          type: 'grain',
          amount: 10,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        },
        {
          id: '2',
          name: 'Crystal 40',
          type: 'grain',
          amount: 1,
          unit: 'lb',
          grain_type: 'caramel_crystal',
          ingredient_id: '2',
          use: '',
          time: 0
        }
      ];

      const analysis = service.analyzeGrainBill(ingredients);

      expect(analysis.totalGrains).toBe(2);
      expect(analysis.baseMaltPercentage).toBeCloseTo(90.9, 1);
      expect(analysis.specialtyGrainTypes).toContain('caramel_crystal');
      expect(analysis.flavorProfile).toContain('caramel');
    });

    it('should handle empty ingredient list', () => {
      const analysis = service.analyzeGrainBill([]);
      
      expect(analysis.totalGrains).toBe(0);
      expect(analysis.baseMaltPercentage).toBe(0);
      expect(analysis.specialtyGrainTypes).toEqual([]);
      expect(analysis.flavorProfile).toEqual([]);
    });
  });

  describe('getSmartBaseMaltRecommendations', () => {
    it('should provide recommendations for IPA style', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test IPA',
        description: 'Test recipe',
        style: 'American IPA',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.060,
        fg: 1.012,
        abv: 6.3,
        ibu: 65,
        srm: 5,
        is_public: false,
        user_id: '1',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        version: 1,
        ingredients: []
      };

      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: 'Maris Otter',
          type: 'grain',
          amount: 10,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        }
      ];

      const recommendations = await service.getSmartBaseMaltRecommendations(recipe, ingredients);

      expect(recommendations.length).toBeGreaterThan(0);
      // Since we can't fetch styles in test environment, check for fallback behavior
      expect(recommendations.some(rec => rec.maltName === 'Maris Otter')).toBe(true);
    });

    it('should handle recipes without style', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test Recipe',
        description: 'Test recipe',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.050,
        fg: 1.010,
        abv: 5.0,
        ibu: 30,
        srm: 4,
        is_public: false,
        user_id: '1',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        version: 1,
        ingredients: []
      };

      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: '2-Row',
          type: 'grain',
          amount: 8,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        }
      ];

      const recommendations = await service.getSmartBaseMaltRecommendations(recipe, ingredients);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].maltName).toBe('2-Row');
    });
  });

  describe('selectBaseMaltsForIncrease', () => {
    it('should select best base malts for increase', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test Stout',
        description: 'Test recipe',
        style: 'American Stout',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.070,
        fg: 1.016,
        abv: 7.1,
        ibu: 45,
        srm: 35,
        is_public: false,
        user_id: '1',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        version: 1,
        ingredients: []
      };

      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: '2-Row',
          type: 'grain',
          amount: 8,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        },
        {
          id: '2',
          name: 'Maris Otter',
          type: 'grain',
          amount: 2,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '2',
          use: '',
          time: 0
        }
      ];

      const baseMalts = ingredients.filter(ing => ing.grain_type === 'base_malt');
      const selected = await service.selectBaseMaltsForIncrease(recipe, ingredients, baseMalts);

      expect(selected).toHaveLength(2);
      expect(selected.map(malt => malt.name)).toContain('Maris Otter');
    });

    it('should handle empty base malts list', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test Recipe',
        description: 'Test recipe',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.050,
        fg: 1.010,
        abv: 5.0,
        ibu: 30,
        srm: 4,
        is_public: false,
        user_id: '1',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        version: 1,
        ingredients: []
      };

      const selected = await service.selectBaseMaltsForIncrease(recipe, [], []);

      expect(selected).toHaveLength(0);
    });
  });
});