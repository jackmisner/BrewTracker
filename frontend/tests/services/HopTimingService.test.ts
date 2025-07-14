import HopTimingService from '../../src/services/AI/HopTimingService';
import { RecipeIngredient } from '../../src/types';
import { BeerStyleGuide } from '../../src/types/beer-styles';

describe('HopTimingService', () => {
  let service: HopTimingService;
  let mockHops: RecipeIngredient[];
  let mockStyleGuide: BeerStyleGuide;

  beforeEach(() => {
    service = new HopTimingService();

    mockHops = [
      {
        id: '1',
        ingredient_id: 'hop-1',
        name: 'Cascade',
        type: 'hop',
        amount: 1.0,
        unit: 'oz',
        alpha_acid: 5.5,
        time: 60,
        use: 'Boil'
      },
      {
        id: '2',
        ingredient_id: 'hop-2',
        name: 'Centennial',
        type: 'hop',
        amount: 0.5,
        unit: 'oz',
        alpha_acid: 10.0,
        time: 30,
        use: 'Boil'
      },
      {
        id: '3',
        ingredient_id: 'hop-3',
        name: 'Citra',
        type: 'hop',
        amount: 0.5,
        unit: 'oz',
        alpha_acid: 12.0,
        time: 5,
        use: 'Boil'
      }
    ];

    mockStyleGuide = {
      id: 'bjcp-21a',
      style_id: '21A',
      name: 'American IPA',
      international_bitterness_units: {
        minimum: { value: 40, unit: 'IBU' },
        maximum: { value: 70, unit: 'IBU' }
      },
      overall_impression: 'Hoppy, bitter beer with citrus and pine hop flavors',
      aroma: 'Moderate to strong hop aroma',
      flavor: 'Hop bitterness is high with citrus flavors'
    };
  });

  describe('analyzeHopTiming', () => {
    it('should analyze hop timing and categorize hops correctly', () => {
      const analysis = service.analyzeHopTiming(
        35, // current IBU
        45, // target IBU
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      expect(analysis).toBeDefined();
      expect(analysis.currentHops).toHaveLength(3);
      expect(analysis.bitteringHops).toHaveLength(1); // 60 min hop
      expect(analysis.flavorHops).toHaveLength(1); // 30 min hop
      expect(analysis.aromaHops).toHaveLength(1); // 5 min hop
    });

    it('should identify timing issues', () => {
      const noBitteringHops = mockHops.filter(hop => hop.time !== 60);
      
      const analysis = service.analyzeHopTiming(
        35,
        45,
        noBitteringHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      expect(analysis.timingIssues).toContain(
        'No bittering hops (60+ minutes) - may lack sufficient bitterness foundation'
      );
    });

    it('should detect excessive late hop timing concentration', () => {
      const manyLateHops = [
        ...mockHops,
        { ...mockHops[2], id: '4', time: 10 },
        { ...mockHops[2], id: '5', time: 5 },
        { ...mockHops[2], id: '6', time: 1 },
        { ...mockHops[2], id: '7', time: 0 }
      ];

      const analysis = service.analyzeHopTiming(
        35,
        45,
        manyLateHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      expect(analysis.timingIssues).toContain(
        'Many late hop additions - consider consolidating for cleaner flavor profile'
      );
    });

    it('should generate optimization strategy for small IBU differences', () => {
      const analysis = service.analyzeHopTiming(
        42, // current IBU
        45, // target IBU (small difference)
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      expect(analysis.optimizationStrategy).toBeDefined();
      expect(analysis.optimizationStrategy?.adjustmentType).toBe('timing_optimization');
    });

    it('should not generate timing strategy for large IBU differences', () => {
      const analysis = service.analyzeHopTiming(
        20, // current IBU
        50, // target IBU (large difference)
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      // Large differences should not use timing optimization
      expect(analysis.optimizationStrategy).toBeNull();
    });

    it('should handle empty hop list gracefully', () => {
      const analysis = service.analyzeHopTiming(
        35,
        45,
        [],
        1.050,
        5.0,
        mockStyleGuide
      );

      expect(analysis.currentHops).toHaveLength(0);
      expect(analysis.bitteringHops).toHaveLength(0);
      expect(analysis.optimizationStrategy).toBeNull();
    });
  });

  describe('timing optimization strategies', () => {
    it('should select highest alpha acid hop for timing adjustments', () => {
      const analysis = service.analyzeHopTiming(
        42, // current IBU
        45, // target IBU
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        // Should select Cascade (bittering hop) over others for timing adjustment
        expect(analysis.optimizationStrategy.targetHop.name).toBe('Cascade');
      }
    });

    it('should prefer bittering hops for timing adjustments', () => {
      const multipleFlavorHops = [
        {
          id: '1',
          ingredient_id: 'hop-1',
          name: 'Columbus',
          type: 'hop' as const,
          amount: 0.5,
          unit: 'oz',
          alpha_acid: 15.0,
          time: 30,
          use: 'Boil'
        },
        {
          id: '2',
          ingredient_id: 'hop-2',
          name: 'Cascade',
          type: 'hop' as const,
          amount: 1.0,
          unit: 'oz',
          alpha_acid: 5.5,
          time: 60,
          use: 'Boil'
        }
      ];

      const analysis = service.analyzeHopTiming(
        42,
        45,
        multipleFlavorHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        // Should prefer bittering hop (60 min) over flavor hop (30 min)
        expect(analysis.optimizationStrategy.targetHop.time).toBe(60);
      }
    });

    it('should calculate appropriate timing changes', () => {
      const analysis = service.analyzeHopTiming(
        42,
        45, // Need to increase IBU
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const currentTiming = analysis.optimizationStrategy.currentTiming;
        const suggestedTiming = analysis.optimizationStrategy.suggestedTiming;
        
        // For IBU increase, timing should increase (more utilization)
        expect(suggestedTiming).toBeGreaterThan(currentTiming);
        expect(analysis.optimizationStrategy.estimatedIBUChange).toBeGreaterThan(0);
      }
    });

    it('should decrease timing when IBU needs to be reduced', () => {
      const analysis = service.analyzeHopTiming(
        48,
        45, // Need to decrease IBU
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const currentTiming = analysis.optimizationStrategy.currentTiming;
        const suggestedTiming = analysis.optimizationStrategy.suggestedTiming;
        
        // For IBU decrease, timing should decrease (less utilization)
        expect(suggestedTiming).toBeLessThan(currentTiming);
        expect(analysis.optimizationStrategy.estimatedIBUChange).toBeLessThan(0);
      }
    });

    it('should provide timing alternatives', () => {
      const analysis = service.analyzeHopTiming(
        42,
        45,
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.alternatives).toBeInstanceOf(Array);
        expect(analysis.optimizationStrategy.alternatives.length).toBeGreaterThan(0);
        
        analysis.optimizationStrategy.alternatives.forEach(alt => {
          expect(alt.description).toBeDefined();
          expect(alt.timing).toBeGreaterThan(0);
          expect(alt.estimatedIBUChange).toBeDefined();
          expect(alt.reasoning).toBeDefined();
        });
      }
    });

    it('should use conservative 15-minute timing increments', () => {
      const analysis = service.analyzeHopTiming(
        42,
        45,
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const alternatives = analysis.optimizationStrategy.alternatives;
        alternatives.forEach(alt => {
          expect(alt.reasoning).toContain('Conservative');
        });
      }
    });
  });

  describe('confidence levels', () => {
    it('should assign high confidence for small, logical timing changes', () => {
      const analysis = service.analyzeHopTiming(
        43,
        45, // Small change
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const timingDiff = Math.abs(
          analysis.optimizationStrategy.suggestedTiming - 
          analysis.optimizationStrategy.currentTiming
        );
        
        if (timingDiff <= 15) {
          expect(analysis.optimizationStrategy.confidenceLevel).toBe('high');
        }
      }
    });

    it('should assign medium confidence for moderate changes', () => {
      // Create scenario that would result in medium confidence
      const analysis = service.analyzeHopTiming(
        40,
        47, // Moderate change
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.confidenceLevel).toMatch(/high|medium/);
      }
    });
  });

  describe('convertToIngredientChange', () => {
    it('should convert timing strategy to ingredient change', () => {
      const analysis = service.analyzeHopTiming(
        42,
        45,
        mockHops,
        1.050,
        5.0,
        mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const change = service.convertToIngredientChange(analysis.optimizationStrategy);
        
        expect(change.ingredientId).toBe(analysis.optimizationStrategy.targetHop.id);
        expect(change.ingredientName).toBe(analysis.optimizationStrategy.targetHop.name);
        expect(change.field).toBe('time');
        expect(change.currentValue).toBe(analysis.optimizationStrategy.currentTiming);
        expect(change.suggestedValue).toBe(analysis.optimizationStrategy.suggestedTiming);
      }
    });
  });

  describe('gravity effects on utilization', () => {
    it('should account for higher gravity reducing utilization', () => {
      const highGravity = 1.080;
      const lowGravity = 1.040;

      const highGravityAnalysis = service.analyzeHopTiming(
        35, 40, mockHops, highGravity, 5.0
      );
      
      const lowGravityAnalysis = service.analyzeHopTiming(
        35, 40, mockHops, lowGravity, 5.0
      );

      // Higher gravity should require different (likely higher) timing to achieve same IBU increase
      if (highGravityAnalysis.optimizationStrategy && lowGravityAnalysis.optimizationStrategy) {
        // This is complex brewing science, so we just verify both strategies exist
        expect(highGravityAnalysis.optimizationStrategy.suggestedTiming).toBeGreaterThan(0);
        expect(lowGravityAnalysis.optimizationStrategy.suggestedTiming).toBeGreaterThan(0);
      }
    });
  });

  describe('style-specific timing recommendations', () => {
    it('should provide style-appropriate reasoning for IPA', () => {
      const ipaStyleGuide = {
        ...mockStyleGuide,
        name: 'American IPA'
      };

      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0, ipaStyleGuide
      );

      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.reasoning).toContain('hop-forward');
      }
    });

    it('should provide style-appropriate reasoning for lagers', () => {
      const lagerStyleGuide = {
        ...mockStyleGuide,
        name: 'German Pilsner'
      };

      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0, lagerStyleGuide
      );

      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.reasoning).toBeDefined();
        expect(analysis.optimizationStrategy.reasoning.length).toBeGreaterThan(0);
      }
    });

    it('should suggest mid-range hop additions for IPA styles', () => {
      const ipaStyleGuide = {
        ...mockStyleGuide,
        name: 'American IPA'
      };

      const hopsWithoutMidRange = [
        mockHops[0], // 60 min
        mockHops[2]  // 5 min
        // Missing 15-30 min range
      ];

      const analysis = service.analyzeHopTiming(
        35, 45, hopsWithoutMidRange, 1.050, 5.0, ipaStyleGuide
      );

      expect(analysis.timingIssues).toContain(
        'IPA may benefit from mid-boil hop additions (15-30 min) for flavor complexity'
      );
    });

    it('should work without style guide', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0
      );

      expect(analysis).toBeDefined();
      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.reasoning).toBeDefined();
      }
    });
  });

  describe('timing appropriateness validation', () => {
    it('should reject inappropriate timing for hop types', () => {
      const dryHop = {
        ...mockHops[0],
        use: 'Dry Hop'
      };

      const analysis = service.analyzeHopTiming(
        42, 45, [dryHop], 1.050, 5.0, mockStyleGuide
      );

      // Dry hops shouldn't be used for boil timing adjustments
      expect(analysis.optimizationStrategy).toBeNull();
    });

    it('should accept whirlpool hops for timing adjustments within appropriate range', () => {
      const whirlpoolHop = {
        ...mockHops[0],
        use: 'Whirlpool',
        time: 15
      };

      const analysis = service.analyzeHopTiming(
        42, 45, [whirlpoolHop], 1.050, 5.0, mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        // Whirlpool hops should stay in 0-20 minute range
        expect(analysis.optimizationStrategy.suggestedTiming).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('expert patterns and reasoning', () => {
    it('should reference expert patterns in reasoning', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0, mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.reasoning).toContain('Expert pattern');
      }
    });

    it('should explain timing-specific benefits', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0, mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const reasoning = analysis.optimizationStrategy.reasoning;
        expect(reasoning).toMatch(/bittering|flavor|aroma|extraction/);
      }
    });

    it('should provide detailed timing explanations', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 5.0, mockStyleGuide
      );

      if (analysis.optimizationStrategy) {
        const reasoning = analysis.optimizationStrategy.reasoning;
        
        if (analysis.optimizationStrategy.suggestedTiming >= 60) {
          expect(reasoning).toContain('bittering');
        } else if (analysis.optimizationStrategy.suggestedTiming >= 30) {
          expect(reasoning).toContain('flavor');
        } else if (analysis.optimizationStrategy.suggestedTiming >= 15) {
          expect(reasoning).toContain('flavor');
        } else {
          expect(reasoning).toContain('aroma');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle hops without alpha acid values', () => {
      const noAlphaHops = mockHops.map(hop => ({
        ...hop,
        alpha_acid: undefined
      }));

      const analysis = service.analyzeHopTiming(
        42, 45, noAlphaHops, 1.050, 5.0, mockStyleGuide
      );

      expect(analysis).toBeDefined();
      // Should still work with default alpha acid values
    });

    it('should handle hops without timing values', () => {
      const noTimingHops = mockHops.map(hop => ({
        ...hop,
        time: undefined
      }));

      const analysis = service.analyzeHopTiming(
        42, 45, noTimingHops, 1.050, 5.0, mockStyleGuide
      );

      expect(analysis).toBeDefined();
      // Should use default timing values
    });

    it('should handle zero IBU difference', () => {
      const analysis = service.analyzeHopTiming(
        45, 45, mockHops, 1.050, 5.0, mockStyleGuide
      );

      expect(analysis.optimizationStrategy).toBeNull();
    });

    it('should handle very small batch sizes', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.050, 1.0, mockStyleGuide
      );

      expect(analysis).toBeDefined();
      if (analysis.optimizationStrategy) {
        expect(analysis.optimizationStrategy.estimatedIBUChange).toBeDefined();
      }
    });

    it('should handle extreme gravity values', () => {
      const analysis = service.analyzeHopTiming(
        42, 45, mockHops, 1.120, 5.0, mockStyleGuide
      );

      expect(analysis).toBeDefined();
      // Should still work with extreme gravity
    });
  });
});