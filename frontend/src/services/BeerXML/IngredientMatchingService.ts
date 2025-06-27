import Fuse from "fuse.js";
import { Ingredient, IngredientsByType, RecipeIngredient } from "../../types";

// Service-specific interfaces
interface MatchResult {
  imported: RecipeIngredient;
  matches: EnhancedMatch[];
  bestMatch: EnhancedMatch | null;
  confidence: number;
  requiresNewIngredient: boolean;
  suggestedIngredientData: Partial<Ingredient> | null;
}

interface EnhancedMatch {
  ingredient: Ingredient;
  confidence: number;
  reasons: string[];
  nameMatch: number;
}

interface MatchingSummary {
  totalIngredients: number;
  matched: number;
  requireNew: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  averageConfidence: number;
  byType: {
    grain: {
      total: number;
      matched: number;
      requireNew: number;
    };
    hop: {
      total: number;
      matched: number;
      requireNew: number;
    };
    yeast: {
      total: number;
      matched: number;
      requireNew: number;
    };
    other: {
      total: number;
      matched: number;
      requireNew: number;
    };
  };
}

/**
 * Service for matching imported ingredients to existing database ingredients
 * Uses fuzzy matching and ingredient-specific heuristics
 */
class IngredientMatchingService {
  private fuseInstances: Map<string, any>;
  private matchingCache: Map<string, MatchResult>;
  private readonly MATCH_THRESHOLD: number;

  constructor() {
    this.fuseInstances = new Map();
    this.matchingCache = new Map();
    this.MATCH_THRESHOLD = 0.6; // Lower = more strict matching
  }

  /**
   * Initialize Fuse instances for different ingredient types
   */
  initializeFuseInstances(availableIngredients: IngredientsByType): void {
    const fuseOptions: any = {
      includeScore: true,
      threshold: this.MATCH_THRESHOLD,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
      ],
    };

