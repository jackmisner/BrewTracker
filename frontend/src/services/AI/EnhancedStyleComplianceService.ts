import { RecipeMetrics } from '../../types';
import { BeerStyleGuide, StyleRange } from '../../types/beer-styles';
import type { StyleCharacteristics, StyleCompliance, StyleOptimizationTarget, AdjustmentPhase } from '../../types/ai';

/**
 * Enhanced Style Compliance Service
 * 
 * Provides deep BJCP style analysis, characteristic detection, and optimization
 * recommendations based on comprehensive style guidelines.
 */
export default class EnhancedStyleComplianceService {
  /**
   * Analyzes a beer style to extract brewing characteristics
   */
  analyzeStyleCharacteristics(style: BeerStyleGuide): StyleCharacteristics {
    const description = this.getCombinedDescription(style);
    const keywords = this.extractKeywords(description);
    
    // Analyze hop vs malt character
    const hopKeywords = ['hop', 'hoppy', 'bitter', 'citrus', 'piney', 'floral', 'resin', 'dank', 'tropical'];
    const maltKeywords = ['malt', 'malty', 'sweet', 'bread', 'biscuit', 'caramel', 'toast', 'rich', 'smooth'];
    
    const hopScore = this.calculateKeywordScore(keywords, hopKeywords);
    const maltScore = this.calculateKeywordScore(keywords, maltKeywords);
    
    // Analyze color characteristics
    const isDark = this.isStyleDark(style);
    const isLight = this.isStyleLight(style);
    
    // Determine primary character
    const isHopForward = hopScore > maltScore && hopScore > 0.3;
    const isMaltForward = maltScore > hopScore && maltScore > 0.3;
    const isBalanced = Math.abs(hopScore - maltScore) < 0.2;
    
    // Analyze complexity
    const complexityKeywords = ['complex', 'layered', 'nuanced', 'sophisticated', 'intricate'];
    const simpleKeywords = ['clean', 'simple', 'straightforward', 'crisp', 'refreshing'];
    const complexityScore = this.calculateKeywordScore(keywords, complexityKeywords);
    const simplicityScore = this.calculateKeywordScore(keywords, simpleKeywords);
    
    let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
    if (complexityScore > 0.3) complexity = 'complex';
    else if (simplicityScore > 0.3) complexity = 'simple';
    
    // Extract flavor profiles
    const primaryFlavors = this.extractPrimaryFlavors(description);
    const secondaryFlavors = this.extractSecondaryFlavors(description);
    
    return {
      isHopForward,
      isMaltForward,
      isBalanced,
      isDark,
      isLight,
      complexity,
      primaryFlavors,
      secondaryFlavors,
      keywords
    };
  }

  /**
   * Performs comprehensive style compliance analysis
   */
  analyzeStyleCompliance(metrics: RecipeMetrics, style: BeerStyleGuide): StyleCompliance {
    const characteristics = this.analyzeStyleCharacteristics(style);
    
    // Analyze each metric with style-aware priorities
    const og = { ...this.analyzeMetricCompliance('og', metrics.og, style.original_gravity, characteristics), currentValue: metrics.og };
    const fg = { ...this.analyzeMetricCompliance('fg', metrics.fg, style.final_gravity, characteristics), currentValue: metrics.fg };
    const abv = { ...this.analyzeMetricCompliance('abv', metrics.abv, style.alcohol_by_volume, characteristics), currentValue: metrics.abv };
    const ibu = { ...this.analyzeMetricCompliance('ibu', metrics.ibu, style.international_bitterness_units, characteristics), currentValue: metrics.ibu };
    const srm = { ...this.analyzeMetricCompliance('srm', metrics.srm, style.color, characteristics), currentValue: metrics.srm };
    
    // Calculate overall score with weighted priorities
    const metrics_array = [og, fg, abv, ibu, srm];
    const totalPriorityWeight = metrics_array.reduce((sum, m) => sum + m.priority, 0);
    const weightedScore = metrics_array.reduce((sum, m) => {
      const metricScore = m.inRange ? 1 : Math.max(0, 1 - Math.abs(m.deviation) / 0.5);
      return sum + (metricScore * m.priority);
    }, 0);
    const overallScore = Math.round((weightedScore / totalPriorityWeight) * 100);
    
    // Identify critical issues and improvement areas
    const criticalIssues = this.identifyCriticalIssues(metrics_array, characteristics);
    const improvementAreas = this.identifyImprovementAreas(metrics_array, characteristics);
    
    return {
      og,
      fg,
      abv,
      ibu,
      srm,
      overallScore,
      criticalIssues,
      improvementAreas
    };
  }

