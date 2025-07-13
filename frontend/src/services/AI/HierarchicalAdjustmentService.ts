import { Recipe, RecipeIngredient, RecipeMetrics } from '../../types';
import { BeerStyleGuide } from '../../types/beer-styles';
import type { 
  StyleCompliance, 
  StyleOptimizationTarget, 
  AdjustmentPhase, 
  AdjustmentStrategy, 
  IngredientAdjustment, 
  AdjustmentPlan,
  IngredientChange,
  MetricChange 
} from '../../types/ai';

/**
 * Hierarchical Adjustment Service
 * 
 * Implements expert brewing methodology for recipe adjustments based on analysis
 * of professional brewing adjustments. Follows a systematic priority-based approach:
 * 1. Base gravity (OG) corrections first
 * 2. Color (SRM) balance second  
 * 3. Alcohol content (ABV) adjustments third
 * 4. Hop balance (IBU) refinements last
 */
export default class HierarchicalAdjustmentService {

  /**
   * Generate a comprehensive adjustment plan following expert methodology
   */
  generateAdjustmentPlan(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics,
    compliance: StyleCompliance,
    style: BeerStyleGuide
  ): AdjustmentPlan {
    const phases: IngredientAdjustment[] = [];
    const dependencies: string[] = [];
    const warnings: string[] = [];

    // Phase 1: Base Gravity Corrections (OG)
    if (!compliance.og.inRange) {
      const gravityAdjustment = this.generateBaseGravityAdjustment(
        recipe, ingredients, metrics, compliance.og, style
      );
      if (gravityAdjustment) {
        phases.push(gravityAdjustment);
        if (gravityAdjustment.strategy.cascadingEffects.includes('srm')) {
          dependencies.push('Color adjustments depend on gravity changes');
        }
      }
    }

    // Phase 2: Color Balance (SRM)
    if (!compliance.srm.inRange) {
      const colorAdjustment = this.generateColorAdjustment(
        recipe, ingredients, metrics, compliance.srm, style
      );
      if (colorAdjustment) {
        phases.push(colorAdjustment);
        if (colorAdjustment.strategy.cascadingEffects.includes('og')) {
          dependencies.push('Specialty grain additions will affect gravity');
        }
      }
    }

    // Phase 3: Alcohol Content (ABV)
    if (!compliance.abv.inRange) {
      const alcoholAdjustment = this.generateAlcoholAdjustment(
        recipe, ingredients, metrics, compliance.abv, style
      );
      if (alcoholAdjustment) {
        phases.push(alcoholAdjustment);
      }
    }

    // Phase 4: Hop Balance (IBU)
    if (!compliance.ibu.inRange) {
      const hopAdjustment = this.generateHopAdjustment(
        recipe, ingredients, metrics, compliance.ibu, style
      );
      if (hopAdjustment) {
        phases.push(hopAdjustment);
      }
    }

    // Calculate estimated final compliance
    const estimatedCompliance = this.calculateEstimatedCompliance(phases, compliance);

    // Add warnings for complex adjustments
    if (phases.length > 3) {
      warnings.push('Complex multi-phase adjustment required - consider iterative approach');
    }

    return {
      phases,
      totalSteps: phases.length,
      estimatedCompliance,
      dependencies,
      warnings
    };
  }

  /**
   * Phase 1: Base Gravity Corrections
   * Based on expert pattern: "Base gravity first via base malt adjustments"
   */
  private generateBaseGravityAdjustment(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics,
    ogCompliance: { inRange: boolean; deviation: number; target: number; currentValue: number },
    style: BeerStyleGuide
  ): IngredientAdjustment | null {
    const baseMalts = ingredients.filter(ing => ing.type === 'grain' && ing.grain_type === 'base');
    if (baseMalts.length === 0) return null;

    const targetOG = ogCompliance.target;
    const currentOG = ogCompliance.currentValue;
    const ogDifference = targetOG - currentOG;

    // Expert pattern: Incremental changes (0.5-1 lb adjustments)
    const primaryBaseMalt = baseMalts.find(malt => 
      malt.name.includes('2-Row') || 
      malt.name.includes('Pilsner') || 
      malt.name.includes('Maris Otter')
    ) || baseMalts[0];

    // Calculate adjustment amount (expert prefers 0.5-1 lb increments)
    const adjustmentAmount = this.calculateIncrementalAdjustment(ogDifference, 0.5, 1.0);
    
    const strategy: AdjustmentStrategy = {
      phase: AdjustmentPhase.BASE_GRAVITY,
      targetMetric: 'og',
      approach: 'incremental',
      confidenceLevel: 'high',
      reasoning: `Adjust primary base malt (${primaryBaseMalt.name}) by ${adjustmentAmount} lb to reach target OG of ${targetOG.toFixed(3)}`,
      estimatedImpact: ogDifference,
      cascadingEffects: ['abv'] // OG changes affect ABV
    };

    const ingredientChanges: IngredientChange[] = [{
      ingredientId: primaryBaseMalt.id,
      ingredientName: primaryBaseMalt.name,
      field: 'amount',
      currentValue: primaryBaseMalt.amount,
      suggestedValue: primaryBaseMalt.amount + adjustmentAmount
    }];

    // Calculate expected results
    const expectedResults = this.predictMetricChanges(metrics, strategy, adjustmentAmount);

    return {
      strategy,
      ingredientChanges,
      expectedResults,
      validationChecks: [
        'Verify OG is within style range',
        'Check that base malt percentage remains above 55%',
        'Confirm ABV impact is acceptable'
      ]
    };
  }

