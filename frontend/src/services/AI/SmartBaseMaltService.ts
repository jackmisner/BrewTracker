import { Recipe, RecipeIngredient } from '../../types';
import { BeerStyleGuide } from '../../types/beer-styles';
import BeerStyleService from '../Data/BeerStyleService';

/**
 * Interface for base malt selection analysis
 */
interface BaseMaltAnalysis {
  preferredMalts: string[];
  styleCharacteristics: {
    isHopForward: boolean;
    isDarkStyle: boolean;
    isLightStyle: boolean;
    requiresComplexMalt: boolean;
    primaryFlavors: string[];
  };
  recommendations: BaseMaltRecommendation[];
}

/**
 * Interface for base malt recommendations
 */
interface BaseMaltRecommendation {
  maltName: string;
  maltType: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suitabilityScore: number;
}

/**
 * Interface for grain bill analysis
 */
interface GrainBillAnalysis {
  totalGrains: number;
  baseMaltPercentage: number;
  specialtyGrainTypes: string[];
  colorContribution: number;
  flavorProfile: string[];
  fermentability: number;
}

/**
 * Smart base malt selection service for AI recipe suggestions
 */
class SmartBaseMaltService {
  
  /**
   * Style-specific base malt preferences mapped by style_id
   */
  private readonly STYLE_MALT_PREFERENCES: { [key: string]: BaseMaltAnalysis } = {
    // Light Lagers
    '1A': { // American Light Lager
      preferredMalts: ['Pilsner', '2-Row', 'Lager Malt'],
      styleCharacteristics: {
        isHopForward: false,
        isDarkStyle: false,
        isLightStyle: true,
        requiresComplexMalt: false,
        primaryFlavors: ['clean', 'neutral', 'crisp']
      },
      recommendations: [
        { maltName: 'Pilsner', maltType: 'base_malt', reason: 'Clean, neutral character ideal for light lagers', priority: 'high', suitabilityScore: 95 },
        { maltName: '2-Row', maltType: 'base_malt', reason: 'Neutral base with good enzyme activity', priority: 'high', suitabilityScore: 90 }
      ]
    },
    
    // IPAs
    '21A': { // American IPA
      preferredMalts: ['2-Row', 'Pale Malt', 'Maris Otter'],
      styleCharacteristics: {
        isHopForward: true,
        isDarkStyle: false,
        isLightStyle: false,
        requiresComplexMalt: false,
        primaryFlavors: ['neutral', 'slightly_sweet', 'clean']
      },
      recommendations: [
        { maltName: '2-Row', maltType: 'base_malt', reason: 'Clean backbone that doesn\'t compete with hop flavors', priority: 'high', suitabilityScore: 95 },
        { maltName: 'Pale Malt', maltType: 'base_malt', reason: 'Slightly more character than 2-Row, complements hops well', priority: 'high', suitabilityScore: 90 },
        { maltName: 'Maris Otter', maltType: 'base_malt', reason: 'Adds subtle biscuit notes that complement citrus hops', priority: 'medium', suitabilityScore: 85 }
      ]
    },
    
    // Stouts
    '20A': { // American Stout
      preferredMalts: ['2-Row', 'Pale Malt', 'Maris Otter'],
      styleCharacteristics: {
        isHopForward: false,
        isDarkStyle: true,
        isLightStyle: false,
        requiresComplexMalt: true,
        primaryFlavors: ['roasted', 'coffee', 'chocolate', 'rich']
      },
      recommendations: [
        { maltName: '2-Row', maltType: 'base_malt', reason: 'Neutral base allows roasted malts to shine', priority: 'high', suitabilityScore: 90 },
        { maltName: 'Maris Otter', maltType: 'base_malt', reason: 'Adds complexity that complements roasted flavors', priority: 'high', suitabilityScore: 95 },
        { maltName: 'Pale Malt', maltType: 'base_malt', reason: 'Good enzyme activity for complex grain bills', priority: 'medium', suitabilityScore: 85 }
      ]
    },
    
    // Porters
    '20B': { // American Porter
      preferredMalts: ['2-Row', 'Pale Malt', 'Maris Otter'],
      styleCharacteristics: {
        isHopForward: false,
        isDarkStyle: true,
        isLightStyle: false,
        requiresComplexMalt: true,
        primaryFlavors: ['chocolate', 'caramel', 'roasted', 'smooth']
      },
      recommendations: [
        { maltName: 'Maris Otter', maltType: 'base_malt', reason: 'Biscuit character complements chocolate and caramel notes', priority: 'high', suitabilityScore: 95 },
        { maltName: '2-Row', maltType: 'base_malt', reason: 'Clean base for complex specialty grain flavors', priority: 'high', suitabilityScore: 88 },
        { maltName: 'Pale Malt', maltType: 'base_malt', reason: 'Good balance of character and enzyme activity', priority: 'medium', suitabilityScore: 85 }
      ]
    },
    
    // Wheat Beers
    '10A': { // Weissbier
      preferredMalts: ['Pilsner', 'Wheat Malt', '2-Row'],
      styleCharacteristics: {
        isHopForward: false,
        isDarkStyle: false,
        isLightStyle: true,
        requiresComplexMalt: false,
        primaryFlavors: ['wheat', 'smooth', 'soft', 'phenolic']
      },
      recommendations: [
        { maltName: 'Pilsner', maltType: 'base_malt', reason: 'Traditional base for wheat beers, clean and light', priority: 'high', suitabilityScore: 95 },
        { maltName: 'Wheat Malt', maltType: 'base_malt', reason: 'Essential for wheat beer character and mouthfeel', priority: 'high', suitabilityScore: 100 },
        { maltName: '2-Row', maltType: 'base_malt', reason: 'Alternative base with good enzyme activity', priority: 'low', suitabilityScore: 70 }
      ]
    }
  };

