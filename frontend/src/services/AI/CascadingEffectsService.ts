import { Recipe, RecipeIngredient, RecipeMetrics } from "../../types";
import type { CascadingEffects, MetricChange, IngredientChange } from "../../types/ai";
import { Services } from "../index";

/**
 * Interface for ingredient impact modeling
 */
interface IngredientImpactModel {
  ingredientType: string;
  affects: {
    og: number;      // Impact factor on original gravity
    fg: number;      // Impact factor on final gravity  
    srm: number;     // Impact factor on color
    ibu: number;     // Impact factor on bitterness
    abv: number;     // Derived from OG/FG changes
  };
  scalingFactor: number; // How impact scales with amount
  interactionEffects: string[]; // Other metrics affected
}

/**
 * Interface for multi-metric interaction analysis
 */
interface MetricInteraction {
  primaryMetric: keyof RecipeMetrics;
  secondaryMetric: keyof RecipeMetrics;
  interactionType: 'direct' | 'inverse' | 'threshold';
  strength: number; // 0-1 interaction strength
  description: string;
}

/**
 * Enhanced Service for calculating cascading effects of ingredient changes
 * 
 * Implements expert brewing methodology for predicting complex ingredient interactions
 * based on analysis of professional brewing adjustments. Models:
 * - Multi-metric ingredient impacts (base malts affect OG, FG, ABV)
 * - Specialty grain interactions (color grains affect both SRM and gravity)
 * - Hop timing effects on IBU and flavor balance
 * - Yeast selection impacts on FG and ABV
 */
class CascadingEffectsService {

  /**
   * Ingredient impact models based on expert brewing patterns
   */
  private readonly INGREDIENT_IMPACT_MODELS: Record<string, IngredientImpactModel> = {
    // Base malts - primary impact on OG, secondary on FG/ABV
    'base_malt': {
      ingredientType: 'base_malt',
      affects: {
        og: 0.8,    // Strong impact on original gravity
        fg: 0.2,    // Moderate impact on final gravity
        srm: 0.1,   // Minimal color impact
        ibu: 0.0,   // No bitterness impact
        abv: 0.6    // Derived from OG/FG changes
      },
      scalingFactor: 1.0,
      interactionEffects: ['abv', 'fg'] // OG changes cascade to ABV and FG
    },

    // Munich Dark - affects both color and gravity (expert pattern from Recipe 4)
    'munich_dark': {
      ingredientType: 'specialty_grain',
      affects: {
        og: 0.3,    // Moderate gravity impact
        fg: 0.1,    // Slight FG impact
        srm: 0.9,   // Strong color impact
        ibu: 0.0,   // No bitterness impact
        abv: 0.2    // Slight ABV impact through gravity
      },
      scalingFactor: 0.8,
      interactionEffects: ['og', 'abv'] // Color additions affect gravity
    },

    // Blackprinz - color impact with minimal gravity effect
    'blackprinz': {
      ingredientType: 'specialty_grain',
      affects: {
        og: 0.05,   // Minimal gravity impact
        fg: 0.02,   // Negligible FG impact
        srm: 0.95,  // Very strong color impact
        ibu: 0.0,   // No bitterness impact
        abv: 0.01   // Negligible ABV impact
      },
      scalingFactor: 0.9,
      interactionEffects: [] // Minimal cascading effects
    },

    // Crystal/Caramel malts - color and some fermentability impact
    'crystal_malt': {
      ingredientType: 'specialty_grain',
      affects: {
        og: 0.2,    // Moderate gravity impact
        fg: 0.4,    // Higher FG impact (less fermentable)
        srm: 0.7,   // Strong color impact
        ibu: 0.0,   // No bitterness impact
        abv: -0.2   // Can reduce ABV due to lower fermentability
      },
      scalingFactor: 0.7,
      interactionEffects: ['fg', 'abv'] // Affects final fermentation
    },

    // Roasted grains - strong color, minimal gravity
    'roasted_grain': {
      ingredientType: 'specialty_grain',
      affects: {
        og: 0.1,    // Minimal gravity impact
        fg: 0.05,   // Very slight FG impact
        srm: 0.85,  // Very strong color impact
        ibu: 0.0,   // No bitterness impact
        abv: 0.05   // Negligible ABV impact
      },
      scalingFactor: 0.95,
      interactionEffects: [] // Minimal cascading effects
    },

    // Hops - primary IBU impact, possible SRM impact for large amounts
    'hop': {
      ingredientType: 'hop',
      affects: {
        og: 0.0,    // No gravity impact
        fg: 0.0,    // No FG impact
        srm: 0.02,  // Minimal color impact
        ibu: 0.9,   // Primary bitterness impact
        abv: 0.0    // No ABV impact
      },
      scalingFactor: 1.0,
      interactionEffects: [] // Isolated impact
    },

    // Yeast - primary impact on FG and ABV
    'yeast': {
      ingredientType: 'yeast',
      affects: {
        og: 0.0,    // No gravity impact
        fg: 0.8,    // Strong FG impact through attenuation
        srm: 0.0,   // No color impact
        ibu: 0.0,   // No bitterness impact
        abv: 0.7    // Strong ABV impact through attenuation
      },
      scalingFactor: 0.5, // Yeast impact is more about selection than amount
      interactionEffects: ['abv'] // FG changes directly affect ABV
    }
  };

