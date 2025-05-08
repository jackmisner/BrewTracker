import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../../services/api";
import "./RecipeBuilder.css";

// Import components
import RecipeDetails from "./RecipeDetails";
import RecipeMetrics from "./RecipeMetrics";
import IngredientsList from "./IngredientsList";
import GrainInput from "./GrainInput";
import HopInput from "./HopInput";
import YeastInput from "./YeastInput";
import AdjunctInput from "./AdjunctInput";

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
            ingredient_name: ingredientData.ingredient_id,
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

    try {
      const recipeData = {
        ...recipe,
        estimated_og: metrics.og,
        estimated_fg: metrics.fg,
        estimated_abv: metrics.abv,
        estimated_ibu: metrics.ibu,
        estimated_srm: metrics.srm,
      };

      let response;
      if (id) {
        // Update existing recipe
        response = await ApiService.recipes.update(id, recipeData);
      } else {
        // Create new recipe
        response = await ApiService.recipes.create(recipeData);

        // Add any ingredients that were added before saving
        const newRecipeId = response.data.recipe.recipe_id;
        for (const ingredient of recipeIngredients) {
          if (ingredient.id.toString().startsWith("temp-")) {
            // Remove temporary id
            const {
              id: tempId,
              ingredient_name,
              ...ingredientData
            } = ingredient;
            await ApiService.recipes.addIngredient(newRecipeId, ingredientData);
          }
        }
      }

      // Navigate to recipe detail page
      navigate(`/recipes/${response.data.recipe.recipe_id}`);
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError("Failed to save recipe");
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  return (
    <div id="recipe-builder" className="container">
      <h1 className="page-title">{id ? "Edit Recipe" : "Create New Recipe"}</h1>

      <div className="grid">
        {/* Recipe Details Form */}
        <div className="grid-col-2-3">
          <RecipeDetails
            recipe={recipe}
            onChange={handleRecipeChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/recipes")}
            isEditing={!!id}
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
        />

        {/* <div className="grid"> */}
        {/* Grains */}
        <div className="grid-col-2-3">
          <GrainInput
            grains={ingredients.grain}
            onAdd={(data) => addIngredient("grain", data)}
          />
        </div>
        {/* </div> */}

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
