import React, { useState, useEffect } from "react";
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

function RecipeBuilder() {
  const { id } = useParams();
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
    if (id) {
      fetchRecipe(id);
    } else {
      setLoading(false);
    }
  }, [id]);

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
    // console.log("ingredientData:", ingredientData);
    try {
      // If recipe exists, add ingredient to it
      if (id) {
        const response = await ApiService.recipes.addIngredient(id, {
          ...ingredientData,
          ingredient_type: type,
        });
        // Add new ingredient to the list
        setRecipeIngredients([...recipeIngredients, response.data]);
      } else {
        // If no recipe yet, store ingredient temporarily
        setRecipeIngredients([
          ...recipeIngredients,
          {
            id: `temp-${Date.now()}`,
            ingredient_id: ingredientData.ingredient_id,
            ingredient_name: getIngredientName(
              ingredientData.ingredient_id,
              type,
            ),
            amount: ingredientData.amount,
            unit: ingredientData.unit,
            ingredient_type: type,
            use: ingredientData.use,
            time: ingredientData.time,
            time_unit: ingredientData.time_unit,
          },
        ]);
      }

      // Recalculate metrics
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

  const removeIngredient = async (ingredientId) => {
    try {
      if (id && !ingredientId.toString().startsWith("temp-")) {
        // If recipe exists and ingredient is saved, remove from database
        await ApiService.recipes.removeIngredient(id, ingredientId);
      }

      // Remove from local state
      setRecipeIngredients(
        recipeIngredients.filter((i) => i.id !== ingredientId),
      );

      // Recalculate metrics
      calculateRecipeMetrics();
    } catch (err) {
      console.error("Error removing ingredient:", err);
      setError("Failed to remove ingredient");
    }
  };

  const calculateRecipeMetrics = async () => {
    try {
      if (id) {
        // If recipe exists, get calculated metrics from server
        const response = await ApiService.recipes.calculateMetrics(id);
        setMetrics(response.data.metrics);
      } else {
        // Client-side estimation for new recipes
        // This is simplified - the server would do more accurate calculations
        let og = 1.0;
        let srm = 0;
        let ibu = 0;

        // Simple OG calculation based on grain amounts
        const grains = recipeIngredients.filter(
          (i) => i.ingredient_type === "grain",
        );
        grains.forEach((grain) => {
          // Assume basic contribution to gravity
          const gravityPoints = 0.036 * parseFloat(grain.amount); // Very simplified (assumes all grains are 36 ppg) and doesn't take into account batch size
          og += gravityPoints;
        });

        // Simple SRM calculation
        grains.forEach((grain) => {
          // Simplified SRM contribution
          const srmContribution = 0.2 * parseFloat(grain.amount); // Very simplified
          srm += srmContribution;
        });

        // Simple IBU calculation
        const hops = recipeIngredients.filter(
          (i) => i.ingredient_type === "hop",
        );
        hops.forEach((hop) => {
          // Simplified IBU contribution
          const ibuContribution = 5 * parseFloat(hop.amount); // Very simplified
          ibu += ibuContribution;
        });

        // Simple FG and ABV calculation
        const fg = og - 0.005; // Very simplified
        const abv = (og - fg) * 131.25;

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
  };

  const handleScaleRecipe = (newBatchSize) => {
    // Implement recipe scaling logic here
    console.log("Scaling recipe to", newBatchSize, "gallons");
    // Would need to update all ingredient amounts proportionally
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
      let newRecipeId = id;

      if (id) {
        // Update existing recipe
        recipeResponse = await ApiService.recipes.update(id, recipeData);
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
      <h1 className="page-title">{id ? "Edit Recipe" : "Create New Recipe"}</h1>

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
            isEditing={!!id || true}
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
          isEditing={!!id || true}
        />

        {/* Grains */}
        <div className="grid-col-2-3">
          <GrainInput
            grains={ingredients.grain}
            onAdd={(data) => addIngredient("grain", data)}
          />
        </div>

        {/* Hops */}
        <HopInput
          hops={ingredients.hop}
          onAdd={(data) => addIngredient("hop", data)}
        />

        {/* Yeast */}
        <YeastInput
          yeasts={ingredients.yeast}
          onAdd={(data) => addIngredient("yeast", data)}
        />

        {/* Adjuncts  */}
        <AdjunctInput
          adjuncts={ingredients.adjunct}
          onAdd={(data) => addIngredient("adjunct", data)}
        />
      </div>
    </div>
  );
}

export default RecipeBuilder;
