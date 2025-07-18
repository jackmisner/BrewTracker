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
  onBulkIngredientUpdate: (updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient> }>) => Promise<void>;
  onRemoveIngredient?: (ingredientId: string) => Promise<void>;
  disabled?: boolean;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  recipe,
  ingredients,
  metrics,
  onBulkIngredientUpdate,
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
    
    return backendChanges.map((change, index) => {
      
      return {
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


    try {
      // Prepare bulk updates - handle async ingredient lookups first
      let response: any = {};
      
      // Only fetch ingredients if we have new ingredients to add
      const hasNewIngredients = suggestion.changes.some(change => change.isNewIngredient);
      if (hasNewIngredients) {
        response = await Services.Data.ingredient.fetchIngredients();
      }

      const updates = await Promise.all(suggestion.changes.map(async (change) => {
        // Handle new ingredient additions
        if (change.isNewIngredient && change.newIngredientData) {
          // Search for the ingredient by name in the grouped structure
          // The service returns a grouped structure: { grain: [], hop: [], yeast: [], other: [] }
          // Get the type from the backend suggestion, defaulting to 'grain'
          const ingredientType = (change.newIngredientData as any).type || 'grain';
          const ingredientGroup = response[ingredientType as keyof typeof response] || [];
          
          const foundIngredient = ingredientGroup.find((ing: any) => 
            ing.name.toLowerCase().includes(change.newIngredientData!.name!.toLowerCase()) ||
            change.newIngredientData!.name!.toLowerCase().includes(ing.name.toLowerCase())
          );

          if (!foundIngredient) {
            throw new Error(`Ingredient "${change.newIngredientData.name}" not found in database. Please add this ingredient manually from the ingredients list.`);
          }

          // For new ingredients, create the full ingredient data using the found ingredient
          const newIngredientData: Partial<RecipeIngredient> = {
            ingredient_id: foundIngredient.ingredient_id,
            name: foundIngredient.name, // Use the exact name from database
            type: foundIngredient.type as any,
            amount: Number(change.newIngredientData.amount!),
            unit: change.newIngredientData.unit! as any,
            grain_type: foundIngredient.grain_type,
            color: foundIngredient.color,
            potential: foundIngredient.potential || 1.035,
            use: 'mash'
          };

          return {
            ingredientId: change.ingredientId,
            updatedData: newIngredientData,
            isNewIngredient: true
          };
        }

        // Handle existing ingredient modifications
        // Try to find by ingredient_id first, then by name as fallback
        let existingIngredient = ingredients.find(ing => ing.id === change.ingredientId);
        if (!existingIngredient) {
          // Fallback: find by name if ID match fails
          existingIngredient = ingredients.find(ing => ing.name === change.ingredientName);
        }
        if (!existingIngredient) {
          // Special case: If this is an ingredient that was added during internal optimization,
          // treat it as a new ingredient addition instead of a modification
          
          // Fetch ingredients from database to find the missing ingredient
          if (!hasNewIngredients) {
            response = await Services.Data.ingredient.fetchIngredients();
          }
          
          // Search for the ingredient by name in all ingredient types
          let foundIngredient: any = null;
          const ingredientTypes = ['grain', 'hop', 'yeast', 'other'];
          
          for (const type of ingredientTypes) {
            const ingredientGroup = response[type as keyof typeof response] || [];
            foundIngredient = ingredientGroup.find((ing: any) => 
              ing.name.toLowerCase().includes(change.ingredientName.toLowerCase()) ||
              change.ingredientName.toLowerCase().includes(ing.name.toLowerCase())
            );
            if (foundIngredient) break;
          }

          if (!foundIngredient) {
            throw new Error(`Ingredient "${change.ingredientName}" not found in database. This ingredient may have been added during optimization but couldn't be located.`);
          }

          // Create new ingredient data using the found ingredient
          const newIngredientData: Partial<RecipeIngredient> = {
            ingredient_id: foundIngredient.ingredient_id,
            name: foundIngredient.name,
            type: foundIngredient.type as any,
            amount: Number(change.suggestedValue),
            unit: change.unit || 'g' as any,
            grain_type: foundIngredient.grain_type,
            color: foundIngredient.color,
            potential: foundIngredient.potential || 1.035,
            use: 'mash'
          };

          return {
            ingredientId: change.ingredientId,
            updatedData: newIngredientData,
            isNewIngredient: true
          };
        }

        // Special handling for yeast strain changes - replace entire yeast ingredient
        if ((change as any).is_yeast_strain_change && change.field === 'ingredient_id') {
          const newYeastData = (change as any).new_yeast_data;
          const suggestedName = (change as any).suggested_name;
          const suggestedAttenuation = (change as any).suggested_attenuation;
          
          if (newYeastData) {
            // Replace the entire yeast ingredient with database yeast data
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
            
            
            return {
              ingredientId: existingIngredient.id || change.ingredientId,
              updatedData: updateData
            };
          } else if (suggestedName && suggestedAttenuation) {
            // Fallback: update name and attenuation manually
            const updateData: Partial<RecipeIngredient> = {
              name: suggestedName,
              attenuation: suggestedAttenuation,
              ingredient_id: existingIngredient.ingredient_id,
              unit: existingIngredient.unit
            };
            
            
            return {
              ingredientId: existingIngredient.id || change.ingredientId,
              updatedData: updateData
            };
          }
        }

        // Regular field change handling
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.suggestedValue,
        };

        // Add required validation fields only if they're not being changed
        if ((change.field as string) !== 'ingredient_id') {
          updateData.ingredient_id = existingIngredient.ingredient_id;
        }
        
        // CRITICAL FIX: When backend provides a unit, use it instead of the original unit
        // This handles the case where backend sends amounts in base units (g/oz) but 
        // original ingredient was in different units (kg/lb)
        if ((change.field as string) !== 'unit') {
          // Check if the backend suggestion includes a unit (from dual-system conversion)
          if (change.unit && change.field === 'amount') {
            // For amount changes, use the backend's suggested unit to ensure unit consistency
            updateData.unit = change.unit as any;
          } else {
            // For non-amount changes or when no backend unit provided, keep original unit
            updateData.unit = existingIngredient.unit;
          }
        }

        // Include hop-specific fields if it's a hop
        if (existingIngredient.type === 'hop') {
          if (change.field !== 'use') {
            updateData.use = existingIngredient.use;
          }
          if (change.field !== 'time') {
            updateData.time = existingIngredient.time;
          }
        }

        return {
          ingredientId: existingIngredient.id || change.ingredientId, // Use the actual ingredient ID from the found ingredient
          updatedData: updateData
        };
      }));

      // Apply all changes as a single bulk update
      await onBulkIngredientUpdate(updates);

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
      // Convert optimized recipe ingredients to the format expected by onBulkIngredientUpdate
      const optimizedIngredients = optimization.optimizedRecipe.ingredients || [];
      
      console.log('🔍 DEBUG: Frontend recipe reconciliation starting:');
      console.log('🔍 DEBUG: Current ingredients in frontend:', ingredients.map(ing => `${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time} amount=${ing.amount}`));
      console.log('🔍 DEBUG: Optimized ingredients from backend:', optimizedIngredients.map((ing: any) => `${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time} amount=${ing.amount}`));
      
      // CRITICAL FIX: Match ingredients by ingredient_id and name to determine which are updates vs new
      const updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient>; isNewIngredient?: boolean }> = [];
      const optimizedIngredientIds = new Set();
      
      // Process optimized ingredients: update existing ones or add new ones
      for (const optimizedIng of optimizedIngredients) {
        console.log(`🔍 DEBUG: Processing optimized ingredient: ${optimizedIng.name} (${optimizedIng.type}) use='${optimizedIng.use}' time=${optimizedIng.time}`);
        
        // Try to find matching existing ingredient with improved hop matching
        const existingIngredient = ingredients.find(ing => {
          // For hops, check if this is a modification of an existing hop by looking at recipe changes
          if (optimizedIng.type === 'hop' && ing.type === 'hop') {
            // First try exact match (name + use + time)
            const exactMatch = ing.name === optimizedIng.name && 
                              ing.use === optimizedIng.use && 
                              ing.time === optimizedIng.time;
            
            if (exactMatch) {
              console.log(`🔍 DEBUG: Hop exact match: ${ing.name} use='${ing.use}' time=${ing.time}`);
              return true;
            }
            
            // Check if this is a timing modification of the same hop
            const isTimingModification = ing.ingredient_id === optimizedIng.ingredient_id && 
                                        ing.use === optimizedIng.use && 
                                        ing.name === optimizedIng.name &&
                                        ing.time !== optimizedIng.time;
            
            if (isTimingModification) {
              // Verify this is actually a timing change from the recipe changes
              const hasTimingChange = optimization.recipeChanges.some(change => 
                change.ingredient_name === ing.name &&
                change.ingredient_type === 'hop' &&
                change.ingredient_use === ing.use &&
                change.ingredient_time === ing.time &&
                change.field === 'time'
              );
              
              console.log(`🔍 DEBUG: Hop timing modification check: ${ing.name} use='${ing.use}' time=${ing.time}->${optimizedIng.time} => ${hasTimingChange}`);
              return hasTimingChange;
            }
            
            console.log(`🔍 DEBUG: Hop no match: ${ing.name} use='${ing.use}' time=${ing.time} vs ${optimizedIng.name} use='${optimizedIng.use}' time=${optimizedIng.time}`);
            return false;
          }
          
          // For non-hops, try exact ingredient_id match first
          if (ing.ingredient_id === optimizedIng.ingredient_id) {
            console.log(`🔍 DEBUG: Found ingredient by ID match: ${ing.name}`);
            return true;
          }
          
          // For non-hops, name match is sufficient
          const matches = ing.name === optimizedIng.name;
          if (matches) {
            console.log(`🔍 DEBUG: Found ingredient by name match: ${ing.name}`);
          }
          return matches;
        });
        
        console.log(`🔍 DEBUG: Match result for ${optimizedIng.name}: ${existingIngredient ? 'FOUND' : 'NOT FOUND'}`);
        
        
        
        
        if (existingIngredient) {
          // Update existing ingredient
          // CRITICAL FIX: Use unique identifier for hops that combines ingredient_id + use + time
          const uniqueKey = optimizedIng.type === 'hop' 
            ? `${optimizedIng.ingredient_id}-${optimizedIng.use}-${optimizedIng.time}`
            : existingIngredient.id;
          optimizedIngredientIds.add(uniqueKey);
          updates.push({
            ingredientId: existingIngredient.id!,
            updatedData: {
              ingredient_id: optimizedIng.ingredient_id,
              name: optimizedIng.name,
              type: optimizedIng.type as any,
              amount: optimizedIng.amount,
              unit: optimizedIng.unit as any,
              grain_type: optimizedIng.grain_type,
              color: optimizedIng.color,
              potential: optimizedIng.potential,
              alpha_acid: optimizedIng.alpha_acid,
              time: optimizedIng.time,
              use: optimizedIng.use,
              attenuation: optimizedIng.attenuation
            },
            isNewIngredient: false
          });
        } else {
          // Add new ingredient (not in original recipe)
          const newIngredientId = `optimized-${Date.now()}-${Math.random()}`;
          // CRITICAL FIX: Use unique identifier for hops that combines ingredient_id + use + time
          const uniqueKey = optimizedIng.type === 'hop' 
            ? `${optimizedIng.ingredient_id}-${optimizedIng.use}-${optimizedIng.time}`
            : newIngredientId;
          optimizedIngredientIds.add(uniqueKey);
          updates.push({
            ingredientId: newIngredientId,
            updatedData: {
              ingredient_id: optimizedIng.ingredient_id,
              name: optimizedIng.name,
              type: optimizedIng.type as any,
              amount: optimizedIng.amount,
              unit: optimizedIng.unit as any,
              grain_type: optimizedIng.grain_type,
              color: optimizedIng.color,
              potential: optimizedIng.potential,
              alpha_acid: optimizedIng.alpha_acid,
              time: optimizedIng.time,
              use: optimizedIng.use,
              attenuation: optimizedIng.attenuation
            },
            isNewIngredient: true
          });
        }
      }

      // CRITICAL FIX: Calculate what ingredients existed before the bulk update
      // This prevents using stale ingredients list that doesn't include newly added ingredients
      // Use unique keys for hops that combine ingredient_id + use + time
      const existingIngredientIds = new Set(ingredients.map(ing => {
        return ing.type === 'hop' 
          ? `${ing.ingredient_id}-${ing.use}-${ing.time}`
          : ing.id;
      }));

      // Apply the updates first
      console.log('🔍 DEBUG: About to apply updates:', updates.map(u => `${u.updatedData.name} (${u.updatedData.type}) amount=${u.updatedData.amount} time=${u.updatedData.time} isNew=${u.isNewIngredient}`));
      await onBulkIngredientUpdate(updates);
      
      // CRITICAL FIX: Add delay to allow React state updates to propagate
      // The ingredients prop is stale due to React closure, need to wait for parent re-render
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('🔍 DEBUG: Ingredients after bulk update (before removal check):', ingredients.map(ing => `${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time} amount=${ing.amount}`));
      
      // Remove ingredients that are not in the optimized recipe
      // SAFETY CHECK: Only remove ingredients that have explicit removal actions
      console.log('🔍 DEBUG: Checking for ingredients to remove:');
      console.log('🔍 DEBUG: existingIngredientIds:', Array.from(existingIngredientIds));
      console.log('🔍 DEBUG: optimizedIngredientIds:', Array.from(optimizedIngredientIds));
      console.log('🔍 DEBUG: Using unique key system for hops (ingredient_id-use-time)');
      
      const ingredientsToRemove = ingredients.filter(ing => {
        const uniqueKey = ing.type === 'hop' 
          ? `${ing.ingredient_id}-${ing.use}-${ing.time}`
          : ing.id;
        const existed = existingIngredientIds.has(uniqueKey);
        const inOptimized = optimizedIngredientIds.has(uniqueKey);
        const shouldRemove = existed && !inOptimized;
        console.log(`🔍 DEBUG: ${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time}: uniqueKey=${uniqueKey}, existed=${existed}, inOptimized=${inOptimized}, shouldRemove=${shouldRemove}`);
        return shouldRemove;
      });
      
      console.log('🔍 DEBUG: ingredientsToRemove:', ingredientsToRemove.map(ing => `${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time}`));
      
      if (ingredientsToRemove.length > 0 && onRemoveIngredient) {
        // Safety check: Look for explicit removal actions in the recipe changes
        const explicitRemovals = new Set();
        optimization.recipeChanges.forEach(change => {
          if (change.type === 'ingredient_removed' || (change as any).action === 'remove') {
            explicitRemovals.add(change.ingredient_name);
          }
        });
        
        // Only remove ingredients that are explicitly marked for removal
        for (const ingredient of ingredientsToRemove) {
          if (explicitRemovals.has(ingredient.name)) {
            console.log(`✅ Removing ingredient with explicit removal action: ${ingredient.name}`);
            await onRemoveIngredient(ingredient.id!);
          } else {
            console.warn(`⚠️ Prevented accidental removal of ingredient: ${ingredient.name} (no explicit removal action found)`);
          }
        }
      }

      
      // Clear the optimization result and show success message
      setOptimizationResult(null);
      setHasAnalyzed(false);
      
      // Add a small delay to allow UI updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🔍 DEBUG: Final ingredients after all changes:', ingredients.map(ing => `${ing.name} (${ing.type}) use='${ing.use}' time=${ing.time} amount=${ing.amount}`));
      
      // alert(`Optimized recipe applied successfully! Recipe was improved through ${optimization.iterationsCompleted} iterations.`);

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