  /**
   * Metric interaction patterns based on expert observations
   */
  private readonly METRIC_INTERACTIONS: MetricInteraction[] = [
    {
      primaryMetric: 'og',
      secondaryMetric: 'abv',
      interactionType: 'direct',
      strength: 0.9,
      description: 'OG changes directly impact ABV potential'
    },
    {
      primaryMetric: 'fg',
      secondaryMetric: 'abv',
      interactionType: 'inverse',
      strength: 0.8,
      description: 'Lower FG increases ABV'
    },
    {
      primaryMetric: 'og',
      secondaryMetric: 'fg',
      interactionType: 'direct',
      strength: 0.3,
      description: 'Higher OG tends to result in higher FG'
    },
    {
      primaryMetric: 'srm',
      secondaryMetric: 'og',
      interactionType: 'threshold',
      strength: 0.2,
      description: 'Specialty grains for color also contribute to gravity'
    }
  ];

  /**
   * Calculate the cascading effects of ingredient changes with enhanced modeling
   */
  async calculateCascadingEffects(
    recipe: Recipe,
    currentIngredients: RecipeIngredient[],
    ingredientChanges: IngredientChange[],
    currentMetrics: RecipeMetrics
  ): Promise<CascadingEffects> {
    // First, predict using ingredient impact models
    const modeledMetrics = this.predictMetricsUsingModels(
      currentMetrics,
      ingredientChanges,
      currentIngredients
    );

    // Apply the changes to create a new ingredient list
    const updatedIngredients = this.applyIngredientChanges(
      currentIngredients,
      ingredientChanges
    );

    // Calculate new metrics with the updated ingredients for validation
    let predictedMetrics: RecipeMetrics;
    try {
      predictedMetrics = await Services.metrics.calculateMetrics(
        recipe,
        updatedIngredients
      );
    } catch (error) {
      console.warn('Falling back to modeled metrics due to calculation error:', error);
      predictedMetrics = modeledMetrics;
    }

    // Blend modeled and calculated metrics for more accurate predictions
    const blendedMetrics = this.blendMetricPredictions(modeledMetrics, predictedMetrics);

    // Calculate the changes for each metric
    const metricChanges = this.calculateMetricChanges(
      currentMetrics,
      blendedMetrics
    );

    // Add interaction analysis
    const enhancedMetricChanges = this.analyzeMetricInteractions(metricChanges, ingredientChanges);

    // Create impacts object with specific metrics
    const impacts = {
      og: enhancedMetricChanges.find(m => m.metric === 'og')!,
      fg: enhancedMetricChanges.find(m => m.metric === 'fg')!,
      abv: enhancedMetricChanges.find(m => m.metric === 'abv')!,
      ibu: enhancedMetricChanges.find(m => m.metric === 'ibu')!,
      srm: enhancedMetricChanges.find(m => m.metric === 'srm')!,
    };

    return {
      predictedMetrics: blendedMetrics,
      metricChanges: enhancedMetricChanges,
      impacts,
    };
  }

