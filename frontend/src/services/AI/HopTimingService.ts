import { RecipeIngredient } from '../../types';
import { BeerStyleGuide } from '../../types/beer-styles';
import type { IngredientChange } from '../../types/ai';

/**
 * Interface for hop timing analysis
 */
interface HopTimingAnalysis {
  currentHops: RecipeIngredient[];
  bitteringHops: RecipeIngredient[];
  flavorHops: RecipeIngredient[];
  aromaHops: RecipeIngredient[];
  timingIssues: string[];
  optimizationStrategy: HopTimingStrategy | null;
}

/**
 * Interface for hop timing strategy
 */
interface HopTimingStrategy {
  adjustmentType: 'timing_optimization' | 'utilization_enhancement' | 'balance_improvement';
  targetHop: RecipeIngredient;
  currentTiming: number;
  suggestedTiming: number;
  estimatedIBUChange: number;
  reasoning: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  alternatives: HopTimingAlternative[];
}

/**
 * Interface for alternative timing strategies
 */
interface HopTimingAlternative {
  description: string;
  timing: number;
  estimatedIBUChange: number;
  reasoning: string;
}

/**
 * Hop Timing Service for AI recipe IBU optimization
 * 
 * Implements expert brewing methodology for hop timing adjustments based on analysis
 * of professional brewing adjustments. Follows patterns observed:
 * - Recipe 4: Prefer timing changes over amount changes (30min → 15min)
 * - Small IBU adjustments through strategic timing modifications
 * - Conservative approach that maintains hop character balance
 */
export default class HopTimingService {

  /**
   * Hop utilization curves and timing characteristics
   */
  private readonly HOP_UTILIZATION_DATA = {
    // Standard utilization percentages for different boil times
    utilization: {
      90: 0.35,  // 90 minutes
      75: 0.32,  // 75 minutes
      60: 0.30,  // 60 minutes (standard bittering)
      45: 0.25,  // 45 minutes
      30: 0.18,  // 30 minutes (flavor addition)
      20: 0.13,  // 20 minutes
      15: 0.10,  // 15 minutes (late flavor)
      10: 0.08,  // 10 minutes
      5: 0.05,   // 5 minutes (aroma)
      1: 0.02,   // 1 minute (aroma)
      0: 0.01    // Whirlpool/hopstand
    },
    
    // IBU contribution factors
    ibuFormula: {
      // IBU = (alpha acid % × amount in oz × utilization) / (batch size in gal) × correction factor
      correctionFactor: 74.9,
      standardBatchSize: 5.0
    }
  };

  /**
   * Timing optimization thresholds
   */
  private readonly TIMING_OPTIMIZATION = {
    smallAdjustment: 5,     // IBU changes < 5 - prefer timing
    mediumAdjustment: 15,   // IBU changes 5-15 - timing + small amount changes
    largeAdjustment: 15,    // IBU changes > 15 - amount changes
    
    minBitteringTime: 45,   // Minimum for effective bittering
    maxBitteringTime: 90,   // Maximum practical bittering time
    
    flavorTimingRange: [10, 30],  // Optimal flavor hop timing
    aromaTimingRange: [0, 10],    // Optimal aroma hop timing
    
    timingIncrements: [5, 10, 15, 20, 30, 45, 60, 75, 90] // Standard timing increments
  };

  /**
   * Analyze current hop timing and generate optimization strategy
   */
  analyzeHopTiming(
    currentIBU: number,
    targetIBU: number,
    currentHops: RecipeIngredient[],
    originalGravity: number = 1.050,
    batchSize: number = 5.0,
    styleGuide?: BeerStyleGuide
  ): HopTimingAnalysis {
    
    const ibuDifference = targetIBU - currentIBU;
    const hops = currentHops.filter(ing => ing.type === 'hop');
    
    // Categorize hops by timing
    const bitteringHops = hops.filter(hop => (hop.time || 60) >= 45);
    const flavorHops = hops.filter(hop => {
      const time = hop.time || 60;
      return time >= 10 && time < 45;
    });
    const aromaHops = hops.filter(hop => (hop.time || 60) < 10);

    // Identify timing issues
    const timingIssues = this.identifyTimingIssues(hops, styleGuide);

    // Generate optimization strategy
    const optimizationStrategy = this.generateHopTimingStrategy(
      ibuDifference,
      hops,
      originalGravity,
      batchSize,
      styleGuide
    );

    return {
      currentHops: hops,
      bitteringHops,
      flavorHops,
      aromaHops,
      timingIssues,
      optimizationStrategy
    };
  }

