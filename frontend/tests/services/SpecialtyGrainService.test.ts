import SpecialtyGrainService from '../../src/services/AI/SpecialtyGrainService';
import { RecipeIngredient } from '../../src/types';
import { BeerStyleGuide } from '../../src/types/beer-styles';

describe('SpecialtyGrainService', () => {
  let service: SpecialtyGrainService;
  let mockIngredients: RecipeIngredient[];
  let mockStyleGuide: BeerStyleGuide;

  beforeEach(() => {
    service = new SpecialtyGrainService();

    mockIngredients = [
      {
        id: '1',
        ingredient_id: 'ing-1',
        name: '2-Row',
        type: 'grain',
        amount: 8.0,
        unit: 'lb',
        grain_type: 'base',
        color: 2
      },
      {
        id: '2',
        ingredient_id: 'ing-2',
        name: 'Crystal 60',
        type: 'grain',
        amount: 0.5,
        unit: 'lb',
        grain_type: 'caramel_crystal',
        color: 60
      },
      {
        id: '3',
        ingredient_id: 'ing-3',
        name: 'Chocolate Malt',
        type: 'grain',
        amount: 0.25,
        unit: 'lb',
        grain_type: 'roasted',
        color: 350
      }
    ];

    mockStyleGuide = {
      id: 'bjcp-20a',
      style_id: '20A',
      name: 'American Stout',
      color: {
        minimum: { value: 30, unit: 'SRM' },
        maximum: { value: 40, unit: 'SRM' }
      },
      overall_impression: 'Bold, roasted, hoppy American interpretation of stout',
      flavor: 'Moderate to high roasted malt flavors'
    };
  });

  describe('generateColorAdjustmentStrategy', () => {
    it('should generate strategy for color increase', () => {
      const currentSRM = 15;
      const targetSRM = 25;
      
      const analysis = service.generateColorAdjustmentStrategy(
        currentSRM,
        targetSRM,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis).toBeDefined();
      expect(analysis.adjustmentStrategy).toBeDefined();
      expect(analysis.adjustmentStrategy?.estimatedSRMChange).toBeCloseTo(targetSRM - currentSRM, 1);
    });

    it('should generate strategy for color decrease', () => {
      const currentSRM = 45;
      const targetSRM = 35;
      
      const analysis = service.generateColorAdjustmentStrategy(
        currentSRM,
        targetSRM,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis).toBeDefined();
      expect(analysis.adjustmentStrategy).toBeDefined();
      expect(analysis.adjustmentStrategy?.estimatedSRMChange).toBeCloseTo(targetSRM - currentSRM, 1);
    });

    it('should return null strategy when no adjustment needed', () => {
      const currentSRM = 35;
      const targetSRM = 35;
      
      const analysis = service.generateColorAdjustmentStrategy(
        currentSRM,
        targetSRM,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy).toBeNull();
    });

    it('should identify current color grains correctly', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.currentColorGrains).toHaveLength(2); // Crystal 60 and Chocolate Malt
      expect(analysis.currentColorGrains.some(g => g.name === 'Crystal 60')).toBe(true);
      expect(analysis.currentColorGrains.some(g => g.name === 'Chocolate Malt')).toBe(true);
    });

    it('should calculate total color contribution', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.totalColorContribution).toBeGreaterThan(0);
      // Crystal 60 (0.5 lb * 60) + Chocolate Malt (0.25 lb * 350) = 30 + 87.5 = 117.5
      expect(analysis.totalColorContribution).toBeCloseTo(117.5, 1);
    });

    it('should identify dominant color source', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.dominantColorSource).toBe('Chocolate Malt'); // Higher color contribution
    });
  });

  describe('color increase strategies', () => {
    it('should use Blackprinz for small color increases', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        16.5, // Small increase
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toBe('Blackprinz');
      expect(analysis.adjustmentStrategy?.grainType).toBe('blackprinz');
      expect(analysis.adjustmentStrategy?.confidenceLevel).toBe('high');
    });

    it('should use Munich Dark for moderate color increases', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        22, // Moderate increase
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toBe('Munich Dark');
      expect(analysis.adjustmentStrategy?.grainType).toBe('munich_dark');
      expect(analysis.adjustmentStrategy?.cascadingEffects).toContain('og');
    });

    it('should use traditional dark grains for large color increases', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        30, // Large increase
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toMatch(/Chocolate Malt|Roasted Barley/);
      expect(analysis.adjustmentStrategy?.amount).toBeGreaterThan(0.05);
    });

    it('should provide alternative strategies', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.alternatives).toBeInstanceOf(Array);
      expect(analysis.alternatives.length).toBeGreaterThan(0);
    });

    it('should follow expert patterns with small increments', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        17,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.amount).toBeGreaterThanOrEqual(0.05); // Minimum 25g
      expect(analysis.adjustmentStrategy?.reasoning).toContain('Expert pattern');
    });
  });

  describe('color decrease strategies', () => {
    it('should reduce darkest grain first', () => {
      const darkIngredients = [
        ...mockIngredients,
        {
          id: '4',
          ingredient_id: 'ing-4',
          name: 'Midnight Wheat',
          type: 'grain' as const,
          amount: 0.3,
          unit: 'lb',
          grain_type: 'roasted',
          color: 550
        }
      ];

      const analysis = service.generateColorAdjustmentStrategy(
        45,
        35, // Decrease needed
        darkIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toBe('Midnight Wheat'); // Darkest grain
      expect(analysis.adjustmentStrategy?.amount).toBeLessThanOrEqual(0); // Negative or zero for reduction
    });

    it('should handle cases with no dark grains to reduce', () => {
      const lightIngredients = [
        {
          id: '1',
          ingredient_id: 'ing-1',
          name: '2-Row',
          type: 'grain' as const,
          amount: 8.0,
          unit: 'lb',
          grain_type: 'base',
          color: 2
        }
      ];

      const analysis = service.generateColorAdjustmentStrategy(
        25,
        15, // Decrease needed but no dark grains
        lightIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy).toBeNull();
    });

    it('should calculate appropriate reduction amounts', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        40,
        30, // 10 SRM reduction
        mockIngredients,
        mockStyleGuide,
        10
      );

      if (analysis.adjustmentStrategy) {
        expect(Math.abs(analysis.adjustmentStrategy.amount)).toBeGreaterThan(0);
        expect(Math.abs(analysis.adjustmentStrategy.amount)).toBeLessThanOrEqual(0.25); // Can't reduce more than available
      }
    });
  });

  describe('convertToIngredientChanges', () => {
    it('should convert addition strategy to ingredient changes', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        20,
        mockIngredients,
        mockStyleGuide,
        10
      );

      if (analysis.adjustmentStrategy) {
        const changes = service.convertToIngredientChanges(
          analysis.adjustmentStrategy,
          mockIngredients
        );

        expect(changes).toHaveLength(1);
        expect(changes[0].isNewIngredient).toBe(true);
        expect(changes[0].field).toBe('amount');
        expect(changes[0].suggestedValue).toBeGreaterThan(0);
        expect(changes[0].newIngredientData).toBeDefined();
      }
    });

    it('should convert reduction strategy to ingredient changes', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        40,
        30,
        mockIngredients,
        mockStyleGuide,
        10
      );

      if (analysis.adjustmentStrategy && analysis.adjustmentStrategy.amount < 0) {
        const changes = service.convertToIngredientChanges(
          analysis.adjustmentStrategy,
          mockIngredients
        );

        expect(changes).toHaveLength(1);
        expect(changes[0].isNewIngredient).toBeUndefined();
        expect(changes[0].field).toBe('amount');
        expect(changes[0].suggestedValue).toBeLessThan(changes[0].currentValue);
      }
    });

    it('should handle missing ingredient gracefully', () => {
      const fakeStrategy = {
        grainType: 'blackprinz' as const,
        grainName: 'Nonexistent Grain',
        amount: -0.1,
        unit: 'lb',
        estimatedSRMChange: -5,
        reasoning: 'Test reduction',
        confidenceLevel: 'high' as const,
        cascadingEffects: []
      };

      const changes = service.convertToIngredientChanges(fakeStrategy, mockIngredients);
      expect(changes).toHaveLength(0);
    });
  });

  describe('style-specific adjustments', () => {
    it('should recommend appropriate grains for stout styles', () => {
      const stoutStyleGuide = {
        ...mockStyleGuide,
        name: 'American Stout'
      };

      const analysis = service.generateColorAdjustmentStrategy(
        15,
        35,
        mockIngredients,
        stoutStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toMatch(/Roasted Barley|Chocolate Malt/);
    });

    it('should recommend appropriate grains for porter styles', () => {
      const porterStyleGuide = {
        ...mockStyleGuide,
        name: 'American Porter'
      };

      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        porterStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.grainName).toMatch(/Chocolate Malt|Munich Dark/);
    });

    it('should work without style guide', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        undefined,
        10
      );

      expect(analysis).toBeDefined();
      expect(analysis.adjustmentStrategy).toBeDefined();
    });
  });

  describe('expert patterns and reasoning', () => {
    it('should provide detailed reasoning for adjustments', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        20,
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.reasoning).toContain('Expert pattern');
      expect(analysis.adjustmentStrategy?.reasoning).toMatch(/Blackprinz|Munich Dark/);
    });

    it('should indicate confidence levels appropriately', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        17, // Small, precise adjustment
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.confidenceLevel).toBe('high');
    });

    it('should identify cascading effects correctly', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25, // Munich Dark likely
        mockIngredients,
        mockStyleGuide,
        10
      );

      if (analysis.adjustmentStrategy?.grainName === 'Munich Dark') {
        expect(analysis.adjustmentStrategy.cascadingEffects).toContain('og');
      }
    });

    it('should follow incremental amount patterns', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        20,
        mockIngredients,
        mockStyleGuide,
        10
      );

      // Amount should be reasonable for color adjustment
      if (analysis.adjustmentStrategy) {
        const amount = analysis.adjustmentStrategy.amount;
        expect(amount).toBeGreaterThan(0);
        expect(amount).toBeLessThan(5); // Reasonable upper bound for specialty grains
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty ingredient list', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        [],
        mockStyleGuide,
        10
      );

      expect(analysis.currentColorGrains).toHaveLength(0);
      expect(analysis.totalColorContribution).toBe(0);
      expect(analysis.dominantColorSource).toBe('No specialty grains');
    });

    it('should handle ingredients without color values', () => {
      const noColorIngredients = [
        {
          id: '1',
          ingredient_id: 'ing-1',
          name: 'Unknown Grain',
          type: 'grain' as const,
          amount: 1.0,
          unit: 'lb',
          grain_type: 'specialty'
          // No color property
        }
      ];

      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        noColorIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis).toBeDefined();
      expect(analysis.currentColorGrains).toHaveLength(0); // Filtered out due to no color
    });

    it('should handle very small color changes', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        15.1, // Tiny change
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy?.amount).toBeGreaterThanOrEqual(0.05); // Minimum amount
    });

    it('should handle very large color changes', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        5,
        50, // Very large change
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.adjustmentStrategy).toBeDefined();
      expect(analysis.adjustmentStrategy?.amount).toBeGreaterThan(0.1);
    });

    it('should handle zero total grain weight', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25,
        mockIngredients,
        mockStyleGuide,
        0 // Zero total weight
      );

      expect(analysis).toBeDefined();
      expect(analysis.adjustmentStrategy).toBeDefined();
    });
  });

  describe('alternative strategies', () => {
    it('should provide multiple alternatives for complex adjustments', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        30, // Large change should generate alternatives
        mockIngredients,
        mockStyleGuide,
        10
      );

      expect(analysis.alternatives.length).toBeGreaterThan(0);
      analysis.alternatives.forEach(alt => {
        expect(alt.grainName).toBeDefined();
        expect(alt.reasoning).toBeDefined();
        expect(alt.estimatedSRMChange).toBeDefined();
      });
    });

    it('should suggest Midnight Wheat as alternative for smooth character', () => {
      const analysis = service.generateColorAdjustmentStrategy(
        15,
        25, // Moderate increase
        mockIngredients,
        mockStyleGuide,
        10
      );

      const midnightWheatAlt = analysis.alternatives.find(alt => 
        alt.grainName?.includes('Midnight Wheat')
      );
      
      if (midnightWheatAlt) {
        expect(midnightWheatAlt.reasoning).toContain('smooth');
      }
    });
  });
});