  /**
   * Predict metrics using ingredient impact models (expert pattern-based)
   */
  private predictMetricsUsingModels(
    currentMetrics: RecipeMetrics,
    ingredientChanges: IngredientChange[],
    currentIngredients: RecipeIngredient[]
  ): RecipeMetrics {
    
    const predictedMetrics = { ...currentMetrics };
    
    for (const change of ingredientChanges) {
      const ingredient = this.findIngredientForChange(change, currentIngredients);
      if (!ingredient) continue;

      const impactModel = this.getImpactModelForIngredient(ingredient, change);
      if (!impactModel) continue;

      // Calculate amount change
      const amountChange = this.calculateAmountChange(change, ingredient);
      
      // Apply impact model to each metric
      Object.keys(impactModel.affects).forEach(metric => {
        const metricKey = metric as keyof RecipeMetrics;
        const impactFactor = impactModel.affects[metricKey];
        const scaledImpact = amountChange * impactFactor * impactModel.scalingFactor;
        
        predictedMetrics[metricKey] += scaledImpact;
      });
    }

    // Apply metric interactions
    predictedMetrics.abv = this.calculateABVFromGravity(predictedMetrics.og, predictedMetrics.fg);

    return predictedMetrics;
  }

  /**
   * Blend modeled and calculated metrics for improved accuracy
   */
  private blendMetricPredictions(
    modeledMetrics: RecipeMetrics,
    calculatedMetrics: RecipeMetrics
  ): RecipeMetrics {
    
    // Weight factors: trust calculated metrics more for gravity/ABV, modeled for color/IBU
    const weights = {
      og: { modeled: 0.3, calculated: 0.7 },
      fg: { modeled: 0.2, calculated: 0.8 },
      abv: { modeled: 0.2, calculated: 0.8 },
      ibu: { modeled: 0.6, calculated: 0.4 }, // Trust models more for IBU
      srm: { modeled: 0.7, calculated: 0.3 }  // Trust models more for color
    };

    const blended: RecipeMetrics = {} as RecipeMetrics;

    Object.keys(weights).forEach(metric => {
      const metricKey = metric as keyof RecipeMetrics;
      const weight = weights[metricKey];
      
      blended[metricKey] = 
        (modeledMetrics[metricKey] * weight.modeled) + 
        (calculatedMetrics[metricKey] * weight.calculated);
    });

    return blended;
  }

  /**
   * Analyze metric interactions and adjust predictions
   */
  private analyzeMetricInteractions(
    metricChanges: MetricChange[],
    _ingredientChanges: IngredientChange[]
  ): MetricChange[] {
    
    const enhancedChanges = [...metricChanges];

    // Apply interaction effects
    for (const interaction of this.METRIC_INTERACTIONS) {
      const primaryChange = enhancedChanges.find(m => m.metric === interaction.primaryMetric);
      const secondaryChange = enhancedChanges.find(m => m.metric === interaction.secondaryMetric);
      
      if (primaryChange && secondaryChange && Math.abs(primaryChange.change) > 0.001) {
        const interactionEffect = this.calculateInteractionEffect(
          primaryChange,
          interaction
        );
        
        // Apply interaction effect to secondary metric
        secondaryChange.predictedValue += interactionEffect;
        secondaryChange.change = secondaryChange.predictedValue - secondaryChange.currentValue;
        secondaryChange.changePercent = secondaryChange.currentValue !== 0 
          ? (secondaryChange.change / secondaryChange.currentValue) * 100 
          : 0;
      }
    }

    return enhancedChanges;
  }

  /**
   * Calculate interaction effect between metrics
   */
  private calculateInteractionEffect(
    primaryChange: MetricChange,
    interaction: MetricInteraction
  ): number {
    
    const baseEffect = Math.abs(primaryChange.change) * interaction.strength;
    
    switch (interaction.interactionType) {
      case 'direct':
        return primaryChange.change > 0 ? baseEffect : -baseEffect;
      case 'inverse':
        return primaryChange.change > 0 ? -baseEffect : baseEffect;
      case 'threshold':
        // Only apply if change exceeds threshold
        return Math.abs(primaryChange.change) > 0.005 ? baseEffect : 0;
      default:
        return 0;
    }
  }

