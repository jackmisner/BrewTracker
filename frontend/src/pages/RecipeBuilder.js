import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../services/api";
import "../components/RecipeBuilder/RecipeBuilder.css";

// Import components
import RecipeDetails from "../components/RecipeBuilder/RecipeDetails";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import IngredientsList from "../components/RecipeBuilder/IngredientsList";
import GrainInput from "../components/RecipeBuilder/GrainInput";
import HopInput from "../components/RecipeBuilder/HopInput";
import YeastInput from "../components/RecipeBuilder/YeastInput";
import AdjunctInput from "../components/RecipeBuilder/AdjunctInput";
import {
  calculateOG,
  calculateFG,
  calculateABV,
  calculateIBU,
  calculateSRM,
} from "../utils/recipeCalculations";

function RecipeBuilder() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState({
    name: "",
    style: "",
    batch_size: 5,
    description: "",
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    notes: "",
  });
  const [ingredients, setIngredients] = useState({
    grain: [],
    hop: [],
    yeast: [],
    adjunct: [],
  });
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Recipe metrics
  const [metrics, setMetrics] = useState({
    og: 1.0,
    fg: 1.0,
    abv: 0.0,
    ibu: 0,
    srm: 0,
  });

  useEffect(() => {
    // Fetch ingredients
    fetchIngredients();

    // If editing an existing recipe, fetch it
    if (recipeId) {
      fetchRecipe(recipeId);
    } else {
      setLoading(false);
    }
  }, [recipeId]);

  // Calculate metrics function (wrapped in useCallback)


  const calculateRecipeMetrics = useCallback(async () => {
    try {
      if (recipeId) {
        // If recipe exists, get calculated metrics from server
        const response = await ApiService.recipes.calculateMetrics(recipeId);
        setMetrics(response.data.metrics);
      } else {
        // Client-side estimation for new recipes
        // This uses the same formulas as the server-side calculations

        const og = calculateOG(
          recipeIngredients,
          recipe.batch_size,
          recipe.efficiency,
        );
        const fg = calculateFG(recipeIngredients, og);
        const abv = calculateABV(og, fg);
        const ibu = calculateIBU(
          recipeIngredients,
          og,
          recipe.batch_size,
          recipe.boil_time,
        );
        const srm = calculateSRM(recipeIngredients, recipe.batch_size);

        setMetrics({
          og: og,
          fg: fg,
          abv: abv,
          ibu: ibu,
          srm: srm,
        });
      }
    } catch (err) {
      console.error("Error calculating metrics:", err);
      setError("Failed to calculate recipe metrics");
    }
  }, [
    recipeId,
    recipeIngredients,
    recipe.batch_size,
    recipe.efficiency,
    recipe.boil_time,
  ]);

  // Calculate metrics when recipe ingredients change
  useEffect(() => {
    if (!loading && recipeIngredients.length >= 0) {
      calculateRecipeMetrics();
    }
  }, [recipeIngredients, recipe.batch_size, recipe.efficiency, recipe.boil_time, calculateRecipeMetrics, loading]);

  const fetchIngredients = async () => {
    try {
      const response = await ApiService.ingredients.getAll();
      // Group ingredients by type
      const grouped = {
        grain: [],
        hop: [],
        yeast: [],
        adjunct: [],
      };

      response.data.ingredients.forEach((ingredient) => {
        if (grouped[ingredient.type]) {
          grouped[ingredient.type].push(ingredient);
        } else {
          console.warn(
            `Ingredient type ${ingredient.type} not recognized. Skipping...`,
          );
        }
      });

      setIngredients(grouped);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      setError("Failed to load ingredients");
    }
  };

  const fetchRecipe = async (recipeId) => {
    try {
      const response = await ApiService.recipes.getById(recipeId);
      setRecipe(response.data.recipe);

      // Fetch recipe ingredients
      const ingredientsResponse =
        await ApiService.recipes.getIngredients(recipeId);
      setRecipeIngredients(ingredientsResponse.data.ingredients);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching recipe:", err);
      setError("Failed to load recipe");
      setLoading(false);
    }
  };

  const handleRecipeChange = (updatedRecipe) => {
    setRecipe(updatedRecipe);
  };

  const addIngredient = async (type, ingredientData) => {
  try {
    let newIngredient;
    if (recipeId) {
      const response = await ApiService.recipes.addIngredient(recipeId, {
        ...ingredientData,
        ingredient_type: type,
      });
      newIngredient = response.data;
    } else {
      newIngredient = {
        id: `temp-${Date.now()}`,
        ingredient_id: ingredientData.ingredient_id,
        ingredient_name: getIngredientName(ingredientData.ingredient_id, type),
        associated_metrics: getIngredientData(ingredientData.ingredient_id, type),
        amount: ingredientData.amount,
        unit: ingredientData.unit,
        ingredient_type: type,
        use: ingredientData.use,
        time: ingredientData.time,
        time_unit: ingredientData.time_unit,
      };
    }

    // Update state in a single operation
    setRecipeIngredients(prevIngredients => [...prevIngredients, newIngredient]);
    
    // Force a metrics recalculation after state update
    calculateRecipeMetrics();
  } catch (err) {
    console.error("Error adding ingredient:", err);
    setError("Failed to add ingredient");
  }
};

  // Helper function to get ingredient name from ID
  const getIngredientName = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => i.ingredient_id === parseInt(ingredientId),
    );
    return ingredient ? ingredient.name : "Unknown";
  };

  // Helper function to get relevant ingredient data from ID
  const getIngredientData = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => i.ingredient_id === parseInt(ingredientId),
    );
    if (type === "grain") {
      return { potential: ingredient.potential, colour: ingredient.color };
    } else if (type === "hop") {
      return { alpha_acid: ingredient.alpha_acid };
    } else if (type === "yeast") {
      return { attenuation: ingredient.attenuation };
    }
  };

  const removeIngredient = async (ingredientId) => {
    try {
      if (recipeId && !ingredientId.toString().startsWith("temp-")) {
        // If recipe exists and ingredient is saved, remove from database
        await ApiService.recipes.removeIngredient(recipeId, ingredientId);
      }

      // Remove from local state
      setRecipeIngredients(
        recipeIngredients.filter((i) => i.id !== ingredientId),
      );

      // Metrics will be recalculated by the useEffect
    } catch (err) {
      console.error("Error removing ingredient:", err);
      setError("Failed to remove ingredient");
    }
  };

  // const calculateRecipeMetrics = async () => {
  //   try {
  //     if (recipeId) {
  //       // If recipe exists, get calculated metrics from server
  //       const response = await ApiService.recipes.calculateMetrics(recipeId);
  //       setMetrics(response.data.metrics);
  //     } else {
  //       // Client-side estimation for new recipes
  //       // This uses the same formulas as the server-side calculations

  //       const og = calculateOG(
  //         recipeIngredients,
  //         recipe.batch_size,
  //         recipe.efficiency,
  //       );
  //       const fg = calculateFG(recipeIngredients, og);
  //       const abv = calculateABV(og, fg);
  //       const ibu = calculateIBU(
  //         recipeIngredients,
  //         og,
  //         recipe.batch_size,
  //         recipe.boil_time,
  //       );
  //       const srm = calculateSRM(recipeIngredients, recipe.batch_size);

  //       setMetrics({
  //         og: og,
  //         fg: fg,
  //         abv: abv,
  //         ibu: ibu,
  //         srm: srm,
  //       });
  //     }
  //   } catch (err) {
  //     console.error("Error calculating metrics:", err);
  //     setError("Failed to calculate recipe metrics");
  //   }
  // };

  const handleScaleRecipe = (newBatchSize) => {
    if (!newBatchSize || isNaN(newBatchSize) || newBatchSize <= 0) {
      setError("Invalid batch size for scaling");
      return;
    }

    // Get current batch size
    const currentBatchSize = recipe.batch_size;

    // Calculate scaling factor
    const scalingFactor = newBatchSize / currentBatchSize;

    // Update the recipe batch size
    const updatedRecipe = {
      ...recipe,
      batch_size: newBatchSize,
    };

    // Scale all ingredient amounts
    const scaledIngredients = recipeIngredients.map((ingredient) => {
      return {
        ...ingredient,
        amount: (parseFloat(ingredient.amount) * scalingFactor).toFixed(2),
      };
    });

    // Update state
    setRecipe(updatedRecipe);
    setRecipeIngredients(scaledIngredients);

    // Metrics will be recalculated by the useEffect
    console.log(
      `Recipe scaled from ${currentBatchSize} to ${newBatchSize} gallons`,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const recipeData = {
        ...recipe,
        estimated_og: metrics.og,
        estimated_fg: metrics.fg,
        estimated_abv: metrics.abv,
        estimated_ibu: metrics.ibu,
        estimated_srm: metrics.srm,
      };

      let recipeResponse;
      let newRecipeId = recipeId;

      if (recipeId) {
        // Update existing recipe
        recipeResponse = await ApiService.recipes.update(recipeId, recipeData);
      } else {
        // Create new recipe
        recipeResponse = await ApiService.recipes.create(recipeData);

        if (!recipeResponse.data || !recipeResponse.data.recipe) {
          throw new Error("Failed to create recipe: Invalid server response");
        }

        newRecipeId = recipeResponse.data.recipe.recipe_id;

        // Add any ingredients that were added before saving
        if (recipeIngredients.length > 0) {
          const saveIngredientPromises = recipeIngredients.map(
            async (ingredient) => {
              if (ingredient.id.toString().startsWith("temp-")) {
                // Extract data for API call
                const {
                  id: tempId,
                  ingredient_name,
                  ingredient_type,
                  ...ingredientData
                } = ingredient;

                // Make sure we're sending the right format
                const ingredientPayload = {
                  ...ingredientData,
                  ingredient_type: ingredient_type,
                };

                try {
                  await ApiService.recipes.addIngredient(
                    newRecipeId,
                    ingredientPayload,
                  );
                } catch (err) {
                  console.error(
                    `Error saving ingredient ${ingredient.ingredient_name}:`,
                    err,
                  );
                  throw new Error(
                    `Failed to save ingredient: ${ingredient.ingredient_name}`,
                  );
                }
              }
            },
          );

          // Wait for all ingredient saves to complete
          await Promise.all(saveIngredientPromises);
        }
      }

      // Show success message
      alert("Recipe saved successfully!");

      // Navigate to recipe detail page
      navigate(`/recipes/${newRecipeId}`);
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError(`Failed to save recipe: ${err.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div id="recipe-builder" className="container">
      <h1 className="page-title">{recipeId ? "Edit Recipe" : "Create New Recipe"}</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      )}

      <div className="grid">
        {/* Recipe Details Form */}
        <div className="grid-col-2-3">
          <RecipeDetails
            recipe={recipe}
            onChange={handleRecipeChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/recipes")}
            isEditing={!!recipeId || true}
            saving={saving}
          />
        </div>

        {/* Recipe Metrics */}
        <div className="grid-col-1-3">
          <RecipeMetrics
            metrics={metrics}
            onCalculate={calculateRecipeMetrics}
            onScale={handleScaleRecipe}
          />
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="mt-6">
        <h2 className="section-title">Ingredients</h2>

        {/* Ingredients Tables */}
        <IngredientsList
          ingredients={recipeIngredients}
          onRemove={removeIngredient}
          isEditing={!!recipeId || true}
        />

        {/* Grains */}
        <div className="grid-col-2-3">
          <GrainInput
            grains={ingredients.grain}
            onAdd={(data) => addIngredient("grain", data)}
            onCalculate={calculateRecipeMetrics}
          />
        </div>

        {/* Hops */}
        <HopInput
          hops={ingredients.hop}
          onAdd={(data) => addIngredient("hop", data)}
          onCalculate={calculateRecipeMetrics}
        />

        {/* Yeast */}
        <YeastInput
          yeasts={ingredients.yeast}
          onAdd={(data) => addIngredient("yeast", data)}
          onCalculate={calculateRecipeMetrics}
        />

        {/* Adjuncts  */}
        <AdjunctInput
          adjuncts={ingredients.adjunct}
          onAdd={(data) => addIngredient("adjunct", data)}
          onCalculate={calculateRecipeMetrics}
        />
      </div>
    </div>
  );
}

export default RecipeBuilder;