  /**
   * Phase 2: Color Balance Corrections  
   * Based on expert pattern: "Strategic use of roasted malts for precise color control"
   */
  private generateColorAdjustment(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics,
    srmCompliance: { inRange: boolean; deviation: number; target: number; currentValue: number },
    style: BeerStyleGuide
  ): IngredientAdjustment | null {
    const targetSRM = srmCompliance.target;
    const currentSRM = srmCompliance.currentValue;
    const srmDifference = targetSRM - currentSRM;

    let strategy: AdjustmentStrategy;
    let ingredientChanges: IngredientChange[] = [];

    if (srmDifference > 0) {
      // Need to increase color - add specialty grains
      strategy = this.generateColorIncreaseStrategy(srmDifference, style);
      ingredientChanges = this.generateColorIncreaseChanges(srmDifference, ingredients, recipe);
    } else {
      // Need to decrease color - reduce dark grains
      strategy = this.generateColorDecreaseStrategy(srmDifference, style);
      ingredientChanges = this.generateColorDecreaseChanges(srmDifference, ingredients);
    }

    const expectedResults = this.predictMetricChanges(metrics, strategy, Math.abs(srmDifference));

    return {
      strategy,
      ingredientChanges,
      expectedResults,
      validationChecks: [
        'Verify SRM is within style range',
        'Check flavor balance with new specialty grains',
        'Confirm specialty grain percentage is appropriate'
      ]
    };
  }

  /**
   * Phase 3: Alcohol Content Adjustments
   * Based on expert pattern: "ABV through yeast selection and gravity management"
   */
  private generateAlcoholAdjustment(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics,
    abvCompliance: { inRange: boolean; deviation: number; target: number; currentValue: number },
    style: BeerStyleGuide
  ): IngredientAdjustment | null {
    const targetABV = abvCompliance.target;
    const currentABV = abvCompliance.currentValue;
    const abvDifference = targetABV - currentABV;

    const currentYeast = ingredients.find(ing => ing.type === 'yeast');
    if (!currentYeast) return null;

    // Expert pattern: Yeast swaps for attenuation fine-tuning
    const strategy: AdjustmentStrategy = {
      phase: AdjustmentPhase.ALCOHOL_CONTENT,
      targetMetric: 'abv',
      approach: 'ingredient_swap',
      confidenceLevel: 'medium',
      reasoning: abvDifference > 0 
        ? `Swap to higher attenuation yeast to increase ABV to ${targetABV.toFixed(1)}%`
        : `Swap to lower attenuation yeast to decrease ABV to ${targetABV.toFixed(1)}%`,
      estimatedImpact: abvDifference,
      cascadingEffects: ['fg'] // Yeast changes affect final gravity
    };

    const suggestedYeast = this.selectYeastForABVAdjustment(abvDifference, style);
    
    const ingredientChanges: IngredientChange[] = [{
      ingredientId: currentYeast.id,
      ingredientName: currentYeast.name,
      field: 'ingredient_id',
      currentValue: currentYeast.ingredient_id,
      suggestedValue: suggestedYeast.id
    }];

    const expectedResults = this.predictMetricChanges(metrics, strategy, Math.abs(abvDifference));

    return {
      strategy,
      ingredientChanges,
      expectedResults,
      validationChecks: [
        'Verify ABV is within style range',
        'Check yeast is appropriate for style',
        'Confirm fermentation characteristics match style'
      ]
    };
  }

