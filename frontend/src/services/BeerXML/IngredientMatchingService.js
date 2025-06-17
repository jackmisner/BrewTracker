import Fuse from "fuse.js";

/**
 * Service for matching imported ingredients to existing database ingredients
 * Uses fuzzy matching and ingredient-specific heuristics
 */
class IngredientMatchingService {
  constructor() {
    this.fuseInstances = new Map();
    this.matchingCache = new Map();
    this.MATCH_THRESHOLD = 0.6; // Lower = more strict matching
  }

  /**
   * Initialize Fuse instances for different ingredient types
   */
  initializeFuseInstances(availableIngredients) {
    const fuseOptions = {
      includeScore: true,
      threshold: this.MATCH_THRESHOLD,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
      ],
    };

    // Enhanced options for different ingredient types
    const grainOptions = {
      ...fuseOptions,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
        { name: "grain_type", weight: 0.4 },
      ],
    };

    const hopOptions = {
      ...fuseOptions,
      keys: [
        { name: "name", weight: 1.0 },
        { name: "description", weight: 0.3 },
        { name: "origin", weight: 0.2 },
      ],
    };

    const yeastOptions = {
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
  async matchIngredients(importedIngredients, availableIngredients) {
    // Initialize Fuse instances
    this.initializeFuseInstances(availableIngredients);

    const matchResults = [];

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
  async matchSingleIngredient(importedIngredient, availableIngredients) {
    const cacheKey = this.generateCacheKey(importedIngredient);

    // Check cache first
    if (this.matchingCache.has(cacheKey)) {
      return this.matchingCache.get(cacheKey);
    }

    const result = {
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
      const enhancedMatches = searchResults.map((searchResult) => {
        const match = searchResult.item;
        const baseScore = 1 - searchResult.score; // Convert to confidence score

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
  calculateEnhancedScore(importedIngredient, existingIngredient, baseScore) {
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
        break;
    }

    // Apply name similarity bonus
    const nameSimilarity = this.calculateNameSimilarity(
      importedIngredient.name,
      existingIngredient.name
    );
    enhancedScore += nameSimilarity * 0.2;

    // Penalize significant property mismatches
    if (this.hasSignificantMismatch(importedIngredient, existingIngredient)) {
      enhancedScore *= 0.7;
    }

    return Math.min(enhancedScore, 1.0); // Cap at 1.0
  }

  /**
   * Enhance scoring for grain ingredients
   */
  enhanceGrainScore(imported, existing, baseScore) {
    let score = baseScore;

    // Grain type bonus
    if (
      imported.grain_type &&
      existing.grain_type &&
      imported.grain_type === existing.grain_type
    ) {
      score += 0.15;
    }

    // Color similarity (if available)
    if (imported.color && existing.color) {
      const colorDiff = Math.abs(imported.color - existing.color);
      if (colorDiff <= 1) score += 0.1;
      else if (colorDiff <= 5) score += 0.05;
      else if (colorDiff > 20) score -= 0.2;
    }

    // Potential similarity (if available)
    if (imported.potential && existing.potential) {
      const potentialDiff = Math.abs(imported.potential - existing.potential);
      if (potentialDiff <= 2) score += 0.1;
      else if (potentialDiff > 10) score -= 0.15;
    }

    return score;
  }

  /**
   * Enhance scoring for hop ingredients
   */
  enhanceHopScore(imported, existing, baseScore) {
    let score = baseScore;

    // Alpha acid similarity
    if (imported.alpha_acid && existing.alpha_acid) {
      const alphaDiff = Math.abs(imported.alpha_acid - existing.alpha_acid);
      if (alphaDiff <= 1) score += 0.15;
      else if (alphaDiff <= 3) score += 0.1;
      else if (alphaDiff > 5) score -= 0.2;
    }

    // Origin matching (if available in BeerXML data)
    if (imported.beerxml_data?.origin && existing.origin) {
      if (
        imported.beerxml_data.origin.toLowerCase() ===
        existing.origin.toLowerCase()
      ) {
        score += 0.1;
      }
    }

    return score;
  }

  /**
   * Enhance scoring for yeast ingredients
   */
  enhanceYeastScore(imported, existing, baseScore) {
    let score = baseScore;

    // Manufacturer/lab matching
    if (imported.beerxml_data?.laboratory && existing.manufacturer) {
      const labMatch = this.calculateNameSimilarity(
        imported.beerxml_data.laboratory,
        existing.manufacturer
      );
      score += labMatch * 0.2;
    }

    // Product ID matching
    if (imported.beerxml_data?.product_id && existing.code) {
      if (
        imported.beerxml_data.product_id.toLowerCase() ===
        existing.code.toLowerCase()
      ) {
        score += 0.3;
      }
    }

    // Attenuation similarity
    if (imported.attenuation && existing.attenuation) {
      const attenuationDiff = Math.abs(
        imported.attenuation - existing.attenuation
      );
      if (attenuationDiff <= 5) score += 0.1;
      else if (attenuationDiff > 15) score -= 0.15;
    }

    return score;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;

    const cleanName1 = this.cleanName(name1);
    const cleanName2 = this.cleanName(name2);

    const distance = this.levenshteinDistance(cleanName1, cleanName2);
    const maxLength = Math.max(cleanName1.length, cleanName2.length);

    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Clean ingredient name for comparison
   */
  cleanName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

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
   * Check for significant property mismatches
   */
  hasSignificantMismatch(imported, existing) {
    // Type mismatch is always significant
    if (imported.type !== existing.type) {
      return true;
    }

    // Type-specific mismatch checks
    switch (imported.type) {
      case "grain":
        // Significant color difference
        if (imported.color && existing.color) {
          const colorDiff = Math.abs(imported.color - existing.color);
          if (colorDiff > 50) return true;
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
  getMatchReasons(imported, existing) {
    const reasons = [];

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
          Math.abs(imported.color - existing.color) <= 2
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
          reasons.push("Similar alpha acid");
        }
        break;

      case "yeast":
        if (
          imported.beerxml_data?.laboratory &&
          existing.manufacturer &&
          imported.beerxml_data.laboratory.toLowerCase() ===
            existing.manufacturer.toLowerCase()
        ) {
          reasons.push("Same manufacturer/lab");
        }
        if (
          imported.beerxml_data?.product_id &&
          existing.code &&
          imported.beerxml_data.product_id === existing.code
        ) {
          reasons.push("Same product code");
        }
        break;
    }

    return reasons;
  }

  /**
   * Generate new ingredient data for ingredients that don't match
   */
  generateNewIngredientData(importedIngredient) {
    const baseData = {
      name: importedIngredient.name,
      type: importedIngredient.type,
      description: `Imported from BeerXML`,
    };

    // Add type-specific fields
    switch (importedIngredient.type) {
      case "grain":
        return {
          ...baseData,
          grain_type: importedIngredient.grain_type || "specialty_malt",
          potential: importedIngredient.potential || 35,
          color: importedIngredient.color || 0,
        };

      case "hop":
        return {
          ...baseData,
          alpha_acid: importedIngredient.alpha_acid || 5,
        };

      case "yeast":
        return {
          ...baseData,
          attenuation: importedIngredient.attenuation || 75,
          manufacturer: importedIngredient.beerxml_data?.laboratory || "",
          code: importedIngredient.beerxml_data?.product_id || "",
          alcohol_tolerance: 12,
          min_temperature: importedIngredient.beerxml_data?.min_temperature
            ? parseFloat(importedIngredient.beerxml_data.min_temperature)
            : 60,
          max_temperature: importedIngredient.beerxml_data?.max_temperature
            ? parseFloat(importedIngredient.beerxml_data.max_temperature)
            : 75,
        };

      default:
        return baseData;
    }
  }

  /**
   * Generate cache key for matching result
   */
  generateCacheKey(ingredient) {
    return `${ingredient.type}-${ingredient.name}-${
      ingredient.alpha_acid || ""
    }-${ingredient.color || ""}`;
  }

  /**
   * Clear matching cache
   */
  clearCache() {
    this.matchingCache.clear();
  }

  /**
   * Get summary statistics for matching results
   */
  getMatchingSummary(matchResults) {
    const summary = {
      total: matchResults.length,
      matched: 0,
      newRequired: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      byType: {
        grain: { total: 0, matched: 0, newRequired: 0 },
        hop: { total: 0, matched: 0, newRequired: 0 },
        yeast: { total: 0, matched: 0, newRequired: 0 },
        other: { total: 0, matched: 0, newRequired: 0 },
      },
    };

    matchResults.forEach((result) => {
      const type = result.imported.type;

      // Update type counters
      summary.byType[type].total++;

      if (result.bestMatch) {
        summary.matched++;
        summary.byType[type].matched++;

        // Confidence levels
        if (result.confidence > 0.8) {
          summary.highConfidence++;
        } else if (result.confidence > 0.6) {
          summary.mediumConfidence++;
        } else {
          summary.lowConfidence++;
        }
      } else {
        summary.newRequired++;
        summary.byType[type].newRequired++;
      }
    });

    return summary;
  }
}

// Export as singleton
const ingredientMatchingServiceInstance = new IngredientMatchingService();
export default ingredientMatchingServiceInstance;