  /**
   * Common base malt characteristics
   */
  private readonly BASE_MALT_CHARACTERISTICS = {
    'Pilsner': {
      flavor: 'Clean, neutral, slightly sweet',
      color: 1.5,
      enzymeActivity: 'high',
      bestFor: ['lagers', 'wheat beers', 'light ales'],
      extractPotential: 1.037
    },
    '2-Row': {
      flavor: 'Neutral, clean, mild grain character',
      color: 2.0,
      enzymeActivity: 'high',
      bestFor: ['american ales', 'ipas', 'general brewing'],
      extractPotential: 1.037
    },
    'Pale Malt': {
      flavor: 'Slightly more character than 2-Row, biscuit notes',
      color: 3.0,
      enzymeActivity: 'medium-high',
      bestFor: ['english ales', 'balanced beers'],
      extractPotential: 1.036
    },
    'Maris Otter': {
      flavor: 'Rich, biscuit, slightly nutty',
      color: 3.5,
      enzymeActivity: 'medium',
      bestFor: ['english ales', 'porters', 'stouts', 'complex beers'],
      extractPotential: 1.035
    },
    'Munich': {
      flavor: 'Rich, malty, bread-like',
      color: 9.0,
      enzymeActivity: 'low-medium',
      bestFor: ['oktoberfest', 'amber ales', 'malty beers'],
      extractPotential: 1.035
    },
    'Vienna': {
      flavor: 'Toasted, amber, slightly sweet',
      color: 3.5,
      enzymeActivity: 'medium',
      bestFor: ['amber ales', 'oktoberfest', 'balanced beers'],
      extractPotential: 1.036
    },
    'Wheat Malt': {
      flavor: 'Smooth, soft, protein-rich',
      color: 2.5,
      enzymeActivity: 'low',
      bestFor: ['wheat beers', 'hazy ipas', 'smooth mouthfeel'],
      extractPotential: 1.033
    }
  };

  /**
   * Analyze the current grain bill
   */
  analyzeGrainBill(ingredients: RecipeIngredient[]): GrainBillAnalysis {
    const grains = ingredients.filter(ing => ing.type === 'grain');
    const totalGrainWeight = grains.reduce((sum, grain) => sum + this.convertToPounds(grain.amount, grain.unit), 0);
    
    const baseMalts = grains.filter(grain => grain.grain_type === 'base_malt');
    const baseMaltWeight = baseMalts.reduce((sum, grain) => sum + this.convertToPounds(grain.amount, grain.unit), 0);
    
    const specialtyGrains = grains.filter(grain => grain.grain_type !== 'base_malt');
    const specialtyGrainTypes = [...new Set(specialtyGrains.map(grain => grain.grain_type || 'specialty'))];
    
    // Estimate color contribution (simplified)
    const colorContribution = grains.reduce((sum, grain) => {
      const weight = this.convertToPounds(grain.amount, grain.unit);
      const color = grain.color || 2;
      return sum + (weight * color);
    }, 0) / totalGrainWeight;
    
    // Estimate fermentability based on grain types
    const fermentability = this.estimateFermentability(grains);
    
    return {
      totalGrains: grains.length,
      baseMaltPercentage: totalGrainWeight > 0 ? (baseMaltWeight / totalGrainWeight) * 100 : 0,
      specialtyGrainTypes,
      colorContribution,
      flavorProfile: this.inferFlavorProfile(grains),
      fermentability
    };
  }

