/**
 * Simplified AI Service for Backend API Communication
 *
 * Replaces complex frontend AI logic with simple backend API calls
 */

import ApiService from "../api";
import { Recipe, RecipeIngredient, RecipeMetrics } from "../../types";

export interface AIAnalysisRequest {
  // Support both old format (recipe_data) and new format (complete_recipe)
  recipe_data?: {
    ingredients: RecipeIngredient[];
    batch_size: number;
    batch_size_unit: string;
    efficiency: number;
    // Optional: Additional recipe metadata can be added here
    mash_temperature?: number; // Optional mash temperature for analysis
    mash_temp_unit?: string; // Optional unit for mash temperature (e.g., "F" or "C")
  };
  complete_recipe?: Recipe; // New: Complete recipe object with all fields
  style_id?: string; // Optional MongoDB ObjectId for specific style analysis
  unit_system?: "metric" | "imperial";
  workflow_name?: string; // Optional workflow name for flowchart analysis
}

export interface AIAnalysisResponse {
  current_metrics: RecipeMetrics;
  style_analysis?: {
    style_name: string;
    overall_score: number;
    compliance: Record<string, any>;
    optimization_targets: OptimizationTarget[];
  };
  suggestions: AISuggestion[];
  analysis_timestamp: string;
  unit_system: string;
  user_preferences: {
    preferred_units: string;
    default_batch_size: number;
  };
  // New optimization fields
  optimization_performed?: boolean;
  iterations_completed?: number;
  original_metrics?: RecipeMetrics;
  optimized_metrics?: RecipeMetrics;
  optimized_recipe?: Recipe; // Complete recipe object with all fields preserved
  recipe_changes?: RecipeChange[];
  optimization_history?: OptimizationHistoryEntry[];
}

export interface RecipeChange {
  type:
    | "ingredient_modified"
    | "ingredient_added"
    | "ingredient_removed"
    | "ingredient_substituted"
    | "optimization_summary";
  ingredient_name?: string;
  field?: string;
  original_value?: any;
  optimized_value?: any;
  unit?: string;
  original_ingredient?: string;
  optimized_ingredient?: string;
  ingredient_type?: string;
  amount?: number;
  change_reason: string;
  iterations_completed?: number;
  total_changes?: number;
  final_compliance?: string;
}

export interface OptimizationHistoryEntry {
  iteration: number;
  applied_changes: any[];
  metrics_before: RecipeMetrics;
  metrics_after: RecipeMetrics;
}

export interface OptimizationTarget {
  metric: string;
  current_value: number;
  target_value: number;
  priority: number;
  reasoning: string;
}

export interface AISuggestion {
  type: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  changes: AIIngredientChange[];
  priority: number;
  predicted_effects?: {
    original_metrics: RecipeMetrics;
    predicted_metrics: RecipeMetrics;
    metric_changes: Record<string, any>;
  };
}

export interface AIIngredientChange {
  ingredient_id?: string;
  ingredient_name: string;
  field: string;
  current_value: any;
  suggested_value: any;
  unit?: string;
  reason: string;
  is_new_ingredient?: boolean;
  new_ingredient_data?: {
    name: string;
    type: string;
    grain_type?: string;
    color?: number;
    use?: string;
    unit?: string;
    amount?: number;
  };
}

/**
 * AI Service for backend communication
 */
export class AIService {
  /**
   * Analyze a recipe and get comprehensive AI suggestions
   */
  async analyzeRecipe(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const response = await ApiService.ai.analyzeRecipe(request);

      return response.data;
    } catch (error: any) {
      console.error("❌ AI Service - Analyze Recipe Error:", {
        error: error.response?.data || error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString(),
      });

      const errorMessage =
        error.response?.data?.error || error.message || "AI analysis failed";
      throw new Error(`AI analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Check AI service health
   */
  async checkHealth(): Promise<{
    status: string;
    service: string;
    components: Record<string, string>;
  }> {
    try {
      const response = await ApiService.ai.checkHealth();
      return response.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "AI health check failed";
      throw new Error(`AI health check failed: ${errorMessage}`);
    }
  }

  /**
   * Helper: Convert Recipe to AIAnalysisRequest format
   * Automatically extracts beer style from recipe.style if available
   */
  async convertRecipeToAnalysisRequest(
    recipe: Recipe,
    ingredients: RecipeIngredient[],
    unitSystem?: "metric" | "imperial"
  ): Promise<AIAnalysisRequest> {
    let styleId: string | undefined;

    // Automatically find style ID from recipe.style if it exists
    if (recipe.style) {
      try {
        // Import Services here to avoid circular dependencies
        const { Services } = await import("../index");
        const allStyles = await Services.beerStyle.getAllStylesList();
        const matchingStyle = allStyles.find(
          (style: any) =>
            style.name.toLowerCase() === recipe.style!.toLowerCase() ||
            style.display_name.toLowerCase() === recipe.style!.toLowerCase()
        );

        if (matchingStyle) {
          styleId = matchingStyle.style_guide_id;
        }
      } catch (error) {
        console.warn("Failed to lookup beer style for AI analysis:", error);
        // Continue without style analysis if lookup fails
      }
    }

    return {
      recipe_data: {
        ingredients: ingredients,
        batch_size: recipe.batch_size,
        batch_size_unit: recipe.batch_size_unit || "gal",
        efficiency: recipe.efficiency || 75,
      },
      style_id: styleId,
      unit_system: unitSystem,
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;
