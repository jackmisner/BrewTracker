import React, { useState, useCallback } from "react";
import { Recipe, RecipeIngredient, RecipeMetrics, CreateRecipeIngredientData } from "../../types";
import { useUnits } from "../../contexts/UnitContext";
import { formatIngredientAmount } from "../../utils/formatUtils";
import { Services } from "../../services";

interface Suggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  changes: IngredientChange[];
  priority?: number;
  styleImpact?: string;
  impactType?: 'critical' | 'important' | 'nice-to-have';
}

interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: 'amount' | 'time' | 'use' | 'ingredient_id';
  currentValue: any;
  suggestedValue: any;
  reason: string;
  // CRITICAL FIX: Add unit field to preserve backend unit suggestions
  unit?: string; // Unit from backend suggestion (g/oz for base units)
  // For adding new ingredients
  isNewIngredient?: boolean;
  newIngredientData?: CreateRecipeIngredientData;
}

interface OptimizationResult {
  performed: boolean;
  originalMetrics: any;
  optimizedMetrics: any;
  optimizedRecipe: any;
  recipeChanges: any[];
  iterationsCompleted: number;
  remainingSuggestions: any[];
}

interface AISuggestionsProps {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  metrics?: RecipeMetrics;
  onBulkIngredientUpdate: (updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient>; isNewIngredient?: boolean }>) => Promise<void>;
  onUpdateIngredient: (ingredientId: string, updatedData: Partial<RecipeIngredient>) => Promise<void>;
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
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  // Style guide is now automatically extracted from recipe.style
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);

  // Unit context for user preferences
  const { unitSystem, loading: unitsLoading } = useUnits();


  // Convert backend API suggestions to frontend format
  const convertBackendSuggestions = useCallback((backendSuggestions: any[]): Suggestion[] => {
    return backendSuggestions.map((suggestion, index) => ({
      id: `backend-${index}`,
      type: suggestion.type || 'general',
      title: suggestion.title || 'Recipe Improvement',
      description: suggestion.description || '',
      confidence: suggestion.confidence || 'medium',
      priority: suggestion.priority || 1,
      changes: convertBackendChangesToFrontend(suggestion.adjustment || suggestion.changes || []),
      styleImpact: suggestion.styleImpact,
      impactType: suggestion.impactType || 'nice-to-have'
    }));
  }, []);

  // Convert backend changes to frontend change format
  const convertBackendChangesToFrontend = (backendChanges: any[]): IngredientChange[] => {
    if (!Array.isArray(backendChanges)) return [];
    
    console.log('🔄 DEBUG: convertBackendChangesToFrontend input', { backendChanges });
    
    return backendChanges.map((change, index) => {
      console.log(`🔄 DEBUG: Converting backend change ${index}`, { change });
      
      const frontendChange = {
        ingredientId: change.ingredient_id || `change-${index}`,
        ingredientName: change.ingredient_name || change.name || 'Unknown Ingredient',
        field: change.field || 'amount',
        currentValue: change.current_value || change.current_amount || change.currentValue,
        suggestedValue: change.suggested_value || change.suggested_amount || change.suggestedValue,
        reason: change.reason || 'Backend suggestion',
        unit: change.unit,
        isNewIngredient: change.action === 'add_ingredient' || change.isNewIngredient || change.is_new_ingredient,
        // Preserve yeast-specific properties
        ...(change.is_yeast_strain_change && {
          is_yeast_strain_change: change.is_yeast_strain_change,
          suggested_name: change.suggested_name,
          suggested_attenuation: change.suggested_attenuation,
          new_yeast_data: change.new_yeast_data
        }),
        newIngredientData: (change.action === 'add_ingredient' || change.is_new_ingredient || change.new_ingredient_data) ? {
          name: change.ingredient_name || change.new_ingredient_data?.name,
          type: change.type || change.new_ingredient_data?.type,
          grain_type: change.grain_type || change.new_ingredient_data?.grain_type,
          amount: change.amount || change.new_ingredient_data?.amount,
          unit: change.unit || change.new_ingredient_data?.unit,
          potential: change.potential || change.new_ingredient_data?.potential,
          color: change.color || change.new_ingredient_data?.color,
          alpha_acid: change.alpha_acid || change.new_ingredient_data?.alpha_acid,
          time: change.time || change.new_ingredient_data?.time,
          use: change.use || change.new_ingredient_data?.use
        } as CreateRecipeIngredientData & { type: string } : undefined
      };
      
      console.log(`✅ DEBUG: Converted to frontend change ${index}`, { 
        original: change,
        converted: frontendChange 
      });
      
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
        ingredients: ingredients.map(ing => ({
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
          attenuation: ing.attenuation  // Include yeast attenuation for proper FG/ABV calculations
        })),
        batch_size: recipe.batch_size,
        batch_size_unit: recipe.batch_size_unit,
        efficiency: recipe.efficiency || 75,
        boil_time: recipe.boil_time || 60
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
          console.warn('🔍 AISuggestions - Failed to lookup style:', error);
        }
      }

      // Call backend AI API using Services
      const response = await Services.AI.service.analyzeRecipe({
        recipe_data: recipeData,
        style_id: styleId, // Pass the looked-up style ID for proper style compliance analysis
        unit_system: unitSystem
      });

      console.log('🤖 DEBUG: Backend AI response', { 
        response,
        optimizationPerformed: response.optimization_performed,
        suggestionsCount: response.suggestions?.length || 0
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
          remainingSuggestions: response.suggestions || []
        });
        setSuggestions([]); // Clear individual suggestions since we have complete optimization
      } else {
        // Fallback to traditional suggestions format
        const convertedSuggestions = convertBackendSuggestions(response.suggestions || []);
        
        setSuggestions(convertedSuggestions);
        setOptimizationResult(null); // Clear any previous optimization results
      }
      
      setHasAnalyzed(true);

    } catch (error) {
      console.error('❌ AISuggestions - Error generating AI suggestions:', {
        error: error,
        message: error instanceof Error ? error.message : 'Failed to generate suggestions',
        timestamp: new Date().toISOString()
      });
      setError(error instanceof Error ? error.message : 'Failed to generate suggestions');
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
    convertBackendSuggestions
  ]);

  // Apply a suggestion
  const applySuggestion = async (suggestion: Suggestion): Promise<void> => {
    if (disabled) return;

    console.log('🔍 DEBUG: AISuggestions.applySuggestion started', {
      suggestionId: suggestion.id,
      suggestionTitle: suggestion.title,
      changesCount: suggestion.changes.length,
      changes: suggestion.changes,
      currentIngredients: ingredients.map(ing => ({ 
        id: ing.id, 
        name: ing.name, 
        type: ing.type, 
        amount: ing.amount, 
        unit: ing.unit,
        use: ing.use,
        time: ing.time 
      }))
    });

    // ANALYSIS: Check if we have multiple changes for the same ingredient
    const changesByIngredient = suggestion.changes.reduce((acc, change) => {
      const key = `${change.ingredientName}_${change.ingredientId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(change);
      return acc;
    }, {} as Record<string, typeof suggestion.changes>);

    console.log('🔍 DEBUG: Changes grouped by ingredient', { 
      changesByIngredient,
      multipleChangesForSameIngredient: Object.values(changesByIngredient).some(changes => changes.length > 1)
    });

    try {
      // Process each change separately for better error handling and clearer logic
      for (const [index, change] of suggestion.changes.entries()) {
        console.log(`🔍 DEBUG: Processing change ${index + 1}/${suggestion.changes.length}`, {
          change,
          isNewIngredient: change.isNewIngredient,
          ingredientId: change.ingredientId,
          ingredientName: change.ingredientName,
          field: change.field,
          currentValue: change.currentValue,
          suggestedValue: change.suggestedValue
        });
        // Handle new ingredient additions
        if (change.isNewIngredient && change.newIngredientData) {
          // Fetch available ingredients for new ingredient addition
          const availableIngredients = await Services.Data.ingredient.fetchIngredients();
          
          // Get the type from the backend suggestion, defaulting to 'grain'
          const ingredientType = (change.newIngredientData as any).type || 'grain';
          const ingredientGroup = availableIngredients[ingredientType as keyof typeof availableIngredients] || [];
          
          const foundIngredient = ingredientGroup.find((ing: any) => 
            ing.name.toLowerCase().includes(change.newIngredientData!.name!.toLowerCase()) ||
            change.newIngredientData!.name!.toLowerCase().includes(ing.name.toLowerCase())
          );

          if (!foundIngredient) {
            throw new Error(`Ingredient "${change.newIngredientData.name}" not found in database. Please add this ingredient manually from the ingredients list.`);
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
            use: change.newIngredientData.use || (foundIngredient.type === 'hop' ? 'boil' : 'mash'),
            time: change.newIngredientData.time || (foundIngredient.type === 'hop' ? 60 : undefined),
            alpha_acid: foundIngredient.alpha_acid,
            attenuation: foundIngredient.attenuation
          };

          await onBulkIngredientUpdate([{
            ingredientId: change.ingredientId,
            updatedData: newIngredientData,
            isNewIngredient: true
          }]);
          continue;
        }

        // Handle existing ingredient modifications using the direct update mechanism
        // Find the existing ingredient by ID first, then by name as fallback
        console.log('🔍 DEBUG: Looking for existing ingredient', {
          searchingForId: change.ingredientId,
          searchingForName: change.ingredientName,
          availableIngredients: ingredients.map(ing => ({ 
            id: ing.id, 
            name: ing.name, 
            type: ing.type, 
            use: ing.use, 
            time: ing.time 
          }))
        });

        let existingIngredient = ingredients.find(ing => ing.id === change.ingredientId);
        console.log('🔍 DEBUG: Found by ID?', { 
          found: !!existingIngredient, 
          ingredient: existingIngredient ? { 
            id: existingIngredient.id, 
            name: existingIngredient.name, 
            use: existingIngredient.use, 
            time: existingIngredient.time 
          } : null 
        });

        if (!existingIngredient) {
          // Fallback: find by name if ID match fails
          existingIngredient = ingredients.find(ing => ing.name === change.ingredientName);
          console.log('🔍 DEBUG: Found by name?', { 
            found: !!existingIngredient, 
            ingredient: existingIngredient ? { 
              id: existingIngredient.id, 
              name: existingIngredient.name, 
              use: existingIngredient.use, 
              time: existingIngredient.time 
            } : null 
          });
        }

        // ENHANCED HOP MATCHING: For hops, try to find by name + current use + current time
        // This handles cases where the backend sends a generic ingredient ID but we need to match
        // the specific hop addition (since hops can appear multiple times with different use/time)
        if (!existingIngredient && change.ingredientName) {
          const hopCandidates = ingredients.filter(ing => 
            ing.name === change.ingredientName && ing.type === 'hop'
          );
          
          console.log('🔍 DEBUG: Hop candidates found', { 
            candidates: hopCandidates.map(hop => ({
              id: hop.id,
              name: hop.name,
              use: hop.use,
              time: hop.time,
              amount: hop.amount
            }))
          });

          // Try to match by current value if it's provided
          if (hopCandidates.length > 0 && change.currentValue !== undefined) {
            if (change.field === 'amount') {
              // Match by current amount
              existingIngredient = hopCandidates.find(hop => hop.amount === change.currentValue);
            } else if (change.field === 'time') {
              // Match by current time
              existingIngredient = hopCandidates.find(hop => hop.time === change.currentValue);
            }
            
            console.log('🔍 DEBUG: Enhanced hop matching result', {
              field: change.field,
              currentValue: change.currentValue,
              found: !!existingIngredient,
              ingredient: existingIngredient ? {
                id: existingIngredient.id,
                name: existingIngredient.name,
                use: existingIngredient.use,
                time: existingIngredient.time,
                amount: existingIngredient.amount
              } : null
            });
          }

          // If still not found and only one hop candidate, use it
          if (!existingIngredient && hopCandidates.length === 1) {
            existingIngredient = hopCandidates[0];
            console.log('🔍 DEBUG: Using single hop candidate', {
              ingredient: {
                id: existingIngredient.id,
                name: existingIngredient.name,
                use: existingIngredient.use,
                time: existingIngredient.time
              }
            });
          }
        }

        if (!existingIngredient) {
          console.error('❌ DEBUG: Ingredient not found!', {
            searchedId: change.ingredientId,
            searchedName: change.ingredientName,
            availableIngredients: ingredients.map(ing => ({ id: ing.id, name: ing.name }))
          });
          throw new Error(`Ingredient "${change.ingredientName}" not found in recipe. Cannot modify non-existent ingredient.`);
        }

        console.log('✅ DEBUG: Found existing ingredient to modify', {
          foundIngredient: {
            id: existingIngredient.id,
            name: existingIngredient.name,
            type: existingIngredient.type,
            amount: existingIngredient.amount,
            unit: existingIngredient.unit,
            use: existingIngredient.use,
            time: existingIngredient.time
          },
          changeToApply: {
            field: change.field,
            currentValue: change.currentValue,
            suggestedValue: change.suggestedValue,
            unit: change.unit
          }
        });

        // Special handling for yeast strain changes - replace entire yeast ingredient
        if ((change as any).is_yeast_strain_change && change.field === 'ingredient_id') {
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
              use: existingIngredient.use || 'primary'
            };
            
            await onUpdateIngredient(existingIngredient.id!, updateData);
            continue;
          } else if (suggestedName && suggestedAttenuation) {
            // Fallback: update name and attenuation manually
            const updateData: Partial<RecipeIngredient> = {
              name: suggestedName,
              attenuation: suggestedAttenuation
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
        if (change.unit && change.field === 'amount') {
          updateData.unit = change.unit as any;
        }

        console.log('🔧 DEBUG: About to call onUpdateIngredient', {
          ingredientId: existingIngredient.id,
          updateData,
          functionExists: typeof onUpdateIngredient === 'function'
        });

        // Use the direct update mechanism that leverages existing validation and state management
        try {
          await onUpdateIngredient(existingIngredient.id!, updateData);
          console.log('✅ DEBUG: onUpdateIngredient call succeeded', {
            ingredientId: existingIngredient.id,
            updateData
          });
        } catch (updateError) {
          console.error('❌ DEBUG: onUpdateIngredient call failed', {
            ingredientId: existingIngredient.id,
            updateData,
            error: updateError
          });
          throw updateError;
        }
      }

      // Mark suggestion as applied
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.id));

      // Remove from current suggestions
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('❌ AISuggestions - Error applying suggestion:', {
        error: error,
        message: error instanceof Error ? error.message : 'Failed to apply suggestion',
        suggestionId: suggestion.id,
        timestamp: new Date().toISOString()
      });
      setError(error instanceof Error ? error.message : 'Failed to apply suggestion');
    }
  };

  // Dismiss a suggestion
  const dismissSuggestion = (suggestionId: string): void => {
    setAppliedSuggestions(prev => new Set(prev).add(suggestionId));
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  // Handle analyze button click
  const handleAnalyzeRecipe = (): void => {
    generateSuggestions();
  };

  // Apply optimized recipe
  const applyOptimizedRecipe = async (optimization: OptimizationResult): Promise<void> => {
    if (disabled) return;


    try {
      // BETTER APPROACH: Use the recipe changes to apply individual updates
      // This is much more reliable than trying to match optimized ingredients
      const recipeChanges = optimization.recipeChanges || [];
      
      // Filter out summary changes and process only ingredient modifications (both single field and consolidated)
      const ingredientChanges = recipeChanges.filter(change => 
        change.type === 'ingredient_modified' && 
        change.ingredient_name && 
        (change.field || (change.changes && Array.isArray(change.changes)))  // Accept both formats
      );
      
      console.log('🔧 DEBUG: Found ingredient changes to apply', { 
        ingredientChanges,
        changeCount: ingredientChanges.length 
      });

      // UNIFIED APPROACH: Process all ingredient changes as a single bulk update
      // This eliminates race conditions between hop and grain processing
      console.log(`🔧 DEBUG: Processing all ${ingredientChanges.length} ingredient changes as unified bulk update`);
      const allBulkUpdates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient> }> = [];
      
      for (const change of ingredientChanges) {
        const isConsolidatedChange = change.changes && Array.isArray(change.changes);
        
        if (isConsolidatedChange) {
          console.log(`🔧 DEBUG: Processing consolidated change: ${change.ingredient_name} with ${change.changes.length} field modifications`);
        } else {
          console.log(`🔧 DEBUG: Processing single change: ${change.ingredient_name} ${change.field} ${change.original_value} -> ${change.optimized_value}`);
        }
        
        // Find target ingredient using appropriate matching logic
        let targetIngredient: any = null;
        
        if (change.ingredient_type === 'hop') {
          // For hops, match by name + use + original time (to target the right hop addition)
          targetIngredient = ingredients.find(ing => 
            ing.name === change.ingredient_name &&
            ing.type === 'hop' &&
            ing.use === change.ingredient_use &&
            ing.time === change.ingredient_time  // Match the ORIGINAL time before optimization
          );
        } else {
          // For non-hops, match by ingredient_id first (most reliable), then fall back to name
          if (change.ingredient_id) {
            targetIngredient = ingredients.find(ing => ing.ingredient_id === change.ingredient_id && ing.name === change.ingredient_name);
          }
          if (!targetIngredient) {
            targetIngredient = ingredients.find(ing => ing.name === change.ingredient_name);
          }
        }
        
        console.log(`🔧 DEBUG: Change targeting ${change.ingredient_type} ${change.ingredient_name}`, {
          found: !!targetIngredient
        });

        if (targetIngredient) {
          // Find the actual ingredient in the ingredients array to get the correct ID
          const actualIngredient = ingredients.find(ing => 
            ing.ingredient_id === targetIngredient.ingredient_id && 
            ing.name === targetIngredient.name &&
            ing.use === targetIngredient.use &&
            ing.time === targetIngredient.time
          );
          
          if (!actualIngredient) {
            console.error(`❌ DEBUG: Could not find actual ingredient in array for ${targetIngredient.name}`);
            continue;
          }
          
          let updateData: Partial<RecipeIngredient>;
          
          if (isConsolidatedChange) {
            // Handle consolidated change with multiple fields
            updateData = {
              // Include essential fields from existing ingredient to pass validation
              ingredient_id: targetIngredient.ingredient_id,
              use: targetIngredient.use,
              time: targetIngredient.time  // Start with current time
            };
            
            // Apply all field changes
            for (const fieldChange of change.changes) {
              updateData[fieldChange.field as keyof RecipeIngredient] = fieldChange.optimized_value;
              
              // Add unit if specified (for amount changes)
              if (fieldChange.field === 'amount' && fieldChange.unit) {
                updateData.unit = fieldChange.unit as any;
              }
            }
            
            console.log(`🔧 DEBUG: Preparing consolidated changes for ${targetIngredient.name}`, {
              ingredientId: actualIngredient.id,
              fieldCount: change.changes.length,
              fields: change.changes.map((c: any) => `${c.field}: ${c.original_value} -> ${c.optimized_value}`),
              updateData
            });
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
            if (change.field === 'amount' && change.unit) {
              updateData.unit = change.unit as any;
            }

            console.log(`🔧 DEBUG: Preparing single change for ${targetIngredient.name}`, {
              ingredientId: actualIngredient.id,
              field: change.field,
              oldValue: change.original_value,
              newValue: change.optimized_value,
              updateData
            });
          }
          
          allBulkUpdates.push({
            ingredientId: actualIngredient.id!, // Use the actual ingredient ID from the array
            updatedData: updateData
          });
        } else {
          console.warn(`⚠️ DEBUG: Could not find ingredient to modify: ${change.ingredient_name}`);
        }
      }
      
      // Apply ALL changes as a single bulk update
      if (allBulkUpdates.length > 0) {
        try {
          console.log(`🔧 DEBUG: Applying ${allBulkUpdates.length} total changes (hops + grains) as unified bulk update`);
          await onBulkIngredientUpdate(allBulkUpdates);
          console.log(`✅ DEBUG: Successfully applied ${allBulkUpdates.length} changes via unified bulk update`);
        } catch (updateError) {
          console.error(`❌ DEBUG: Failed to apply unified bulk update`, { updateError });
          throw updateError;
        }
      }

      // Handle ingredient additions (for new ingredients suggested by AI)
      const ingredientAdditions = recipeChanges.filter(change => 
        change.type === 'ingredient_added' && change.ingredient_name
      );
      
      console.log('🔧 DEBUG: Found ingredient additions to apply', { 
        ingredientAdditions,
        additionCount: ingredientAdditions.length 
      });

      for (const addition of ingredientAdditions) {
        console.log(`🔧 DEBUG: Processing addition: ${addition.ingredient_name}`);
        
        // Fetch available ingredients for new ingredient addition
        const availableIngredients = await Services.Data.ingredient.fetchIngredients();
        
        // Get the type from the addition, defaulting to 'grain'
        const ingredientType = addition.ingredient_type || 'grain';
        const ingredientGroup = availableIngredients[ingredientType as keyof typeof availableIngredients] || [];
        
        const foundIngredient = ingredientGroup.find((ing: any) => 
          ing.name.toLowerCase().includes(addition.ingredient_name.toLowerCase()) ||
          addition.ingredient_name.toLowerCase().includes(ing.name.toLowerCase())
        );

        if (!foundIngredient) {
          console.error(`❌ DEBUG: Ingredient "${addition.ingredient_name}" not found in database for addition`);
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
          use: addition.use || (foundIngredient.type === 'hop' ? 'boil' : 'mash'),
          time: addition.time || (foundIngredient.type === 'hop' ? 60 : undefined),
          alpha_acid: foundIngredient.alpha_acid,
          attenuation: foundIngredient.attenuation
        };

        try {
          await onBulkIngredientUpdate([{
            ingredientId: `addition-${Date.now()}-${Math.random()}`,
            updatedData: newIngredientData,
            isNewIngredient: true
          }]);
          console.log(`✅ DEBUG: Successfully added new ingredient ${addition.ingredient_name}`);
        } catch (addError) {
          console.error(`❌ DEBUG: Failed to add ${addition.ingredient_name}`, { addError });
          throw addError;
        }
      }

      // Handle ingredient removals (for substitutions and eliminations)
      const ingredientRemovals = recipeChanges.filter(change => 
        change.type === 'ingredient_removed' && change.ingredient_name
      );
      
      console.log('🔧 DEBUG: Found ingredient removals to apply', { 
        ingredientRemovals,
        removalCount: ingredientRemovals.length 
      });

      for (const removal of ingredientRemovals) {
        console.log(`🔧 DEBUG: Processing removal: ${removal.ingredient_name}`);
        
        // Find the specific ingredient to remove using the same matching logic
        let targetIngredient: any = null;
        
        if (removal.ingredient_type === 'hop') {
          // For hops, match by name + use + time
          targetIngredient = ingredients.find(ing => 
            ing.name === removal.ingredient_name &&
            ing.type === 'hop' &&
            ing.use === removal.ingredient_use &&
            ing.time === removal.ingredient_time
          );
        } else {
          // For non-hops, match by name
          targetIngredient = ingredients.find(ing => ing.name === removal.ingredient_name);
        }

        if (targetIngredient && onRemoveIngredient) {
          try {
            await onRemoveIngredient(targetIngredient.id!);
            console.log(`✅ DEBUG: Successfully removed ingredient ${removal.ingredient_name}`);
          } catch (removeError) {
            console.error(`❌ DEBUG: Failed to remove ${removal.ingredient_name}`, { removeError });
            throw removeError;
          }
        } else {
          console.warn(`⚠️ DEBUG: Could not find ingredient to remove: ${removal.ingredient_name}`, {
            hasRemoveFunction: !!onRemoveIngredient
          });
        }
      }
      



      
      // Clear the optimization result and show success message
      setOptimizationResult(null);
      setHasAnalyzed(false);
      
      console.log('✅ DEBUG: applyOptimizedRecipe completed successfully using recipe changes');

    } catch (error) {
      console.error('❌ AISuggestions - Error applying optimized recipe:', {
        error: error,
        message: error instanceof Error ? error.message : 'Failed to apply optimized recipe',
        timestamp: new Date().toISOString()
      });
      setError(error instanceof Error ? error.message : 'Failed to apply optimized recipe');
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
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', margin: '20px 0', background: '#f9f9f9' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #ddd', background: '#fff', borderRadius: '8px 8px 0 0' }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          {isExpanded ? '▼' : '▶'} AI Recipe Analysis
        </button>
        
        {isExpanded && (
          <div style={{ marginTop: '15px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            {recipe.style && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>Style:</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{recipe.style}</span>
              </div>
            )}
            
            <button
              onClick={handleAnalyzeRecipe}
              disabled={analyzing || disabled || !ingredients.length || !metrics}
              style={{
                padding: '10px 20px',
                background: (analyzing || disabled || !ingredients.length || !metrics) ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (analyzing || disabled || !ingredients.length || !metrics) ? 'not-allowed' : 'pointer'
              }}
            >
              {analyzing ? 'Analyzing...' : 'Analyze Recipe'}
            </button>
            
            {hasAnalyzed && (
              <button 
                onClick={clearSuggestions}
                style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Clear Results
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div style={{ padding: '15px' }}>
          {error && (
            <div style={{ color: 'red', margin: '10px 0', padding: '10px', background: '#ffe6e6', borderRadius: '4px' }}>
              Error: {error}
            </div>
          )}

          {analyzing && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              <p>🤖 Analyzing recipe...</p>
            </div>
          )}

          {hasAnalyzed && !analyzing && optimizationResult && (
            <div style={{ background: 'white', border: '2px solid #28a745', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <h4 style={{ color: '#28a745', marginTop: 0 }}>Recipe Optimization Complete!</h4>
              <p>Internal optimization completed in <strong>{optimizationResult.iterationsCompleted} iterations</strong></p>
              
              {/* Metrics comparison */}
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                <h5>Metrics Improvement</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                  {Object.entries(optimizationResult.originalMetrics || {}).map(([metric, originalValue]) => {
                    const optimizedValue = optimizationResult.optimizedMetrics?.[metric];
                    const isImproved = originalValue !== optimizedValue;
                    return (
                      <div key={metric} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', color: '#666' }}>{metric}</div>
                        <div style={{ color: isImproved ? '#28a745' : '#666' }}>
                          {originalValue} → {optimizedValue}
                          {isImproved && <span style={{ fontSize: '12px', marginLeft: '5px' }}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recipe changes summary */}
              {optimizationResult.recipeChanges.length > 0 && (
                <div style={{ background: '#e9ecef', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <h5>Changes Made ({optimizationResult.recipeChanges.length-1})</h5>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {optimizationResult.recipeChanges.map((change, idx) => (
                      <div key={idx} style={{ padding: '8px', background: 'white', marginBottom: '8px', borderRadius: '4px', borderLeft: '3px solid #007bff' }}>
                        {change.type === 'ingredient_modified' && (
                          <div>
                            <strong>{change.ingredient_name}:</strong> {change.field} changed from {change.original_value} to {change.optimized_value} {change.unit}
                          </div>
                        )}
                        {change.type === 'ingredient_added' && (
                          <div>
                            <strong>Added:</strong> {change.ingredient_name} ({change.amount} {change.unit})
                          </div>
                        )}
                        {change.type === 'ingredient_substituted' && (
                          <div>
                            <strong>Substituted:</strong> {change.original_ingredient} → {change.optimized_ingredient}
                          </div>
                        )}
                        {change.type === 'optimization_summary' && (
                          <div>
                            <strong>Summary:</strong> {change.final_compliance} ({change.iterations_completed} iterations)
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>
                          {change.change_reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => applyOptimizedRecipe(optimizationResult)}
                  disabled={disabled}
                  style={{
                    background: disabled ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  Apply Optimized Recipe
                </button>
                <button
                  onClick={() => setOptimizationResult(null)}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Keep Original Recipe
                </button>
              </div>

              {/* Remaining suggestions if any */}
              {optimizationResult.remainingSuggestions.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #dee2e6' }}>
                  <h5>Additional Fine-tuning Available ({optimizationResult.remainingSuggestions.length})</h5>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    These minor adjustments can be applied after accepting the optimized recipe.
                  </p>
                </div>
              )}
            </div>
          )}

          {hasAnalyzed && !analyzing && suggestions.length === 0 && !optimizationResult && !error && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#28a745' }}>
              <p>✅ Recipe analysis complete - no suggestions needed!</p>
              <p>Your recipe looks well-balanced for the current style.</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <h4>Suggestions ({suggestions.length})</h4>
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} style={{ background: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h5 style={{ margin: 0 }}>{suggestion.title}</h5>
                    <span style={{ 
                      color: suggestion.confidence === 'high' ? '#28a745' : suggestion.confidence === 'medium' ? '#ffc107' : '#dc3545',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {suggestion.confidence} confidence
                    </span>
                  </div>
                  
                  <p style={{ margin: '10px 0' }}>{suggestion.description}</p>
                  
                  <div style={{ margin: '15px 0', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                    {suggestion.changes.map((change, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: 'white', borderRadius: '4px', borderLeft: '3px solid #007bff' }}>
                        <strong>{change.ingredientName}:</strong>
                        {change.isNewIngredient ? (
                          <span> Add {formatIngredientAmount(change.suggestedValue, change.newIngredientData?.unit || 'g', 'grain', unitSystem)}</span>
                        ) : (change as any).is_yeast_strain_change && change.field === 'ingredient_id' ? (
                          <span>
                            {' '}Switch to {(change as any).suggested_name} ({(change as any).suggested_attenuation}% attenuation)
                          </span>
                        ) : (
                          <span>
                            {' '}Change {change.field} from {change.currentValue} to {change.suggestedValue}
                          </span>
                        )}
                        <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>{change.reason}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      disabled={disabled}
                      style={{
                        background: disabled ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: disabled ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Apply Changes
                    </button>
                    <button
                      onClick={() => dismissSuggestion(suggestion.id)}
                      style={{
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
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