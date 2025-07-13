import { RecipeIngredient } from '../../types';
import { BeerStyleGuide } from '../../types/beer-styles';
import type { IngredientChange } from '../../types/ai';

/**
 * Interface for specialty grain color adjustment
 */
interface ColorAdjustmentStrategy {
  grainType: 'munich_dark' | 'blackprinz' | 'midnight_wheat' | 'crystal_reduction' | 'roasted_reduction';
  grainName: string;
  amount: number; // in pounds
  unit: string;
  estimatedSRMChange: number;
  reasoning: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  cascadingEffects: string[];
}

/**
 * Interface for specialty grain analysis
 */
interface SpecialtyGrainAnalysis {
  currentColorGrains: RecipeIngredient[];
  totalColorContribution: number;
  dominantColorSource: string;
  adjustmentStrategy: ColorAdjustmentStrategy | null;
  alternatives: ColorAdjustmentStrategy[];
}

/**
 * Specialty Grain Service for AI recipe color corrections
 * 
 * Implements expert brewing methodology for precise color control based on analysis
 * of professional brewing adjustments. Follows patterns observed:
 * - Munich Dark for moderate color increases (Recipe 4: +25g for precise SRM control)
 * - Blackprinz for dark color additions with minimal flavor impact
 * - Midnight Wheat for smooth dark color without harshness
 * - Strategic reduction of existing dark grains when SRM is too high
 */
export default class SpecialtyGrainService {

  /**
   * Specialty grain characteristics for color adjustment
   */
  private readonly SPECIALTY_GRAIN_CHARACTERISTICS = {
    'Munich Dark': {
      color: 9,
      flavor: 'Rich, malty, bread-like character',
      use: 'Color and flavor enhancement',
      maxPercentage: 20,
      minAmount: 0.05, // 0.05 lb = ~25g (expert pattern)
      incrementSize: 0.05,
      cascadingEffects: ['og', 'fg'], // Affects gravity
      confidenceLevel: 'high' as const
    },
    'Blackprinz': {
      color: 450,
      flavor: 'Very dark color with minimal roasted character',
      use: 'Precise color adjustment',
      maxPercentage: 5,
      minAmount: 0.05, // 25g minimum
      incrementSize: 0.05,
      cascadingEffects: [], // Minimal gravity impact
      confidenceLevel: 'high' as const
    },
    'Midnight Wheat': {
      color: 550,
      flavor: 'Smooth dark color without harsh roasted bite',
      use: 'Dark color with smooth character',
      maxPercentage: 8,
      minAmount: 0.05,
      incrementSize: 0.05,
      cascadingEffects: [], // Minimal gravity impact
      confidenceLevel: 'medium' as const
    },
    'Chocolate Malt': {
      color: 350,
      flavor: 'Rich chocolate and coffee notes',
      use: 'Dark color and flavor',
      maxPercentage: 10,
      minAmount: 0.1,
      incrementSize: 0.1,
      cascadingEffects: ['og'],
      confidenceLevel: 'medium' as const
    },
    'Roasted Barley': {
      color: 550,
      flavor: 'Sharp roasted character, coffee-like',
      use: 'Intense dark color and roasted flavor',
      maxPercentage: 10,
      minAmount: 0.1,
      incrementSize: 0.1,
      cascadingEffects: ['og'],
      confidenceLevel: 'medium' as const
    }
  };

  /**
   * Generate color adjustment strategy based on target SRM change
   */
  generateColorAdjustmentStrategy(
    currentSRM: number,
    targetSRM: number,
    currentIngredients: RecipeIngredient[],
    styleGuide?: BeerStyleGuide,
    totalGrainWeight?: number
  ): SpecialtyGrainAnalysis {
    
    const srmDifference = targetSRM - currentSRM;
    const colorGrains = this.identifyColorGrains(currentIngredients);
    
    let strategy: ColorAdjustmentStrategy | null = null;
    const alternatives: ColorAdjustmentStrategy[] = [];

    if (srmDifference > 0) {
      // Need to increase color
      strategy = this.generateColorIncreaseStrategy(
        srmDifference, 
        colorGrains, 
        styleGuide, 
        totalGrainWeight || 10
      );
      
      // Generate alternative strategies
      alternatives.push(...this.generateColorIncreaseAlternatives(
        srmDifference, 
        colorGrains, 
        styleGuide, 
        totalGrainWeight || 10
      ));
    } else if (srmDifference < 0) {
      // Need to decrease color
      strategy = this.generateColorDecreaseStrategy(
        Math.abs(srmDifference), 
        colorGrains, 
        styleGuide
      );
      
      // Generate alternative strategies
      alternatives.push(...this.generateColorDecreaseAlternatives(
        Math.abs(srmDifference), 
        colorGrains, 
        styleGuide
      ));
    }

    return {
      currentColorGrains: colorGrains,
      totalColorContribution: this.calculateTotalColorContribution(colorGrains),
      dominantColorSource: this.identifyDominantColorSource(colorGrains),
      adjustmentStrategy: strategy,
      alternatives
    };
  }