  /**
   * Get appropriate impact model for ingredient and change type
   */
  private getImpactModelForIngredient(
    ingredient: RecipeIngredient,
    change: IngredientChange
  ): IngredientImpactModel | null {
    
    // Special handling for new ingredients
    if (change.isNewIngredient && change.newIngredientData) {
      const grainType = change.newIngredientData.grain_type;
      if (grainType === 'base_malt') return this.INGREDIENT_IMPACT_MODELS['base_malt'];
      
      // Map specialty grain types to models
      const ingredientName = change.ingredientName.toLowerCase();
      if (ingredientName.includes('munich dark')) return this.INGREDIENT_IMPACT_MODELS['munich_dark'];
      if (ingredientName.includes('blackprinz')) return this.INGREDIENT_IMPACT_MODELS['blackprinz'];
      if (ingredientName.includes('crystal') || ingredientName.includes('caramel')) {
        return this.INGREDIENT_IMPACT_MODELS['crystal_malt'];
      }
      
      return this.INGREDIENT_IMPACT_MODELS['roasted_grain']; // Default for dark grains
    }

    // Handle existing ingredients
    switch (ingredient.type) {
      case 'grain':
        if (ingredient.grain_type === 'base_malt') {
          return this.INGREDIENT_IMPACT_MODELS['base_malt'];
        } else {
          // Determine specialty grain subtype
          const grainName = ingredient.name.toLowerCase();
          if (grainName.includes('crystal') || grainName.includes('caramel')) {
            return this.INGREDIENT_IMPACT_MODELS['crystal_malt'];
          }
          return this.INGREDIENT_IMPACT_MODELS['roasted_grain'];
        }
      case 'hop':
        return this.INGREDIENT_IMPACT_MODELS['hop'];
      case 'yeast':
        return this.INGREDIENT_IMPACT_MODELS['yeast'];
      default:
        return null;
    }
  }

  /**
   * Calculate amount change from IngredientChange
   */
  private calculateAmountChange(change: IngredientChange, ingredient?: RecipeIngredient): number {
    if (change.field !== 'amount') return 0;
    
    if (change.isNewIngredient) {
      return change.suggestedValue; // New ingredient addition
    }
    
    if (!ingredient) return 0;
    
    return change.suggestedValue - change.currentValue; // Change in existing ingredient
  }

  /**
   * Find ingredient associated with a change
   */
  private findIngredientForChange(
    change: IngredientChange,
    ingredients: RecipeIngredient[]
  ): RecipeIngredient | null {
    
    if (change.isNewIngredient) {
      // Create a mock ingredient for new additions
      return {
        id: change.ingredientId,
        ingredient_id: change.ingredientId,
        name: change.ingredientName,
        type: change.newIngredientData?.type || 'grain',
        amount: 0,
        unit: 'lb',
        grain_type: change.newIngredientData?.grain_type
      } as RecipeIngredient;
    }
    
    return ingredients.find(ing => ing.id === change.ingredientId) || null;
  }

  /**
   * Calculate ABV from gravity readings
   */
  private calculateABVFromGravity(og: number, fg: number): number {
    return (og - fg) * 131.25; // Standard ABV calculation
  }