  /**
   * Generate hop timing optimization strategy following expert patterns
   */
  private generateHopTimingStrategy(
    ibuDifference: number,
    hops: RecipeIngredient[],
    originalGravity: number,
    batchSize: number,
    styleGuide?: BeerStyleGuide
  ): HopTimingStrategy | null {
    
    if (hops.length === 0) return null;

    const absIBUDiff = Math.abs(ibuDifference);

    // Expert pattern: Use timing adjustments for small changes (< 10 IBU)
    if (absIBUDiff <= this.TIMING_OPTIMIZATION.smallAdjustment) {
      return this.generateTimingOnlyStrategy(ibuDifference, hops, originalGravity, batchSize, styleGuide);
    }
    
    // For medium changes, still prefer timing if possible
    if (absIBUDiff <= this.TIMING_OPTIMIZATION.mediumAdjustment) {
      const timingStrategy = this.generateTimingOnlyStrategy(ibuDifference, hops, originalGravity, batchSize, styleGuide);
      if (timingStrategy) return timingStrategy;
    }

    // For large changes, recommend amount adjustments instead
    return null;
  }

  /**
   * Generate timing-only optimization strategy (expert pattern from Recipe 4)
   */
  private generateTimingOnlyStrategy(
    ibuDifference: number,
    hops: RecipeIngredient[],
    originalGravity: number,
    batchSize: number,
    styleGuide?: BeerStyleGuide
  ): HopTimingStrategy | null {
    
    // Find the best hop for timing adjustment
    const candidateHop = this.selectHopForTimingAdjustment(hops, ibuDifference);
    if (!candidateHop) return null;

    const currentTiming = candidateHop.time || 60;
    const targetIBUChange = ibuDifference;

    // Calculate optimal new timing
    const suggestedTiming = this.calculateOptimalTiming(
      candidateHop,
      currentTiming,
      targetIBUChange,
      originalGravity,
      batchSize
    );

    if (suggestedTiming === currentTiming) return null;

    // Calculate actual IBU change
    const estimatedIBUChange = this.calculateIBUChangeFromTiming(
      candidateHop,
      currentTiming,
      suggestedTiming,
      originalGravity,
      batchSize
    );

    // Generate alternatives
    const alternatives = this.generateTimingAlternatives(
      candidateHop,
      currentTiming,
      targetIBUChange,
      originalGravity,
      batchSize
    );

    const reasoning = this.generateTimingReasoning(
      candidateHop,
      currentTiming,
      suggestedTiming,
      estimatedIBUChange,
      styleGuide
    );

    return {
      adjustmentType: 'timing_optimization',
      targetHop: candidateHop,
      currentTiming,
      suggestedTiming,
      estimatedIBUChange,
      reasoning,
      confidenceLevel: this.calculateTimingConfidence(candidateHop, currentTiming, suggestedTiming),
      alternatives
    };
  }

  /**
   * Select best hop for timing adjustment based on expert patterns
   */
  private selectHopForTimingAdjustment(
    hops: RecipeIngredient[],
    ibuDifference: number
  ): RecipeIngredient | null {
    
    // Expert pattern: Prefer bittering hops for timing adjustments
    const bitteringHops = hops.filter(hop => (hop.time || 60) >= 45);
    
    if (bitteringHops.length > 0) {
      // Select hop with highest alpha acid for maximum impact
      return bitteringHops.reduce((best, current) => 
        (current.alpha_acid || 0) > (best.alpha_acid || 0) ? current : best
      );
    }

    // If no bittering hops, use flavor hops (30min range)
    const flavorHops = hops.filter(hop => {
      const time = hop.time || 60;
      return time >= 20 && time < 45;
    });

    if (flavorHops.length > 0) {
      return flavorHops.reduce((best, current) => 
        (current.alpha_acid || 0) > (best.alpha_acid || 0) ? current : best
      );
    }

    // Last resort: any hop
    return hops.length > 0 ? hops[0] : null;
  }

