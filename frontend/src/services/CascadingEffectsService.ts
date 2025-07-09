import { Recipe, RecipeIngredient, RecipeMetrics } from "../types";
import { Services } from "./index";

/**
 * Interface for ingredient change predictions
 */
interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
}

/**
 * Interface for predicted metric changes
 */
interface MetricChange {
  metric: keyof RecipeMetrics;
  currentValue: number;
  predictedValue: number;
  change: number;
  changePercent: number;
}

/**
 * Interface for cascading effects analysis
 */
interface CascadingEffects {
  predictedMetrics: RecipeMetrics;
  metricChanges: MetricChange[];
  impacts: {
    og: MetricChange;
    fg: MetricChange;
    abv: MetricChange;
    ibu: MetricChange;
    srm: MetricChange;
  };
}

/**
 * Service for calculating cascading effects of ingredient changes
 */
class CascadingEffectsService {


  /**
   * Calculate the cascading effects of ingredient changes
   */
  async calculateCascadingEffects(
    recipe: Recipe,
    currentIngredients: RecipeIngredient[],
    ingredientChanges: IngredientChange[],
    currentMetrics: RecipeMetrics
  ): Promise<CascadingEffects> {
    // Apply the changes to create a new ingredient list
    const updatedIngredients = this.applyIngredientChanges(
      currentIngredients,
      ingredientChanges
    );

    // Calculate new metrics with the updated ingredients
    const predictedMetrics = await Services.metrics.calculateMetrics(
      recipe,
      updatedIngredients
    );

    // Calculate the changes for each metric
    const metricChanges = this.calculateMetricChanges(
      currentMetrics,
      predictedMetrics
    );

    // Create impacts object with specific metrics
    const impacts = {
      og: metricChanges.find(m => m.metric === 'og')!,
      fg: metricChanges.find(m => m.metric === 'fg')!,
      abv: metricChanges.find(m => m.metric === 'abv')!,
      ibu: metricChanges.find(m => m.metric === 'ibu')!,
      srm: metricChanges.find(m => m.metric === 'srm')!,
    };

    return {
      predictedMetrics,
      metricChanges,
      impacts,
    };
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
export type { CascadingEffects, MetricChange, IngredientChange };