  /**
   * Generate color increase strategy following expert patterns
   */
  private generateColorIncreaseStrategy(
    srmIncrease: number,
    currentColorGrains: RecipeIngredient[],
    styleGuide?: BeerStyleGuide,
    totalGrainWeight: number = 10
  ): ColorAdjustmentStrategy {
    
    // Expert pattern decision tree based on SRM increase magnitude
    if (srmIncrease <= 2) {
      // Small adjustment - use Blackprinz (expert pattern from Recipe 4)
      return this.generateBlackprinzAddition(srmIncrease, totalGrainWeight, styleGuide);
    } else if (srmIncrease <= 8) {
      // Moderate adjustment - use Munich Dark (expert preference for flavor balance)
      return this.generateMunichDarkAddition(srmIncrease, totalGrainWeight, styleGuide);
    } else {
      // Large adjustment - use traditional dark grains
      return this.generateDarkGrainAddition(srmIncrease, totalGrainWeight, styleGuide);
    }
  }

  /**
   * Generate Blackprinz addition strategy (expert pattern for precise color control)
   */
  private generateBlackprinzAddition(
    srmIncrease: number,
    totalGrainWeight: number,
    styleGuide?: BeerStyleGuide
  ): ColorAdjustmentStrategy {
    
    // Expert pattern: 25g increments for precise control
    // Rough calculation: 1 oz Blackprinz (~450L) in 5 gal ≈ 8-10 SRM increase
    const baseAmount = 0.05; // 25g = ~0.05 lb
    const srmPerIncrement = 8; // Conservative estimate
    
    const increments = Math.max(1, Math.round(srmIncrease / srmPerIncrement));
    const amount = baseAmount * increments;
    
    return {
      grainType: 'blackprinz',
      grainName: 'Blackprinz',
      amount,
      unit: 'lb',
      estimatedSRMChange: srmIncrease,
      reasoning: `Add ${this.formatAmount(amount)} Blackprinz for precise color control. Expert pattern: minimal flavor impact, maximum color efficiency`,
      confidenceLevel: 'high',
      cascadingEffects: []
    };
  }

  /**
   * Generate Munich Dark addition strategy (expert pattern for balanced color/flavor)
   */
  private generateMunichDarkAddition(
    srmIncrease: number,
    totalGrainWeight: number,
    styleGuide?: BeerStyleGuide
  ): ColorAdjustmentStrategy {
    
    // Munich Dark provides both color and flavor enhancement
    // Rough calculation: 1 lb Munich Dark (~9L) ≈ 1-2 SRM increase in 5 gal
    const srmPerPound = 1.5;
    const baseAmount = srmIncrease / srmPerPound;
    
    // Round to 0.05 lb increments (expert pattern)
    const amount = Math.round(baseAmount * 20) / 20;
    
    return {
      grainType: 'munich_dark',
      grainName: 'Munich Dark',
      amount,
      unit: 'lb',
      estimatedSRMChange: srmIncrease,
      reasoning: `Add ${this.formatAmount(amount)} Munich Dark for color and rich malty character. Expert pattern: balanced color/flavor enhancement`,
      confidenceLevel: 'high',
      cascadingEffects: ['og', 'fg']
    };
  }