  /**
   * Apply ingredient changes to create an updated ingredient list
   */
  private applyIngredientChanges(
    currentIngredients: RecipeIngredient[],
    changes: IngredientChange[]
  ): RecipeIngredient[] {
    let updatedIngredients = [...currentIngredients];

    for (const change of changes) {
      // Handle new ingredient additions
      if (change.isNewIngredient && change.newIngredientData) {
        const newIngredient: RecipeIngredient = {
          id: change.ingredientId, // Temporary ID for calculations
          ingredient_id: null, // Will be generated by server
          name: change.newIngredientData.name || change.ingredientName,
          type: change.newIngredientData.type as any || 'grain',
          amount: Number(change.newIngredientData.amount || change.suggestedValue),
          unit: (change.newIngredientData.unit || 'lb') as any,
          grain_type: change.newIngredientData.grain_type as any,
          color: change.newIngredientData.color || 50,
          potential: 1.035, // Default potential for specialty grains
          use: 'mash'
        };
        updatedIngredients.push(newIngredient);
        continue;
      }
      
      // Handle existing ingredient modifications
      // Validate the suggested value before applying
      if (change.field === 'amount' && (
        !isFinite(change.suggestedValue) || 
        change.suggestedValue <= 0 ||
        change.suggestedValue === null ||
        change.suggestedValue === undefined
      )) {
        console.warn(`Invalid suggested value for ingredient ${change.ingredientName}: ${change.suggestedValue}`);
        continue; // Skip this change
      }
      
      updatedIngredients = updatedIngredients.map(ingredient => {
        if (ingredient.id === change.ingredientId) {
          return {
            ...ingredient,
            [change.field]: change.suggestedValue,
          };
        }
        return ingredient;
      });
    }

    return updatedIngredients;
  }

  /**
   * Calculate the changes between current and predicted metrics
   */
  private calculateMetricChanges(
    currentMetrics: RecipeMetrics,
    predictedMetrics: RecipeMetrics
  ): MetricChange[] {
    const metrics: (keyof RecipeMetrics)[] = ['og', 'fg', 'abv', 'ibu', 'srm'];
    
    return metrics.map(metric => {
      const currentValue = currentMetrics[metric];
      const predictedValue = predictedMetrics[metric];
      const change = predictedValue - currentValue;
      const changePercent = currentValue !== 0 ? (change / currentValue) * 100 : 0;

      return {
        metric,
        currentValue,
        predictedValue,
        change,
        changePercent,
      };
    });
  }

  /**
   * Format metric changes for display
   */
  formatMetricChange(change: MetricChange): string {
    const { metric, currentValue, predictedValue, change: delta } = change;
    
    const formatValue = (value: number): string => {
      switch (metric) {
        case 'og':
        case 'fg':
          return value.toFixed(3);
        case 'abv':
          return `${value.toFixed(1)}%`;
        case 'ibu':
          return Math.round(value).toString();
        case 'srm':
          return value.toFixed(1);
        default:
          return value.toString();
      }
    };

    const sign = delta > 0 ? '+' : '';
    const formattedCurrent = formatValue(currentValue);
    const formattedPredicted = formatValue(predictedValue);
    const formattedDelta = formatValue(delta);

    return `${formattedCurrent} → ${formattedPredicted} (${sign}${formattedDelta})`;
  }

  /**
   * Get impact description for a metric change
   */
  getImpactDescription(change: MetricChange): string {
    const { metric, change: delta } = change;
    
    if (Math.abs(delta) < 0.001) {
      return 'No significant change';
    }

    const direction = delta > 0 ? 'increase' : 'decrease';
    const magnitude = Math.abs(delta);

    switch (metric) {
      case 'og':
        return `OG will ${direction} by ${magnitude.toFixed(3)}`;
      case 'fg':
        return `FG will ${direction} by ${magnitude.toFixed(3)}`;
      case 'abv':
        return `ABV will ${direction} by ${magnitude.toFixed(1)}%`;
      case 'ibu':
        return `IBU will ${direction} by ${Math.round(magnitude)}`;
      case 'srm':
        return `Color will ${direction} by ${magnitude.toFixed(1)} SRM`;
      default:
        return `${String(metric).toUpperCase()} will ${direction}`;
    }
  }

  /**
   * Check if the predicted changes will cause style compliance issues
   */
  predictStyleCompliance(
    _currentMetrics: RecipeMetrics,
    _predictedMetrics: RecipeMetrics,
    _styleName?: string
  ): {
    willImprove: boolean;
    willWorsen: boolean;
    newIssues: string[];
    resolvedIssues: string[];
  } {
    // This is a placeholder - would need style guideline integration
    // For now, return a basic analysis
    return {
      willImprove: false,
      willWorsen: false,
      newIssues: [],
      resolvedIssues: [],
    };
  }
}

export default CascadingEffectsService;
// Types are now exported from types/ai.ts