  /**
   * Calculate optimal timing for target IBU change
   */
  private calculateOptimalTiming(
    hop: RecipeIngredient,
    currentTiming: number,
    targetIBUChange: number,
    originalGravity: number,
    batchSize: number
  ): number {
    
    const currentUtilization = this.getUtilization(currentTiming, originalGravity);
    const currentIBU = this.calculateHopIBU(hop, currentUtilization, batchSize);
    const targetIBU = currentIBU + targetIBUChange;

    // Find timing that gets closest to target IBU
    let bestTiming = currentTiming;
    let bestDifference = Math.abs(targetIBUChange);

    for (const timing of this.TIMING_OPTIMIZATION.timingIncrements) {
      // Skip if timing is the same as current
      if (timing === currentTiming) continue;
      
      // Check if timing makes sense for this hop type
      if (!this.isTimingAppropriate(timing, hop)) continue;

      const utilization = this.getUtilization(timing, originalGravity);
      const projectedIBU = this.calculateHopIBU(hop, utilization, batchSize);
      const projectedChange = projectedIBU - currentIBU;
      const difference = Math.abs(projectedChange - targetIBUChange);

      if (difference < bestDifference) {
        bestDifference = difference;
        bestTiming = timing;
      }
    }

    return bestTiming;
  }

  /**
   * Calculate IBU change from timing modification
   */
  private calculateIBUChangeFromTiming(
    hop: RecipeIngredient,
    oldTiming: number,
    newTiming: number,
    originalGravity: number,
    batchSize: number
  ): number {
    
    const oldUtilization = this.getUtilization(oldTiming, originalGravity);
    const newUtilization = this.getUtilization(newTiming, originalGravity);
    
    const oldIBU = this.calculateHopIBU(hop, oldUtilization, batchSize);
    const newIBU = this.calculateHopIBU(hop, newUtilization, batchSize);
    
    return newIBU - oldIBU;
  }

  /**
   * Generate alternative timing strategies
   */
  private generateTimingAlternatives(
    hop: RecipeIngredient,
    currentTiming: number,
    targetIBUChange: number,
    originalGravity: number,
    batchSize: number
  ): HopTimingAlternative[] {
    
    const alternatives: HopTimingAlternative[] = [];
    
    // Conservative timing changes (expert pattern: 15-minute increments)
    const conservativeTimings = targetIBUChange > 0 
      ? [currentTiming + 15, currentTiming + 30]  // Increase utilization
      : [currentTiming - 15, currentTiming - 30]; // Decrease utilization

    for (const timing of conservativeTimings) {
      if (timing > 0 && timing <= 90 && this.isTimingAppropriate(timing, hop)) {
        const ibuChange = this.calculateIBUChangeFromTiming(
          hop, currentTiming, timing, originalGravity, batchSize
        );
        
        alternatives.push({
          description: `${timing} minutes`,
          timing,
          estimatedIBUChange: ibuChange,
          reasoning: `Conservative ${Math.abs(timing - currentTiming)}-minute adjustment`
        });
      }
    }

    return alternatives;
  }

  /**
   * Generate reasoning for timing adjustment
   */
  private generateTimingReasoning(
    hop: RecipeIngredient,
    currentTiming: number,
    suggestedTiming: number,
    estimatedIBUChange: number,
    styleGuide?: BeerStyleGuide
  ): string {
    
    const direction = suggestedTiming > currentTiming ? 'increase' : 'decrease';
    const timingChange = Math.abs(suggestedTiming - currentTiming);
    
    let reasoning = `${direction === 'increase' ? 'Increase' : 'Decrease'} ${hop.name} timing `;
    reasoning += `from ${currentTiming} to ${suggestedTiming} minutes `;
    reasoning += `(${estimatedIBUChange > 0 ? '+' : ''}${estimatedIBUChange.toFixed(1)} IBU). `;
    
    // Add expert pattern note
    reasoning += `Expert pattern: prefer timing adjustments over amount changes for small IBU corrections. `;
    
    // Add timing-specific reasoning
    if (suggestedTiming >= 60) {
      reasoning += 'Extended boil time maximizes bittering extraction';
    } else if (suggestedTiming >= 30) {
      reasoning += 'Mid-boil timing balances bitterness and flavor';
    } else if (suggestedTiming >= 15) {
      reasoning += 'Late addition preserves hop flavor character';
    } else {
      reasoning += 'Very late addition emphasizes aroma over bitterness';
    }

    // Add style-specific context
    if (styleGuide) {
      const styleName = styleGuide.name.toLowerCase();
      if (styleName.includes('ipa') && suggestedTiming >= 45) {
        reasoning += '. Bittering foundation supports hop-forward character';
      } else if (styleName.includes('lager') && suggestedTiming >= 60) {
        reasoning += '. Clean bittering appropriate for lager styles';
      }
    }

    return reasoning;
  }

