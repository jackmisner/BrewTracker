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
  disabled?: boolean;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  recipe,
  ingredients,
  metrics,
  onBulkIngredientUpdate,
  onUpdateIngredient,
  onRemoveIngredient,
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

    return backendChanges.map((change, index) => {
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

  // Generate suggestions using backend API
  const generateSuggestions = useCallback(async (): Promise<void> => {
    if (!ingredients.length || !metrics || unitsLoading || disabled) return;

    setAnalyzing(true);
    setError(null);

    try {
      // Prepare recipe data for backend API
      const recipeData = {
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
          attenuation: ing.attenuation, // Include yeast attenuation for proper FG/ABV calculations
        })),
        batch_size: recipe.batch_size,
        batch_size_unit: recipe.batch_size_unit,
        efficiency: recipe.efficiency || 75,
        boil_time: recipe.boil_time || 60,
      };

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
          console.warn("🔍 AISuggestions - Failed to lookup style:", error);
        }
      }

      // Call backend AI API using Services
      const response = await Services.AI.service.analyzeRecipe({
        recipe_data: recipeData,
        style_id: styleId, // Pass the looked-up style ID for proper style compliance analysis
        unit_system: unitSystem,
      });

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
        setSuggestions([]); // Clear individual suggestions since we have complete optimization
      } else {
        // Fallback to traditional suggestions format
        const convertedSuggestions = convertBackendSuggestions(
          response.suggestions || []
        );

        setSuggestions(convertedSuggestions);
        setOptimizationResult(null); // Clear any previous optimization results
      }

      setHasAnalyzed(true);
    } catch (error) {
      console.error("❌ AISuggestions - Error generating AI suggestions:", {
        error: error,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate suggestions",
        timestamp: new Date().toISOString(),
      });
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
      // Process each change separately for better error handling and clearer logic
      for (const change of suggestion.changes) {
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
              (foundIngredient.type === "hop" ? "boil" : "mash"),
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
          console.error("❌ DEBUG: Ingredient not found!", {
            searchedId: change.ingredientId,
            searchedName: change.ingredientName,
            availableIngredients: ingredients.map((ing) => ({
              id: ing.id,
              name: ing.name,
            })),
          });
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

        // Use the direct update mechanism that leverages existing validation and state management
        try {
          await onUpdateIngredient(existingIngredient.id!, updateData);
        } catch (updateError) {
          console.error("❌ DEBUG: onUpdateIngredient call failed", {
            ingredientId: existingIngredient.id,
            updateData,
            error: updateError,
          });
          throw updateError;
        }
      }

      // Mark suggestion as applied
      setAppliedSuggestions((prev) => new Set(prev).add(suggestion.id));

      // Remove from current suggestions
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (error) {
      console.error("❌ AISuggestions - Error applying suggestion:", {
        error: error,
        message:
          error instanceof Error ? error.message : "Failed to apply suggestion",
        suggestionId: suggestion.id,
        timestamp: new Date().toISOString(),
      });
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

  // Apply optimized recipe
  const applyOptimizedRecipe = async (
    optimization: OptimizationResult
  ): Promise<void> => {
    if (disabled) return;

    try {
      // BETTER APPROACH: Use the recipe changes to apply individual updates
      // This is much more reliable than trying to match optimized ingredients
      const recipeChanges = optimization.recipeChanges || [];

      // Filter out summary changes and process only ingredient modifications (both single field and consolidated)
      const ingredientChanges = recipeChanges.filter(
        (change) =>
          change.type === "ingredient_modified" &&
          change.ingredient_name &&
          (change.field || (change.changes && Array.isArray(change.changes))) // Accept both formats
      );

      // UNIFIED APPROACH: Process all ingredient changes as a single bulk update
      // This eliminates race conditions between hop and grain processing

      const allBulkUpdates: Array<{
        ingredientId: string;
        updatedData: Partial<RecipeIngredient>;
      }> = [];

      for (const change of ingredientChanges) {
        const isConsolidatedChange =
          change.changes && Array.isArray(change.changes);

        // Find target ingredient using appropriate matching logic
        let targetIngredient: any = null;

        if (change.ingredient_type === "hop") {
          // For hops, match by name + use + original time (to target the right hop addition)
          targetIngredient = ingredients.find(
            (ing) =>
              ing.name === change.ingredient_name &&
              ing.type === "hop" &&
              ing.use === change.ingredient_use &&
              ing.time === change.ingredient_time // Match the ORIGINAL time before optimization
          );
        } else {
          // For non-hops, match by ingredient_id first (most reliable), then fall back to name
          if (change.ingredient_id) {
            targetIngredient = ingredients.find(
              (ing) =>
                ing.ingredient_id === change.ingredient_id &&
                ing.name === change.ingredient_name
            );
          }
          if (!targetIngredient) {
            targetIngredient = ingredients.find(
              (ing) => ing.name === change.ingredient_name
            );
          }
        }

        if (targetIngredient) {
          // Find the actual ingredient in the ingredients array to get the correct ID
          const actualIngredient = ingredients.find(
            (ing) =>
              ing.ingredient_id === targetIngredient.ingredient_id &&
              ing.name === targetIngredient.name &&
              ing.use === targetIngredient.use &&
              ing.time === targetIngredient.time
          );

          if (!actualIngredient) {
            console.error(
              `❌ DEBUG: Could not find actual ingredient in array for ${targetIngredient.name}`
            );
            continue;
          }

          let updateData: Partial<RecipeIngredient>;

          if (isConsolidatedChange) {
            // Handle consolidated change with multiple fields
            updateData = {
              // Include essential fields from existing ingredient to pass validation
              ingredient_id: targetIngredient.ingredient_id,
              use: targetIngredient.use,
              time: targetIngredient.time, // Start with current time
            };

            // Apply all field changes
            for (const fieldChange of change.changes) {
              updateData[fieldChange.field as keyof RecipeIngredient] =
                fieldChange.optimized_value;

              // Add unit if specified (for amount changes)
              if (fieldChange.field === "amount" && fieldChange.unit) {
                updateData.unit = fieldChange.unit as any;
              }
            }
          } else {
            // Handle single field change
            updateData = {
              // Include essential fields from existing ingredient to pass validation
              ingredient_id: targetIngredient.ingredient_id,
              use: targetIngredient.use,
              time: targetIngredient.time,
              [change.field]: change.optimized_value,
            };

            // Add unit if specified (for amount changes)
            if (change.field === "amount" && change.unit) {
              updateData.unit = change.unit as any;
            }
          }

          allBulkUpdates.push({
            ingredientId: actualIngredient.id!, // Use the actual ingredient ID from the array
            updatedData: updateData,
          });
        } else {
          console.warn(
            `⚠️ DEBUG: Could not find ingredient to modify: ${change.ingredient_name}`
          );
        }
      }

      // Apply ALL changes as a single bulk update
      if (allBulkUpdates.length > 0) {
        try {
          await onBulkIngredientUpdate(allBulkUpdates);
        } catch (updateError) {
          console.error(`❌ DEBUG: Failed to apply unified bulk update`, {
            updateError,
          });
          throw updateError;
        }
      }

      // Handle ingredient additions (for new ingredients suggested by AI)
      const ingredientAdditions = recipeChanges.filter(
        (change) => change.type === "ingredient_added" && change.ingredient_name
      );

      for (const addition of ingredientAdditions) {
        // Fetch available ingredients for new ingredient addition
        const availableIngredients =
          await Services.Data.ingredient.fetchIngredients();

        // Get the type from the addition, defaulting to 'grain'
        const ingredientType = addition.ingredient_type || "grain";
        const ingredientGroup =
          availableIngredients[
            ingredientType as keyof typeof availableIngredients
          ] || [];

        const foundIngredient = ingredientGroup.find(
          (ing: any) =>
            ing.name
              .toLowerCase()
              .includes(addition.ingredient_name.toLowerCase()) ||
            addition.ingredient_name
              .toLowerCase()
              .includes(ing.name.toLowerCase())
        );

        if (!foundIngredient) {
          console.error(
            `❌ DEBUG: Ingredient "${addition.ingredient_name}" not found in database for addition`
          );
          continue;
        }

        // For new ingredients, use bulk update with the isNewIngredient flag
        const newIngredientData: Partial<RecipeIngredient> = {
          ingredient_id: foundIngredient.ingredient_id,
          name: foundIngredient.name,
          type: foundIngredient.type as any,
          amount: Number(addition.amount),
          unit: addition.unit as any,
          grain_type: foundIngredient.grain_type,
          color: foundIngredient.color,
          potential: foundIngredient.potential || 1.035,
          use:
            addition.use || (foundIngredient.type === "hop" ? "boil" : "mash"),
          time:
            addition.time || (foundIngredient.type === "hop" ? 60 : undefined),
          alpha_acid: foundIngredient.alpha_acid,
          attenuation: foundIngredient.attenuation,
        };

        try {
          await onBulkIngredientUpdate([
            {
              ingredientId: `addition-${Date.now()}-${Math.random()}`,
              updatedData: newIngredientData,
              isNewIngredient: true,
            },
          ]);
        } catch (addError) {
          console.error(`❌ DEBUG: Failed to add ${addition.ingredient_name}`, {
            addError,
          });
          throw addError;
        }
      }

      // Handle ingredient removals (for substitutions and eliminations)
      const ingredientRemovals = recipeChanges.filter(
        (change) =>
          change.type === "ingredient_removed" && change.ingredient_name
      );

      for (const removal of ingredientRemovals) {
        // Find the specific ingredient to remove using the same matching logic
        let targetIngredient: any = null;

        if (removal.ingredient_type === "hop") {
          // For hops, match by name + use + time
          targetIngredient = ingredients.find(
            (ing) =>
              ing.name === removal.ingredient_name &&
              ing.type === "hop" &&
              ing.use === removal.ingredient_use &&
              ing.time === removal.ingredient_time
          );
        } else {
          // For non-hops, match by name
          targetIngredient = ingredients.find(
            (ing) => ing.name === removal.ingredient_name
          );
        }

        if (targetIngredient && onRemoveIngredient) {
          try {
            await onRemoveIngredient(targetIngredient.id!);
          } catch (removeError) {
            console.error(
              `❌ DEBUG: Failed to remove ${removal.ingredient_name}`,
              { removeError }
            );
            throw removeError;
          }
        } else {
          console.warn(
            `⚠️ DEBUG: Could not find ingredient to remove: ${removal.ingredient_name}`,
            {
              hasRemoveFunction: !!onRemoveIngredient,
            }
          );
        }
      }

      // Clear the optimization result and show success message
      setOptimizationResult(null);
      setHasAnalyzed(false);
    } catch (error) {
      console.error("❌ AISuggestions - Error applying optimized recipe:", {
        error: error,
        message:
          error instanceof Error
            ? error.message
            : "Failed to apply optimized recipe",
        timestamp: new Date().toISOString(),
      });
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
              <p className="optimization-subtitle">
                Internal optimization completed in{" "}
                <strong>
                  {optimizationResult.iterationsCompleted} iterations
                </strong>
              </p>

              {/* Metrics comparison */}
              <div className="metrics-improvement">
                <h5>Metrics Improvement</h5>
                <div className="metrics-grid">
                  {Object.entries(optimizationResult.originalMetrics || {}).map(
                    ([metric, originalValue]) => {
                      const optimizedValue =
                        optimizationResult.optimizedMetrics?.[metric];
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
                    }
                  )}
                </div>
              </div>

              {/* Recipe changes summary */}
              {optimizationResult.recipeChanges.length > 0 && (
                <div className="changes-made">
                  <h5>
                    Changes Made (
                    {
                      optimizationResult.recipeChanges.filter(
                        (change: any) => change.type !== "optimization_summary"
                      ).length
                    }
                    )
                  </h5>
                  <div className="changes-scroll">
                    {optimizationResult.recipeChanges
                      .filter(
                        (change: any) => change.type !== "optimization_summary"
                      )
                      .map((change, idx) => (
                        <div
                          key={idx}
                          className={`change-item ${
                            change.ingredient_type || ""
                          }`}
                        >
                          {change.type === "ingredient_modified" && (
                            <div>
                              <strong>{change.ingredient_name}:</strong>{" "}
                              {change.changes &&
                              Array.isArray(change.changes) ? (
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
                              {change.amount} {change.unit})
                            </div>
                          )}
                          {change.type === "ingredient_substituted" && (
                            <div>
                              <strong>Substituted:</strong>{" "}
                              {change.original_ingredient} →{" "}
                              {change.optimized_ingredient}
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
