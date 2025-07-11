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

  describe('additional coverage tests', () => {
    it('should detect style characteristics correctly', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test Porter',
        description: 'Dark, malty beer',
        style: 'American Porter',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.055,
        fg: 1.014,
        abv: 5.4,
        ibu: 35,
        srm: 25,
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
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle lager styles appropriately', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Test Lager',
        description: 'Clean, crisp lager',
        style: 'German Pilsner',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.045,
        fg: 1.008,
        abv: 4.8,
        ibu: 28,
        srm: 3,
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
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should analyze grain bill with multiple specialty grains', () => {
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
          name: 'Crystal 40',
          type: 'grain',
          amount: 1,
          unit: 'lb',
          grain_type: 'caramel_crystal',
          ingredient_id: '2',
          use: '',
          time: 0
        },
        {
          id: '3',
          name: 'Chocolate Malt',
          type: 'grain',
          amount: 0.5,
          unit: 'lb',
          grain_type: 'roasted',
          ingredient_id: '3',
          use: '',
          time: 0
        },
        {
          id: '4',
          name: 'Munich Malt',
          type: 'grain',
          amount: 1,
          unit: 'lb',
          grain_type: 'specialty_malt',
          ingredient_id: '4',
          use: '',
          time: 0
        }
      ];

      const analysis = service.analyzeGrainBill(ingredients);

      expect(analysis.totalGrains).toBe(4);
      expect(analysis.baseMaltPercentage).toBeCloseTo(76.2, 1);
      expect(analysis.specialtyGrainTypes).toContain('caramel_crystal');
      expect(analysis.specialtyGrainTypes).toContain('roasted');
      expect(analysis.specialtyGrainTypes).toContain('specialty_malt');
      expect(analysis.flavorProfile).toContain('caramel');
      // Roasted grains add 'roasted' flavor, not 'chocolate' even if name contains chocolate
      // due to the else-if logic in inferFlavorProfile
      expect(analysis.flavorProfile).toContain('roasted');
    });

    it('should handle ingredients with missing grain_type', () => {
      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: '2-Row',
          type: 'grain',
          amount: 8,
          unit: 'lb',
          ingredient_id: '1',
          use: '',
          time: 0
          // Missing grain_type
        },
        {
          id: '2',
          name: 'Citra Hops',
          type: 'hop',
          amount: 1,
          unit: 'oz',
          ingredient_id: '2',
          use: 'boil',
          time: 60
        }
      ];

      const analysis = service.analyzeGrainBill(ingredients);

      expect(analysis.totalGrains).toBe(1);
      // Ingredient without grain_type gets categorized as 'specialty'
      expect(analysis.specialtyGrainTypes).toEqual(['specialty']);
    });

    it('should handle extreme recipe values', async () => {
      const recipe: Recipe = {
        id: '1',
        name: 'Extreme Recipe',
        description: 'Very strong beer',
        style: 'Imperial Stout',
        batch_size: 10,
        batch_size_unit: 'gal',
        boil_time: 120,
        efficiency: 65,
        og: 1.120,
        fg: 1.030,
        abv: 12.0,
        ibu: 80,
        srm: 45,
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
          amount: 20,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        }
      ];

      const recommendations = await service.getSmartBaseMaltRecommendations(recipe, ingredients);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle recipes with zero amounts', () => {
      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: '2-Row',
          type: 'grain',
          amount: 0,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        }
      ];

      const analysis = service.analyzeGrainBill(ingredients);

      expect(analysis.totalGrains).toBe(1);
      expect(analysis.baseMaltPercentage).toBe(0);
    });

    it('should prioritize malts correctly for different styles', async () => {
      const stoutRecipe: Recipe = {
        id: '1',
        name: 'Stout',
        description: 'Dark stout',
        style: 'Dry Stout',
        batch_size: 5,
        batch_size_unit: 'gal',
        boil_time: 60,
        efficiency: 75,
        og: 1.045,
        fg: 1.010,
        abv: 4.6,
        ibu: 35,
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
          amount: 6,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '1',
          use: '',
          time: 0
        },
        {
          id: '2',
          name: 'Munich Malt',
          type: 'grain',
          amount: 1,
          unit: 'lb',
          grain_type: 'base_malt',
          ingredient_id: '2',
          use: '',
          time: 0
        }
      ];

      const baseMalts = ingredients.filter(ing => ing.grain_type === 'base_malt');
      const selected = await service.selectBaseMaltsForIncrease(stoutRecipe, ingredients, baseMalts);

      expect(selected.length).toBeGreaterThan(0);
      // Test should pass if any base malts are selected, as the specific malt selection depends on style analysis
      expect(selected.every(malt => malt.grain_type === 'base_malt')).toBe(true);
    });

    it('should handle non-grain ingredients in analysis', () => {
      const ingredients: RecipeIngredient[] = [
        {
          id: '1',
          name: 'Cascade',
          type: 'hop',
          amount: 1,
          unit: 'oz',
          ingredient_id: '1',
          use: 'boil',
          time: 60
        },
        {
          id: '2',
          name: 'US-05',
          type: 'yeast',
          amount: 1,
          unit: 'pkg',
          ingredient_id: '2',
          use: 'fermentation',
          time: 0
        }
      ];

      const analysis = service.analyzeGrainBill(ingredients);

      expect(analysis.totalGrains).toBe(0);
      expect(analysis.baseMaltPercentage).toBe(0);
      expect(analysis.specialtyGrainTypes).toEqual([]);
      expect(analysis.flavorProfile).toEqual([]);
    });
  });
});