  /**
   * Generate traditional dark grain addition strategy
   */
  private generateDarkGrainAddition(
    srmIncrease: number,
    totalGrainWeight: number,
    styleGuide?: BeerStyleGuide
  ): ColorAdjustmentStrategy {
    
    // For large color increases, use traditional dark grains
    const grainChoice = this.selectDarkGrainForStyle(styleGuide);
    const grainChars = this.SPECIALTY_GRAIN_CHARACTERISTICS[grainChoice];
    
    // Calculate amount needed
    const srmPerPound = grainChars.color / 100; // Rough calculation
    const amount = Math.max(grainChars.minAmount, srmIncrease / srmPerPound);
    
    return {
      grainType: grainChoice === 'Chocolate Malt' ? 'crystal_reduction' : 'roasted_reduction',
      grainName: grainChoice,
      amount: Math.round(amount * 20) / 20, // 0.05 lb increments
      unit: 'lb',
      estimatedSRMChange: srmIncrease,
      reasoning: `Add ${this.formatAmount(amount)} ${grainChoice} for significant color increase. ${grainChars.flavor}`,
      confidenceLevel: grainChars.confidenceLevel,
      cascadingEffects: grainChars.cascadingEffects
    };
  }

  /**
   * Generate color decrease strategy (expert pattern: reduce existing dark grains)
   */
  private generateColorDecreaseStrategy(
    srmDecrease: number,
    currentColorGrains: RecipeIngredient[],
    styleGuide?: BeerStyleGuide
  ): ColorAdjustmentStrategy | null {
    
    // Expert pattern: Reduce the darkest grain first (Recipe 2: Midnight Wheat reduction)
    const darkestGrains = currentColorGrains
      .filter(grain => (grain.color || 0) > 50)
      .sort((a, b) => (b.color || 0) - (a.color || 0));

    if (darkestGrains.length === 0) {
      return null;
    }

    const targetGrain = darkestGrains[0];
    const colorContribution = (targetGrain.color || 0) * this.convertToPounds(targetGrain.amount, targetGrain.unit || 'lb');
    
    // Calculate reduction needed
    const reductionFactor = srmDecrease / colorContribution;
    const reductionAmount = Math.min(
      targetGrain.amount,
      targetGrain.amount * reductionFactor
    );

    // Round to 0.05 lb increments
    const roundedReduction = Math.round(reductionAmount * 20) / 20;

    return {
      grainType: 'roasted_reduction',
      grainName: targetGrain.name,
      amount: -roundedReduction, // Negative for reduction
      unit: targetGrain.unit || 'lb',
      estimatedSRMChange: -srmDecrease,
      reasoning: `Reduce ${targetGrain.name} by ${this.formatAmount(roundedReduction)} to decrease color. Expert pattern: target darkest grain first`,
      confidenceLevel: 'high',
      cascadingEffects: ['og']
    };
  }

  /**
   * Generate alternative color adjustment strategies
   */
  private generateColorIncreaseAlternatives(
    srmIncrease: number,
    currentColorGrains: RecipeIngredient[],
    styleGuide?: BeerStyleGuide,
    totalGrainWeight: number = 10
  ): ColorAdjustmentStrategy[] {
    
    const alternatives: ColorAdjustmentStrategy[] = [];
    
    // Alternative 1: Midnight Wheat for smooth dark character
    if (srmIncrease > 3) {
      const amount = Math.max(0.05, srmIncrease / 12); // Midnight Wheat efficiency
      alternatives.push({
        grainType: 'midnight_wheat',
        grainName: 'Midnight Wheat',
        amount: Math.round(amount * 20) / 20,
        unit: 'lb',
        estimatedSRMChange: srmIncrease,
        reasoning: `Alternative: ${this.formatAmount(amount)} Midnight Wheat for smooth dark color without harsh roasted bite`,
        confidenceLevel: 'medium',
        cascadingEffects: []
      });
    }

    // Alternative 2: Different approach based on current color grains
    if (currentColorGrains.length === 0) {
      // No existing color grains - suggest Munich Dark as base
      alternatives.push(this.generateMunichDarkAddition(srmIncrease, totalGrainWeight, styleGuide));
    }

    return alternatives;
  }

