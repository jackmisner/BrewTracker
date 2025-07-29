import ApiService from "../api";
import {
  Ingredient,
  IngredientsByType,
  RecipeIngredient,
  IngredientType,
  CreateRecipeIngredientData,
  ID,
} from "../../types";

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Order mappings for sorting
interface TypeOrder {
  [key: string]: number;
}

interface HopUseOrder {
  [key: string]: number;
}

interface GrainTypeOrder {
  [key: string]: number;
}

/**
 * Service class for managing ingredients business logic
 */
class IngredientService {
  private ingredientsCache: IngredientsByType | null = null;
  private cacheTimestamp: number | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch and group ingredients by type with caching
   */
  async fetchIngredients(): Promise<IngredientsByType> {
    // Check cache first
    if (this.ingredientsCache && this.isCacheValid()) {
      return this.ingredientsCache;
    }

    try {
      const response = await ApiService.ingredients.getAll();
      const ingredientsData: Ingredient[] = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.ingredients || [];

      const grouped = this.groupIngredientsByType(ingredientsData);

      // Update cache
      this.ingredientsCache = grouped;
      this.cacheTimestamp = Date.now();

      return grouped;
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      throw new Error("Failed to load ingredients");
    }
  }

  /**
   * Custom sorting function for ingredients with special handling for caramel malts and candi syrups
   */
  private sortIngredientsCustom(ingredients: Ingredient[]): Ingredient[] {
    return ingredients.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Check for caramel malts (e.g., "caramel 60", "caramel/crystal 40L", "caramel malt - 120L")
      const caramelRegex = /(?:caramel|crystal)[\s/-]*(?:malt[\s-]*)?(\d+)l?/i;
      const aCaramelMatch = aName.match(caramelRegex);
      const bCaramelMatch = bName.match(caramelRegex);

      if (aCaramelMatch && bCaramelMatch) {
        // Both are caramel malts - sort by number
        const aNum = parseInt(aCaramelMatch[1]);
        const bNum = parseInt(bCaramelMatch[1]);
        return aNum - bNum;
      } else if (aCaramelMatch && !bCaramelMatch) {
        // Only a is caramel - check if b starts with caramel/crystal
        if (bName.startsWith('caramel') || bName.startsWith('crystal')) {
          return -1; // a (with number) comes before b (without number)
        }
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      } else if (!aCaramelMatch && bCaramelMatch) {
        // Only b is caramel - check if a starts with caramel/crystal
        if (aName.startsWith('caramel') || aName.startsWith('crystal')) {
          return 1; // b (with number) comes before a (without number)
        }
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      }

      // Check for candi syrups (e.g., "D-45", "D-180")
      const candiRegex = /d-(\d+)/i;
      const aCandiMatch = aName.match(candiRegex);
      const bCandiMatch = bName.match(candiRegex);

      if (aCandiMatch && bCandiMatch) {
        // Both are candi syrups - sort by number
        const aNum = parseInt(aCandiMatch[1]);
        const bNum = parseInt(bCandiMatch[1]);
        return aNum - bNum;
      } else if (aCandiMatch && !bCandiMatch) {
        // Only a is candi syrup - check if b starts with 'candi' or 'd-'
        if (bName.includes('candi') || bName.startsWith('d-')) {
          return -1; // a (with number) comes before b (without number)
        }
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      } else if (!aCandiMatch && bCandiMatch) {
        // Only b is candi syrup - check if a starts with 'candi' or 'd-'
        if (aName.includes('candi') || aName.startsWith('d-')) {
          return 1; // b (with number) comes before a (without number)
        }
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      }

      // Default alphabetical sorting
      return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });
  }

  /**
   * Group ingredients by type
   */
  groupIngredientsByType(ingredients: Ingredient[]): IngredientsByType {
    const grouped: IngredientsByType = {
      grain: [],
      hop: [],
      yeast: [],
      other: [], // Changed from 'adjunct' to 'other'
    };

    ingredients.forEach((ingredient) => {
      //  Map old 'adjunct' type to 'other' for backward compatibility
      const ingredientType: IngredientType =
        (ingredient.type as any) === "adjunct" ? "other" : ingredient.type;

      if (grouped[ingredientType]) {
        grouped[ingredientType].push(ingredient);
      } else {
        console.warn(
          `Ingredient type ${ingredient.type} not recognized. Adding to 'other'...`
        );
        grouped.other.push(ingredient);
      }
    });

    // Sort each type with custom sorting logic
    Object.keys(grouped).forEach((type) => {
      grouped[type as keyof IngredientsByType] = this.sortIngredientsCustom(grouped[type as keyof IngredientsByType]);
    });

    return grouped;
  }

  /**
   * Create a new recipe ingredient with proper ID and metadata
   * Updated to handle newly created ingredients and prioritize provided name
   */
  createRecipeIngredient(
    type: IngredientType,
    ingredientData: CreateRecipeIngredientData,
    availableIngredients: IngredientsByType
  ): RecipeIngredient {
    // Prioritize provided name over cache lookup
    let ingredientName =
      ingredientData.name ||
      this.getIngredientName(
        ingredientData.ingredient_id,
        type,
        availableIngredients
      );

    // If still no name found, use a fallback
    if (!ingredientName || ingredientName === "Unknown") {
      ingredientName = ingredientData.name || `Unknown ${type}`;
    }

    // Try to get metadata from available ingredients
    let baseData = this.getIngredientMetadata(
      ingredientData.ingredient_id,
      type,
      availableIngredients
    );

    // If no metadata found in cache, use provided ingredient data
    if (Object.keys(baseData).length === 0) {
      baseData = {
        potential: ingredientData.potential || undefined,
        color: ingredientData.color || undefined,
        grain_type: ingredientData.grain_type || undefined,
        alpha_acid: ingredientData.alpha_acid || undefined,
        attenuation: ingredientData.attenuation || undefined,
      };
    }

    const newIngredient: RecipeIngredient = {
      id: this.generateIngredientId(),
      ingredient_id: ingredientData.ingredient_id || "",
      name: ingredientName,
      type: type,
      amount: parseFloat((ingredientData.amount || 0).toString()),
      unit: ingredientData.unit as any, // Type assertion for unit compatibility
      use: ingredientData.use || this.getDefaultUse(type),
      time: parseInt((ingredientData.time || 0).toString()),
      // Include calculation-specific fields
      ...baseData,
    };

    // Override with custom values if provided (for newly created ingredients)
    if (type === "hop" && ingredientData.alpha_acid !== undefined) {
      newIngredient.alpha_acid = parseFloat(
        ingredientData.alpha_acid.toString()
      );
    }

    if (type === "grain" && ingredientData.color !== undefined) {
      newIngredient.color = parseFloat(ingredientData.color.toString());
    }

    if (type === "grain" && ingredientData.potential !== undefined) {
      newIngredient.potential = parseFloat(ingredientData.potential.toString());
    }

    if (type === "grain" && ingredientData.grain_type) {
      newIngredient.grain_type = ingredientData.grain_type;
    }

    if (type === "yeast" && ingredientData.attenuation !== undefined) {
      newIngredient.attenuation = parseFloat(
        ingredientData.attenuation.toString()
      );
    }

    return newIngredient;
  }

  /**
   * Scale ingredient amounts by a given factor
   */
  scaleIngredients(
    ingredients: RecipeIngredient[],
    scalingFactor: number
  ): RecipeIngredient[] {
    return ingredients.map((ingredient) => ({
      ...ingredient,
      amount: parseFloat(
        (parseFloat(ingredient.amount.toString()) * scalingFactor).toFixed(2)
      ),
    }));
  }

  /**
   * Sort ingredients by type and usage
   */
  sortIngredients(ingredients: RecipeIngredient[]): RecipeIngredient[] {
    const typeOrder: TypeOrder = {
      grain: 1,
      hop: 2,
      yeast: 3,
      adjunct: 4,
      other: 4,
    };
    const hopUseOrder: HopUseOrder = { boil: 1, whirlpool: 2, dry_hop: 3 };
    const grainTypeOrder: GrainTypeOrder = {
      base_malt: 1,
      adjunct_grain: 2,
      caramel_crystal: 4,
      roasted: 5,
      smoked: 6,
    };

    return [...ingredients].sort((a, b) => {
      const typeA = a.type || "";
      const typeB = b.type || "";
      const orderA = typeOrder[typeA] || 999;
      const orderB = typeOrder[typeB] || 999;

      // Sort by ingredient type first
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Type-specific sorting
      if (typeA === "grain") {
        // Sort grains by grain_type first, then by name
        const grainTypeA = (a.grain_type || "").toLowerCase();
        const grainTypeB = (b.grain_type || "").toLowerCase();
        const grainOrderA = grainTypeOrder[grainTypeA] || 999;
        const grainOrderB = grainTypeOrder[grainTypeB] || 999;

        if (grainOrderA !== grainOrderB) {
          return grainOrderA - grainOrderB;
        }

        // Within same grain type, sort by name
        return a.name.localeCompare(b.name);
      } else if (typeA === "hop") {
        const useA = (a.use || "").toLowerCase().replace(" ", "_");
        const useB = (b.use || "").toLowerCase().replace(" ", "_");
        const useOrderA = hopUseOrder[useA] || 999;
        const useOrderB = hopUseOrder[useB] || 999;

        if (useOrderA !== useOrderB) {
          return useOrderA - useOrderB;
        }

        // Sort by time (higher first)
        const timeA = parseFloat((a.time || 0).toString());
        const timeB = parseFloat((b.time || 0).toString());
        return timeB - timeA;
      } else if (typeA === "yeast") {
        return a.name.localeCompare(b.name);
      }

      return (a.id || "").localeCompare(b.id || "");
    });
  }

  /**
   * Validate ingredient data before adding
   */
  validateIngredientData(
    type: IngredientType,
    ingredientData: CreateRecipeIngredientData
  ): ValidationResult {
    const errors: string[] = [];

    if (!ingredientData.ingredient_id) {
      errors.push("Ingredient selection is required");
    }

    if (
      !ingredientData.amount ||
      parseFloat(ingredientData.amount.toString()) <= 0
    ) {
      errors.push("Amount must be greater than 0");
    }

    if (!ingredientData.unit) {
      errors.push("Unit is required");
    }

    // Type-specific validation
    if (type === "hop") {
      if (!ingredientData.use) {
        errors.push("Hop usage is required");
      }
      if (
        ingredientData.use === "boil" &&
        (ingredientData.time === undefined ||
          ingredientData.time === null ||
          parseInt(ingredientData.time.toString()) < 0)
      ) {
        errors.push("Boil time is required for boil hops");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format ingredients for API submission
   */
  formatIngredientsForApi(ingredients: RecipeIngredient[]): any[] {
    if (!ingredients || !Array.isArray(ingredients)) {
      return [];
    }

    return ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      name: ing.name || "",
      type: ing.type || "",
      amount: parseFloat((ing.amount || 0).toString()),
      unit: ing.unit || "",
      use: ing.use || "",
      time: parseInt((ing.time || 0).toString()),
      potential: ing.potential || null,
      color: ing.color || null,
      grain_type: ing.grain_type || null,
      alpha_acid: ing.alpha_acid || null,
      attenuation: ing.attenuation || null,
    }));
  }

  // Private helper methods
  private getIngredientName(
    ingredientId: ID | undefined,
    type: IngredientType,
    availableIngredients: IngredientsByType
  ): string {
    if (!ingredientId) return "Unknown";

    const ingredient = availableIngredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    return ingredient ? ingredient.name : "Unknown";
  }

  private getIngredientMetadata(
    ingredientId: ID | undefined,
    type: IngredientType,
    availableIngredients: IngredientsByType
  ): Partial<RecipeIngredient> {
    if (!ingredientId) return {};

    const ingredient = availableIngredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );

    if (!ingredient) return {};

    const metadata: Partial<RecipeIngredient> = {};

    if (type === "grain") {
      if (ingredient.potential) metadata.potential = ingredient.potential;
      if (ingredient.color) metadata.color = ingredient.color;
      if (ingredient.grain_type) metadata.grain_type = ingredient.grain_type;
    } else if (type === "hop") {
      if (ingredient.alpha_acid) metadata.alpha_acid = ingredient.alpha_acid;
    } else if (type === "yeast") {
      // Prefer improved attenuation estimate if available
      if (ingredient.improved_attenuation_estimate) {
        metadata.attenuation = ingredient.improved_attenuation_estimate;
      } else if (ingredient.attenuation) {
        metadata.attenuation = ingredient.attenuation;
      }
    }

    return metadata;
  }

  private generateIngredientId(): string {
    // Generate a more robust UUID-like ID that doesn't depend on timestamps
    // Use multiple random components to ensure uniqueness even in bulk operations
    const randomPart1 = Math.random().toString(36).substr(2, 9);
    const randomPart2 = Math.random().toString(36).substr(2, 9);
    const randomPart3 = Math.random().toString(36).substr(2, 9);

    // Use a global counter to ensure uniqueness across all instances
    const globalCounter = IngredientService.getNextId();

    return `new-${randomPart1}-${randomPart2}-${randomPart3}-${globalCounter.toString(
      36
    )}`;
  }

  // Static counter shared across all instances to ensure uniqueness
  private static globalIdCounter = 0;

  private static getNextId(): number {
    return ++IngredientService.globalIdCounter;
  }

  private isCacheValid(): boolean {
    return (
      this.cacheTimestamp !== null &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }

  /**
   * Get default use value for ingredient type
   */
  private getDefaultUse(type: IngredientType): string {
    switch (type) {
      case "grain":
        return "mash";
      case "hop":
        return "boil";
      case "yeast":
        return "fermentation";
      case "other":
        return "boil";
      default:
        return "";
    }
  }

  /**
   * Clear the ingredients cache
   */
  clearCache(): void {
    this.ingredientsCache = null;
    this.cacheTimestamp = null;
  }
}

// Export as singleton
const ingredientServiceInstance = new IngredientService();
export default ingredientServiceInstance;