  /**
   * Phase 4: Hop Balance Refinements
   * Based on expert pattern: "Adjust timing rather than just amounts when possible"
   */
  private generateHopAdjustment(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics,
    ibuCompliance: { inRange: boolean; deviation: number; target: number; currentValue: number },
    style: BeerStyleGuide
  ): IngredientAdjustment | null {
    const targetIBU = ibuCompliance.target;
    const currentIBU = ibuCompliance.currentValue;
    const ibuDifference = targetIBU - currentIBU;

    const hops = ingredients.filter(ing => ing.type === 'hop');
    if (hops.length === 0) return null;

    // Expert pattern: Prefer timing adjustments over amount changes
    const bittering_hops = hops.filter(hop => hop.use === 'Boil' && hop.time >= 45);
    
    let strategy: AdjustmentStrategy;
    let ingredientChanges: IngredientChange[] = [];

    if (bittering_hops.length > 0 && Math.abs(ibuDifference) < 10) {
      // Small adjustment - use timing change (expert pattern from Recipe 4)
      strategy = {
        phase: AdjustmentPhase.HOP_BALANCE,
        targetMetric: 'ibu',
        approach: 'timing_change',
        confidenceLevel: 'high',
        reasoning: `Adjust hop timing to fine-tune IBU to ${targetIBU.toFixed(0)}`,
        estimatedImpact: ibuDifference,
        cascadingEffects: [] // Timing changes have minimal cascading effects
      };

      const primaryBitteringHop = bittering_hops[0];
      ingredientChanges = [{
        ingredientId: primaryBitteringHop.id,
        ingredientName: primaryBitteringHop.name,
        field: 'time',
        currentValue: primaryBitteringHop.time,
        suggestedValue: this.calculateOptimalHopTiming(ibuDifference, primaryBitteringHop.time || 60)
      }];
    } else {
      // Large adjustment - use amount change (expert pattern from Recipe 3)
      strategy = {
        phase: AdjustmentPhase.HOP_BALANCE,
        targetMetric: 'ibu',
        approach: 'incremental',
        confidenceLevel: 'medium',
        reasoning: `Adjust hop amount to reach target IBU of ${targetIBU.toFixed(0)}`,
        estimatedImpact: ibuDifference,
        cascadingEffects: [] // Amount changes have minimal cascading effects
      };

      const primaryHop = hops[0];
      const adjustmentAmount = this.calculateHopAdjustment(ibuDifference, primaryHop.alpha_acid || 5);
      
      ingredientChanges = [{
        ingredientId: primaryHop.id,
        ingredientName: primaryHop.name,
        field: 'amount',
        currentValue: primaryHop.amount,
        suggestedValue: Math.max(0.25, primaryHop.amount + adjustmentAmount) // Minimum 0.25 oz
      }];
    }

    const expectedResults = this.predictMetricChanges(metrics, strategy, Math.abs(ibuDifference));

    return {
      strategy,
      ingredientChanges,
      expectedResults,
      validationChecks: [
        'Verify IBU is within style range',
        'Check hop balance matches style character',
        'Confirm hop utilization calculations'
      ]
    };
  }

  // Helper methods for calculations

  private calculateIncrementalAdjustment(difference: number, minIncrement: number, maxIncrement: number): number {
    // Expert pattern: Prefer 0.5-1 lb increments
    const adjustment = Math.abs(difference * 10); // Rough correlation factor
    return Math.max(minIncrement, Math.min(maxIncrement, Math.round(adjustment * 2) / 2));
  }

  private generateColorIncreaseStrategy(srmDifference: number, style: BeerStyleGuide): AdjustmentStrategy {
    // Expert patterns: Munich Dark for moderate increases, Blackprinz for precise additions
    const grainType = srmDifference > 5 ? 'Munich Dark' : 'Blackprinz';
    
    return {
      phase: AdjustmentPhase.COLOR_BALANCE,
      targetMetric: 'srm',
      approach: 'addition',
      confidenceLevel: 'high',
      reasoning: `Add ${grainType} to increase color by ${srmDifference.toFixed(1)} SRM`,
      estimatedImpact: srmDifference,
      cascadingEffects: srmDifference > 5 ? ['og'] : [] // Munich Dark affects gravity, Blackprinz minimal
    };
  }

  private generateColorDecreaseStrategy(srmDifference: number, style: BeerStyleGuide): AdjustmentStrategy {
    return {
      phase: AdjustmentPhase.COLOR_BALANCE,
      targetMetric: 'srm',
      approach: 'incremental',
      confidenceLevel: 'high',
      reasoning: `Reduce dark specialty grains to decrease color by ${Math.abs(srmDifference).toFixed(1)} SRM`,
      estimatedImpact: srmDifference,
      cascadingEffects: ['og'] // Reducing grains affects gravity
    };
  }

