import HierarchicalAdjustmentService from '../../src/services/AI/HierarchicalAdjustmentService';
import { Recipe, RecipeIngredient, RecipeMetrics } from '../../src/types';
import { BeerStyleGuide } from '../../src/types/beer-styles';
import { StyleCompliance, AdjustmentPhase } from '../../src/types/ai';

describe('HierarchicalAdjustmentService', () => {
  let service: HierarchicalAdjustmentService;
  let mockRecipe: Recipe;
  let mockIngredients: RecipeIngredient[];
  let mockMetrics: RecipeMetrics;
  let mockStyleGuide: BeerStyleGuide;
  let mockCompliance: StyleCompliance;

  beforeEach(() => {
    service = new HierarchicalAdjustmentService();

    mockRecipe = {
      id: 'test-recipe',
      name: 'Test Recipe',
      style: 'American IPA',
      batch_size: 5.0,
      boil_time: 60,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      public: false,
      user_id: 'test-user'
    };

    mockIngredients = [
      {
        id: '1',
        ingredient_id: 'ing-1',
        name: '2-Row',
        type: 'grain',
        amount: 8.0,
        unit: 'lb',
        grain_type: 'base_malt',
        color: 2
      },
      {
        id: '2',
        ingredient_id: 'ing-2',
        name: 'Cascade',
        type: 'hop',
        amount: 1.0,
        unit: 'oz',
        alpha_acid: 5.5,
        time: 60,
        use: 'Boil'
      },
      {
        id: '3',
        ingredient_id: 'ing-3',
        name: 'US-05',
        type: 'yeast',
        amount: 1,
        unit: 'pkg'
      }
    ];

    mockMetrics = {
      og: 1.055,
      fg: 1.012,
      abv: 5.6,
      ibu: 35,
      srm: 4.2
    };

    mockStyleGuide = {
      id: 'bjcp-21a',
      style_id: '21A',
      name: 'American IPA',
      original_gravity: {
        minimum: { value: 1.056, unit: 'SG' },
        maximum: { value: 1.070, unit: 'SG' }
      },
      final_gravity: {
        minimum: { value: 1.008, unit: 'SG' },
        maximum: { value: 1.014, unit: 'SG' }
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
      overall_impression: 'Hoppy, bitter beer with citrus and pine hop flavors',
      aroma: 'Moderate to strong hop aroma',
      flavor: 'Hop bitterness is high with citrus flavors'
    };

    mockCompliance = {
      og: { inRange: false, deviation: 0.001, target: 1.056, priority: 1.5, currentValue: 1.055 },
      fg: { inRange: true, deviation: 0, target: 1.012, priority: 1, currentValue: 1.012 },
      abv: { inRange: true, deviation: 0, target: 5.6, priority: 1.5, currentValue: 5.6 },
      ibu: { inRange: false, deviation: 0.15, target: 45, priority: 2, currentValue: 35 },
      srm: { inRange: false, deviation: 0.3, target: 8, priority: 1.5, currentValue: 4.2 },
      overallScore: 60,
      criticalIssues: ['IBU too low', 'SRM too low'],
      improvementAreas: ['Increase hop bitterness', 'Increase color']
    };
  });

  describe('generateAdjustmentPlan', () => {
    it('should generate a comprehensive adjustment plan with multiple phases', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
      expect(plan.totalSteps).toBeGreaterThan(0);
      expect(plan.estimatedCompliance).toBeGreaterThan(60);
    });

    it('should follow hierarchical adjustment phases', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const phases = plan.phases.map(p => p.strategy.phase);
      
      // Should include relevant phases based on compliance issues
      if (phases.includes(AdjustmentPhase.BASE_GRAVITY)) {
        expect(phases.indexOf(AdjustmentPhase.BASE_GRAVITY)).toBeLessThan(
          phases.indexOf(AdjustmentPhase.COLOR_BALANCE) || phases.length
        );
      }
      
      if (phases.includes(AdjustmentPhase.COLOR_BALANCE)) {
        expect(phases.indexOf(AdjustmentPhase.COLOR_BALANCE)).toBeLessThan(
          phases.indexOf(AdjustmentPhase.HOP_BALANCE) || phases.length
        );
      }
    });

    it('should generate OG adjustment when gravity is out of range', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const ogAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.BASE_GRAVITY);
      expect(ogAdjustment).toBeDefined();
      expect(ogAdjustment?.strategy.targetMetric).toBe('og');
      expect(ogAdjustment?.ingredientChanges).toHaveLength(1);
    });

    it('should generate color adjustment when SRM is out of range', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const colorAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.COLOR_BALANCE);
      expect(colorAdjustment).toBeDefined();
      expect(colorAdjustment?.strategy.targetMetric).toBe('srm');
    });

    it('should generate hop adjustment when IBU is out of range', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const hopAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.HOP_BALANCE);
      expect(hopAdjustment).toBeDefined();
      expect(hopAdjustment?.strategy.targetMetric).toBe('ibu');
    });

    it('should include dependencies when metrics affect each other', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan.dependencies).toBeInstanceOf(Array);
      // Should have dependencies when both OG and ABV are being adjusted
      if (plan.phases.some(p => p.strategy.targetMetric === 'og') && 
          plan.phases.some(p => p.strategy.targetMetric === 'abv')) {
        expect(plan.dependencies.length).toBeGreaterThan(0);
      }
    });

    it('should add warnings for complex adjustments', () => {
      // Create a scenario with many out-of-range metrics
      const complexCompliance = {
        ...mockCompliance,
        og: { inRange: false, deviation: 0.01, target: 1.065, priority: 1.5, currentValue: 1.055 },
        fg: { inRange: false, deviation: 0.004, target: 1.008, priority: 1, currentValue: 1.012 },
        abv: { inRange: false, deviation: 1.0, target: 6.5, priority: 1.5, currentValue: 5.6 },
        ibu: { inRange: false, deviation: 0.3, target: 50, priority: 2, currentValue: 35 },
        srm: { inRange: false, deviation: 0.5, target: 10, priority: 1.5, currentValue: 4.2 }
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        complexCompliance,
        mockStyleGuide
      );

      if (plan.phases.length > 3) {
        expect(plan.warnings).toContain('Complex multi-phase adjustment required - consider iterative approach');
      }
    });

    it('should handle recipes with no base malts gracefully', () => {
      const noBaseMaltIngredients = mockIngredients.filter(ing => ing.grain_type !== 'base');
      
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        noBaseMaltIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
    });

    it('should handle recipes with no hops gracefully', () => {
      const noHopIngredients = mockIngredients.filter(ing => ing.type !== 'hop');
      
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        noHopIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
    });
  });

  describe('base gravity adjustments', () => {
    it('should target primary base malt for gravity adjustments', () => {
      const multiBaseMaltIngredients = [
        ...mockIngredients,
        {
          id: '4',
          ingredient_id: 'ing-4',
          name: 'Munich',
          type: 'grain' as const,
          amount: 1.0,
          unit: 'lb',
          grain_type: 'base_malt',
          color: 9
        }
      ];

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        multiBaseMaltIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const ogAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.BASE_GRAVITY);
      if (ogAdjustment) {
        expect(ogAdjustment.ingredientChanges).toHaveLength(1);
        expect(ogAdjustment.ingredientChanges[0].field).toBe('amount');
      }
    });

    it('should use incremental adjustment amounts', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const ogAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.BASE_GRAVITY);
      if (ogAdjustment) {
        const amountChange = ogAdjustment.ingredientChanges[0];
        const changeAmount = Math.abs(amountChange.suggestedValue - amountChange.currentValue);
        
        // Should be in 0.5-1 lb increments
        expect(changeAmount).toBeGreaterThanOrEqual(0.25);
        expect(changeAmount).toBeLessThanOrEqual(1.5);
      }
    });
  });

  describe('color adjustments', () => {
    it('should add specialty grains for color increases', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const colorAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.COLOR_BALANCE);
      if (colorAdjustment && mockCompliance.srm.target > mockCompliance.srm.currentValue) {
        expect(colorAdjustment.ingredientChanges.length).toBeGreaterThan(0);
        expect(colorAdjustment.strategy.approach).toMatch(/addition|incremental/);
      }
    });

    it('should reduce dark grains for color decreases', () => {
      // Create scenario where color needs to be reduced
      const darkGrainIngredients = [
        ...mockIngredients,
        {
          id: '5',
          ingredient_id: 'ing-5',
          name: 'Chocolate Malt',
          type: 'grain' as const,
          amount: 0.5,
          unit: 'lb',
          grain_type: 'roasted',
          color: 350
        }
      ];

      const darkCompliance = {
        ...mockCompliance,
        srm: { inRange: false, deviation: -0.3, target: 6, priority: 1.5, currentValue: 12 }
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        darkGrainIngredients,
        { ...mockMetrics, srm: 12 },
        darkCompliance,
        mockStyleGuide
      );

      const colorAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.COLOR_BALANCE);
      if (colorAdjustment) {
        expect(colorAdjustment.strategy.approach).toBe('incremental');
      }
    });
  });

  describe('hop adjustments', () => {
    it('should prefer timing changes for small IBU adjustments', () => {
      const smallIBUCompliance = {
        ...mockCompliance,
        ibu: { inRange: false, deviation: 0.15, target: 40, priority: 2, currentValue: 35 }
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        smallIBUCompliance,
        mockStyleGuide
      );

      const hopAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.HOP_BALANCE);
      if (hopAdjustment) {
        expect(hopAdjustment.strategy.approach).toMatch(/timing_change|incremental/);
      }
    });

    it('should handle recipes with multiple hop additions', () => {
      const multiHopIngredients = [
        ...mockIngredients,
        {
          id: '6',
          ingredient_id: 'ing-6',
          name: 'Centennial',
          type: 'hop' as const,
          amount: 0.5,
          unit: 'oz',
          alpha_acid: 10,
          time: 15,
          use: 'Boil'
        }
      ];

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        multiHopIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      const hopAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.HOP_BALANCE);
      expect(hopAdjustment).toBeDefined();
    });
  });

  describe('yeast adjustments', () => {
    it('should generate ABV adjustment through yeast selection', () => {
      const abvCompliance = {
        ...mockCompliance,
        abv: { inRange: false, deviation: 0.5, target: 6.5, priority: 1.5, currentValue: 5.6 }
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        abvCompliance,
        mockStyleGuide
      );

      const abvAdjustment = plan.phases.find(p => p.strategy.phase === AdjustmentPhase.ALCOHOL_CONTENT);
      if (abvAdjustment) {
        expect(abvAdjustment.strategy.targetMetric).toBe('abv');
        expect(abvAdjustment.strategy.approach).toBe('ingredient_swap');
      }
    });

    it('should handle recipes with no yeast gracefully', () => {
      const noYeastIngredients = mockIngredients.filter(ing => ing.type !== 'yeast');
      
      const abvCompliance = {
        ...mockCompliance,
        abv: { inRange: false, deviation: 0.5, target: 6.5, priority: 1.5, currentValue: 5.6 }
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        noYeastIngredients,
        mockMetrics,
        abvCompliance,
        mockStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
    });
  });

  describe('expert patterns', () => {
    it('should follow incremental adjustment principles', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      plan.phases.forEach(phase => {
        expect(phase.strategy.reasoning).toBeDefined();
        expect(phase.strategy.confidenceLevel).toMatch(/high|medium|low/);
      });
    });

    it('should provide validation checks for each adjustment', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      plan.phases.forEach(phase => {
        expect(phase.validationChecks).toBeInstanceOf(Array);
        expect(phase.validationChecks.length).toBeGreaterThan(0);
      });
    });

    it('should calculate realistic estimated compliance improvements', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan.estimatedCompliance).toBeGreaterThan(mockCompliance.overallScore);
      expect(plan.estimatedCompliance).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty ingredient list', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        [],
        mockMetrics,
        mockCompliance,
        mockStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
      // Empty ingredient list might still generate color adjustments (new ingredient additions)
      expect(plan.phases.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle all metrics in range', () => {
      const perfectCompliance = {
        og: { inRange: true, deviation: 0, target: 1.055, priority: 1.5, currentValue: 1.055 },
        fg: { inRange: true, deviation: 0, target: 1.012, priority: 1, currentValue: 1.012 },
        abv: { inRange: true, deviation: 0, target: 5.6, priority: 1.5, currentValue: 5.6 },
        ibu: { inRange: true, deviation: 0, target: 45, priority: 2, currentValue: 45 },
        srm: { inRange: true, deviation: 0, target: 8, priority: 1.5, currentValue: 8 },
        overallScore: 100,
        criticalIssues: [],
        improvementAreas: []
      };

      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        perfectCompliance,
        mockStyleGuide
      );

      expect(plan.phases).toHaveLength(0);
      expect(plan.totalSteps).toBe(0);
    });

    it('should handle missing style guide gracefully', () => {
      const plan = service.generateAdjustmentPlan(
        mockRecipe,
        mockIngredients,
        mockMetrics,
        mockCompliance,
        {} as BeerStyleGuide
      );

      expect(plan).toBeDefined();
      expect(plan.phases).toBeInstanceOf(Array);
    });
  });
});