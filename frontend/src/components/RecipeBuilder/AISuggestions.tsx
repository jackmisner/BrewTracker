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
  disabled?: boolean;
}

// Helper function to generate changes summary using optimized recipe values (rounded)
const getOptimizedChangesSummary = (
  currentIngredients: RecipeIngredient[],
  optimizedIngredients: any[],
  currentRecipe?: Recipe,
  optimizedRecipe?: any
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

  // Track ingredient modifications and additions
  for (const optimizedIng of optimizedIngredients) {
    const currentIng = currentIngredients.find(
      (ing) =>
        ing.ingredient_id === optimizedIng.ingredient_id ||
        ing.name === optimizedIng.name
    );

    if (currentIng) {
      // Check for modifications
      const modifications: any[] = [];

      if (currentIng.amount !== optimizedIng.amount) {
        modifications.push({
          field: "amount",
          original_value: currentIng.amount,
          optimized_value: optimizedIng.amount,
          unit: optimizedIng.unit || currentIng.unit,
        });
      }

      if (
        currentIng.time !== optimizedIng.time &&
        optimizedIng.time !== undefined
      ) {
        modifications.push({
          field: "time",
          original_value: currentIng.time,
          optimized_value: optimizedIng.time,
          unit: "min",
        });
      }

      if (modifications.length > 0) {
        changes.push({
          type: "ingredient_modified",
          ingredient_name: optimizedIng.name,
          ingredient_type: optimizedIng.type,
          changes: modifications,
        });
      }
    } else {
      // New ingredient added
      changes.push({
        type: "ingredient_added",
        ingredient_name: optimizedIng.name,
        ingredient_type: optimizedIng.type,
        amount: optimizedIng.amount,
        unit: optimizedIng.unit,
      });
    }
  }

  // Track ingredient removals
  for (const currentIng of currentIngredients) {
    const stillExists = optimizedIngredients.find(
      (optIng) =>
        optIng.ingredient_id === currentIng.ingredient_id ||
        optIng.name === currentIng.name
    );
    if (!stillExists) {
      changes.push({
        type: "ingredient_removed",
        ingredient_name: currentIng.name,
        ingredient_type: currentIng.type,
        amount: currentIng.amount,
        unit: currentIng.unit,
      });
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
  onRemoveIngredient,
  onUpdateRecipe,
  onBulkUpdateRecipe,
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
          attenuation: ing.attenuation,
        })),
        batch_size: recipe.batch_size,
        batch_size_unit: recipe.batch_size_unit,
        efficiency: recipe.efficiency || 75,
        boil_time: recipe.boil_time || 60,
        mash_temperature: recipe.mash_temperature || 152,
        mash_temp_unit: recipe.mash_temp_unit || "F",
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
          // Silently continue without style analysis if lookup fails
        }
      }

      // Call backend AI API using Services (flowchart-based analysis only)
      console.log("🔍 AI DEBUG: Sending request to backend with recipe data:", JSON.stringify({
        recipe_data: recipeData,
        style_id: styleId,
        unit_system: unitSystem,
        workflow_name: "recipe_optimization",
      }, null, 2));
      
      const response = await Services.AI.service.analyzeRecipe({
        recipe_data: recipeData,
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

  // Apply optimized recipe
  const applyOptimizedRecipe = async (
    optimization: OptimizationResult
  ): Promise<void> => {
    if (disabled) return;

    try {
      console.log("🔍 AI DEBUG: Applying optimized recipe using recipe_changes array");
      console.log("🔍 AI DEBUG: Recipe changes to apply:", JSON.stringify(optimization.recipeChanges || [], null, 2));
      
      // IMPROVED APPROACH: Only apply the actual changes from recipe_changes array
      // This prevents replacing entire ingredient list and avoids duplicate hop issues
      const optimizedRecipe = optimization.optimizedRecipe;
      const recipeChanges = optimization.recipeChanges || [];

      // Step 1: Apply recipe-level parameter changes using bulk approach
      if (onUpdateRecipe && optimizedRecipe) {
        // Build a map of recipe parameter changes that need to be applied
        const recipeParameterChanges: Array<{
          field: keyof Recipe;
          value: any;
        }> = [];

        // Handle mash temperature conversion to user's preferred units
        if (
          optimizedRecipe.mash_temperature !== undefined &&
          optimizedRecipe.mash_temp_unit !== undefined
        ) {
          let targetTemp = optimizedRecipe.mash_temperature;
          let targetUnit = optimizedRecipe.mash_temp_unit;

          // Convert to user's preferred units if needed
          const userPreferredUnit = unitSystem === "metric" ? "C" : "F";
          if (targetUnit !== userPreferredUnit) {
            if (userPreferredUnit === "C" && targetUnit === "F") {
              // Convert F to C
              targetTemp = Math.round((((targetTemp - 32) * 5) / 9) * 10) / 10;
              targetUnit = "C";
            } else if (userPreferredUnit === "F" && targetUnit === "C") {
              // Convert C to F
              targetTemp = Math.round(((targetTemp * 9) / 5 + 32) * 10) / 10;
              targetUnit = "F";
            }
          }

          // Add to changes if different from current values
          if (targetTemp !== recipe.mash_temperature) {
            recipeParameterChanges.push({
              field: "mash_temperature",
              value: targetTemp,
            });
          }
          if (targetUnit !== recipe.mash_temp_unit) {
            recipeParameterChanges.push({
              field: "mash_temp_unit",
              value: targetUnit,
            });
          }
        }

        // Handle other recipe parameters
        const otherFields: (keyof Recipe)[] = ["boil_time", "efficiency"];
        for (const field of otherFields) {
          if (
            optimizedRecipe[field] !== undefined &&
            optimizedRecipe[field] !== recipe[field]
          ) {
            recipeParameterChanges.push({
              field,
              value: optimizedRecipe[field],
            });
          }
        }

        // Apply all recipe parameter changes atomically using bulk update
        if (recipeParameterChanges.length > 0) {
          try {
            if (onBulkUpdateRecipe) {
              // Use bulk update to apply all recipe changes simultaneously
              await onBulkUpdateRecipe(recipeParameterChanges);
            } else {
              // Fallback to sequential updates if bulk update not available
              for (const change of recipeParameterChanges) {
                await onUpdateRecipe(change.field, change.value);
              }
            }
          } catch (error) {
            console.error(
              `❌ APPLY: Failed to update recipe parameters:`,
              error
            );
          }
        }
      }

      // Step 2: Handle ingredient substitutions (removal + addition)
      // Check if the optimized recipe includes new ingredients that require substitution
      const optimizedIngredients = optimizedRecipe?.ingredients || [];
      
      // Handle yeast substitutions specifically
      const hasNewYeast = optimizedIngredients.some(
        (ing: any) =>
          ing.type === "yeast" &&
          !ingredients.some(
            (existing) => existing.ingredient_id === ing.ingredient_id
          )
      );

      if (hasNewYeast && onRemoveIngredient) {
        console.log("🔍 AI DEBUG: New yeast detected, removing existing yeast ingredients");
        // Remove all existing yeast ingredients first
        const existingYeastIds = ingredients
          .filter((ing) => ing.type === "yeast")
          .map((ing) => ing.id!);

        for (const yeastId of existingYeastIds) {
          await onRemoveIngredient(yeastId);
        }
        
        // Add the new yeast ingredient
        const newYeastIngredient = optimizedIngredients.find((ing: any) => 
          ing.type === "yeast" && !ingredients.some(existing => existing.ingredient_id === ing.ingredient_id)
        );
        
        if (newYeastIngredient) {
          console.log("🔍 AI DEBUG: Adding new yeast ingredient:", newYeastIngredient.name);
          
          try {
            const cachedIngredients = await Services.Data.ingredient.fetchIngredients();
            const completeYeastData = cachedIngredients.yeast?.find(
              (ing: any) => ing.ingredient_id === newYeastIngredient.ingredient_id
            );

            await onBulkIngredientUpdate([{
              ingredientId: newYeastIngredient.ingredient_id,
              updatedData: {
                ingredient_id: newYeastIngredient.ingredient_id,
                name: newYeastIngredient.name,
                type: newYeastIngredient.type,
                amount: newYeastIngredient.amount,
                unit: newYeastIngredient.unit,
                use: newYeastIngredient.use || "fermentation",
                time: newYeastIngredient.time || 0,
                attenuation: completeYeastData?.attenuation || newYeastIngredient.attenuation,
                alpha_acid: completeYeastData?.alpha_acid || newYeastIngredient.alpha_acid,
                color: completeYeastData?.color || newYeastIngredient.color,
                grain_type: completeYeastData?.grain_type || newYeastIngredient.grain_type,
                potential: completeYeastData?.potential || newYeastIngredient.potential,
              },
              isNewIngredient: true,
            }]);
          } catch (error) {
            console.error("❌ APPLY: Failed to add new yeast ingredient:", error);
          }
        }
      }

      // Step 3: Apply only the specific ingredient changes from recipe_changes
      // This prevents replacing entire ingredient list and maintains existing hop scheduling
      const bulkUpdates: Array<{
        ingredientId: string;
        updatedData: Partial<RecipeIngredient>;
      }> = [];
      
      for (const change of recipeChanges) {
        console.log("🔍 AI DEBUG: Processing recipe change:", JSON.stringify(change, null, 2));
        
        // Find the ingredient to update
        const targetIngredient = ingredients.find(ing => 
          ing.name === change.ingredient_name
        );
        
        if (!targetIngredient) {
          console.error(`❌ APPLY: Ingredient "${change.ingredient_name}" not found in recipe`);
          continue;
        }
        
        console.log("🔍 AI DEBUG: Found target ingredient:", JSON.stringify(targetIngredient, null, 2));
        
        // Apply the specific field change
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.optimized_value,
        };
        
        // Add unit if provided
        if (change.unit) {
          updateData.unit = change.unit as any;
        }
        
        console.log("🔍 AI DEBUG: Preparing bulk update:", JSON.stringify(updateData, null, 2));
        
        bulkUpdates.push({
          ingredientId: targetIngredient.id!,
          updatedData: updateData,
        });
      }
      
      // Apply all changes using bulk update method
      if (bulkUpdates.length > 0) {
        console.log("🔍 AI DEBUG: Applying bulk updates:", JSON.stringify(bulkUpdates, null, 2));
        try {
          await onBulkIngredientUpdate(bulkUpdates);
          console.log("✅ AI DEBUG: Successfully applied all recipe changes via bulk update");
        } catch (error) {
          console.error("❌ APPLY: Failed to apply bulk updates:", error);
        }
      }

      console.log("✅ AI DEBUG: All recipe changes applied successfully");
      
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
                        optimizationResult.optimizedRecipe
                      ).length
                    }
                    )
                  </h5>
                  <div className="changes-scroll">
                    {getOptimizedChangesSummary(
                      ingredients,
                      optimizationResult.optimizedRecipe.ingredients,
                      recipe,
                      optimizationResult.optimizedRecipe
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
