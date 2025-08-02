// hooks/useRecipeBuilderMinimal.ts
// Minimal working version with useReducer for core operations
import { useReducer, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Services } from "../services";
import { useUnits } from "../contexts/UnitContext";
import {
  Recipe,
  RecipeIngredient,
  RecipeMetrics,
  IngredientType,
  CreateRecipeIngredientData,
  ID,
  BatchSizeUnit,
  IngredientsByType,
  StyleAnalysis,
  StyleSuggestion,
  RecipeAnalysis,
} from "../types";
import { convertUnit } from "../utils/formatUtils";
import {
  recipeBuilderReducer,
  createInitialState,
} from "../reducers";

// Return interface for the hook (same API as before)
interface UseRecipeBuilderReturn {
  // Core data
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  availableIngredients: IngredientsByType;
  metrics: RecipeMetrics;

  // UI state
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  calculatingMetrics: boolean;
  addingIngredient: boolean;
  updatingIngredient: boolean;

  // Core actions
  updateRecipe: (field: keyof Recipe, value: any) => Promise<void>;
  bulkUpdateRecipe: (
    updates: Array<{ field: keyof Recipe; value: any }>
  ) => Promise<void>;
  addIngredient: (
    type: IngredientType,
    ingredientData: CreateRecipeIngredientData
  ) => Promise<void>;
  updateIngredient: (
    ingredientId: string,
    updatedIngredientData: Partial<RecipeIngredient>
  ) => Promise<void>;
  bulkUpdateIngredients: (
    updates: Array<{
      ingredientId: string;
      updatedData: Partial<RecipeIngredient>;
      isNewIngredient?: boolean;
    }>
  ) => Promise<void>;
  removeIngredient: (ingredientId: string) => Promise<void>;
  scaleRecipe: (newBatchSize: number | string) => Promise<void>;
  saveRecipe: (event?: React.FormEvent) => Promise<Recipe>;
  recalculateMetrics: () => Promise<void>;
  importIngredients: (ingredientsToImport: RecipeIngredient[]) => Promise<void>;

  // Utility actions
  clearError: () => void;
  cancelOperation: () => void;
  getRecipeAnalysis: () => RecipeAnalysis;
  refreshAvailableIngredients: () => Promise<void>;
  importRecipeData: (recipeData: Partial<Recipe>) => Promise<void>;

  // Beer style analysis
  styleAnalysis: StyleAnalysis | null;
  styleSuggestions: StyleSuggestion[];
  updateRecipeStyle: (styleName: string) => Promise<void>;
  refreshStyleAnalysis: () => Promise<void>;

  // Computed properties
  isEditing: boolean;
  canSave: boolean;
  recipeDisplayName: string;
}

/**
 * Unified hook for recipe builder functionality using useReducer
 * Orchestrates all recipe building operations using the service layer
 */