  /**
   * Generates optimization targets based on style compliance analysis
   */
  generateOptimizationTargets(compliance: StyleCompliance, style: BeerStyleGuide): StyleOptimizationTarget[] {
    const targets: StyleOptimizationTarget[] = [];
    const characteristics = this.analyzeStyleCharacteristics(style);
    
    // Prioritize targets based on style characteristics and current compliance
    const metrics = ['og', 'fg', 'abv', 'ibu', 'srm'] as const;
    
    for (const metric of metrics) {
      const metricData = compliance[metric];
      
      // Generate targets for out-of-range metrics (critical)
      if (!metricData.inRange) {
        const target = this.calculateOptimalTarget(metric, metricData, style, characteristics);
        if (target) {
          targets.push(target);
        }
      }
      // Also generate targets for metrics that are in range but could be optimized
      else if (metricData.deviation > 0.1) {
        const target = this.calculateOptimalTarget(metric, metricData, style, characteristics);
        if (target) {
          // Lower priority for in-range optimizations
          target.priority = target.priority * 0.8;
          target.impactType = target.impactType === 'critical' ? 'important' : 
                             target.impactType === 'important' ? 'nice-to-have' : 'nice-to-have';
          targets.push(target);
        }
      }
    }
    
    // Sort by priority and impact
    return targets.sort((a, b) => {
      if (a.impactType !== b.impactType) {
        const impactOrder = { 'critical': 3, 'important': 2, 'nice-to-have': 1 };
        return impactOrder[b.impactType] - impactOrder[a.impactType];
      }
      return b.priority - a.priority;
    });
  }

  /**
   * Determines if a style prioritizes certain characteristics
   */
  getStylePriorities(characteristics: StyleCharacteristics): Record<string, number> {
    const priorities: Record<string, number> = {
      hop_character: 1,
      malt_character: 1,
      balance: 1,
      color: 1,
      strength: 1
    };
    
    // Adjust priorities based on style characteristics
    if (characteristics.isHopForward) {
      priorities.hop_character = 2;
      priorities.balance = 0.5;
    }
    
    if (characteristics.isMaltForward) {
      priorities.malt_character = 2;
      priorities.balance = 0.5;
    }
    
    if (characteristics.isDark || characteristics.isLight) {
      priorities.color = 1.5;
    }
    
    if (characteristics.complexity === 'complex') {
      priorities.balance = 1.5;
    }
    
    return priorities;
  }

  // Private helper methods
  