  /**
   * Get smart base malt recommendations based on style and current grain bill
   */
  async getSmartBaseMaltRecommendations(
    recipe: Recipe,
    ingredients: RecipeIngredient[]
  ): Promise<BaseMaltRecommendation[]> {
    // If recipe has a style string, look it up to get the full BeerStyleGuide
    if (recipe.style) {
      return this.getSmartBaseMaltRecommendationsFromStyleName(recipe.style, ingredients);
    }
    
    return this.getGeneralRecommendations(this.analyzeGrainBill(ingredients), ingredients.filter(ing => ing.type === 'grain' && ing.grain_type === 'base_malt'));
  }

  /**
   * Get smart base malt recommendations using a BeerStyleGuide object
   */
  async getSmartBaseMaltRecommendationsFromStyleGuide(
    styleGuide: BeerStyleGuide,
    ingredients: RecipeIngredient[]
  ): Promise<BaseMaltRecommendation[]> {
    const grainBillAnalysis = this.analyzeGrainBill(ingredients);
    const currentBaseMalts = ingredients.filter(ing => ing.type === 'grain' && ing.grain_type === 'base_malt');
    
    // Get style-specific analysis from the BeerStyleGuide
    const styleAnalysis = this.analyzeStyleGuide(styleGuide);
    
    // Generate recommendations
    const recommendations: BaseMaltRecommendation[] = [];
    
    // If we have style analysis, use it
    if (styleAnalysis) {
      for (const rec of styleAnalysis.recommendations) {
        // Check if this malt is already in the recipe
        const existingMalt = currentBaseMalts.find(malt => 
          malt.name.toLowerCase().includes(rec.maltName.toLowerCase()) ||
          rec.maltName.toLowerCase().includes(malt.name.toLowerCase())
        );
        
        if (!existingMalt) {
          recommendations.push({
            ...rec,
            reason: `${rec.reason} (${styleGuide.name} style)`
          });
        } else {
          // If malt exists, prioritize it for increases
          recommendations.push({
            ...rec,
            reason: `${rec.maltName} is excellent for ${styleGuide.name} style - increase proportion for better characteristics`,
            priority: 'high',
            suitabilityScore: rec.suitabilityScore + 10
          });
        }
      }
    } else {
      // Fallback to general recommendations
      recommendations.push(...this.getGeneralRecommendations(grainBillAnalysis, currentBaseMalts));
    }
    
    // Sort by suitability score and priority
    return recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.suitabilityScore - a.suitabilityScore;
    });
  }

  /**
   * Get smart base malt recommendations from style name (legacy method)
   */
  private async getSmartBaseMaltRecommendationsFromStyleName(
    styleName: string,
    ingredients: RecipeIngredient[]
  ): Promise<BaseMaltRecommendation[]> {
    const grainBillAnalysis = this.analyzeGrainBill(ingredients);
    const currentBaseMalts = ingredients.filter(ing => ing.type === 'grain' && ing.grain_type === 'base_malt');
    
    // Get style-specific analysis
    const styleAnalysis = await this.getStyleSpecificAnalysis(styleName);
    
    // Generate recommendations
    const recommendations: BaseMaltRecommendation[] = [];
    
    // If we have style analysis, use it
    if (styleAnalysis) {
      for (const rec of styleAnalysis.recommendations) {
        // Check if this malt is already in the recipe
        const existingMalt = currentBaseMalts.find(malt => 
          malt.name.toLowerCase().includes(rec.maltName.toLowerCase()) ||
          rec.maltName.toLowerCase().includes(malt.name.toLowerCase())
        );
        
        if (!existingMalt) {
          recommendations.push({
            ...rec,
            reason: `${rec.reason} (${styleName} style)`
          });
        } else {
          // If malt exists, prioritize it for increases
          recommendations.push({
            ...rec,
            reason: `${rec.maltName} is excellent for ${styleName} style - increase proportion for better characteristics`,
            priority: 'high',
            suitabilityScore: rec.suitabilityScore + 10
          });
        }
      }
    } else {
      // Fallback to general recommendations based on grain bill analysis
      recommendations.push(...this.getGeneralRecommendations(grainBillAnalysis, currentBaseMalts));
    }
    
    // Sort by suitability score and priority
    return recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.suitabilityScore - a.suitabilityScore;
    });
  }

  /**
   * Determine which base malts to increase based on style and grain bill
   */
  async selectBaseMaltsForIncrease(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    currentBaseMalts: RecipeIngredient[]
  ): Promise<RecipeIngredient[]> {
    const recommendations = await this.getSmartBaseMaltRecommendations(recipe, ingredients);
    
    return this.selectBaseMaltsFromRecommendations(recommendations, currentBaseMalts, recipe.style);
  }

  /**
   * Determine which base malts to increase using a BeerStyleGuide object
   */
  async selectBaseMaltsForIncreaseFromStyleGuide(
    styleGuide: BeerStyleGuide,
    ingredients: RecipeIngredient[],
    currentBaseMalts: RecipeIngredient[]
  ): Promise<RecipeIngredient[]> {
    const recommendations = await this.getSmartBaseMaltRecommendationsFromStyleGuide(styleGuide, ingredients);
    
    return this.selectBaseMaltsFromRecommendations(recommendations, currentBaseMalts, styleGuide.name);
  }

  /**
   * Select base malts from recommendations
   */
  private selectBaseMaltsFromRecommendations(
    recommendations: BaseMaltRecommendation[],
    currentBaseMalts: RecipeIngredient[],
    styleName?: string
  ): RecipeIngredient[] {
    
    // If no current base malts, can't make intelligent selections
    if (currentBaseMalts.length === 0) {
      return [];
    }
    
    // Score each current base malt based on recommendations
    const scoredBaseMalts = currentBaseMalts.map(baseMalt => {
      let score = 50; // Base score
      
      // Find matching recommendation
      const matchingRec = recommendations.find(rec => 
        baseMalt.name.toLowerCase().includes(rec.maltName.toLowerCase()) ||
        rec.maltName.toLowerCase().includes(baseMalt.name.toLowerCase())
      );
      
      if (matchingRec) {
        score = matchingRec.suitabilityScore;
      } else {
        // Apply general scoring based on malt characteristics
        const maltCharacteristics = this.BASE_MALT_CHARACTERISTICS;
        const maltChars = maltCharacteristics[baseMalt.name as keyof typeof maltCharacteristics] || 
                          maltCharacteristics['2-Row']; // Default
        
        // Adjust score based on style (simplified for now)
        if (styleName) {
          const styleLower = styleName.toLowerCase();
          if (styleLower.includes('ipa') && maltChars.flavor.includes('neutral')) {
            score += 20;
          }
          if ((styleLower.includes('stout') || styleLower.includes('porter')) && maltChars.flavor.includes('rich')) {
            score += 15;
          }
          if (styleLower.includes('lager') && maltChars.flavor.includes('clean')) {
            score += 15;
          }
        }
      }
      
      return { ...baseMalt, score };
    });
    
    // Sort by score and return top performers
    scoredBaseMalts.sort((a, b) => b.score - a.score);
    
    // Return top 2-3 base malts for increase, or all if less than 3
    const topMalts = scoredBaseMalts.slice(0, Math.min(3, scoredBaseMalts.length));
    
    // If there's a clear winner (score difference > 20), prefer it
    if (topMalts.length > 1 && topMalts[0].score - topMalts[1].score > 20) {
      return [topMalts[0]];
    }
    
    return topMalts;
  }

  /**
   * Get style-specific analysis from BeerStyleGuide
   */
  private async getStyleSpecificAnalysis(styleName: string): Promise<BaseMaltAnalysis | null> {
    try {
      const allStyles = await BeerStyleService.getAllStylesList();
      const matchingStyle = allStyles.find(style => 
        style.name.toLowerCase() === styleName.toLowerCase()
      );
      
      if (matchingStyle) {
        return this.analyzeStyleGuide(matchingStyle);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting style-specific analysis:', error);
      return null;
    }
  }

  /**
   * Analyze a BeerStyleGuide object to determine malt characteristics
   */
  private analyzeStyleGuide(styleGuide: BeerStyleGuide): BaseMaltAnalysis | null {
    // First try to get from predefined preferences
    if (styleGuide.style_id && this.STYLE_MALT_PREFERENCES[styleGuide.style_id]) {
      return this.STYLE_MALT_PREFERENCES[styleGuide.style_id];
    }

    // Analyze the style guide to determine characteristics
    const analysis = this.deriveStyleCharacteristics(styleGuide);
    
    // Generate recommendations based on analysis
    const recommendations = this.generateStyleBasedRecommendations(analysis, styleGuide);
    
    return {
      preferredMalts: recommendations.map(r => r.maltName),
      styleCharacteristics: analysis,
      recommendations
    };
  }

  /**
   * Derive style characteristics from BeerStyleGuide
   */
  private deriveStyleCharacteristics(styleGuide: BeerStyleGuide): BaseMaltAnalysis['styleCharacteristics'] {
    
    // Analyze color range for dark/light determination
    const isDarkStyle = this.isStyleDark(styleGuide);
    const isLightStyle = this.isStyleLight(styleGuide);
    
    // Analyze IBU range for hop-forward determination
    const isHopForward = this.isStyleHopForward(styleGuide);
    
    // Determine if style requires complex malt character
    const requiresComplexMalt = this.requiresComplexMalt(styleGuide);
    
    // Extract primary flavors from style descriptions
    const primaryFlavors = this.extractPrimaryFlavors(styleGuide);
    
    return {
      isHopForward,
      isDarkStyle,
      isLightStyle,
      requiresComplexMalt,
      primaryFlavors
    };
  }

  /**
   * Check if style is dark based on SRM color range
   */
  private isStyleDark(styleGuide: BeerStyleGuide): boolean {
    if (!styleGuide.color) return false;
    
    const minSrm = styleGuide.color.minimum?.value || 0;
    const maxSrm = styleGuide.color.maximum?.value || 0;
    
    // Consider dark if minimum SRM is above 20 or average SRM is above 25
    return minSrm > 20 || (minSrm + maxSrm) / 2 > 25;
  }

  /**
   * Check if style is light based on SRM color range
   */
  private isStyleLight(styleGuide: BeerStyleGuide): boolean {
    if (!styleGuide.color) return false;
    
    const maxSrm = styleGuide.color.maximum?.value || 0;
    
    // Consider light if maximum SRM is below 4
    return maxSrm < 4;
  }

  /**
   * Check if style is hop-forward based on IBU range and descriptions
   */
  private isStyleHopForward(styleGuide: BeerStyleGuide): boolean {
    const styleName = styleGuide.name.toLowerCase();
    const aroma = styleGuide.aroma?.toLowerCase() || '';
    const flavor = styleGuide.flavor?.toLowerCase() || '';
    
    // Check for hop-forward style names
    if (styleName.includes('ipa') || styleName.includes('pale ale')) {
      return true;
    }
    
    // Check IBU range
    if (styleGuide.international_bitterness_units) {
      const minIbu = styleGuide.international_bitterness_units.minimum?.value || 0;
      
      // Consider hop-forward if minimum IBU is above 40
      if (minIbu > 40) return true;
    }
    
    // Check descriptions for hop-forward indicators
    const hopIndicators = ['hop', 'bitter', 'citrus', 'pine', 'floral', 'herbal', 'spicy'];
    return hopIndicators.some(indicator => 
      aroma.includes(indicator) || flavor.includes(indicator)
    );
  }

  /**
   * Check if style requires complex malt character
   */
  private requiresComplexMalt(styleGuide: BeerStyleGuide): boolean {
    const styleName = styleGuide.name.toLowerCase();
    const flavor = styleGuide.flavor?.toLowerCase() || '';
    
    // Dark styles typically require complex malt
    if (this.isStyleDark(styleGuide)) return true;
    
    // Check for styles that benefit from complex malt
    const complexMaltStyles = ['porter', 'stout', 'barleywine', 'scotch', 'brown', 'amber'];
    if (complexMaltStyles.some(style => styleName.includes(style))) {
      return true;
    }
    
    // Check flavor descriptions for complexity indicators
    const complexityIndicators = ['malty', 'rich', 'complex', 'biscuit', 'bread', 'caramel', 'toffee'];
    return complexityIndicators.some(indicator => flavor.includes(indicator));
  }

  /**
   * Extract primary flavors from style descriptions
   */
  private extractPrimaryFlavors(styleGuide: BeerStyleGuide): string[] {
    const flavors: string[] = [];
    const sources = [
      styleGuide.aroma || '',
      styleGuide.flavor || '',
      styleGuide.overall_impression || ''
    ];
    
    const flavorMap = {
      'clean': ['clean', 'neutral', 'crisp'],
      'malty': ['malty', 'grain', 'bread', 'biscuit'],
      'hoppy': ['hop', 'bitter', 'citrus', 'pine', 'floral'],
      'roasted': ['roasted', 'coffee', 'chocolate', 'burnt'],
      'sweet': ['sweet', 'caramel', 'toffee', 'honey'],
      'spicy': ['spicy', 'phenolic', 'clove', 'pepper'],
      'fruity': ['fruit', 'berry', 'apple', 'banana', 'citrus'],
      'smooth': ['smooth', 'creamy', 'soft', 'silky']
    };
    
    const text = sources.join(' ').toLowerCase();
    
    for (const [flavor, keywords] of Object.entries(flavorMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        flavors.push(flavor);
      }
    }
    
    return flavors;
  }

  /**
   * Generate style-based recommendations
   */
  private generateStyleBasedRecommendations(
    characteristics: BaseMaltAnalysis['styleCharacteristics'],
    styleGuide: BeerStyleGuide
  ): BaseMaltRecommendation[] {
    const recommendations: BaseMaltRecommendation[] = [];
    
    // Base recommendations based on characteristics
    if (characteristics.isHopForward) {
      recommendations.push({
        maltName: '2-Row',
        maltType: 'base_malt',
        reason: `Clean backbone that doesn't compete with hop flavors in ${styleGuide.name}`,
        priority: 'high',
        suitabilityScore: 95
      });
    }
    
    if (characteristics.isDarkStyle) {
      recommendations.push({
        maltName: 'Maris Otter',
        maltType: 'base_malt',
        reason: `Rich, biscuit character complements dark malts in ${styleGuide.name}`,
        priority: 'high',
        suitabilityScore: 95
      });
    }
    
    if (characteristics.isLightStyle) {
      recommendations.push({
        maltName: 'Pilsner',
        maltType: 'base_malt',
        reason: `Light, clean character perfect for ${styleGuide.name}`,
        priority: 'high',
        suitabilityScore: 95
      });
    }
    
    if (characteristics.requiresComplexMalt) {
      recommendations.push({
        maltName: 'Maris Otter',
        maltType: 'base_malt',
        reason: `Provides complexity and character for ${styleGuide.name}`,
        priority: 'high',
        suitabilityScore: 90
      });
      
      recommendations.push({
        maltName: 'Munich',
        maltType: 'base_malt',
        reason: `Rich, malty character enhances ${styleGuide.name}`,
        priority: 'medium',
        suitabilityScore: 85
      });
    }
    
    // Add Pale Malt as a versatile option
    recommendations.push({
      maltName: 'Pale Malt',
      maltType: 'base_malt',
      reason: `Versatile base malt suitable for ${styleGuide.name}`,
      priority: 'medium',
      suitabilityScore: 80
    });
    
    return recommendations;
  }

  /**
   * Get general recommendations based on grain bill analysis
   */
  private getGeneralRecommendations(
    grainBillAnalysis: GrainBillAnalysis,
    currentBaseMalts: RecipeIngredient[]
  ): BaseMaltRecommendation[] {
    const recommendations: BaseMaltRecommendation[] = [];
    
    // If no current base malts, suggest starting with 2-Row
    if (currentBaseMalts.length === 0) {
      recommendations.push({
        maltName: '2-Row',
        maltType: 'base_malt',
        reason: 'Versatile base malt suitable for most beer styles',
        priority: 'high',
        suitabilityScore: 85
      });
    }
    
    // Analyze current base malts and suggest improvements
    currentBaseMalts.forEach(baseMalt => {
      const maltChars = this.BASE_MALT_CHARACTERISTICS[baseMalt.name as keyof typeof this.BASE_MALT_CHARACTERISTICS];
      if (maltChars) {
        recommendations.push({
          maltName: baseMalt.name,
          maltType: 'base_malt',
          reason: `Current ${baseMalt.name} provides: ${maltChars.flavor}`,
          priority: 'medium',
          suitabilityScore: 75
        });
      }
    });
    
    // Suggest complementary malts based on flavor profile
    if (grainBillAnalysis.flavorProfile.includes('roasted')) {
      recommendations.push({
        maltName: 'Maris Otter',
        maltType: 'base_malt',
        reason: 'Biscuit character complements roasted flavors',
        priority: 'high',
        suitabilityScore: 90
      });
    }
    
    return recommendations;
  }

  /**
   * Convert grain weight to pounds for consistent calculations
   */
  private convertToPounds(amount: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'g':
        return amount * 0.00220462;
      case 'kg':
        return amount * 2.20462;
      case 'oz':
        return amount / 16;
      case 'lb':
      default:
        return amount;
    }
  }

  /**
   * Estimate fermentability based on grain types
   */
  private estimateFermentability(grains: RecipeIngredient[]): number {
    // Simplified fermentability estimation
    const totalWeight = grains.reduce((sum, grain) => sum + this.convertToPounds(grain.amount, grain.unit), 0);
    
    let fermentabilityScore = 0;
    grains.forEach(grain => {
      const weight = this.convertToPounds(grain.amount, grain.unit);
      const percentage = weight / totalWeight;
      
      // Base malts are highly fermentable
      if (grain.grain_type === 'base_malt') {
        fermentabilityScore += percentage * 85;
      }
      // Crystal malts are less fermentable
      else if (grain.grain_type === 'caramel_crystal') {
        fermentabilityScore += percentage * 30;
      }
      // Roasted malts contribute very little
      else if (grain.grain_type === 'roasted') {
        fermentabilityScore += percentage * 10;
      }
      // Other specialty malts (moderate)
      else {
        fermentabilityScore += percentage * 50;
      }
    });
    
    return fermentabilityScore;
  }

  /**
   * Infer flavor profile from grain bill
   */
  private inferFlavorProfile(grains: RecipeIngredient[]): string[] {
    const flavors: string[] = [];
    
    grains.forEach(grain => {
      if (grain.grain_type === 'roasted') {
        flavors.push('roasted');
      } else if (grain.grain_type === 'caramel_crystal') {
        flavors.push('caramel', 'sweet');
      } else if (grain.name.toLowerCase().includes('chocolate')) {
        flavors.push('chocolate');
      } else if (grain.name.toLowerCase().includes('wheat')) {
        flavors.push('wheat', 'smooth');
      }
    });
    
    return [...new Set(flavors)];
  }

  /**
   * Generate incremental base malt adjustment following expert patterns
   * Based on observed pattern: 0.25-1 lb increments (Recipe 1: Flaked Corn 3 -> 3.5lbs)
   */
  generateIncrementalBaseMaltAdjustment(
    currentBaseMalts: RecipeIngredient[],
    targetOGChange: number,
    styleGuide?: BeerStyleGuide
  ): { malt: RecipeIngredient; currentAmount: number; suggestedAmount: number; adjustmentAmount: number; reasoning: string } | null {
    
    if (currentBaseMalts.length === 0) {
      return null;
    }

    // Expert pattern: Select primary base malt for adjustment
    let primaryMalt = this.selectPrimaryBaseMaltForAdjustment(currentBaseMalts, styleGuide);
    
    // Calculate incremental adjustment amount (expert pattern: 0.25-1 lb increments)
    const adjustmentAmount = this.calculateIncrementalAdjustmentAmount(targetOGChange);
    
    // Convert current amount to pounds for calculation
    const currentAmountLbs = this.convertToPounds(primaryMalt.amount, primaryMalt.unit || 'lb');
    const suggestedAmountLbs = currentAmountLbs + adjustmentAmount;
    
    // Convert back to original unit
    const suggestedAmount = this.convertFromPounds(suggestedAmountLbs, primaryMalt.unit || 'lb');
    
    const reasoning = this.generateIncrementalAdjustmentReasoning(
      primaryMalt, 
      adjustmentAmount, 
      targetOGChange, 
      styleGuide
    );

    return {
      malt: primaryMalt,
      currentAmount: primaryMalt.amount,
      suggestedAmount,
      adjustmentAmount,
      reasoning
    };
  }

  /**
   * Select primary base malt for incremental adjustment based on expert patterns
   */
  private selectPrimaryBaseMaltForAdjustment(
    baseMalts: RecipeIngredient[],
    styleGuide?: BeerStyleGuide
  ): RecipeIngredient {
    
    // Expert pattern priority order for adjustments:
    // 1. Largest quantity base malt (most impact)
    // 2. Style-appropriate base malt
    // 3. Most fermentable base malt

    // Sort by amount (largest first)
    const maltsByAmount = [...baseMalts].sort((a, b) => {
      const aLbs = this.convertToPounds(a.amount, a.unit || 'lb');
      const bLbs = this.convertToPounds(b.amount, b.unit || 'lb');
      return bLbs - aLbs;
    });

    // If we have style guidance, prioritize style-appropriate malts
    if (styleGuide) {
      const styleAppropriate = maltsByAmount.find(malt => 
        this.isMaltStyleAppropriate(malt, styleGuide)
      );
      
      if (styleAppropriate) {
        return styleAppropriate;
      }
    }

    // Default to largest base malt (expert pattern from Recipe 1 and 4)
    return maltsByAmount[0];
  }

  /**
   * Calculate incremental adjustment amount following expert patterns
   * Expert observed increments: 0.5 lb (Recipe 1: Flaked Corn), 0.25-1 lb range
   */
  private calculateIncrementalAdjustmentAmount(targetOGChange: number): number {
    
    // Expert pattern: Conservative incremental changes
    // Rough correlation: 0.001 OG change ≈ 0.5 lb base malt adjustment
    const baseAdjustment = Math.abs(targetOGChange) * 500;
    
    // Round to brewing-friendly increments (0.25 lb steps)
    let increment = Math.round(baseAdjustment * 4) / 4;
    
    // Expert constraints: minimum 0.25 lb, maximum 1.0 lb per step
    increment = Math.max(0.25, Math.min(1.0, increment));
    
    // Direction based on target change
    return targetOGChange > 0 ? increment : -increment;
  }

  /**
   * Check if a malt is appropriate for the given style
   */
  private isMaltStyleAppropriate(malt: RecipeIngredient, styleGuide: BeerStyleGuide): boolean {
    const maltName = malt.name.toLowerCase();
    const styleName = styleGuide.name.toLowerCase();
    
    // Style-specific malt appropriateness patterns
    if (styleName.includes('ipa') || styleName.includes('pale ale')) {
      return maltName.includes('2-row') || maltName.includes('pale');
    }
    
    if (styleName.includes('stout') || styleName.includes('porter')) {
      return maltName.includes('maris otter') || maltName.includes('2-row');
    }
    
    if (styleName.includes('lager') || styleName.includes('pilsner')) {
      return maltName.includes('pilsner') || maltName.includes('lager');
    }
    
    if (styleName.includes('wheat')) {
      return maltName.includes('wheat') || maltName.includes('pilsner');
    }
    
    // Default: 2-Row and Pale are generally appropriate
    return maltName.includes('2-row') || maltName.includes('pale');
  }

  /**
   * Convert weight from pounds to specified unit
   */
  private convertFromPounds(pounds: number, targetUnit: string): number {
    switch (targetUnit.toLowerCase()) {
      case 'g':
        return pounds / 0.00220462;
      case 'kg':
        return pounds / 2.20462;
      case 'oz':
        return pounds * 16;
      case 'lb':
      default:
        return pounds;
    }
  }

  /**
   * Generate reasoning for incremental adjustment
   */
  private generateIncrementalAdjustmentReasoning(
    malt: RecipeIngredient,
    adjustmentAmount: number,
    targetOGChange: number,
    styleGuide?: BeerStyleGuide
  ): string {
    
    const direction = adjustmentAmount > 0 ? 'increase' : 'decrease';
    const magnitude = Math.abs(adjustmentAmount);
    const maltName = malt.name;
    
    let reasoning = `${direction === 'increase' ? 'Increase' : 'Decrease'} ${maltName} by ${magnitude} lb `;
    
    if (targetOGChange > 0) {
      reasoning += `to raise original gravity by ${(targetOGChange * 1000).toFixed(0)} points`;
    } else {
      reasoning += `to lower original gravity by ${(Math.abs(targetOGChange) * 1000).toFixed(0)} points`;
    }
    
    // Add style-specific reasoning if available
    if (styleGuide) {
      reasoning += ` for ${styleGuide.name} style compliance`;
      
      // Add style-specific benefits
      if (styleGuide.name.toLowerCase().includes('ipa') && maltName.toLowerCase().includes('2-row')) {
        reasoning += '. 2-Row provides clean backdrop for hop character';
      } else if (styleGuide.name.toLowerCase().includes('stout') && maltName.toLowerCase().includes('maris otter')) {
        reasoning += '. Maris Otter adds complementary biscuit notes to roasted flavors';
      }
    }
    
    // Add expert pattern note
    reasoning += `. Following expert pattern of incremental ${magnitude} lb adjustments`;
    
    return reasoning;
  }

  /**
   * Generate proportional base malt increases across multiple malts
   * Based on expert pattern: maintaining ratios while adjusting total base malt
   */
  generateProportionalBaseMaltAdjustments(
    currentBaseMalts: RecipeIngredient[],
    totalAdjustmentAmount: number,
    styleGuide?: BeerStyleGuide
  ): Array<{ malt: RecipeIngredient; currentAmount: number; suggestedAmount: number; adjustmentAmount: number }> {
    
    if (currentBaseMalts.length === 0) {
      return [];
    }

    // Calculate total current base malt weight
    const totalCurrentWeight = currentBaseMalts.reduce((sum, malt) => 
      sum + this.convertToPounds(malt.amount, malt.unit || 'lb'), 0
    );

    // Generate proportional adjustments
    const adjustments = currentBaseMalts.map(malt => {
      const currentAmountLbs = this.convertToPounds(malt.amount, malt.unit || 'lb');
      const proportion = currentAmountLbs / totalCurrentWeight;
      const maltAdjustmentLbs = totalAdjustmentAmount * proportion;
      
      // Round to quarter-pound increments (expert pattern)
      const roundedAdjustmentLbs = Math.round(maltAdjustmentLbs * 4) / 4;
      const suggestedAmountLbs = currentAmountLbs + roundedAdjustmentLbs;
      
      // Convert back to original unit
      const suggestedAmount = this.convertFromPounds(suggestedAmountLbs, malt.unit || 'lb');
      
      return {
        malt,
        currentAmount: malt.amount,
        suggestedAmount,
        adjustmentAmount: roundedAdjustmentLbs
      };
    });

    // Filter out adjustments smaller than 0.25 lb (expert minimum)
    return adjustments.filter(adj => Math.abs(adj.adjustmentAmount) >= 0.25);
  }
}

export default SmartBaseMaltService;