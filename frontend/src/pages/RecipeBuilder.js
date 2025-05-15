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
          recipe.efficiency
        );
        const fg = calculateFG(recipeIngredients, og);
        const abv = calculateABV(og, fg);
        const ibu = calculateIBU(
          recipeIngredients,
          og,
          recipe.batch_size,
          recipe.boil_time
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
  }, [
    recipeIngredients,
    recipe.batch_size,
    recipe.efficiency,
    recipe.boil_time,
    calculateRecipeMetrics,
    loading,
  ]);

  const fetchIngredients = async () => {
    try {
      const response = await ApiService.ingredients.getAll();
      // console.log("Ingredients API Response:", response.data);

      // Check if response data is an array directly or nested in an 'ingredients' property
      const ingredientsData = Array.isArray(response.data)
        ? response.data
        : response.data.ingredients || [];

      // Group ingredients by type
      const grouped = {
        grain: [],
        hop: [],
        yeast: [],
        adjunct: [],
      };

      ingredientsData.forEach((ingredient) => {
        if (grouped[ingredient.type]) {
          grouped[ingredient.type].push(ingredient);
        } else {
          console.warn(
            `Ingredient type ${ingredient.type} not recognized. Skipping...`
          );
        }
      });

      setIngredients(grouped);
    } catch (err) {
      console.error("Error fetching ingredients:", err);
      console.log("Error details:", err.response?.data);
      setError("Failed to load ingredients");
    }
  };

  const fetchRecipe = async (recipeId) => {
    try {
      const response = await ApiService.recipes.getById(recipeId);
      setRecipe(response.data.recipe);

      // Fetch recipe ingredients
      const ingredientsResponse = await ApiService.recipes.getIngredients(
        recipeId
      );
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
          ingredient_name: getIngredientName(
            ingredientData.ingredient_id,
            type
          ),
          associated_metrics: getIngredientData(
            ingredientData.ingredient_id,
            type
          ),
          amount: ingredientData.amount,
          unit: ingredientData.unit,
          ingredient_type: type,
          use: ingredientData.use,
          time: ingredientData.time,
          time_unit: ingredientData.time_unit,
        };
      }

      // Update state using the callback form to ensure we have the latest state
      setRecipeIngredients((prevIngredients) => [
        ...prevIngredients,
        newIngredient,
      ]);

      // We're relying on the useEffect to handle the metric recalculation
      // Don't call calculateRecipeMetrics() directly here
    } catch (err) {
      console.error("Error adding ingredient:", err);
      setError("Failed to add ingredient");
    }
  };

  const getIngredientName = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    return ingredient ? ingredient.name : "Unknown";
  };

  // Helper function to get relevant ingredient data from ID
  const getIngredientData = (ingredientId, type) => {
    const ingredient = ingredients[type]?.find(
      (i) => String(i.ingredient_id) === String(ingredientId)
    );
    if (!ingredient) return {};

    if (type === "grain") {
      return { potential: ingredient.potential, colour: ingredient.color };
    } else if (type === "hop") {
      return { alpha_acid: ingredient.alpha_acid };
    } else if (type === "yeast") {
      return { attenuation: ingredient.attenuation };
    }
    return {};
  };

  const removeIngredient = async (ingredientId) => {
    try {
      if (recipeId && !ingredientId.toString().startsWith("temp-")) {
        // If recipe exists and ingredient is saved, remove from database
        await ApiService.recipes.removeIngredient(recipeId, ingredientId);
      }

      // Remove from local state
      setRecipeIngredients(
        recipeIngredients.filter((i) => i.id !== ingredientId)
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
      `Recipe scaled from ${currentBatchSize} to ${newBatchSize} gallons`
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Prepare recipe data with metrics
      const recipeData = {
        ...recipe,
        estimated_og: metrics.og,
        estimated_fg: metrics.fg,
        estimated_abv: metrics.abv,
        estimated_ibu: metrics.ibu,
        estimated_srm: metrics.srm,
      };

      // Format ingredients for MongoDB
      // In MongoDB, ingredients are embedded in the recipe document
      const formattedIngredients = recipeIngredients.map((ing) => {
        // Only include necessary fields for MongoDB model
        return {
          ingredient_id: ing.ingredient_id, // This should be a string in MongoDB
          name:
            ing.ingredient_name ||
            getIngredientName(ing.ingredient_id, ing.ingredient_type),
          type: ing.ingredient_type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use,
          time: parseInt(ing.time) || 0,
        };
      });

      // Add ingredients to recipe data
      recipeData.ingredients = formattedIngredients;

      let recipeResponse;

      if (recipeId) {
        // Update existing recipe
        recipeResponse = await ApiService.recipes.update(recipeId, recipeData);

        // Check response
        if (!recipeResponse.data) {
          throw new Error("Failed to update recipe: Invalid server response");
        }

        alert("Recipe updated successfully!");
      } else {
        // Create new recipe
        recipeResponse = await ApiService.recipes.create(recipeData);

        // Check response
        if (!recipeResponse.data) {
          throw new Error("Failed to create recipe: Invalid server response");
        }

        alert("Recipe created successfully!");

        // Get the new recipe ID
        const newRecipeId =
          recipeResponse.data.recipe_id ||
          recipeResponse.data._id ||
          recipeResponse.data.id;

        if (!newRecipeId) {
          throw new Error("Failed to get new recipe ID from server response");
        }

        // Navigate to the new recipe
        navigate(`/recipes/${newRecipeId}`);
      }
    } catch (err) {
      console.error("Error saving recipe:", err);
      console.log("Error response:", err.response?.data);
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
      <h1 className="page-title">
        {recipeId ? "Edit Recipe" : "Create New Recipe"}
      </h1>

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
