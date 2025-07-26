import React, { useState, useCallback } from "react";
import {
  Recipe,
  RecipeIngredient,
  RecipeMetrics,
  CreateRecipeIngredientData,
} from "../../types";
import { useUnits } from "../../contexts/UnitContext";
import { formatIngredientAmount } from "../../utils/formatUtils";
import { Services } from "../../services";

interface Suggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  changes: IngredientChange[];
  priority?: number;
  styleImpact?: string;
  impactType?: "critical" | "important" | "nice-to-have";
}

interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: "amount" | "time" | "use" | "ingredient_id";
  currentValue: any;
  suggestedValue: any;
  reason: string;
  // CRITICAL FIX: Add unit field to preserve backend unit suggestions
  unit?: string; // Unit from backend suggestion (g/oz for base units)
  // For adding new ingredients
  isNewIngredient?: boolean;
  newIngredientData?: CreateRecipeIngredientData;
  // For consolidated changes (multiple field changes for same ingredient)
  changes?: Array<{
    field: string;
    original_value: any;
    optimized_value: any;
    unit?: string;
    change_reason: string;
  }>;
}

interface OptimizationResult {
  performed: boolean;
  originalMetrics: any;
  optimizedMetrics: any;
  optimizedRecipe: any;
  recipeChanges: any[];
  iterationsCompleted: number;
}

interface AISuggestionsProps {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  metrics?: RecipeMetrics;
  onBulkIngredientUpdate: (
    updates: Array<{
      ingredientId: string;
      updatedData: Partial<RecipeIngredient>;
      isNewIngredient?: boolean;
    }>
  ) => Promise<void>;
  onUpdateIngredient: (
    ingredientId: string,
    updatedData: Partial<RecipeIngredient>
  ) => Promise<void>;
  onRemoveIngredient?: (ingredientId: string) => Promise<void>;
  onUpdateRecipe?: (field: keyof Recipe, value: any) => Promise<void>;
  onBulkUpdateRecipe?: (
    updates: Array<{ field: keyof Recipe; value: any }>
  ) => Promise<void>;
  importIngredients: (ingredientsToImport: RecipeIngredient[]) => Promise<void>;
  disabled?: boolean;
}

// Helper function to generate changes summary using recipe_changes array (accurate)
const getOptimizedChangesSummary = (
  _currentIngredients: RecipeIngredient[],
  _optimizedIngredients: any[],
  currentRecipe?: Recipe,
  optimizedRecipe?: any,
  recipeChanges?: any[]
): any[] => {
  const changes: any[] = [];

  // Track recipe parameter changes (like mash temperature)
  if (currentRecipe && optimizedRecipe) {
    const recipeParams = [
      { 
        key: 'mash_temperature', 
        display: 'Mash Temperature',
        unitKey: 'mash_temp_unit',
        formatValue: (value: number, unit: string) => `${Math.round(value * 10) / 10}°${unit}`
      },
      { 
        key: 'boil_time', 
        display: 'Boil Time',
        formatValue: (value: number) => `${value} min`
      },
      { 
        key: 'efficiency', 
        display: 'Efficiency',
        formatValue: (value: number) => `${value}%`
      }
    ];

    for (const param of recipeParams) {
      const currentValue = (currentRecipe as any)[param.key];
      const optimizedValue = (optimizedRecipe as any)[param.key];
      
      if (optimizedValue !== undefined && currentValue !== optimizedValue) {
        const unit = param.unitKey ? (optimizedRecipe as any)[param.unitKey] || (currentRecipe as any)[param.unitKey] : '';
        changes.push({
          type: "recipe_parameter_modified",
          parameter_name: param.display,
          parameter_key: param.key,
          original_value: param.formatValue ? param.formatValue(currentValue, unit) : currentValue,
          optimized_value: param.formatValue ? param.formatValue(optimizedValue, unit) : optimizedValue,
          unit: unit
        });
      }
    }
  }

  // FIXED: Use recipe_changes array instead of comparing ingredient lists
  // This prevents false positives from duplicate hops with different usage types
  if (recipeChanges && recipeChanges.length > 0) {
    for (const change of recipeChanges) {
      if (change.type === "ingredient_modified") {
        const modifications: any[] = [];
        
        if (change.field === "amount") {
          modifications.push({
            field: "amount",
            original_value: change.original_value,
            optimized_value: change.optimized_value,
            unit: change.unit,
          });
        } else if (change.field === "time") {
          modifications.push({
            field: "time",
            original_value: change.original_value,
            optimized_value: change.optimized_value,
            unit: "min",
          });
        }

        if (modifications.length > 0) {
          changes.push({
            type: "ingredient_modified",
            ingredient_name: change.ingredient_name,
            ingredient_type: "ingredient", // Generic type since recipe_changes doesn't specify
            changes: modifications,
          });
        }
      }
      // Handle other change types (ingredient_added, ingredient_removed) if they exist in recipe_changes
      else if (change.type === "ingredient_added") {
        changes.push({
          type: "ingredient_added",
          ingredient_name: change.ingredient_name,
          ingredient_type: change.ingredient_type || "ingredient",
          amount: change.optimized_value || change.amount,
          unit: change.unit,
        });
      }
      else if (change.type === "ingredient_removed") {
        changes.push({
          type: "ingredient_removed",
          ingredient_name: change.ingredient_name,
          ingredient_type: change.ingredient_type || "ingredient",
          amount: change.original_value || change.amount,
          unit: change.unit,
        });
      }
    }
  }

  return changes;
};