  /**
   * Generate alternative color decrease strategies
   */
  private generateColorDecreaseAlternatives(
    srmDecrease: number,
    currentColorGrains: RecipeIngredient[],
    styleGuide?: BeerStyleGuide
  ): ColorAdjustmentStrategy[] {
    
    const alternatives: ColorAdjustmentStrategy[] = [];
    
    // Alternative approaches for color reduction
    const mediumDarkGrains = currentColorGrains.filter(grain => 
      (grain.color || 0) > 20 && (grain.color || 0) < 200
    );

    if (mediumDarkGrains.length > 0) {
      const targetGrain = mediumDarkGrains[0];
      const reductionAmount = 0.1; // Conservative reduction
      
      alternatives.push({
        grainType: 'crystal_reduction',
        grainName: targetGrain.name,
        amount: -reductionAmount,
        unit: targetGrain.unit || 'lb',
        estimatedSRMChange: -srmDecrease * 0.7, // Partial reduction
        reasoning: `Alternative: Reduce ${targetGrain.name} by ${this.formatAmount(reductionAmount)} for gentler color adjustment`,
        confidenceLevel: 'medium',
        cascadingEffects: ['og']
      });
    }

    return alternatives;
  }

  /**
   * Convert ingredient changes to IngredientChange format
   */
  convertToIngredientChanges(
    strategy: ColorAdjustmentStrategy,
    currentIngredients: RecipeIngredient[]
  ): IngredientChange[] {
    
    if (strategy.amount > 0) {
      // Adding new ingredient
      return [{
        ingredientId: `new-${strategy.grainName.toLowerCase().replace(/\s+/g, '-')}`,
        ingredientName: strategy.grainName,
        field: 'amount',
        currentValue: 0,
        suggestedValue: strategy.amount,
        isNewIngredient: true,
        newIngredientData: {
          type: 'grain',
          grain_type: 'specialty',
          color: this.SPECIALTY_GRAIN_CHARACTERISTICS[strategy.grainName]?.color || 50,
          use: 'Mash',
          unit: strategy.unit
        }
      }];
    } else {
      // Reducing existing ingredient
      const existingGrain = currentIngredients.find(ing => 
        ing.name === strategy.grainName && ing.type === 'grain'
      );
      
      if (!existingGrain) return [];
      
      return [{
        ingredientId: existingGrain.id,
        ingredientName: existingGrain.name,
        field: 'amount',
        currentValue: existingGrain.amount,
        suggestedValue: Math.max(0, existingGrain.amount + strategy.amount) // amount is negative
      }];
    }
  }

  // Helper methods

  private identifyColorGrains(ingredients: RecipeIngredient[]): RecipeIngredient[] {
    return ingredients.filter(ing => 
      ing.type === 'grain' && 
      (ing.color || 0) > 3 && 
      ing.grain_type !== 'base_malt'
    );
  }

  private calculateTotalColorContribution(colorGrains: RecipeIngredient[]): number {
    return colorGrains.reduce((sum, grain) => {
      const weightLbs = this.convertToPounds(grain.amount, grain.unit || 'lb');
      return sum + (grain.color || 0) * weightLbs;
    }, 0);
  }

  private identifyDominantColorSource(colorGrains: RecipeIngredient[]): string {
    if (colorGrains.length === 0) return 'No specialty grains';
    
    const dominant = colorGrains.reduce((prev, current) => {
      const prevContribution = (prev.color || 0) * this.convertToPounds(prev.amount, prev.unit || 'lb');
      const currentContribution = (current.color || 0) * this.convertToPounds(current.amount, current.unit || 'lb');
      return currentContribution > prevContribution ? current : prev;
    });
    
    return dominant.name;
  }

  private selectDarkGrainForStyle(styleGuide?: BeerStyleGuide): string {
    if (!styleGuide) return 'Chocolate Malt';
    
    const styleName = styleGuide.name.toLowerCase();
    
    if (styleName.includes('stout')) {
      return 'Roasted Barley';
    } else if (styleName.includes('porter')) {
      return 'Chocolate Malt';
    } else {
      return 'Chocolate Malt'; // Default
    }
  }

  private convertToPounds(amount: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'g': return amount * 0.00220462;
      case 'kg': return amount * 2.20462;
      case 'oz': return amount / 16;
      case 'lb': default: return amount;
    }
  }

  private formatAmount(amount: number): string {
    if (amount < 0.1) {
      return `${Math.round(amount * 1000)}g`;
    } else {
      return `${amount} lb`;
    }
  }
}