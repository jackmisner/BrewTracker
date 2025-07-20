// hooks/useRecipeBuilder.ts
import { useState, useEffect, useCallback, useRef } from "react";
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
} from '../types';

// Hook state interface
interface UseRecipeBuilderState {
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

  // Operation flags
  calculatingMetrics: boolean;
  addingIngredient: boolean;
  updatingIngredient: boolean;
}

// Return interface for the hook
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
  addIngredient: (type: IngredientType, ingredientData: CreateRecipeIngredientData) => Promise<void>;
  updateIngredient: (ingredientId: string, updatedIngredientData: Partial<RecipeIngredient>) => Promise<void>;
  bulkUpdateIngredients: (updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient>; isNewIngredient?: boolean }>) => Promise<void>;
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
 * Unified hook for recipe builder functionality
 * Orchestrates all recipe building operations using the service layer
 */
export function useRecipeBuilder(recipeId?: ID): UseRecipeBuilderReturn {
  const navigate = useNavigate();
  const originalRecipeRef = useRef<Recipe | null>(null);
  const { unitSystem } = useUnits();

  // Consolidated state
  const [state, setState] = useState<UseRecipeBuilderState>({
    // Core data
    recipe: {
      id: '',
      recipe_id: '',
      name: "",
      style: "",
      batch_size: unitSystem === "metric" ? 19 : 5, // Use 19L for metric, 5 gal for imperial
      batch_size_unit: (unitSystem === "metric" ? "l" : "gal") as BatchSizeUnit, // Add unit field
      description: "",
      boil_time: 60,
      efficiency: 75,
      is_public: false,
      notes: "",
      ingredients: [],
      created_at: '',
      updated_at: '',
    } as Recipe,
    ingredients: [],
    availableIngredients: {
      grain: [],
      hop: [],
      yeast: [],
      other: [],
    },
    metrics: {
      og: 1.0,
      fg: 1.0,
      abv: 0.0,
      ibu: 0,
      srm: 0,
    },

    // UI state
    loading: true,
    saving: false,
    error: null,
    hasUnsavedChanges: false,

    // Operation flags
    calculatingMetrics: false,
    addingIngredient: false,
    updatingIngredient: false,
  });

  // Beer style analysis state
  const [styleAnalysis, setStyleAnalysis] = useState<StyleAnalysis | null>(null);
  const [styleSuggestions, setStyleSuggestions] = useState<StyleSuggestion[]>([]);

  // Initialize data on mount
  useEffect(() => {
    // Each effect run gets its own mounted flag
    let effectMounted = true;

    async function initialize(): Promise<void> {
      try {
        if (!effectMounted) {
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
        }));

        // Load available ingredients first
        const availableIngredients = await Services.ingredient.fetchIngredients();

        if (!effectMounted) {
          return;
        }

        // Initialize default values with unit awareness
        let recipe: Recipe = {
          id: '',
          recipe_id: '',
          name: "",
          style: "",
          batch_size: unitSystem === "metric" ? 19 : 5, // Use 19L for metric, 5 gal for imperial
          batch_size_unit: (unitSystem === "metric" ? "l" : "gal") as BatchSizeUnit, // Add unit field
          description: "",
          boil_time: 60,
          efficiency: 75,
          is_public: false,
          notes: "",
          ingredients: [],
          created_at: '',
          updated_at: '',
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
            // Infer from batch size value - if it's around 19, it's probably metric
            recipe.batch_size_unit = (recipe.batch_size > 10 ? "l" : "gal") as BatchSizeUnit;
          }
          ingredients = recipeData.ingredients || [];
          originalRecipeRef.current = recipeData as Recipe; // Store original for change detection
        }

        // Calculate initial metrics
        // If editing an existing recipe, try to use existing estimated metrics first
        if (recipeId && (recipe.estimated_og || recipe.estimated_fg || recipe.estimated_abv || recipe.estimated_ibu || recipe.estimated_srm)) {
          metrics = {
            og: recipe.estimated_og || 1.0,
            fg: recipe.estimated_fg || 1.0,
            abv: recipe.estimated_abv || 0.0,
            ibu: recipe.estimated_ibu || 0,
            srm: recipe.estimated_srm || 0,
          };
        } else if (ingredients.length === 0) {
          // For new recipes with no ingredients, use default values
          metrics = {
            og: 1.0,
            fg: 1.0,
            abv: 0.0,
            ibu: 0,
            srm: 0,
          };
        } else {
          // Calculate metrics from ingredients
          try {
            // Add timeout to metrics calculation
            const metricsPromise = Services.metrics.calculateMetrics(
              recipe,
              ingredients
            );
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Metrics calculation timeout")),
                10000
              )
            );

            metrics = await Promise.race([metricsPromise, timeoutPromise]);
          } catch (metricsError) {
            // Use default metrics if calculation fails
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

        setState((prev) => ({
          ...prev,
          recipe,
          ingredients: Services.ingredient.sortIngredients(ingredients),
          availableIngredients,
          metrics,
          loading: false,
          hasUnsavedChanges: false,
        }));
      } catch (error) {
        console.error("CATCH BLOCK: Error initializing recipe builder:", error);
        console.error("Error stack:", (error as Error).stack);
        if (effectMounted) {
          setState((prev) => ({
            ...prev,
            error: (error as Error).message || "Failed to initialize recipe builder",
            loading: false,
          }));
        }
      }
    }

    initialize();

    // Cleanup function
    return () => {
      effectMounted = false;
      Services.metrics.cancelCalculation("recipe-builder");
    };
  }, [recipeId, unitSystem]); // Add unitSystem to dependencies

  // Update recipe field
  const updateRecipe = useCallback(
    async (field: keyof Recipe, value: any): Promise<void> => {
      const updatedRecipe = { ...state.recipe, [field]: value };

      setState((prev) => ({
        ...prev,
        recipe: updatedRecipe,
        hasUnsavedChanges: true,
      }));

      // Recalculate metrics if field affects calculations
      const calculationFields: (keyof Recipe)[] = [
        "batch_size",
        "efficiency",
        "boil_time",
        "batch_size_unit",
      ];
      if (calculationFields.includes(field)) {
        try {
          setState((prev) => ({ ...prev, calculatingMetrics: true }));

          const metrics = await Services.metrics.calculateMetricsDebounced(
            "recipe-builder",
            updatedRecipe,
            state.ingredients
          );

          setState((prev) => ({
            ...prev,
            metrics,
            calculatingMetrics: false,
          }));
        } catch (error) {
          console.error("Error recalculating metrics:", error);
          setState((prev) => ({
            ...prev,
            calculatingMetrics: false,
            error: "Failed to recalculate metrics",
          }));
        }
      }
    },
    [state.recipe, state.ingredients]
  );

  // Add ingredient
  const addIngredient = useCallback(
    async (type: IngredientType, ingredientData: CreateRecipeIngredientData): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          addingIngredient: true,
          error: null,
        }));

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

        // Update state immediately for better UX
        setState((prev) => ({
          ...prev,
          ingredients: sortedIngredients,
          hasUnsavedChanges: true,
          addingIngredient: false,
          calculatingMetrics: true,
        }));

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          state.recipe,
          sortedIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error adding ingredient:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to add ingredient",
          addingIngredient: false,
          calculatingMetrics: false,
        }));
      }
    },
    [state.recipe, state.ingredients, state.availableIngredients]
  );

  // Update ingredient
  const updateIngredient = useCallback(
    async (ingredientId: string, updatedIngredientData: Partial<RecipeIngredient>): Promise<void> => {
      try {
        // Use functional setState to access current state and avoid stale closures
        let currentIngredients: RecipeIngredient[] = [];
        let currentRecipe: Recipe = state.recipe;
        let existingIngredient: RecipeIngredient | undefined;
        
        setState((prev) => {
          currentIngredients = prev.ingredients;
          currentRecipe = prev.recipe;
          
          // Find the ingredient to update using current state
          existingIngredient = currentIngredients.find(
            (ing) => ing.id === ingredientId
          );
          
          return {
            ...prev,
            updatingIngredient: true,
            error: null,
          };
        });

        if (!existingIngredient) {
          throw new Error("Ingredient not found");
        }

        // Validate the updated ingredient data
        const validation = Services.ingredient.validateIngredientData(
          existingIngredient.type,
          {
            ingredient_id: updatedIngredientData.ingredient_id,
            amount: updatedIngredientData.amount,
            unit: updatedIngredientData.unit,
            use: updatedIngredientData.use,
            time: updatedIngredientData.time,
            alpha_acid: updatedIngredientData.alpha_acid,
            color: updatedIngredientData.color,
          } as CreateRecipeIngredientData
        );

        if (!validation.isValid) {
          throw new Error(validation.errors.join(", "));
        }

        // Update the ingredient in the list using current ingredients
        const updatedIngredients = currentIngredients.map((ing) =>
          ing.id === ingredientId ? { ...ing, ...updatedIngredientData } : ing
        );

        const sortedIngredients = Services.ingredient.sortIngredients(updatedIngredients);

        // Update state immediately for better UX
        setState((prev) => ({
          ...prev,
          ingredients: sortedIngredients,
          hasUnsavedChanges: true,
          updatingIngredient: false,
          calculatingMetrics: true,
        }));

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          currentRecipe,
          sortedIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error updating ingredient:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to update ingredient",
          updatingIngredient: false,
          calculatingMetrics: false,
        }));

        // Re-throw the error so the component can handle it
        throw error;
      }
    },
    [state.recipe] // Remove state dependencies to prevent stale closures
  );

  // Bulk update ingredients
  const bulkUpdateIngredients = useCallback(
    async (updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient>; isNewIngredient?: boolean }>): Promise<void> => {
      try {
        // Use functional setState to access current state and avoid stale closures
        let currentRecipe: Recipe = state.recipe;
        let currentIngredients: RecipeIngredient[] = [];
        
        setState((prev) => {
          currentIngredients = prev.ingredients;
          currentRecipe = prev.recipe;
          return {
            ...prev,
            updatingIngredient: true,
            error: null,
          };
        });

        // Wait for setState to complete and ensure we have the current ingredients
        if (currentIngredients.length === 0) {
          // Fallback: if currentIngredients is still empty, use state.ingredients directly
          currentIngredients = state.ingredients;
          console.log(`🔧 DEBUG: Using fallback ingredients array with ${currentIngredients.length} ingredients`);
        }

        // Apply all updates to the current ingredients
        let updatedIngredients = [...currentIngredients];
        
        for (const { ingredientId, updatedData, isNewIngredient } of updates) {
          if (isNewIngredient) {
            // Handle new ingredient additions
            const newIngredient: RecipeIngredient = {
              id: ingredientId,
              ingredient_id: updatedData.ingredient_id!,
              name: updatedData.name!,
              type: updatedData.type!,
              amount: updatedData.amount!,
              unit: updatedData.unit!,
              grain_type: updatedData.grain_type,
              color: updatedData.color,
              potential: updatedData.potential,
              use: updatedData.use,
              time: updatedData.time,
              alpha_acid: updatedData.alpha_acid,
              attenuation: updatedData.attenuation,
              improved_attenuation_estimate: updatedData.improved_attenuation_estimate,
            };
            // Validate the new ingredient data
            const validation = Services.ingredient.validateIngredientData(
              newIngredient.type,
              {
                ingredient_id: newIngredient.ingredient_id,
                amount: newIngredient.amount,
                unit: newIngredient.unit,
                use: newIngredient.use,
                time: newIngredient.time,
                alpha_acid: newIngredient.alpha_acid,
                color: newIngredient.color,
              } as CreateRecipeIngredientData
            );

            if (!validation.isValid) {
              throw new Error(`Validation failed for ${newIngredient.name}: ${validation.errors.join(", ")}`);
            }

            // Add the new ingredient to the array
            updatedIngredients.push(newIngredient);
          } else {
            // Handle existing ingredient updates
            const existingIngredient = updatedIngredients.find(ing => ing.id === ingredientId);
            if (!existingIngredient) {
              throw new Error(`Ingredient with ID ${ingredientId} not found`);
            }


            // Validate the updated ingredient data
            const validation = Services.ingredient.validateIngredientData(
              existingIngredient.type,
              {
                ingredient_id: updatedData.ingredient_id || existingIngredient.ingredient_id,
                amount: updatedData.amount || existingIngredient.amount,
                unit: updatedData.unit || existingIngredient.unit,
                use: updatedData.use || existingIngredient.use,
                time: updatedData.time || existingIngredient.time,
                alpha_acid: updatedData.alpha_acid || existingIngredient.alpha_acid,
                color: updatedData.color || existingIngredient.color,
              } as CreateRecipeIngredientData
            );

            if (!validation.isValid) {
              throw new Error(`Validation failed for ${existingIngredient.name}: ${validation.errors.join(", ")}`);
            }

            // Update the ingredient in the array
            updatedIngredients = updatedIngredients.map((ing) =>
              ing.id === ingredientId ? { ...ing, ...updatedData } : ing
            );
          }
        }

        const sortedIngredients = Services.ingredient.sortIngredients(updatedIngredients);
        // Update state immediately for better UX
        setState((prev) => ({
          ...prev,
          ingredients: sortedIngredients,
          hasUnsavedChanges: true,
          updatingIngredient: false,
          calculatingMetrics: true,
        }));

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          currentRecipe,
          sortedIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error bulk updating ingredients:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to update ingredients",
          updatingIngredient: false,
          calculatingMetrics: false,
        }));

        // Re-throw the error so the component can handle it
        throw error;
      }
    },
    [state.recipe] // Remove state dependencies to prevent stale closures
  );

  // Remove ingredient
  const removeIngredient = useCallback(
    async (ingredientId: string): Promise<void> => {
      try {
        // Use functional setState to access current state and avoid stale closures
        let currentRecipe: Recipe = state.recipe;
        let currentIngredients: RecipeIngredient[] = state.recipe.ingredients;

        setState((prev) => {
          currentIngredients = prev.ingredients;
          currentRecipe = prev.recipe;
          return prev;
        });

        const updatedIngredients = currentIngredients.filter(
          (ing) => ing.id !== ingredientId
        );

        // Update state immediately
        setState((prev) => ({
          ...prev,
          ingredients: updatedIngredients,
          hasUnsavedChanges: true,
          calculatingMetrics: true,
        }));

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          currentRecipe,
          updatedIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error removing ingredient:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to remove ingredient",
          calculatingMetrics: false,
        }));
      }
    },
    [state.recipe] // Remove state dependencies to prevent stale closures
  );

  // Scale recipe
  const scaleRecipe = useCallback(
    async (newBatchSize: number | string): Promise<void> => {
      try {
        const batchSize = typeof newBatchSize === 'string' ? parseFloat(newBatchSize) : newBatchSize;
        
        if (!batchSize || batchSize <= 0) {
          throw new Error("Invalid batch size for scaling");
        }

        // Use functional setState to access current state and avoid stale closures
        let currentRecipe: Recipe = state.recipe;
        let currentIngredients: RecipeIngredient[] = [];
        
        setState((prev) => {
          currentRecipe = prev.recipe;
          currentIngredients = prev.ingredients;
          return prev;
        });

        const { scaledRecipe, scalingFactor } = Services.recipe.scaleRecipe(
          currentRecipe,
          currentIngredients,
          batchSize
        );

        const scaledIngredients = Services.ingredient.scaleIngredients(
          currentIngredients,
          scalingFactor
        );

        // Update state immediately
        setState((prev) => ({
          ...prev,
          recipe: scaledRecipe,
          ingredients: scaledIngredients,
          hasUnsavedChanges: true,
          calculatingMetrics: true,
        }));

        // Recalculate metrics
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder",
          scaledRecipe,
          scaledIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error scaling recipe:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to scale recipe",
          calculatingMetrics: false,
        }));
      }
    },
    [state.recipe] // Remove state dependencies to prevent stale closures
  );

  // Save recipe
  const saveRecipe = useCallback(
    async (event?: React.FormEvent): Promise<Recipe> => {
      if (event) {
        event.preventDefault();
      }

      try {
        // Use functional setState to access current state and avoid stale closures
        let currentRecipe: Recipe = state.recipe;
        let currentIngredients: RecipeIngredient[] = [];
        let currentMetrics: RecipeMetrics = state.metrics;
        
        setState((prev) => {
          currentRecipe = prev.recipe;
          currentIngredients = prev.ingredients;
          currentMetrics = prev.metrics;
          return {
            ...prev,
            saving: true,
            error: null,
          };
        });

        const savedRecipe = await Services.recipe.saveRecipe(
          recipeId || null,
          currentRecipe,
          currentIngredients,
          currentMetrics
        );

        if (!savedRecipe) {
          throw new Error("Failed to save recipe - no data returned");
        }

        // Update state with saved recipe data
        setState((prev) => ({
          ...prev,
          recipe: savedRecipe as Recipe,
          hasUnsavedChanges: false,
          saving: false,
        }));

        // Update original recipe reference
        originalRecipeRef.current = savedRecipe as Recipe;

        // Navigate to the saved recipe if it's new
        if (!recipeId && savedRecipe.recipe_id) {
          navigate(`/recipes/${savedRecipe.recipe_id}`);
        }

        return savedRecipe as unknown as Recipe;
      } catch (error) {
        console.error("Error saving recipe:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to save recipe",
          saving: false,
        }));
        throw error;
      }
    },
    [state.recipe, state.metrics, recipeId, navigate] // Keep only dependencies that don't change during operations
  );

  // Manually recalculate metrics
  const recalculateMetrics = useCallback(async (): Promise<void> => {
    try {
      // Use functional setState to access current state and avoid stale closures
      let currentRecipe: Recipe = state.recipe;
      let currentIngredients: RecipeIngredient[] = [];
      
      setState((prev) => {
        currentRecipe = prev.recipe;
        currentIngredients = prev.ingredients;
        return {
          ...prev,
          calculatingMetrics: true,
          error: null,
        };
      });

      const metrics = await Services.metrics.calculateMetrics(
        currentRecipe,
        currentIngredients
      );

      setState((prev) => ({
        ...prev,
        metrics,
        calculatingMetrics: false,
      }));
    } catch (error) {
      console.error("Error recalculating metrics:", error);
      setState((prev) => ({
        ...prev,
        error: (error as Error).message || "Failed to recalculate metrics",
        calculatingMetrics: false,
      }));
    }
  }, [state.recipe]); // Remove state dependencies to prevent stale closures

  // Clear error
  const clearError = useCallback((): void => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Cancel current operation
  const cancelOperation = useCallback((): void => {
    Services.metrics.cancelCalculation("recipe-builder");
    setState((prev) => ({
      ...prev,
      calculatingMetrics: false,
      addingIngredient: false,
      updatingIngredient: false,
      error: null,
    }));
  }, []);

  // Check for unsaved changes
  useEffect(() => {
    if (originalRecipeRef.current && state.recipe && !state.loading) {
      const hasChanges = Services.recipe.hasUnsavedChanges(
        originalRecipeRef.current,
        state.recipe,
        state.ingredients
      );

      if (hasChanges !== state.hasUnsavedChanges) {
        setState((prev) => ({
          ...prev,
          hasUnsavedChanges: hasChanges,
        }));
      }
    }
  }, [state.recipe, state.ingredients, state.hasUnsavedChanges, state.loading]);

  // Get recipe analysis
  const getRecipeAnalysis = useCallback((): RecipeAnalysis => {
    return Services.metrics.getRecipeAnalysis(state.metrics, state.recipe) as unknown as RecipeAnalysis;
  }, [state.metrics, state.recipe]);

  const refreshAvailableIngredients = useCallback(async (): Promise<void> => {
    try {
      const updatedAvailableIngredients = await Services.ingredient.fetchIngredients();
      setState((prev) => ({
        ...prev,
        availableIngredients: updatedAvailableIngredients,
      }));
    } catch (error) {
      console.error("Error refreshing available ingredients:", error);
    }
  }, []);

  // Import multiple ingredients at once (for BeerXML import)
  const importIngredients = useCallback(
    async (ingredientsToImport: RecipeIngredient[]): Promise<void> => {
      try {
        
        setState((prev) => ({
          ...prev,
          addingIngredient: true,
          error: null,
        }));

        const processedIngredients: RecipeIngredient[] = [];

        // Process each ingredient with complete data including name
        for (const importIngredient of ingredientsToImport) {
          // Create ingredient data object with all properties including name
          const ingredientData: CreateRecipeIngredientData = {
            ingredient_id: importIngredient.ingredient_id || undefined,
            name: importIngredient.name, // Include the name!
            amount: importIngredient.amount,
            unit: importIngredient.unit,
            use: importIngredient.use,
            time: importIngredient.time,
            alpha_acid: importIngredient.alpha_acid,
            color: importIngredient.color,
            potential: importIngredient.potential,
            grain_type: importIngredient.grain_type,
            attenuation: importIngredient.attenuation,
          };

          // Validate ingredient data
          const validation = Services.ingredient.validateIngredientData(
            importIngredient.type,
            ingredientData
          );
          if (!validation.isValid) {
            console.error(
              `Validation failed for ${importIngredient.name}:`,
              validation.errors
            );
            throw new Error(
              `${importIngredient.name}: ${validation.errors.join(", ")}`
            );
          }

          // Create new recipe ingredient using the service
          const newIngredient = Services.ingredient.createRecipeIngredient(
            importIngredient.type,
            ingredientData,
            state.availableIngredients
          );

          processedIngredients.push(newIngredient);
        }

        // Sort all ingredients together
        const sortedIngredients = Services.ingredient.sortIngredients(processedIngredients);

        // Update state with all ingredients at once
        setState((prev) => ({
          ...prev,
          ingredients: sortedIngredients,
          hasUnsavedChanges: true,
          addingIngredient: false,
          calculatingMetrics: true,
        }));

        // Recalculate metrics with all ingredients
        const metrics = await Services.metrics.calculateMetricsDebounced(
          "recipe-builder-import",
          state.recipe,
          sortedIngredients
        );

        setState((prev) => ({
          ...prev,
          metrics,
          calculatingMetrics: false,
        }));
      } catch (error) {
        console.error("Error importing ingredients:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to import ingredients",
          addingIngredient: false,
          calculatingMetrics: false,
        }));
        throw error;
      }
    },
    [state.recipe, state.availableIngredients]
  );

  // Import recipe data all at once (for BeerXML import)
  const importRecipeData = useCallback(
    async (recipeData: Partial<Recipe>): Promise<void> => {
      try {
        // Clean up the imported data before applying

        const cleanedRecipeData = { ...recipeData };
        
        // Round batch size to reasonable precision (2 decimal places)
        if (cleanedRecipeData.batch_size && typeof cleanedRecipeData.batch_size === 'number') {
          cleanedRecipeData.batch_size = Math.round(cleanedRecipeData.batch_size * 100) / 100;
        }
        
        // Update the recipe state with all imported data at once
        const updatedRecipe = { ...state.recipe, ...cleanedRecipeData };

        setState((prev) => ({
          ...prev,
          recipe: updatedRecipe,
          hasUnsavedChanges: true,
        }));

        // Recalculate metrics if any calculation fields were updated
        const calculationFields: (keyof Recipe)[] = [
          "batch_size",
          "efficiency",
          "boil_time",
          "batch_size_unit",
        ];
        
        const hasCalculationFieldChanges = calculationFields.some(field => 
          recipeData[field] !== undefined
        );
        
        if (hasCalculationFieldChanges && state.ingredients.length > 0) {
          try {

            setState((prev) => ({ ...prev, calculatingMetrics: true }));

            const metrics = await Services.metrics.calculateMetricsDebounced(
              "recipe-builder",
              updatedRecipe,
              state.ingredients
            );

            setState((prev) => ({
              ...prev,
              metrics,
              calculatingMetrics: false,
            }));
          } catch (error) {
            console.error("Error recalculating metrics:", error);
            setState((prev) => ({
              ...prev,
              calculatingMetrics: false,
              error: "Failed to recalculate metrics",
            }));
          }
        }
      } catch (error) {
        console.error("Error importing recipe data:", error);
        setState((prev) => ({
          ...prev,
          error: (error as Error).message || "Failed to import recipe data",
        }));
      }
    },
    [state.recipe, state.ingredients]
  );

  const updateRecipeStyle = useCallback(
    async (styleName: string): Promise<void> => {
      await updateRecipe("style", styleName);

      // Refresh style analysis after style change
      if (state.recipe.recipe_id) {
        try {
          const analysis = await Services.beerStyle.getRecipeStyleAnalysis(
            state.recipe.recipe_id
          );
          setStyleAnalysis(analysis);
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
        Services.beerStyle
          .findMatchingStyles(state.metrics)
          .catch(() => []),
      ]);

      setStyleAnalysis(analysis);
      setStyleSuggestions(suggestions.slice(0, 5));
    } catch (error) {
      console.error("Error refreshing style analysis:", error);
    }
  }, [state.recipe.recipe_id, state.metrics]);

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
    styleAnalysis,
    styleSuggestions,
    updateRecipeStyle,
    refreshStyleAnalysis,

    // Computed properties
    isEditing: Boolean(recipeId),
    canSave: !state.saving && !state.loading && state.ingredients.length > 0,
    recipeDisplayName: Services.recipe.getRecipeDisplayName(state.recipe),
  };
}