export function useRecipeBuilder(recipeId?: ID): UseRecipeBuilderReturn {
  const navigate = useNavigate();
  const originalRecipeRef = useRef<Recipe | null>(null);
  const { unitSystem, loading: unitContextLoading } = useUnits();

  // Initialize state with reducer
  const [state, dispatch] = useReducer(
    recipeBuilderReducer,
    createInitialState(unitSystem)
  );

  // Initialize data on mount
  useEffect(() => {
    let effectMounted = true;

    async function initialize(): Promise<void> {
      try {
        if (!effectMounted || unitContextLoading) {
          return;
        }

        dispatch({ type: 'INITIALIZE_START', payload: { unitSystem } });

        // Load available ingredients first
        const availableIngredients = await Services.ingredient.fetchIngredients();

        if (!effectMounted) {
          return;
        }

        // Initialize default values with unit awareness
        let recipe: Recipe = {
          id: "",
          recipe_id: "",
          name: "",
          style: "",
          batch_size: unitSystem === "metric" ? 19 : 5,
          batch_size_unit: (unitSystem === "metric" ? "l" : "gal") as BatchSizeUnit,
          description: "",
          boil_time: 60,
          efficiency: 75,
          mash_temperature: unitSystem === "metric" ? 67 : 152,
          mash_temp_unit: unitSystem === "metric" ? "C" : "F",
          is_public: false,
          notes: "",
          ingredients: [],
          created_at: "",
          updated_at: "",
        };
        let ingredients: RecipeIngredient[] = [];
        let metrics: RecipeMetrics = {
          og: 1.0,
          fg: 1.0,
          abv: 0.0,
          ibu: 0,
          srm: 0,
        };

        // Load recipe if editing
        if (recipeId) {
          const recipeData = await Services.recipe.fetchRecipe(recipeId);

          if (!effectMounted || !recipeData) {
            return;
          }

          recipe = recipeData as Recipe;
          // Ensure batch_size_unit is set for existing recipes
          if (!recipe.batch_size_unit) {
            recipe.batch_size_unit = (recipe.batch_size > 10 ? "l" : "gal") as BatchSizeUnit;
          }

          // Convert mash temperature to user's preferred units if needed
          if (recipe.mash_temperature && recipe.mash_temp_unit) {
            const userPreferredUnit = unitSystem === "metric" ? "C" : "F";

            if (recipe.mash_temp_unit !== userPreferredUnit) {
              if (userPreferredUnit === "C" && recipe.mash_temp_unit === "F") {
                const converted = convertUnit(recipe.mash_temperature, "f", "c");
                recipe.mash_temperature = Math.round(converted.value * 10) / 10;
                recipe.mash_temp_unit = "C";
              } else if (userPreferredUnit === "F" && recipe.mash_temp_unit === "C") {
                const converted = convertUnit(recipe.mash_temperature, "c", "f");
                recipe.mash_temperature = Math.round(converted.value * 10) / 10;
                recipe.mash_temp_unit = "F";
              }
            }
          }
          ingredients = recipeData.ingredients || [];
          originalRecipeRef.current = recipeData as Recipe;
        }

        // Calculate initial metrics
        if (
          recipeId &&
          (recipe.estimated_og || recipe.estimated_fg || recipe.estimated_abv || recipe.estimated_ibu || recipe.estimated_srm)
        ) {
          metrics = {
            og: recipe.estimated_og || 1.0,
            fg: recipe.estimated_fg || 1.0,
            abv: recipe.estimated_abv || 0.0,
            ibu: recipe.estimated_ibu || 0,
            srm: recipe.estimated_srm || 0,
          };
        } else if (ingredients.length === 0) {
          metrics = {
            og: 1.0,
            fg: 1.0,
            abv: 0.0,
            ibu: 0,
            srm: 0,
          };
        } else {
          try {
            const metricsPromise = Services.metrics.calculateMetrics(recipe, ingredients);
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Metrics calculation timeout")), 10000)
            );
            metrics = await Promise.race([metricsPromise, timeoutPromise]);
          } catch (metricsError) {
            metrics = {
              og: 1.0,
              fg: 1.0,
              abv: 0.0,
              ibu: 0,
              srm: 0,
            };
          }
        }

        if (!effectMounted) {
          return;
        }

        dispatch({
          type: 'INITIALIZE_SUCCESS',
          payload: {
            recipe,
            ingredients: Services.ingredient.sortIngredients(ingredients),
            availableIngredients,
            metrics,
          },
        });
      } catch (error) {
        console.error("Error initializing recipe builder:", error);
        if (effectMounted) {
          dispatch({
            type: 'INITIALIZE_ERROR',
            payload: (error as Error).message || "Failed to initialize recipe builder",
          });
        }
      }
    }

    initialize();

    return () => {
      effectMounted = false;
      Services.metrics.cancelCalculation("recipe-builder");
    };
  }, [recipeId, unitSystem, unitContextLoading]);

  // Update recipe field
  const updateRecipe = useCallback(
    async (field: keyof Recipe, value: any): Promise<void> => {
      dispatch({ type: 'UPDATE_RECIPE_FIELD', payload: { field, value } });

      // Recalculate metrics if field affects calculations
      const calculationFields: (keyof Recipe)[] = [
        "batch_size",
        "efficiency",
        "boil_time",
        "batch_size_unit",
        "mash_temperature",
        "mash_temp_unit",
      ];
      if (calculationFields.includes(field)) {
        try {
          dispatch({ type: 'CALCULATE_METRICS_START' });

          const updatedRecipe = { ...state.recipe, [field]: value };
          const metrics = await Services.metrics.calculateMetricsDebounced(
            "recipe-builder",
            updatedRecipe,
            state.ingredients
          );

          dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
        } catch (error) {
          console.error("Error recalculating metrics:", error);
          dispatch({ 
            type: 'CALCULATE_METRICS_ERROR', 
            payload: "Failed to recalculate metrics" 
          });
        }
      }
    },
    [state.recipe, state.ingredients]
  );

  // Bulk update recipe fields
  const bulkUpdateRecipe = useCallback(
    async (
      updates: Array<{ field: keyof Recipe; value: any }>
    ): Promise<void> => {
      try {
        dispatch({ type: 'CALCULATE_METRICS_START' });
        dispatch({ type: 'BULK_UPDATE_RECIPE', payload: updates });

        // Check if any field affects calculations
        const calculationFields: (keyof Recipe)[] = [
          "batch_size",
          "efficiency",
          "boil_time",
          "batch_size_unit",
          "mash_temperature",
          "mash_temp_unit",
        ];

        const needsRecalculation = updates.some((update) =>
          calculationFields.includes(update.field)
        );

        if (needsRecalculation) {
          // Apply all updates to create the final recipe for calculation
          let updatedRecipe = { ...state.recipe };
          for (const update of updates) {
            updatedRecipe = { ...updatedRecipe, [update.field]: update.value };
          }

          const metrics = await Services.metrics.calculateMetricsDebounced(
            "recipe-builder",
            updatedRecipe,
            state.ingredients
          );

          dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
        } else {
          dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: state.metrics });
        }
      } catch (error) {
        console.error("Error bulk updating recipe:", error);
        dispatch({ 
          type: 'CALCULATE_METRICS_ERROR', 
          payload: "Failed to update recipe" 
        });
      }
    },
    [state.recipe, state.ingredients, state.metrics]
  );

  // Add ingredient
  const addIngredient = useCallback(
    async (
      type: IngredientType,
      ingredientData: CreateRecipeIngredientData
    ): Promise<void> => {
      try {
        dispatch({ type: 'ADD_INGREDIENT_START' });

        // Validate ingredient data
        const validation = Services.ingredient.validateIngredientData(
          type,
          ingredientData
        );
        if (!validation.isValid) {
          throw new Error(validation.errors.join(", "));
        }

        // Create new ingredient
        const newIngredient = Services.ingredient.createRecipeIngredient(
          type,
          ingredientData,
          state.availableIngredients
        );

        const updatedIngredients = [...state.ingredients, newIngredient];
        const sortedIngredients = Services.ingredient.sortIngredients(updatedIngredients);

        dispatch({ 
          type: 'ADD_INGREDIENT_SUCCESS', 
          payload: { ingredient: newIngredient, sortedIngredients } 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          sortedIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error adding ingredient:", error);
        dispatch({ 
          type: 'ADD_INGREDIENT_ERROR', 
          payload: (error as Error).message || "Failed to add ingredient" 
        });
      }
    },
    [state.recipe, state.ingredients, state.availableIngredients]
  );

  // Update ingredient
  const updateIngredient = useCallback(
    async (
      ingredientId: string,
      updatedIngredientData: Partial<RecipeIngredient>
    ): Promise<void> => {
      try {
        dispatch({ type: 'UPDATE_INGREDIENT_START' });

        // Find the ingredient to update
        const existingIngredient = state.ingredients.find(
          (ing) => ing.id === ingredientId
        );
        if (!existingIngredient) {
          throw new Error("Ingredient not found");
        }

        // Validate ingredient data
        const validation = Services.ingredient.validateIngredientData(
          existingIngredient.type as IngredientType,
          updatedIngredientData as CreateRecipeIngredientData
        );
        if (!validation.isValid) {
          throw new Error(
            `Validation failed for ${existingIngredient.name}: ${validation.errors.join(", ")}`
          );
        }

        // Update the ingredient
        const updatedIngredient = { ...existingIngredient, ...updatedIngredientData };
        const updatedIngredients = state.ingredients.map((ing) =>
          ing.id === ingredientId ? updatedIngredient : ing
        );
        const sortedIngredients = Services.ingredient.sortIngredients(updatedIngredients);

        dispatch({ 
          type: 'UPDATE_INGREDIENT_SUCCESS', 
          payload: { ingredient: updatedIngredient, sortedIngredients } 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          sortedIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error updating ingredient:", error);
        dispatch({ 
          type: 'UPDATE_INGREDIENT_ERROR', 
          payload: (error as Error).message || "Failed to update ingredient" 
        });
        throw error;
      }
    },
    [state.recipe, state.ingredients]
  );

  // Bulk update ingredients
  const bulkUpdateIngredients = useCallback(
    async (
      updates: Array<{
        ingredientId: string;
        updatedData: Partial<RecipeIngredient>;
        isNewIngredient?: boolean;
      }>
    ): Promise<void> => {
      try {
        dispatch({ type: 'UPDATE_INGREDIENT_START' });

        let updatedIngredients = [...state.ingredients];

        // Process each update
        for (const update of updates) {
          if (update.isNewIngredient) {
            // Add new ingredient
            const newIngredient = update.updatedData as RecipeIngredient;
            updatedIngredients.push(newIngredient);
          } else {
            // Update existing ingredient
            const existingIngredient = updatedIngredients.find(
              (ing) => ing.id === update.ingredientId
            );
            if (existingIngredient) {
              // Validate ingredient data
              const validation = Services.ingredient.validateIngredientData(
                existingIngredient.type as IngredientType,
                update.updatedData as CreateRecipeIngredientData
              );
              if (!validation.isValid) {
                throw new Error(
                  `Validation failed for ${existingIngredient.name}: ${validation.errors.join(", ")}`
                );
              }

              // Update the ingredient in the array
              updatedIngredients = updatedIngredients.map((ing) =>
                ing.id === update.ingredientId ? { ...ing, ...update.updatedData } : ing
              );
            }
          }
        }

        const sortedIngredients = Services.ingredient.sortIngredients(updatedIngredients);

        dispatch({ 
          type: 'BULK_UPDATE_INGREDIENTS_SUCCESS', 
          payload: sortedIngredients 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          sortedIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error bulk updating ingredients:", error);
        dispatch({ 
          type: 'UPDATE_INGREDIENT_ERROR', 
          payload: (error as Error).message || "Failed to update ingredients" 
        });
        throw error;
      }
    },
    [state.ingredients, state.recipe]
  );

  // Remove ingredient
  const removeIngredient = useCallback(
    async (ingredientId: string): Promise<void> => {
      try {
        if (!state.ingredients) {
          throw new Error("No ingredients available to remove");
        }

        const updatedIngredients = state.ingredients.filter(
          (ing) => ing.id !== ingredientId
        );

        dispatch({ 
          type: 'REMOVE_INGREDIENT_SUCCESS', 
          payload: updatedIngredients 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          updatedIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error removing ingredient:", error);
        dispatch({ 
          type: 'REMOVE_INGREDIENT_ERROR', 
          payload: (error as Error).message || "Failed to remove ingredient" 
        });
      }
    },
    [state.recipe, state.ingredients]
  );

  // Scale recipe
  const scaleRecipe = useCallback(
    async (newBatchSize: number | string): Promise<void> => {
      try {
        const batchSize =
          typeof newBatchSize === "string"
            ? parseFloat(newBatchSize)
            : newBatchSize;

        if (!batchSize || batchSize <= 0) {
          throw new Error("Invalid batch size for scaling");
        }

        const { scaledRecipe, scalingFactor } = Services.recipe.scaleRecipe(
          state.recipe,
          state.ingredients,
          batchSize
        );

        const scaledIngredients = Services.ingredient.scaleIngredients(
          state.ingredients,
          scalingFactor
        );

        dispatch({ 
          type: 'SCALE_RECIPE_SUCCESS', 
          payload: { recipe: scaledRecipe, ingredients: scaledIngredients } 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          scaledRecipe,
          scaledIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error scaling recipe:", error);
        dispatch({ 
          type: 'SCALE_RECIPE_ERROR', 
          payload: (error as Error).message || "Failed to scale recipe" 
        });
      }
    },
    [state.recipe, state.ingredients]
  );

  // Save recipe
  const saveRecipe = useCallback(
    async (event?: React.FormEvent): Promise<Recipe> => {
      if (event) {
        event.preventDefault();
      }

      try {
        dispatch({ type: 'SAVE_RECIPE_START' });

        const savedRecipe = await Services.recipe.saveRecipe(
          recipeId || null,
          state.recipe,
          state.ingredients,
          state.metrics
        );

        if (!savedRecipe) {
          throw new Error("Failed to save recipe - no data returned");
        }

        dispatch({ 
          type: 'SAVE_RECIPE_SUCCESS', 
          payload: savedRecipe as Recipe 
        });

        // Update original recipe reference
        originalRecipeRef.current = savedRecipe as Recipe;

        // Navigate to the saved recipe if it's new
        if (!recipeId && savedRecipe.recipe_id) {
          navigate(`/recipes/${savedRecipe.recipe_id}`);
        }

        return savedRecipe as unknown as Recipe;
      } catch (error) {
        console.error("Error saving recipe:", error);
        dispatch({ 
          type: 'SAVE_RECIPE_ERROR', 
          payload: (error as Error).message || "Failed to save recipe" 
        });
        throw error;
      }
    },
    [state.recipe, state.metrics, state.ingredients, recipeId, navigate]
  );

  // Recalculate metrics
  const recalculateMetrics = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'CALCULATE_METRICS_START' });

      const metrics = await Services.metrics.calculateMetrics(
        state.recipe,
        state.ingredients
      );

      dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
    } catch (error) {
      console.error("Error recalculating metrics:", error);
      dispatch({ 
        type: 'CALCULATE_METRICS_ERROR', 
        payload: "Failed to recalculate metrics" 
      });
    }
  }, [state.recipe, state.ingredients]);

  // Import ingredients
  const importIngredients = useCallback(
    async (ingredientsToImport: RecipeIngredient[]): Promise<void> => {
      try {
        dispatch({ type: 'IMPORT_INGREDIENTS_START' });

        // Validate all ingredients
        for (const ingredient of ingredientsToImport) {
          const validation = Services.ingredient.validateIngredientData(
            ingredient.type as IngredientType,
            ingredient as CreateRecipeIngredientData
          );
          if (!validation.isValid) {
            throw new Error(
              `Validation failed for ${ingredient.name}: ${validation.errors.join(", ")}`
            );
          }
        }

        // Add to existing ingredients
        const combinedIngredients = [...state.ingredients, ...ingredientsToImport];
        const sortedIngredients = Services.ingredient.sortIngredients(combinedIngredients);

        dispatch({ 
          type: 'IMPORT_INGREDIENTS_SUCCESS', 
          payload: sortedIngredients 
        });

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          sortedIngredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error importing ingredients:", error);
        dispatch({ 
          type: 'IMPORT_INGREDIENTS_ERROR', 
          payload: (error as Error).message || "Failed to import ingredients" 
        });
      }
    },
    [state.recipe, state.ingredients]
  );

  // Utility actions
  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const cancelOperation = useCallback((): void => {
    Services.metrics.cancelCalculation("recipe-builder");
    dispatch({ type: 'CANCEL_OPERATIONS' });
  }, []);

  const getRecipeAnalysis = useCallback((): RecipeAnalysis => {
    return Services.metrics.getRecipeAnalysis(
      state.metrics,
      state.recipe
    ) as unknown as RecipeAnalysis;
  }, [state.metrics, state.recipe]);

  const refreshAvailableIngredients = useCallback(async (): Promise<void> => {
    try {
      const updatedAvailableIngredients = await Services.ingredient.fetchIngredients();
      dispatch({ type: 'REFRESH_AVAILABLE_INGREDIENTS', payload: updatedAvailableIngredients });
    } catch (error) {
      console.error("Error refreshing available ingredients:", error);
    }
  }, []);

  const importRecipeData = useCallback(async (recipeData: Partial<Recipe>): Promise<void> => {
    dispatch({ type: 'IMPORT_RECIPE_DATA', payload: recipeData });

    // Recalculate metrics if any calculation fields were updated
    const calculationFields: (keyof Recipe)[] = [
      "batch_size",
      "efficiency",
      "boil_time",
      "batch_size_unit",
    ];

    const hasCalculationFieldChanges = calculationFields.some(
      (field) => recipeData[field] !== undefined
    );

    if (hasCalculationFieldChanges && state.ingredients && state.ingredients.length > 0) {
      try {
        dispatch({ type: 'CALCULATE_METRICS_START' });

        const updatedRecipe = { ...state.recipe, ...recipeData };
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          updatedRecipe,
          state.ingredients
        );

        dispatch({ type: 'CALCULATE_METRICS_SUCCESS', payload: metrics });
      } catch (error) {
        console.error("Error recalculating metrics:", error);
        dispatch({ type: 'CALCULATE_METRICS_ERROR', payload: "Failed to recalculate metrics" });
      }
    }
  }, [state.recipe, state.ingredients]);

  const updateRecipeStyle = useCallback(
    async (styleName: string): Promise<void> => {
      await updateRecipe("style", styleName);

      // Refresh style analysis after style change
      if (state.recipe.recipe_id) {
        try {
          const analysis = await Services.beerStyle.getRecipeStyleAnalysis(
            state.recipe.recipe_id
          );
          dispatch({ type: 'UPDATE_STYLE_ANALYSIS', payload: analysis });
        } catch (error) {
          console.error("Error updating style analysis:", error);
        }
      }
    },
    [updateRecipe, state.recipe.recipe_id]
  );

  const refreshStyleAnalysis = useCallback(async (): Promise<void> => {
    if (!state.recipe.recipe_id || !state.metrics) return;

    try {
      const [analysis, suggestions] = await Promise.all([
        Services.beerStyle
          .getRecipeStyleAnalysis(state.recipe.recipe_id)
          .catch(() => null),
        Services.beerStyle.findMatchingStyles(state.metrics).catch(() => []),
      ]);

      dispatch({ type: 'UPDATE_STYLE_ANALYSIS', payload: analysis });
      dispatch({ type: 'UPDATE_STYLE_SUGGESTIONS', payload: suggestions.slice(0, 5) });
    } catch (error) {
      console.error("Error refreshing style analysis:", error);
    }
  }, [state.recipe.recipe_id, state.metrics]);

  // Check for unsaved changes
  useEffect(() => {
    if (originalRecipeRef.current && state.recipe && !state.loading) {
      const hasChanges = Services.recipe.hasUnsavedChanges(
        originalRecipeRef.current,
        state.recipe,
        state.ingredients
      );

      if (hasChanges !== state.hasUnsavedChanges) {
        dispatch({ type: 'SET_UNSAVED_CHANGES', payload: hasChanges });
      }
    }
  }, [state.recipe, state.ingredients, state.hasUnsavedChanges, state.loading]);

  // Return interface
  return {
    // Core data
    recipe: state.recipe,
    ingredients: state.ingredients,
    availableIngredients: state.availableIngredients,
    metrics: state.metrics,

    // UI state
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    hasUnsavedChanges: state.hasUnsavedChanges,
    calculatingMetrics: state.calculatingMetrics,
    addingIngredient: state.addingIngredient,
    updatingIngredient: state.updatingIngredient,

    // Core actions
    updateRecipe,
    bulkUpdateRecipe,
    addIngredient,
    updateIngredient,
    bulkUpdateIngredients,
    removeIngredient,
    scaleRecipe,
    saveRecipe,
    recalculateMetrics,
    importIngredients,

    // Utility actions
    clearError,
    cancelOperation,
    getRecipeAnalysis,
    refreshAvailableIngredients,
    importRecipeData,

    // Beer style analysis
    styleAnalysis: state.styleAnalysis,
    styleSuggestions: state.styleSuggestions,
    updateRecipeStyle,
    refreshStyleAnalysis,

    // Computed properties
    isEditing: Boolean(recipeId),
    canSave: !state.saving && !state.loading && state.ingredients && state.ingredients.length > 0,
    recipeDisplayName: Services.recipe.getRecipeDisplayName(state.recipe),
  };
}