const AISuggestions: React.FC<AISuggestionsProps> = ({
  recipe,
  ingredients,
  metrics,
  onBulkIngredientUpdate,
  onUpdateIngredient,
  onRemoveIngredient: _onRemoveIngredient,
  onUpdateRecipe,
  onBulkUpdateRecipe: _onBulkUpdateRecipe,
  importIngredients,
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  // Style guide is now automatically extracted from recipe.style
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResult | null>(null);

  // Unit context for user preferences
  const { unitSystem, loading: unitsLoading } = useUnits();

  // Convert backend API suggestions to frontend format
  const convertBackendSuggestions = useCallback(
    (backendSuggestions: any[]): Suggestion[] => {
      console.log("🔍 AI DEBUG: Raw backend suggestions received:", JSON.stringify(backendSuggestions, null, 2));
      
      // Filter out optimization_summary suggestions
      const filteredSuggestions = backendSuggestions.filter(
        (suggestion) => suggestion.type !== "optimization_summary"
      );

      return filteredSuggestions.map((suggestion, index) => ({
        id: `backend-${index}`,
        type: suggestion.type || "general",
        title: suggestion.title || "Recipe Improvement",
        description: suggestion.description || "",
        confidence: suggestion.confidence || "medium",
        priority: suggestion.priority || 1,
        changes: convertBackendChangesToFrontend(
          suggestion.adjustment || suggestion.changes || []
        ),
        styleImpact: suggestion.styleImpact,
        impactType: suggestion.impactType || "nice-to-have",
      }));
    },
    []
  );

  // Convert backend changes to frontend change format
  const convertBackendChangesToFrontend = (
    backendChanges: any[]
  ): IngredientChange[] => {
    if (!Array.isArray(backendChanges)) return [];

    console.log("🔍 AI DEBUG: Converting backend changes to frontend format:", JSON.stringify(backendChanges, null, 2));

    return backendChanges.map((change, index) => {
      console.log("🔍 AI DEBUG: Processing backend change:", JSON.stringify(change, null, 2));
      const frontendChange = {
        ingredientId: change.ingredient_id || `change-${index}`,
        ingredientName:
          change.ingredient_name || change.name || "Unknown Ingredient",
        field: change.field || "amount",
        currentValue:
          change.current_value || change.current_amount || change.currentValue,
        suggestedValue:
          change.suggested_value ||
          change.suggested_amount ||
          change.suggestedValue,
        reason: change.reason || "Backend suggestion",
        unit: change.unit,
        isNewIngredient:
          change.action === "add_ingredient" ||
          change.isNewIngredient ||
          change.is_new_ingredient,
        // Preserve yeast-specific properties
        ...(change.is_yeast_strain_change && {
          is_yeast_strain_change: change.is_yeast_strain_change,
          suggested_name: change.suggested_name,
          suggested_attenuation: change.suggested_attenuation,
          new_yeast_data: change.new_yeast_data,
        }),
        newIngredientData:
          change.action === "add_ingredient" ||
          change.is_new_ingredient ||
          change.new_ingredient_data
            ? ({
                name:
                  change.ingredient_name || change.new_ingredient_data?.name,
                type: change.type || change.new_ingredient_data?.type,
                grain_type:
                  change.grain_type || change.new_ingredient_data?.grain_type,
                amount: change.amount || change.new_ingredient_data?.amount,
                unit: change.unit || change.new_ingredient_data?.unit,
                potential:
                  change.potential || change.new_ingredient_data?.potential,
                color: change.color || change.new_ingredient_data?.color,
                alpha_acid:
                  change.alpha_acid || change.new_ingredient_data?.alpha_acid,
                time: change.time || change.new_ingredient_data?.time,
                use: change.use || change.new_ingredient_data?.use,
              } as CreateRecipeIngredientData & { type: string })
            : undefined,
        // Handle consolidated changes (multiple field changes for same ingredient)
        changes:
          change.changes && Array.isArray(change.changes)
            ? change.changes
            : undefined,
      };

      return frontendChange;
    });
  };

  // Generate suggestions using flowchart-based backend API
  const generateSuggestions = useCallback(async (): Promise<void> => {
    if (!ingredients.length || !metrics || unitsLoading || disabled) return;

    setAnalyzing(true);
    setError(null);

    try {
      // Legacy recipe data format (no longer used but kept for reference)
      // const recipeData = { ... };

      // Look up style ID from recipe style name for proper style compliance analysis
      let styleId: string | undefined;
      if (recipe.style) {
        try {
          const allStyles = await Services.Data.beerStyle.getAllStylesList();
          const matchingStyle = allStyles.find(
            (style: any) =>
              style.name.toLowerCase() === recipe.style!.toLowerCase() ||
              style.display_name?.toLowerCase() === recipe.style!.toLowerCase()
          );

          if (matchingStyle) {
            styleId = matchingStyle.style_guide_id || matchingStyle.id;
          }
        } catch (error) {
          // Silently continue without style analysis if lookup fails
        }
      }

      // Prepare complete recipe object for backend using the correct Recipe interface
      const completeRecipe: Recipe = {
        // BaseEntity fields
        id: recipe.id,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
        
        // Recipe-specific fields
        recipe_id: recipe.recipe_id,
        user_id: recipe.user_id,
        username: recipe.username,
        name: recipe.name,
        style: recipe.style,
        batch_size: recipe.batch_size,
        batch_size_unit: recipe.batch_size_unit,
        description: recipe.description,
        is_public: recipe.is_public,
        version: recipe.version,
        parent_recipe_id: recipe.parent_recipe_id,
        
        // Brewing parameters
        boil_time: recipe.boil_time,
        efficiency: recipe.efficiency,
        notes: recipe.notes,
        
        // Mash temperature fields
        mash_temperature: recipe.mash_temperature,
        mash_temp_unit: recipe.mash_temp_unit,
        mash_time: recipe.mash_time,
        
        // Calculated/estimated values
        estimated_og: recipe.estimated_og,
        estimated_fg: recipe.estimated_fg,
        estimated_abv: recipe.estimated_abv,
        estimated_ibu: recipe.estimated_ibu,
        estimated_srm: recipe.estimated_srm,
        
        // Ingredients (complete ingredient data)
        ingredients: ingredients.map((ing) => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          grain_type: ing.grain_type,
          amount: ing.amount,
          unit: ing.unit,
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          time: ing.time,
          use: ing.use,
          attenuation: ing.attenuation,
        })),
      };

      // Call backend AI API using Services (flowchart-based analysis only)
      console.log("🔍 AI DEBUG: Sending complete recipe to backend:", JSON.stringify({
        complete_recipe: completeRecipe,
        style_id: styleId,
        unit_system: unitSystem,
        workflow_name: "recipe_optimization",
      }, null, 2));
      
      const response = await Services.AI.service.analyzeRecipe({
        complete_recipe: completeRecipe,
        style_id: styleId,
        unit_system: unitSystem,
        workflow_name: "recipe_optimization",
      });
      
      console.log("🔍 AI DEBUG: Raw backend response received:", JSON.stringify(response, null, 2));

      // Check if internal optimization was performed
      if (response.optimization_performed && response.optimized_recipe) {
        // Show optimization results instead of individual suggestions
        setOptimizationResult({
          performed: true,
          originalMetrics: response.original_metrics,
          optimizedMetrics: response.optimized_metrics,
          optimizedRecipe: response.optimized_recipe,
          recipeChanges: response.recipe_changes || [],
          iterationsCompleted: response.iterations_completed || 0,
        });
        setSuggestions([]);
      } else {
        // Fallback to traditional suggestions format
        const convertedSuggestions = convertBackendSuggestions(
          response.suggestions || []
        );

        setSuggestions(convertedSuggestions);
        setOptimizationResult(null);
      }

      setHasAnalyzed(true);
    } catch (error) {
      console.error(
        "❌ AI: Error generating suggestions:",
        error instanceof Error ? error.message : "Unknown error"
      );
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate suggestions"
      );
      setSuggestions([]);
    } finally {
      setAnalyzing(false);
    }
  }, [
    recipe,
    ingredients,
    metrics,
    unitSystem,
    unitsLoading,
    disabled,
    convertBackendSuggestions,
  ]);

  // Apply a suggestion
  const applySuggestion = async (suggestion: Suggestion): Promise<void> => {
    if (disabled) return;

    try {
      console.log("🔍 AI DEBUG: Starting to apply suggestion:", suggestion);
      console.log("🔍 AI DEBUG: Raw backend changes received:", JSON.stringify(suggestion.changes, null, 2));
      
      // Process each change separately for better error handling and clearer logic
      for (const change of suggestion.changes) {
        console.log("🔍 AI DEBUG: Processing individual change:", JSON.stringify(change, null, 2));
        // Handle new ingredient additions
        if (change.isNewIngredient && change.newIngredientData) {
          // Fetch available ingredients for new ingredient addition
          const availableIngredients =
            await Services.Data.ingredient.fetchIngredients();

          // Get the type from the backend suggestion, defaulting to 'grain'
          const ingredientType =
            (change.newIngredientData as any).type || "grain";
          const ingredientGroup =
            availableIngredients[
              ingredientType as keyof typeof availableIngredients
            ] || [];

          const foundIngredient = ingredientGroup.find(
            (ing: any) =>
              ing.name
                .toLowerCase()
                .includes(change.newIngredientData!.name!.toLowerCase()) ||
              change
                .newIngredientData!.name!.toLowerCase()
                .includes(ing.name.toLowerCase())
          );

          if (!foundIngredient) {
            throw new Error(
              `Ingredient "${change.newIngredientData.name}" not found in database. Please add this ingredient manually from the ingredients list.`
            );
          }

          // For new ingredients, use bulk update with the isNewIngredient flag
          const newIngredientData: Partial<RecipeIngredient> = {
            ingredient_id: foundIngredient.ingredient_id,
            name: foundIngredient.name,
            type: foundIngredient.type as any,
            amount: Number(change.newIngredientData.amount!),
            unit: change.newIngredientData.unit! as any,
            grain_type: foundIngredient.grain_type,
            color: foundIngredient.color,
            potential: foundIngredient.potential || 1.035,
            use:
              change.newIngredientData.use ||
              (foundIngredient.type === "hop"
                ? "boil"
                : foundIngredient.type === "yeast"
                ? "fermentation"
                : "mash"),
            time:
              change.newIngredientData.time ||
              (foundIngredient.type === "hop" ? 60 : undefined),
            alpha_acid: foundIngredient.alpha_acid,
            attenuation: foundIngredient.attenuation,
          };

          await onBulkIngredientUpdate([
            {
              ingredientId: change.ingredientId,
              updatedData: newIngredientData,
              isNewIngredient: true,
            },
          ]);
          continue;
        }

        // Handle existing ingredient modifications using the direct update mechanism
        // Find the existing ingredient by ID first, then by name as fallback

        let existingIngredient = ingredients.find(
          (ing) => ing.id === change.ingredientId
        );

        if (!existingIngredient) {
          // Fallback: find by name if ID match fails
          existingIngredient = ingredients.find(
            (ing) => ing.name === change.ingredientName
          );
        }

        // ENHANCED HOP MATCHING: For hops, try to find by name + current use + current time
        // This handles cases where the backend sends a generic ingredient ID but we need to match
        // the specific hop addition (since hops can appear multiple times with different use/time)
        if (!existingIngredient && change.ingredientName) {
          const hopCandidates = ingredients.filter(
            (ing) => ing.name === change.ingredientName && ing.type === "hop"
          );

          // Try to match by current value if it's provided
          if (hopCandidates.length > 0 && change.currentValue !== undefined) {
            if (change.field === "amount") {
              // Match by current amount
              existingIngredient = hopCandidates.find(
                (hop) => hop.amount === change.currentValue
              );
            } else if (change.field === "time") {
              // Match by current time
              existingIngredient = hopCandidates.find(
                (hop) => hop.time === change.currentValue
              );
            }
          }

          // If still not found and only one hop candidate, use it
          if (!existingIngredient && hopCandidates.length === 1) {
            existingIngredient = hopCandidates[0];
          }
        }

        if (!existingIngredient) {
          console.error(
            "❌ APPLY: Ingredient not found:",
            change.ingredientName,
            "ID:",
            change.ingredientId
          );
          throw new Error(
            `Ingredient "${change.ingredientName}" not found in recipe. Cannot modify non-existent ingredient.`
          );
        }

        // Special handling for yeast strain changes - replace entire yeast ingredient
        if (
          (change as any).is_yeast_strain_change &&
          change.field === "ingredient_id"
        ) {
          const newYeastData = (change as any).new_yeast_data;
          const suggestedName = (change as any).suggested_name;
          const suggestedAttenuation = (change as any).suggested_attenuation;

          if (newYeastData) {
            // Replace the entire yeast ingredient using direct update
            const updateData: Partial<RecipeIngredient> = {
              ingredient_id: newYeastData.id,
              name: newYeastData.name,
              type: newYeastData.type as any,
              attenuation: newYeastData.attenuation,
              // Keep existing recipe-specific fields
              amount: existingIngredient.amount,
              unit: existingIngredient.unit,
              use: existingIngredient.use || "primary",
            };

            await onUpdateIngredient(existingIngredient.id!, updateData);
            continue;
          } else if (suggestedName && suggestedAttenuation) {
            // Fallback: update name and attenuation manually
            const updateData: Partial<RecipeIngredient> = {
              name: suggestedName,
              attenuation: suggestedAttenuation,
            };

            await onUpdateIngredient(existingIngredient.id!, updateData);
            continue;
          }
        }

        // Regular field change handling - use direct ingredient update
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.suggestedValue,
        };

        // When backend provides a unit (for amount changes), use it for consistency
        if (change.unit && change.field === "amount") {
          updateData.unit = change.unit as any;
        }

        console.log("🔍 AI DEBUG: About to update ingredient:", existingIngredient.name);
        console.log("🔍 AI DEBUG: Current ingredient state:", JSON.stringify(existingIngredient, null, 2));
        console.log("🔍 AI DEBUG: Update data being applied:", JSON.stringify(updateData, null, 2));
        console.log("🔍 AI DEBUG: Change field:", change.field, "Current Value:", change.currentValue, "Suggested Value:", change.suggestedValue);

        // Use the direct update mechanism that leverages existing validation and state management
        try {
          await onUpdateIngredient(existingIngredient.id!, updateData);
        } catch (updateError) {
          console.error(
            "❌ APPLY: onUpdateIngredient failed for",
            existingIngredient.name,
            ":",
            updateError
          );
          throw updateError;
        }
      }

      // Mark suggestion as applied
      setAppliedSuggestions((prev) => new Set(prev).add(suggestion.id));

      // Remove from current suggestions
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (error) {
      console.error(
        "❌ APPLY: Error applying suggestion:",
        error instanceof Error ? error.message : "Unknown error"
      );
      setError(
        error instanceof Error ? error.message : "Failed to apply suggestion"
      );
    }
  };

  // Dismiss a suggestion
  const dismissSuggestion = (suggestionId: string): void => {
    setAppliedSuggestions((prev) => new Set(prev).add(suggestionId));
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  };

  // Handle analyze button click
  const handleAnalyzeRecipe = (): void => {
    generateSuggestions();
  };

  // Apply optimized recipe using complete replacement approach
  const applyOptimizedRecipe = async (
    optimization: OptimizationResult
  ): Promise<void> => {
    if (disabled) return;

    try {
      console.log("🔍 AI DEBUG: Applying optimized recipe using complete replacement");
      console.log("🔍 AI DEBUG: Optimized recipe received:", JSON.stringify(optimization.optimizedRecipe, null, 2));
      
      const optimizedRecipe = optimization.optimizedRecipe;
      
      if (!optimizedRecipe) {
        throw new Error("No optimized recipe provided");
      }

      // Extract recipe parameters (excluding ingredients which are handled separately)
      const recipeParameters: Partial<Recipe> = {
        // Only include parameters that can be optimized by the AI system
        mash_temperature: optimizedRecipe.mash_temperature,
        mash_temp_unit: optimizedRecipe.mash_temp_unit,
        mash_time: optimizedRecipe.mash_time,
        estimated_og: optimizedRecipe.estimated_og,
        estimated_fg: optimizedRecipe.estimated_fg,
        estimated_abv: optimizedRecipe.estimated_abv,
        estimated_ibu: optimizedRecipe.estimated_ibu,
        estimated_srm: optimizedRecipe.estimated_srm,
      };

      // Remove undefined values to avoid overwriting with undefined
      Object.keys(recipeParameters).forEach(key => {
        if (recipeParameters[key as keyof Recipe] === undefined) {
          delete recipeParameters[key as keyof Recipe];
        }
      });

      // Step 1: Apply recipe parameter updates
      if (Object.keys(recipeParameters).length > 0) {
        console.log("🔍 AI DEBUG: Applying recipe parameter updates:", JSON.stringify(recipeParameters, null, 2));
        try {
          // Use importRecipeData to handle all recipe metadata properly
          if (onUpdateRecipe) {
            for (const [field, value] of Object.entries(recipeParameters)) {
              if (value !== undefined) {
                await onUpdateRecipe(field as keyof Recipe, value);
              }
            }
          }
          console.log("✅ AI DEBUG: Successfully applied recipe parameter updates");
        } catch (error) {
          console.error("❌ APPLY: Failed to apply recipe parameter updates:", error);
          throw error;
        }
      }

      // Step 2: Replace ingredients completely
      if (optimizedRecipe.ingredients && Array.isArray(optimizedRecipe.ingredients)) {
        console.log("🔍 AI DEBUG: Replacing ingredients completely with optimized list");
        console.log("🔍 AI DEBUG: Optimized ingredients:", JSON.stringify(optimizedRecipe.ingredients, null, 2));
        
        try {
          // Use importIngredients to replace the entire ingredient list
          // This function handles all the complex ingredient management automatically
          await importIngredients(optimizedRecipe.ingredients);
          console.log("✅ AI DEBUG: Successfully replaced all ingredients");
        } catch (error) {
          console.error("❌ APPLY: Failed to replace ingredients:", error);
          throw error;
        }
      }

      console.log("✅ AI DEBUG: Complete recipe replacement applied successfully");
      
      // Clear the optimization result and show success message
      setOptimizationResult(null);
      setHasAnalyzed(false);
    } catch (error) {
      console.error(
        "❌ APPLY: Error applying optimized recipe:",
        error instanceof Error ? error.message : "Unknown error"
      );
      setError(
        error instanceof Error
          ? error.message
          : "Failed to apply optimized recipe"
      );
    }
  };


  // Clear suggestions
  const clearSuggestions = (): void => {
    setSuggestions([]);
    setAppliedSuggestions(new Set());
    setOptimizationResult(null);
    setHasAnalyzed(false);
    setError(null);
  };

  return (
    <div className="ai-suggestions-container">
      <div className="ai-suggestions-header">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ai-suggestions-toggle"
        >
          {isExpanded ? "▼" : "▶"} AI Recipe Analysis
        </button>

        {isExpanded && (
          <div className="header-controls">
            {recipe.style && (
              <div className="style-display">
                <span className="style-label">Style:</span>
                <span className="style-value">{recipe.style}</span>
              </div>
            )}

            <button
              onClick={handleAnalyzeRecipe}
              disabled={
                analyzing || disabled || !ingredients.length || !metrics
              }
              className="btn-analyze"
            >
              {analyzing ? "Analyzing..." : "Analyze Recipe"}
            </button>

            {hasAnalyzed && (
              <button onClick={clearSuggestions} className="btn-secondary">
                Clear Results
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="ai-suggestions-content">
          {error && <div className="ai-suggestions-error">Error: {error}</div>}

          {analyzing && (
            <div className="ai-suggestions-loading">
              <p>🤖 Analyzing recipe...</p>
            </div>
          )}

          {hasAnalyzed && !analyzing && optimizationResult && (
            <div className="optimization-results">
              <h4 className="optimization-title">
                Recipe Optimization Complete!
              </h4>

              {/* Metrics comparison */}
              <div className="metrics-improvement">
                <h5>Metrics Improvement</h5>
                <div className="metrics-grid">
                  {["OG", "FG", "ABV", "IBU", "SRM"].map((metric) => {
                    const originalValue =
                      optimizationResult.originalMetrics?.[metric];
                    const optimizedValue =
                      optimizationResult.optimizedMetrics?.[metric];
                    // Only render if the metric exists
                    if (
                      originalValue === undefined &&
                      optimizedValue === undefined
                    )
                      return null;
                    const isImproved = originalValue !== optimizedValue;
                    return (
                      <div key={metric} className="metric-item">
                        <div className="metric-label">{metric}</div>
                        <div
                          className={`metric-value ${
                            isImproved ? "improved" : ""
                          }`}
                        >
                          {originalValue} → {optimizedValue}
                          {isImproved && (
                            <span className="metric-checkmark">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recipe changes summary */}
              {optimizationResult.optimizedRecipe?.ingredients && (
                <div className="changes-made">
                  <h5>
                    Changes Made (
                    {
                      getOptimizedChangesSummary(
                        ingredients,
                        optimizationResult.optimizedRecipe.ingredients,
                        recipe,
                        optimizationResult.optimizedRecipe,
                        optimizationResult.recipeChanges
                      ).length
                    }
                    )
                  </h5>
                  <div className="changes-scroll">
                    {getOptimizedChangesSummary(
                      ingredients,
                      optimizationResult.optimizedRecipe.ingredients,
                      recipe,
                      optimizationResult.optimizedRecipe,
                      optimizationResult.recipeChanges
                    ).map((change, idx) => (
                      <div
                        key={idx}
                        className={`change-item ${
                          change.ingredient_type || ""
                        }`}
                      >
                        {change.type === "ingredient_modified" && (
                          <div>
                            <strong>{change.ingredient_name}:</strong>{" "}
                            {change.changes && Array.isArray(change.changes) ? (
                              // Consolidated changes - multiple field changes
                              <div className="consolidated-changes">
                                {change.changes.map(
                                  (fieldChange: any, fieldIdx: number) => (
                                    <div
                                      key={fieldIdx}
                                      className="consolidated-change-item"
                                    >
                                      <span>
                                        • {fieldChange.field} changed from{" "}
                                        {fieldChange.field === "amount"
                                          ? formatIngredientAmount(
                                              fieldChange.original_value,
                                              fieldChange.unit || "g",
                                              "grain",
                                              unitSystem
                                            )
                                          : fieldChange.original_value}{" "}
                                        to{" "}
                                        {fieldChange.field === "amount"
                                          ? formatIngredientAmount(
                                              fieldChange.optimized_value,
                                              fieldChange.unit || "g",
                                              "grain",
                                              unitSystem
                                            )
                                          : fieldChange.field === "time"
                                          ? `${fieldChange.optimized_value} min`
                                          : fieldChange.optimized_value}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              // Single change - original logic
                              <span>
                                {change.field} changed from{" "}
                                {change.original_value} to{" "}
                                {change.optimized_value} {change.unit}
                              </span>
                            )}
                          </div>
                        )}
                        {change.type === "ingredient_added" && (
                          <div>
                            <strong>Added:</strong> {change.ingredient_name} (
                            {formatIngredientAmount(
                              change.amount,
                              change.unit || "g",
                              change.ingredient_type || "grain",
                              unitSystem
                            )}
                            )
                          </div>
                        )}
                        {change.type === "ingredient_removed" && (
                          <div>
                            <strong>Removed:</strong> {change.ingredient_name} (
                            {formatIngredientAmount(
                              change.amount,
                              change.unit || "g",
                              change.ingredient_type || "grain",
                              unitSystem
                            )}
                            )
                          </div>
                        )}
                        {change.type === "ingredient_substituted" && (
                          <div>
                            <strong>Substituted:</strong>{" "}
                            {change.original_ingredient} →{" "}
                            {change.optimized_ingredient}
                          </div>
                        )}
                        {change.type === "recipe_parameter_modified" && (
                          <div>
                            <strong>Modified:</strong> {change.parameter_name} from{" "}
                            {change.original_value} to {change.optimized_value}
                          </div>
                        )}
                        <div className="change-description">
                          {change.change_reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <div className="optimization-actions">
                <button
                  onClick={() => applyOptimizedRecipe(optimizationResult)}
                  disabled={disabled}
                  className="btn-apply"
                >
                  Apply Optimized Recipe
                </button>
                <button
                  onClick={() => setOptimizationResult(null)}
                  className="btn-secondary"
                >
                  Keep Original Recipe
                </button>
              </div>
            </div>
          )}

          {hasAnalyzed &&
            !analyzing &&
            suggestions.length === 0 &&
            !optimizationResult &&
            !error && (
              <div className="ai-suggestions-success">
                <p>✅ Recipe analysis complete - no suggestions needed!</p>
                <p>Your recipe looks well-balanced for the current style.</p>
              </div>
            )}

          {suggestions.length > 0 && (
            <div className="suggestions-list">
              <h4>Suggestions ({suggestions.length})</h4>
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="individual-suggestion">
                  <div className="individual-suggestion-header">
                    <h5>{suggestion.title}</h5>
                    <span
                      className={`confidence-badge confidence-${suggestion.confidence}`}
                    >
                      {suggestion.confidence} confidence
                    </span>
                  </div>

                  <p>{suggestion.description}</p>

                  <div className="individual-suggestion-changes">
                    {suggestion.changes.map((change, idx) => {
                      const isConsolidated =
                        change.changes && Array.isArray(change.changes);

                      // Determine ingredient type from the current ingredients list
                      const ingredient = ingredients.find(
                        (ing) =>
                          ing.name === change.ingredientName ||
                          ing.id === change.ingredientId
                      );
                      const ingredientType = ingredient?.type || "";

                      return (
                        <div
                          key={idx}
                          className={`suggestion-change-item ${ingredientType}`}
                        >
                          <strong>{change.ingredientName}:</strong>
                          {change.isNewIngredient ? (
                            <span>
                              {" "}
                              Add{" "}
                              {formatIngredientAmount(
                                change.suggestedValue,
                                change.newIngredientData?.unit || "g",
                                "grain",
                                unitSystem
                              )}
                            </span>
                          ) : (change as any).is_yeast_strain_change &&
                            change.field === "ingredient_id" ? (
                            <span>
                              {" "}
                              Switch to {(change as any).suggested_name} (
                              {(change as any).suggested_attenuation}%
                              attenuation)
                            </span>
                          ) : isConsolidated ? (
                            // Render consolidated changes (multiple field changes)
                            <div className="consolidated-changes">
                              {change.changes!.map((fieldChange, fieldIdx) => (
                                <div
                                  key={fieldIdx}
                                  className="consolidated-change-item"
                                >
                                  <span>
                                    • {fieldChange.field} changed from{" "}
                                    {fieldChange.field === "amount"
                                      ? formatIngredientAmount(
                                          fieldChange.original_value,
                                          fieldChange.unit || "g",
                                          "grain",
                                          unitSystem
                                        )
                                      : fieldChange.original_value}{" "}
                                    to{" "}
                                    {fieldChange.field === "amount"
                                      ? formatIngredientAmount(
                                          fieldChange.optimized_value,
                                          fieldChange.unit || "g",
                                          "grain",
                                          unitSystem
                                        )
                                      : fieldChange.field === "time"
                                      ? `${fieldChange.optimized_value} min`
                                      : fieldChange.optimized_value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>
                              {" "}
                              Change {change.field} from {change.currentValue}{" "}
                              to {change.suggestedValue}
                            </span>
                          )}
                          <div className="change-description">
                            {isConsolidated
                              ? "Multiple optimizations: Recipe optimization to meet style guidelines, Hop timing optimization for better brewing practice"
                              : change.reason}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="individual-suggestion-actions">
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      disabled={disabled}
                      className="btn-apply"
                    >
                      Apply Changes
                    </button>
                    <button
                      onClick={() => dismissSuggestion(suggestion.id)}
                      className="btn-secondary"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AISuggestions;
