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

  const calculateRecipeMetrics = useCallback(async () => {
    try {
      // Log current ingredients for debugging
      // console.log("Calculating metrics with ingredients:", recipeIngredients);
      // console.log("Current recipe state:", recipe);

      if (recipeId) {
        // If recipe exists, get calculated metrics from server
        const response = await ApiService.recipes.calculateMetrics(recipeId);
        // console.log("Server metrics response:", response.data);

        if (response.data) {
          setMetrics({
            og: response.data.og || response.data.avg_og || 1.0,
            fg: response.data.fg || response.data.avg_fg || 1.0,
            abv: response.data.abv || response.data.avg_abv || 0.0,
            ibu: response.data.ibu || 0,
            srm: response.data.srm || 0,
          });
        }
      } else {
        // Client-side estimation for new recipes
        // Make sure we use proper field names
        // console.log("recipeIngredients:", recipeIngredients);
        const mappedIngredients = recipeIngredients.map((ing) => ({
          // Map ingredients to the format expected by calculation functions
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use || "",
          time: parseInt(ing.time) || 0,
          // Include any calculation-specific fields
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          attenuation: ing.attenuation,
        }));

        // console.log("Mapped ingredients for calculation:", mappedIngredients);

        // Now calculate metrics with properly formatted data
        const og = calculateOG(
          mappedIngredients,
          recipe.batch_size,
          recipe.efficiency
        );
        const fg = calculateFG(mappedIngredients, og);
        const abv = calculateABV(og, fg);
        const ibu = calculateIBU(
          mappedIngredients,
          og,
          recipe.batch_size,
          recipe.boil_time
        );
        const srm = calculateSRM(mappedIngredients, recipe.batch_size);

        console.log("Calculated metrics:", { og, fg, abv, ibu, srm });

        // Update the metrics state with new values
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
      setRecipe(response.data);

      // Use ingredients directly from recipe response
      setRecipeIngredients(response.data.ingredients || []);

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
      // Create new ingredient object
      const newIngredient = {
        id: `temp-${Date.now()}`, // Temporary ID for client-side tracking
        ingredient_id: ingredientData.ingredient_id,
        name: getIngredientName(ingredientData.ingredient_id, type),
        type: type,
        amount: ingredientData.amount,
        unit: ingredientData.unit,
        use: ingredientData.use || "",
        time: ingredientData.time || 0,
        // Include any calculation-specific fields
        ...getIngredientData(ingredientData.ingredient_id, type),
      };

      // Update state using the callback form to ensure we have the latest state
      const updatedIngredients = [...recipeIngredients, newIngredient];
      setRecipeIngredients(updatedIngredients);

      // If editing an existing recipe, update it on the server
      if (recipeId) {
        const updatedRecipe = {
          ...recipe,
          ingredients: updatedIngredients,
        };
        await ApiService.recipes.update(recipeId, updatedRecipe);
      }
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
      return { potential: ingredient.potential, color: ingredient.color };
    } else if (type === "hop") {
      return { alpha_acid: ingredient.alpha_acid };
    } else if (type === "yeast") {
      return { attenuation: ingredient.attenuation };
    }
    return {};
  };

  const removeIngredient = async (ingredientId) => {
    try {
      // Remove from local state
      const updatedIngredients = recipeIngredients.filter(
        (i) => i.id !== ingredientId
      );
      setRecipeIngredients(updatedIngredients);

      // If recipe exists, update it on the server with the filtered ingredients
      if (recipeId) {
        const updatedRecipe = {
          ...recipe,
          ingredients: updatedIngredients,
        };
        await ApiService.recipes.update(recipeId, updatedRecipe);
      }
    } catch (err) {
      console.error("Error removing ingredient:", err);
      setError("Failed to remove ingredient");
    }
  };

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
    // console.log(
    //   `Recipe scaled from ${currentBatchSize} to ${newBatchSize} gallons`
    // );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Log current state for debugging
      // console.log("Current recipe:", recipe);
      // console.log("Current recipe ingredients:", recipeIngredients);
      // console.log("Current metrics:", metrics);

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
      // Make sure we're using the field names expected by the MongoDB model
      const formattedIngredients = recipeIngredients.map((ing) => {
        return {
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          type: ing.type,
          amount: parseFloat(ing.amount),
          unit: ing.unit,
          use: ing.use || "",
          time: parseInt(ing.time) || 0,
          // Include any calculation-specific fields if needed
          potential: ing.potential,
          color: ing.color,
          alpha_acid: ing.alpha_acid,
          attenuation: ing.attenuation,
        };
      });

      // Add ingredients to recipe data
      recipeData.ingredients = formattedIngredients;

      // console.log("Sending data to server:", recipeData);

      let recipeResponse;

      if (recipeId) {
        // Update existing recipe
        recipeResponse = await ApiService.recipes.update(recipeId, recipeData);

        // console.log("Update recipe response:", recipeResponse);

        if (!recipeResponse.data) {
          throw new Error("Failed to update recipe: Invalid server response");
        }

        alert("Recipe updated successfully!");
      } else {
        // Create new recipe
        recipeResponse = await ApiService.recipes.create(recipeData);

        // console.log("Create recipe response:", recipeResponse);

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
