import ApiService from "../api";
import { Recipe, RecipeIngredient, ID } from "../../types";

// Service-specific interfaces
interface BeerXMLExportResult {
  xmlContent: string;
  filename: string;
}

interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

interface BeerXMLRecipe extends Partial<Recipe> {
  ingredients: RecipeIngredient[];
  matchingResults?: IngredientMatchingResult[];
}

interface IngredientMatchingResult {
  bestMatch: any;
  confidence: number;
}

interface ImportSummary {
  totalRecipes: number;
  totalIngredients: number;
  ingredientsByType: {
    grain: number;
    hop: number;
    yeast: number;
    other: number;
  };
  matchingStats: {
    matched: number;
    newRequired: number;
    highConfidence: number;
  };
}

/**
 * BeerXML Service - Backend-focused implementation
 * All parsing and processing is handled by the backend
 */
class BeerXMLService {
  private readonly SUPPORTED_FILE_TYPES: string[];
  private readonly MAX_FILE_SIZE: number;

  constructor() {
    this.SUPPORTED_FILE_TYPES = [".xml"];
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Export recipe to BeerXML using backend
   */
  async exportRecipe(recipeId: ID): Promise<BeerXMLExportResult> {
    try {
      const response = await ApiService.beerxml.export(recipeId);
      return {
        xmlContent: (response.data as any).xml_content || (response.data as any).xml,
        filename: (response.data as any).filename,
      };
    } catch (error) {
      console.error("Error exporting recipe:", error);
      throw new Error(`Failed to export recipe: ${(error as Error).message}`);
    }
  }

  /**
   * Parse BeerXML content using backend
   */
  async parseBeerXML(xmlContent: string): Promise<BeerXMLRecipe[]> {
    try {
      // Validate on client side first
      this.validateBeerXML(xmlContent);

      const response = await ApiService.beerxml.parse({
        xml_content: xmlContent,
      });

      // Transform the backend response structure to match frontend expectations
      const recipes = (response.data as any).recipes;
      return recipes.map((recipeData: any) => ({
        ...recipeData.recipe,
        ingredients: recipeData.ingredients,
      }));
    } catch (error) {
      console.error("Error parsing BeerXML:", error);
      throw new Error(`Failed to parse BeerXML: ${(error as Error).message}`);
    }
  }

  /**
   * Match ingredients using backend service
   */
  async matchIngredients(ingredients: RecipeIngredient[]): Promise<IngredientMatchingResult[]> {
    try {
      const response = await ApiService.beerxml.matchIngredients({
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          type: ing.type,
          amount: ing.amount,
          unit: ing.unit,
          use: ing.use,
          time: ing.time,
          // Include type-specific fields
          ...(ing.type === 'grain' && {
            potential: ing.potential,
            color: ing.color,
            grain_type: ing.grain_type,
          }),
          ...(ing.type === 'hop' && {
            alpha_acid: ing.alpha_acid,
          }),
          ...(ing.type === 'yeast' && {
            attenuation: ing.attenuation,
          }),
          // Include any additional BeerXML data if available
          ...((ing as any).beerxml_data && {
            beerxml_data: (ing as any).beerxml_data,
          }),
        })),
      } as any);