  private generateColorIncreaseChanges(srmDifference: number, ingredients: RecipeIngredient[], recipe: Recipe): IngredientChange[] {
    // Expert pattern: Add specialty grains for color
    const grainType = srmDifference > 5 ? 'Munich Dark' : 'Blackprinz';
    const amount = this.calculateColorGrainAmount(srmDifference);
    
    return [{
      ingredientId: `new-${grainType.toLowerCase().replace(' ', '-')}`,
      ingredientName: grainType,
      field: 'amount',
      currentValue: 0,
      suggestedValue: amount,
      isNewIngredient: true,
      newIngredientData: {
        type: 'grain',
        grain_type: 'specialty',
        color: srmDifference > 5 ? 9 : 450, // Munich Dark ~9L, Blackprinz ~450L
        use: 'Mash'
      }
    }];
  }

  private generateColorDecreaseChanges(srmDifference: number, ingredients: RecipeIngredient[]): IngredientChange[] {
    // Expert pattern: Reduce existing dark grains (like Midnight Wheat reduction in Recipe 2)
    const darkGrains = ingredients.filter(ing => 
      ing.type === 'grain' && 
      (ing.color || 0) > 50 &&
      ing.grain_type === 'roasted'
    ).sort((a, b) => (b.color || 0) - (a.color || 0)); // Darkest first
    
    if (darkGrains.length === 0) return [];
    
    const reductionGrain = darkGrains[0];
    const reductionAmount = this.calculateColorReduction(Math.abs(srmDifference), reductionGrain);
    
    return [{
      ingredientId: reductionGrain.id,
      ingredientName: reductionGrain.name,
      field: 'amount',
      currentValue: reductionGrain.amount,
      suggestedValue: Math.max(0, reductionGrain.amount - reductionAmount)
    }];
  }

  private selectYeastForABVAdjustment(abvDifference: number, style: BeerStyleGuide): { id: string; name: string } {
    // Expert pattern: Yeast swaps for attenuation control
    if (abvDifference > 0) {
      // Need higher attenuation
      return { id: 'safale-us-05', name: 'Safale US-05' }; // ~82% attenuation
    } else {
      // Need lower attenuation  
      return { id: 'wyeast-2124', name: 'Wyeast 2124 Bohemian Lager' }; // ~73% attenuation
    }
  }

  private calculateOptimalHopTiming(ibuDifference: number, currentTime: number): number {
    // Expert pattern: Timing adjustments (30min→15min as seen in Recipe 4)
    if (ibuDifference > 0) {
      // Need more IBU - increase time
      return Math.min(60, currentTime + 15);
    } else {
      // Need less IBU - decrease time
      return Math.max(5, currentTime - 15);
    }
  }

  private calculateHopAdjustment(ibuDifference: number, alphaAcid: number): number {
    // Rough calculation: 1 oz hop at 5% AA for 60 min ≈ 30 IBU in 5 gal
    const ibuPerOz = (alphaAcid / 5) * 30;
    return ibuDifference / ibuPerOz;
  }

  private calculateColorGrainAmount(srmDifference: number): number {
    // Expert pattern: Small amounts for color adjustment (25g increments from Recipe 4)
    return Math.max(0.05, Math.min(1.0, srmDifference * 0.1)); // 0.05-1.0 lb range
  }

  private calculateColorReduction(srmDifference: number, grain: RecipeIngredient): number {
    // Expert pattern: Proportional reduction based on grain color contribution
    const colorContribution = (grain.color || 0) * grain.amount;
    const reductionFactor = srmDifference / colorContribution;
    return Math.min(grain.amount, grain.amount * reductionFactor);
  }

  private predictMetricChanges(baseMetrics: RecipeMetrics, strategy: AdjustmentStrategy, magnitude: number): RecipeMetrics {
    // Simplified prediction - in real implementation, this would use CascadingEffectsService
    const predicted = { ...baseMetrics };
    
    switch (strategy.targetMetric) {
      case 'og':
        predicted.og += strategy.estimatedImpact;
        predicted.abv = (predicted.og - predicted.fg) * 131.25; // Update ABV
        break;
      case 'srm':
        predicted.srm += strategy.estimatedImpact;
        break;
      case 'abv':
        predicted.abv += strategy.estimatedImpact;
        break;
      case 'ibu':
        predicted.ibu += strategy.estimatedImpact;
        break;
    }
    
    return predicted;
  }

  private calculateEstimatedCompliance(phases: IngredientAdjustment[], baseCompliance: StyleCompliance): number {
    // Calculate estimated improvement in compliance score
    let improvements = 0;
    let totalMetrics = 5;
    
    phases.forEach(phase => {
      const metric = phase.strategy.targetMetric;
      if (!baseCompliance[metric].inRange) {
        improvements += 1;
      }
    });
    
    const baseScore = [
      baseCompliance.og.inRange,
      baseCompliance.fg.inRange,
      baseCompliance.abv.inRange,
      baseCompliance.ibu.inRange,
      baseCompliance.srm.inRange
    ].filter(Boolean).length;
    
    return Math.round(((baseScore + improvements) / totalMetrics) * 100);
  }
}