  /**
   * Calculate confidence level for timing adjustment
   */
  private calculateTimingConfidence(
    hop: RecipeIngredient,
    currentTiming: number,
    suggestedTiming: number
  ): 'high' | 'medium' | 'low' {
    
    const timingDifference = Math.abs(suggestedTiming - currentTiming);
    
    // High confidence for small, logical timing changes
    if (timingDifference <= 15 && this.isTimingAppropriate(suggestedTiming, hop)) {
      return 'high';
    }
    
    // Medium confidence for moderate changes
    if (timingDifference <= 30 && this.isTimingAppropriate(suggestedTiming, hop)) {
      return 'medium';
    }
    
    // Lower confidence for large timing changes
    return 'low';
  }

  /**
   * Convert timing strategy to IngredientChange format
   */
  convertToIngredientChange(strategy: HopTimingStrategy): IngredientChange {
    return {
      ingredientId: strategy.targetHop.id,
      ingredientName: strategy.targetHop.name,
      field: 'time',
      currentValue: strategy.currentTiming,
      suggestedValue: strategy.suggestedTiming
    };
  }

  // Helper methods

  /**
   * Get hop utilization based on timing and gravity
   */
  private getUtilization(timing: number, originalGravity: number): number {
    // Get base utilization from timing
    let baseUtilization = 0;
    
    // Find closest timing in utilization table
    const timings = Object.keys(this.HOP_UTILIZATION_DATA.utilization)
      .map(Number)
      .sort((a, b) => Math.abs(a - timing) - Math.abs(b - timing));
    
    baseUtilization = this.HOP_UTILIZATION_DATA.utilization[timings[0] as keyof typeof this.HOP_UTILIZATION_DATA.utilization];
    
    // Adjust for gravity (higher gravity = lower utilization)
    const gravityFactor = 1.65 * Math.pow(0.000125, originalGravity - 1);
    
    return baseUtilization * gravityFactor;
  }

  /**
   * Calculate IBU contribution from a hop
   */
  private calculateHopIBU(
    hop: RecipeIngredient,
    utilization: number,
    batchSize: number
  ): number {
    
    const alphaAcid = hop.alpha_acid || 5; // Default 5% if not specified
    const amount = hop.amount; // Assume in ounces
    const { correctionFactor } = this.HOP_UTILIZATION_DATA.ibuFormula;
    
    return (alphaAcid * amount * utilization * correctionFactor) / batchSize;
  }

  /**
   * Check if timing is appropriate for hop type/use
   */
  private isTimingAppropriate(timing: number, hop: RecipeIngredient): boolean {
    const hopUse = hop.use?.toLowerCase() || 'boil';
    
    // Boil hops can be used at any timing
    if (hopUse === 'boil') return timing >= 0 && timing <= 90;
    
    // Dry hop timing doesn't make sense for boil timing adjustments
    if (hopUse === 'dry hop') return false;
    
    // Whirlpool/hopstand hops typically 0-20 minutes
    if (hopUse === 'whirlpool' || hopUse === 'hopstand') {
      return timing >= 0 && timing <= 20;
    }
    
    return true;
  }

  /**
   * Identify timing issues in current hop schedule
   */
  private identifyTimingIssues(hops: RecipeIngredient[], styleGuide?: BeerStyleGuide): string[] {
    const issues: string[] = [];
    
    // Check for missing bittering hops
    const bitteringHops = hops.filter(hop => (hop.time || 60) >= 60);
    if (bitteringHops.length === 0 && hops.length > 0) {
      issues.push('No bittering hops (60+ minutes) - may lack sufficient bitterness foundation');
    }
    
    // Check for excessive late hop timing concentration
    const lateHops = hops.filter(hop => (hop.time || 60) <= 10);
    if (lateHops.length > 3) {
      issues.push('Many late hop additions - consider consolidating for cleaner flavor profile');
    }
    
    // Style-specific timing checks
    if (styleGuide) {
      const styleName = styleGuide.name.toLowerCase();
      
      if (styleName.includes('ipa')) {
        const midRangeHops = hops.filter(hop => {
          const time = hop.time || 60;
          return time >= 15 && time <= 30;
        });
        
        if (midRangeHops.length === 0) {
          issues.push('IPA may benefit from mid-boil hop additions (15-30 min) for flavor complexity');
        }
      }
    }
    
    return issues;
  }
}