      return (response.data as any).matching_results || (response.data as any).matched_ingredients;
    } catch (error) {
      console.error("Error matching ingredients:", error);
      throw new Error(`Failed to match ingredients: ${(error as Error).message}`);
    }
  }

  /**
   * Create new ingredients using backend
   */
  async createIngredients(ingredientsData: any[]): Promise<any[]> {
    try {
      const response = await ApiService.beerxml.createIngredients({
        ingredients: ingredientsData,
      });

      return (response.data as any).created_ingredients;
    } catch (error) {
      console.error("Error creating ingredients:", error);
      throw new Error(`Failed to create ingredients: ${(error as Error).message}`);
    }
  }

  /**
   * Validate file before processing
   */
  validateFile(file: File): FileValidationResult {
    const errors: string[] = [];

    if (!file) {
      errors.push("No file provided");
      return { valid: false, errors };
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const hasValidExtension = this.SUPPORTED_FILE_TYPES.some((ext) =>
      fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      errors.push(
        `File must be one of: ${this.SUPPORTED_FILE_TYPES.join(", ")}`
      );
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(
        `File size must be less than ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Check if file is empty
    if (file.size === 0) {
      errors.push("File is empty");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate BeerXML content before sending to backend
   */
  validateBeerXML(xmlContent: string): boolean {
    if (!xmlContent || typeof xmlContent !== "string") {
      throw new Error("Invalid XML content");
    }

    if (xmlContent.trim().length === 0) {
      throw new Error("XML content is empty");
    }

    // Basic XML structure check
    if (!xmlContent.includes("<RECIPES>") && !xmlContent.includes("<RECIPE>")) {
      throw new Error(
        "Not a valid BeerXML file - missing RECIPES or RECIPE elements"
      );
    }

    // Check for obvious malformed XML
    const openBrackets = (xmlContent.match(/</g) || []).length;
    const closeBrackets = (xmlContent.match(/>/g) || []).length;

    if (openBrackets !== closeBrackets) {
      throw new Error("Malformed XML - mismatched brackets");
    }

    return true;
  }

  /**
   * Read file content as text
   */
  async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          resolve(content);
        } catch (error) {
          reject(new Error("Failed to read file content"));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Download BeerXML file
   */
  downloadBeerXML(xmlContent: string, filename: string = "recipe.xml"): boolean {
    try {
      const blob = new Blob([xmlContent], {
        type: "application/xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error("Error downloading file:", error);
      throw new Error("Failed to download BeerXML file");
    }
  }

  /**
   * Generate safe filename from recipe name
   */
  generateFilename(recipeName?: string): string {
    if (!recipeName) {
      return "recipe.xml";
    }

    // Remove special characters and replace spaces with underscores
    const safeName = recipeName
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()
      .substring(0, 50); // Limit length

    return `${safeName}_recipe.xml`;
  }

  /**
   * Process uploaded file through complete import workflow
   */
  async processImportFile(file: File, _availableIngredients?: any): Promise<BeerXMLRecipe[]> {
    try {
      // Step 1: Validate file
      const fileValidation = this.validateFile(file);
      if (!fileValidation.valid) {
        throw new Error(fileValidation.errors.join("; "));
      }

      // Step 2: Read file content
      const xmlContent = await this.readFileContent(file);

      // Step 3: Parse BeerXML
      const recipes = await this.parseBeerXML(xmlContent);

      if (!recipes || recipes.length === 0) {
        throw new Error("No valid recipes found in BeerXML file");
      }

      // Step 4: Match ingredients for first recipe (or all recipes)
      const processedRecipes: BeerXMLRecipe[] = [];

      for (const recipeData of recipes) {
        if (recipeData.ingredients && recipeData.ingredients.length > 0) {
          const matchingResults = await this.matchIngredients(
            recipeData.ingredients
          );

          processedRecipes.push({
            ...recipeData,
            matchingResults,
          });
        } else {
          processedRecipes.push(recipeData);
        }
      }

      return processedRecipes;
    } catch (error) {
      console.error("Error processing import file:", error);
      throw error;
    }
  }

  /**
   * Get import summary statistics
   */
  getImportSummary(recipes: BeerXMLRecipe[]): ImportSummary {
    const summary: ImportSummary = {
      totalRecipes: recipes.length,
      totalIngredients: 0,
      ingredientsByType: {
        grain: 0,
        hop: 0,
        yeast: 0,
        other: 0,
      },
      matchingStats: {
        matched: 0,
        newRequired: 0,
        highConfidence: 0,
      },
    };

    recipes.forEach((recipe) => {
      if (recipe.ingredients) {
        summary.totalIngredients += recipe.ingredients.length;

        recipe.ingredients.forEach((ingredient) => {
          const type =
            (ingredient.type as any) === "adjunct" ? "other" : ingredient.type;
          if (summary.ingredientsByType[type as keyof typeof summary.ingredientsByType] !== undefined) {
            summary.ingredientsByType[type as keyof typeof summary.ingredientsByType]++;
          }
        });
      }

      if (recipe.matchingResults) {
        recipe.matchingResults.forEach((result) => {
          if (result.bestMatch && result.confidence > 0.7) {
            summary.matchingStats.matched++;
            if (result.confidence > 0.8) {
              summary.matchingStats.highConfidence++;
            }
          } else {
            summary.matchingStats.newRequired++;
          }
        });
      }
    });

    return summary;
  }

  /**
   * Error handling helper
   */
  handleApiError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || error.response.statusText;
      return new Error(`Server error: ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      return new Error("Network error: Unable to connect to server");
    } else {
      // Something else happened
      return new Error(`Unexpected error: ${error.message}`);
    }
  }
}

// Export as singleton
const beerXMLServiceInstance = new BeerXMLService();
export default beerXMLServiceInstance;