  private getCombinedDescription(style: BeerStyleGuide): string {
    const parts = [
      style.overall_impression,
      style.aroma,
      style.appearance,
      style.flavor,
      style.mouthfeel,
      style.comments
    ].filter(Boolean);
    
    return parts.join(' ').toLowerCase();
  }

  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful brewing terms
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'a', 'an'];
    
    return text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 50); // Limit to most relevant terms
  }

  private calculateKeywordScore(keywords: string[], targetWords: string[]): number {
    const matches = keywords.filter(keyword => 
      targetWords.some(target => keyword.includes(target) || target.includes(keyword))
    );
    return matches.length / Math.max(keywords.length, 1);
  }

  private isStyleDark(style: BeerStyleGuide): boolean {
    const colorRange = style.color;
    if (!colorRange?.minimum?.value || !colorRange?.maximum?.value) return false;
    
    // Consider dark if minimum SRM > 15 or maximum > 25
    return colorRange.minimum.value > 15 || colorRange.maximum.value > 25;
  }

  private isStyleLight(style: BeerStyleGuide): boolean {
    const colorRange = style.color;
    if (!colorRange?.minimum?.value || !colorRange?.maximum?.value) return false;
    
    // Consider light if maximum SRM < 6
    return colorRange.maximum.value < 6;
  }

  private extractPrimaryFlavors(description: string): string[] {
    const flavorKeywords = [
      'hop', 'malt', 'fruit', 'citrus', 'pine', 'floral', 'spice', 'bread', 'biscuit',
      'caramel', 'chocolate', 'coffee', 'roast', 'smoke', 'vanilla', 'oak', 'tart',
      'sour', 'sweet', 'bitter', 'dry', 'crisp', 'smooth', 'rich', 'clean'
    ];
    
    return flavorKeywords.filter(flavor => description.includes(flavor));
  }

  private extractSecondaryFlavors(description: string): string[] {
    const secondaryKeywords = [
      'subtle', 'hint', 'note', 'touch', 'background', 'finish', 'aftertaste',
      'complex', 'layered', 'balanced', 'harmonious'
    ];
    
    return secondaryKeywords.filter(flavor => description.includes(flavor));
  }

  private analyzeMetricCompliance(
    metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm',
    value: number,
    range: StyleRange | undefined,
    characteristics: StyleCharacteristics
  ) {
    if (!range?.minimum?.value || !range?.maximum?.value) {
      return { inRange: true, deviation: 0, target: value, priority: 1 };
    }
    
    const min = range.minimum.value;
    const max = range.maximum.value;
    const midpoint = (min + max) / 2;
    
    const inRange = value >= min && value <= max;
    let deviation = 0;
    
    if (value < min) {
      deviation = (min - value) / min;
    } else if (value > max) {
      deviation = (value - max) / max;
    }
    
    // Calculate priority based on style characteristics
    const priority = this.calculateMetricPriority(metric, characteristics);
    
    return {
      inRange,
      deviation,
      target: midpoint,
      priority
    };
  }

  private calculateMetricPriority(metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm', characteristics: StyleCharacteristics): number {
    let priority = 1;
    
    switch (metric) {
      case 'ibu':
        if (characteristics.isHopForward) priority = 2;
        break;
      case 'srm':
        if (characteristics.isDark || characteristics.isLight) priority = 1.5;
        break;
      case 'og':
      case 'abv':
        priority = 1.5; // Always important for style compliance
        break;
      case 'fg':
        if (characteristics.isMaltForward) priority = 1.5;
        break;
    }
    
    return priority;
  }

  private identifyCriticalIssues(metrics: any[], _characteristics: StyleCharacteristics): string[] {
    const issues: string[] = [];
    
    for (const metric of metrics) {
      if (!metric.inRange && metric.deviation > 0.3 && metric.priority > 1.5) {
        issues.push(`${metric.metric?.toUpperCase()} significantly out of range`);
      }
    }
    
    return issues;
  }

  private identifyImprovementAreas(metrics: any[], _characteristics: StyleCharacteristics): string[] {
    const areas: string[] = [];
    
    for (const metric of metrics) {
      if (!metric.inRange && metric.deviation > 0.1) {
        areas.push(`Adjust ${metric.metric?.toUpperCase()} to style range`);
      }
    }
    
    return areas;
  }

  private calculateOptimalTarget(
    metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm',
    metricData: any,
    style: BeerStyleGuide,
    characteristics: StyleCharacteristics
  ): StyleOptimizationTarget | null {
    const range = this.getStyleRange(metric, style);
    if (!range) return null;
    
    const min = range.minimum.value;
    const max = range.maximum.value;
    
    // Calculate optimal target based on style characteristics
    let targetValue = (min + max) / 2; // Default to midpoint
    
    // Adjust target based on style characteristics
    if (metric === 'ibu' && characteristics.isHopForward) {
      targetValue = min + (max - min) * 0.7; // Aim for upper range
    } else if (metric === 'ibu' && characteristics.isMaltForward) {
      targetValue = min + (max - min) * 0.3; // Aim for lower range
    } else if (metric === 'srm' && characteristics.isDark) {
      targetValue = min + (max - min) * 0.6; // Darker end
    } else if (metric === 'srm' && characteristics.isLight) {
      targetValue = min + (max - min) * 0.4; // Lighter end
    }
    
    const impactType = this.determineImpactType(metricData.deviation, metricData.priority);
    const reasoning = this.generateTargetReasoning(metric, targetValue, characteristics);
    
    return {
      metric,
      currentValue: metricData.currentValue,
      targetValue,
      priority: metricData.priority,
      reasoning,
      impactType
    };
  }

  private getStyleRange(metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm', style: BeerStyleGuide): StyleRange | undefined {
    switch (metric) {
      case 'og': return style.original_gravity;
      case 'fg': return style.final_gravity;
      case 'abv': return style.alcohol_by_volume;
      case 'ibu': return style.international_bitterness_units;
      case 'srm': return style.color;
      default: return undefined;
    }
  }

  private determineImpactType(deviation: number, priority: number): 'critical' | 'important' | 'nice-to-have' {
    if (deviation > 0.3 && priority > 1.5) return 'critical';
    if (deviation > 0.2 || priority > 1.2) return 'important';
    return 'nice-to-have';
  }

  private generateTargetReasoning(metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm', target: number, characteristics: StyleCharacteristics): string {
    const metricNames = {
      og: 'Original Gravity',
      fg: 'Final Gravity', 
      abv: 'ABV',
      ibu: 'IBU',
      srm: 'SRM'
    };
    
    let reasoning = `Target ${metricNames[metric]} of ${target.toFixed(metric === 'og' || metric === 'fg' ? 3 : 1)}`;
    
    if (metric === 'ibu' && characteristics.isHopForward) {
      reasoning += ' for proper hop character';
    } else if (metric === 'ibu' && characteristics.isMaltForward) {
      reasoning += ' to maintain malt balance';
    } else if (metric === 'srm' && characteristics.isDark) {
      reasoning += ' for authentic dark appearance';
    } else if (metric === 'srm' && characteristics.isLight) {
      reasoning += ' for crisp, light appearance';
    } else {
      reasoning += ' for style compliance';
    }
    
    return reasoning;
  }

  /**
   * Analyzes dependencies between adjustment phases to prevent conflicts
   * Based on expert patterns: base gravity affects ABV, specialty grains affect color AND gravity
   */
  analyzeDependencies(targets: StyleOptimizationTarget[]): { dependencies: string[]; conflicts: string[]; recommendedOrder: AdjustmentPhase[] } {
    const dependencies: string[] = [];
    const conflicts: string[] = [];
    const phases: AdjustmentPhase[] = [];

    // Map targets to adjustment phases based on expert methodology
    const phaseMap = new Map<string, AdjustmentPhase>();
    targets.forEach(target => {
      switch (target.metric) {
        case 'og':
          phaseMap.set('og', AdjustmentPhase.BASE_GRAVITY);
          break;
        case 'srm':
          phaseMap.set('srm', AdjustmentPhase.COLOR_BALANCE);
          break;
        case 'abv':
          phaseMap.set('abv', AdjustmentPhase.ALCOHOL_CONTENT);
          break;
        case 'ibu':
          phaseMap.set('ibu', AdjustmentPhase.HOP_BALANCE);
          break;
      }
    });

    // Analyze dependencies based on expert patterns
    if (phaseMap.has('og') && phaseMap.has('abv')) {
      dependencies.push('ABV adjustments depend on OG changes - adjust base gravity first');
    }

    if (phaseMap.has('og') && phaseMap.has('srm')) {
      dependencies.push('Color additions (specialty grains) will affect gravity - coordinate adjustments');
    }

    if (phaseMap.has('srm') && phaseMap.has('abv')) {
      dependencies.push('Specialty grain additions affect both color and alcohol potential');
    }

    // Detect potential conflicts
    if (targets.filter(t => t.impactType === 'critical').length > 2) {
      conflicts.push('Multiple critical adjustments may create cascading effects - consider iterative approach');
    }

    if (phaseMap.has('og') && phaseMap.has('ibu') && targets.length > 3) {
      conflicts.push('Complex multi-metric adjustment - hop balance may need re-adjustment after gravity changes');
    }

    // Recommended order based on expert methodology
    const recommendedOrder: AdjustmentPhase[] = [
      AdjustmentPhase.BASE_GRAVITY,
      AdjustmentPhase.COLOR_BALANCE,
      AdjustmentPhase.ALCOHOL_CONTENT,
      AdjustmentPhase.HOP_BALANCE
    ].filter(phase => Array.from(phaseMap.values()).includes(phase));

    return {
      dependencies,
      conflicts,
      recommendedOrder
    };
  }

  /**
   * Validates if an adjustment conflicts with style authenticity
   * Prevents inappropriate ingredient suggestions based on style guidelines
   */
  validateStyleAuthenticity(metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm', adjustmentType: string, style: BeerStyleGuide): { isValid: boolean; reason?: string } {
    const styleName = style.style_name?.toLowerCase() || '';
    
    // German style authenticity checks
    if (styleName.includes('german') || styleName.includes('helles') || styleName.includes('märzen') || styleName.includes('bock')) {
      if (adjustmentType.includes('adjunct') && metric === 'og') {
        return { 
          isValid: false, 
          reason: 'German styles traditionally use all-malt grain bills - avoid adjunct additions' 
        };
      }
      
      if (adjustmentType.includes('american') && metric === 'ibu') {
        return { 
          isValid: false, 
          reason: 'German styles should use traditional European hop varieties' 
        };
      }
    }

    // American IPA authenticity checks
    if (styleName.includes('american') && styleName.includes('ipa')) {
      if (adjustmentType.includes('crystal') && metric === 'srm') {
        return { 
          isValid: true, 
          reason: 'Crystal malt additions appropriate for American IPA complexity' 
        };
      }
    }

    // Stout authenticity checks
    if (styleName.includes('stout')) {
      if (adjustmentType.includes('roasted') && metric === 'srm') {
        return { 
          isValid: true, 
          reason: 'Roasted grain management essential for stout color balance' 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Calculates confidence level for adjustment suggestions based on expert patterns
   */
  calculateAdjustmentConfidence(
    metric: 'og' | 'fg' | 'abv' | 'ibu' | 'srm',
    deviation: number,
    adjustmentType: string,
    style: BeerStyleGuide
  ): 'high' | 'medium' | 'low' {
    // High confidence for patterns directly observed in expert adjustments
    if (metric === 'og' && adjustmentType === 'base_malt_incremental' && deviation < 0.02) {
      return 'high'; // Expert pattern: small base malt adjustments
    }

    if (metric === 'srm' && adjustmentType === 'specialty_grain_addition' && deviation < 10) {
      return 'high'; // Expert pattern: specialty grain color control
    }

    if (metric === 'ibu' && adjustmentType === 'hop_timing' && deviation < 10) {
      return 'high'; // Expert pattern: timing over amount changes
    }

    // Medium confidence for established brewing principles
    if (metric === 'abv' && adjustmentType === 'yeast_swap') {
      return 'medium'; // Expert pattern: yeast for attenuation control
    }

    // Lower confidence for complex or style-specific adjustments
    if (deviation > 0.5 || adjustmentType.includes('complex')) {
      return 'low';
    }

    return 'medium';
  }
}