    // Enhanced options for different ingredient types
    const grainOptions: any = {
      ...fuseOptions,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
        { name: "grain_type", weight: 0.4 },
      ],
    };

    const hopOptions: any = {
      ...fuseOptions,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
        { name: "origin", weight: 0.2 },
      ],
    };

    const yeastOptions: any = {
      ...fuseOptions,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "manufacturer", weight: 0.8 },
        { name: "code", weight: 0.9 },
        { name: "description", weight: 0.3 },
      ],
    };

    // Create Fuse instances for each type
    this.fuseInstances.set(
      "grain",
      new Fuse(availableIngredients.grain || [], grainOptions)
    );
    this.fuseInstances.set(
      "hop",
      new Fuse(availableIngredients.hop || [], hopOptions)
    );
    this.fuseInstances.set(
      "yeast",
      new Fuse(availableIngredients.yeast || [], yeastOptions)
    );
    this.fuseInstances.set(
      "other",
      new Fuse(availableIngredients.other || [], fuseOptions)
    );
  }

  /**
   * Match a list of imported ingredients to existing ones
   */
  async matchIngredients(
    importedIngredients: RecipeIngredient[],
    availableIngredients: IngredientsByType
  ): Promise<MatchResult[]> {
    // Initialize Fuse instances
    this.initializeFuseInstances(availableIngredients);

    const matchResults: MatchResult[] = [];

    for (const importedIngredient of importedIngredients) {
      const matchResult = await this.matchSingleIngredient(
        importedIngredient,
        availableIngredients
      );
      matchResults.push(matchResult);
    }

    return matchResults;
  }

  /**
   * Match a single imported ingredient
   */
  async matchSingleIngredient(
    importedIngredient: RecipeIngredient,
    _availableIngredients: IngredientsByType
  ): Promise<MatchResult> {
    const cacheKey = this.generateCacheKey(importedIngredient);

    // Check cache first
    if (this.matchingCache.has(cacheKey)) {
      return this.matchingCache.get(cacheKey)!;
    }

    const result: MatchResult = {
      imported: importedIngredient,
      matches: [],
      bestMatch: null,
      confidence: 0,
      requiresNewIngredient: false,
      suggestedIngredientData: null,
    };

    try {
      // Get Fuse instance for ingredient type
      const fuse = this.fuseInstances.get(importedIngredient.type);
      if (!fuse) {
        console.warn(`No Fuse instance for type: ${importedIngredient.type}`);
        result.requiresNewIngredient = true;
        result.suggestedIngredientData =
          this.generateNewIngredientData(importedIngredient);
        return result;
      }

      // Perform fuzzy search
      const searchResults = fuse.search(importedIngredient.name);

      // Enhanced matching for each result
      const enhancedMatches: EnhancedMatch[] = searchResults.map((searchResult: any) => {
        const match = searchResult.item;
        const baseScore = 1 - (searchResult.score || 0); // Convert to confidence score

        // Apply ingredient-specific scoring
        const enhancedScore = this.calculateEnhancedScore(
          importedIngredient,
          match,
          baseScore
        );

        return {
          ingredient: match,
          confidence: enhancedScore,
          reasons: this.getMatchReasons(importedIngredient, match),
          nameMatch: this.calculateNameSimilarity(
            importedIngredient.name,
            match.name
          ),
        };
      });

      // Sort by confidence and take top matches
      enhancedMatches.sort((a, b) => b.confidence - a.confidence);
      result.matches = enhancedMatches.slice(0, 5); // Top 5 matches

      // Determine best match
      if (enhancedMatches.length > 0 && enhancedMatches[0].confidence > 0.7) {
        result.bestMatch = enhancedMatches[0];
        result.confidence = enhancedMatches[0].confidence;
      } else {
        result.requiresNewIngredient = true;
        result.suggestedIngredientData =
          this.generateNewIngredientData(importedIngredient);
      }
    } catch (error) {
      console.error("Error matching ingredient:", error);
      result.requiresNewIngredient = true;
      result.suggestedIngredientData =
        this.generateNewIngredientData(importedIngredient);
    }

    // Cache result
    this.matchingCache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate enhanced score using ingredient-specific heuristics
   */
  calculateEnhancedScore(
    importedIngredient: RecipeIngredient,
    existingIngredient: Ingredient,
    baseScore: number
  ): number {
    let enhancedScore = baseScore;

    // Type-specific enhancements
    switch (importedIngredient.type) {
      case "grain":
        enhancedScore = this.enhanceGrainScore(
          importedIngredient,
          existingIngredient,
          enhancedScore
        );
        break;
      case "hop":
        enhancedScore = this.enhanceHopScore(
          importedIngredient,
          existingIngredient,
          enhancedScore
        );
        break;
      case "yeast":
        enhancedScore = this.enhanceYeastScore(
          importedIngredient,
          existingIngredient,
          enhancedScore
        );
        break;
      default:
        // No additional scoring for other types
        break;
    }

    // Penalty for significant differences
    if (this.hasSignificantDifferences(importedIngredient, existingIngredient)) {
      enhancedScore *= 0.7; // 30% penalty
    }

    return Math.max(0, Math.min(1, enhancedScore)); // Clamp between 0 and 1
  }

  /**
   * Enhance scoring for grain ingredients
   */
  private enhanceGrainScore(
    imported: RecipeIngredient,
    existing: Ingredient,
    baseScore: number
  ): number {
    let score = baseScore;

    // Bonus for matching grain type
    if (imported.grain_type && existing.grain_type) {
      if (imported.grain_type === existing.grain_type) {
        score += 0.2;
      }
    }

    // Bonus for similar color
    if (imported.color && existing.color) {
      const colorDiff = Math.abs(imported.color - existing.color);
      if (colorDiff <= 5) {
        score += 0.15;
      } else if (colorDiff <= 15) {
        score += 0.05;
      }
    }

    // Bonus for similar potential
    if (imported.potential && existing.potential) {
      const potentialDiff = Math.abs(imported.potential - existing.potential);
      if (potentialDiff <= 0.003) {
        score += 0.1;
      }
    }

    return score;
  }

  /**
   * Enhance scoring for hop ingredients
   */
  private enhanceHopScore(
    imported: RecipeIngredient,
    existing: Ingredient,
    baseScore: number
  ): number {
    let score = baseScore;

    // Bonus for similar alpha acid
    if (imported.alpha_acid && existing.alpha_acid) {
      const alphaDiff = Math.abs(imported.alpha_acid - existing.alpha_acid);
      if (alphaDiff <= 1) {
        score += 0.2;
      } else if (alphaDiff <= 3) {
        score += 0.1;
      }
    }

    return score;
  }

  /**
   * Enhance scoring for yeast ingredients
   */
  private enhanceYeastScore(
    imported: RecipeIngredient,
    existing: Ingredient,
    baseScore: number
  ): number {
    let score = baseScore;

    // Bonus for matching manufacturer
    if ((imported as any).manufacturer && existing.manufacturer) {
      if (
        (imported as any).manufacturer.toLowerCase() ===
        existing.manufacturer.toLowerCase()
      ) {
        score += 0.3;
      }
    }

    // Bonus for matching code
    if ((imported as any).code && existing.code) {
      if ((imported as any).code.toLowerCase() === existing.code.toLowerCase()) {
        score += 0.4;
      }
    }

    // Bonus for similar attenuation
    if (imported.attenuation && existing.attenuation) {
      const attenuationDiff = Math.abs(imported.attenuation - existing.attenuation);
      if (attenuationDiff <= 5) {
        score += 0.15;
      } else if (attenuationDiff <= 15) {
        score += 0.05;
      }
    }

    return score;
  }

  /**
   * Check for significant differences that should lower confidence
   */
  private hasSignificantDifferences(
    imported: RecipeIngredient,
    existing: Ingredient
  ): boolean {
    switch (imported.type) {
      case "grain":
        // Significant color difference
        if (imported.color && existing.color) {
          const colorDiff = Math.abs(imported.color - existing.color);
          if (colorDiff > 30) return true;
        }
        // Different grain types
        if (
          imported.grain_type &&
          existing.grain_type &&
          imported.grain_type !== existing.grain_type
        ) {
          return true;
        }
        break;

      case "hop":
        // Significant alpha acid difference
        if (imported.alpha_acid && existing.alpha_acid) {
          const alphaDiff = Math.abs(imported.alpha_acid - existing.alpha_acid);
          if (alphaDiff > 8) return true;
        }
        break;

      case "yeast":
        // Significant attenuation difference
        if (imported.attenuation && existing.attenuation) {
          const attenuationDiff = Math.abs(
            imported.attenuation - existing.attenuation
          );
          if (attenuationDiff > 25) return true;
        }
        break;
    }

    return false;
  }

  /**
   * Get reasons why ingredients match
   */
  getMatchReasons(imported: RecipeIngredient, existing: Ingredient): string[] {
    const reasons: string[] = [];

    // Name similarity
    const nameSimilarity = this.calculateNameSimilarity(
      imported.name,
      existing.name
    );
    if (nameSimilarity > 0.8) {
      reasons.push("Very similar name");
    } else if (nameSimilarity > 0.6) {
      reasons.push("Similar name");
    }

    // Type-specific reasons
    switch (imported.type) {
      case "grain":
        if (
          imported.grain_type &&
          existing.grain_type &&
          imported.grain_type === existing.grain_type
        ) {
          reasons.push("Same grain type");
        }
        if (
          imported.color &&
          existing.color &&
          Math.abs(imported.color - existing.color) <= 5
        ) {
          reasons.push("Similar color");
        }
        break;

      case "hop":
        if (
          imported.alpha_acid &&
          existing.alpha_acid &&
          Math.abs(imported.alpha_acid - existing.alpha_acid) <= 1
        ) {
          reasons.push("Very similar alpha acid");
        }
        break;

      case "yeast":
        if ((imported as any).manufacturer && existing.manufacturer) {
          if (
            (imported as any).manufacturer.toLowerCase() ===
            existing.manufacturer.toLowerCase()
          ) {
            reasons.push("Same manufacturer");
          }
        }
        if ((imported as any).code && existing.code) {
          if ((imported as any).code.toLowerCase() === existing.code.toLowerCase()) {
            reasons.push("Same product code");
          }
        }
        break;
    }

    return reasons;
  }

  /**
   * Calculate name similarity using various techniques
   */
  calculateNameSimilarity(name1: string, name2: string): number {
    const clean1 = this.cleanIngredientName(name1);
    const clean2 = this.cleanIngredientName(name2);

    // Exact match
    if (clean1 === clean2) return 1.0;

    // Levenshtein distance-based similarity
    const levenshteinSimilarity = this.levenshteinSimilarity(clean1, clean2);

    // Word-based similarity
    const wordSimilarity = this.calculateWordSimilarity(clean1, clean2);

    // Return the best similarity score
    return Math.max(levenshteinSimilarity, wordSimilarity);
  }

  /**
   * Clean ingredient name for better matching
   */
  private cleanIngredientName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Calculate Levenshtein similarity
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate word-based similarity
   */
  private calculateWordSimilarity(name1: string, name2: string): number {
    const words1 = new Set(name1.split(" "));
    const words2 = new Set(name2.split(" "));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Generate suggested data for new ingredient creation
   */
  generateNewIngredientData(importedIngredient: RecipeIngredient): Partial<Ingredient> {
    const baseData: Partial<Ingredient> = {
      name: importedIngredient.name,
      type: importedIngredient.type,
      description: `Imported from BeerXML: ${importedIngredient.name}`,
    };

    // Add type-specific data
    switch (importedIngredient.type) {
      case "grain":
        if (importedIngredient.color) baseData.color = importedIngredient.color;
        if (importedIngredient.potential) baseData.potential = importedIngredient.potential;
        if (importedIngredient.grain_type) baseData.grain_type = importedIngredient.grain_type;
        break;

      case "hop":
        if (importedIngredient.alpha_acid) baseData.alpha_acid = importedIngredient.alpha_acid;
        break;

      case "yeast":
        if (importedIngredient.attenuation) baseData.attenuation = importedIngredient.attenuation;
        if ((importedIngredient as any).manufacturer) baseData.manufacturer = (importedIngredient as any).manufacturer;
        if ((importedIngredient as any).code) baseData.code = (importedIngredient as any).code;
        break;
    }

    return baseData;
  }

  /**
   * Generate cache key for ingredient
   */
  private generateCacheKey(ingredient: RecipeIngredient): string {
    return `${ingredient.type}-${ingredient.name}-${ingredient.alpha_acid || ''}-${ingredient.color || ''}-${ingredient.grain_type || ''}`;
  }

  /**
   * Clear the matching cache
   */
  clearCache(): void {
    this.matchingCache.clear();
  }

  /**
   * Get matching statistics summary
   */
  getMatchingSummary(matchResults: MatchResult[]): MatchingSummary {
    const summary: MatchingSummary = {
      totalIngredients: matchResults.length,
      matched: 0,
      requireNew: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      averageConfidence: 0,
      byType: {
        grain: { total: 0, matched: 0, requireNew: 0 },
        hop: { total: 0, matched: 0, requireNew: 0 },
        yeast: { total: 0, matched: 0, requireNew: 0 },
        other: { total: 0, matched: 0, requireNew: 0 },
      },
    };

    let totalConfidence = 0;

    matchResults.forEach((result) => {
      const type = result.imported.type;

      // Update type counts
      if (summary.byType[type as keyof typeof summary.byType]) {
        summary.byType[type as keyof typeof summary.byType].total++;
      }

      if (result.bestMatch) {
        summary.matched++;
        if (summary.byType[type as keyof typeof summary.byType]) {
          summary.byType[type as keyof typeof summary.byType].matched++;
        }

        const confidence = result.confidence;
        totalConfidence += confidence;

        if (confidence >= 0.8) {
          summary.highConfidence++;
        } else if (confidence >= 0.6) {
          summary.mediumConfidence++;
        } else {
          summary.lowConfidence++;
        }
      } else {
        summary.requireNew++;
        if (summary.byType[type as keyof typeof summary.byType]) {
          summary.byType[type as keyof typeof summary.byType].requireNew++;
        }
      }
    });

    summary.averageConfidence =
      summary.matched > 0 ? totalConfidence / summary.matched : 0;

    return summary;
  }
}

// Export as singleton
const ingredientMatchingServiceInstance = new IngredientMatchingService();
export default ingredientMatchingServiceInstance;