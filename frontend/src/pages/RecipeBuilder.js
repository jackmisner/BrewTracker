import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../services/api";

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

  // Form state for adding ingredients
  const [grainForm, setGrainForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "lb",
  });
  const [hopForm, setHopForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "oz",
    use: "boil",
    time: 60,
  });
  const [yeastForm, setYeastForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "pkg",
  });
  const [adjunctForm, setAdjunctForm] = useState({
    ingredient_id: "",
    amount: "",
    unit: "oz",
    use: "boil",
    time: 0,
  });

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
      // console.log("Fetching ingredients:", response.data);
      // Group ingredients by type
      const grouped = {
        grain: [],
        hop: [],
        yeast: [],
        adjunct: [],
      };

      response.data.ingredients.forEach((ingredient) => {
        if (grouped[ingredient.type]) {
          // console.log("Adding ingredient:", ingredient.name);
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

  const handleRecipeChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRecipe({
      ...recipe,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleFormChange = (type, e) => {
    const { name, value } = e.target;
    switch (type) {
      case "grain":
        setGrainForm({ ...grainForm, [name]: value });
        break;
      case "hop":
        setHopForm({ ...hopForm, [name]: value });
        break;
      case "yeast":
        setYeastForm({ ...yeastForm, [name]: value });
        break;
      case "adjunct":
        setAdjunctForm({ ...adjunctForm, [name]: value });
        break;
      default:
        break;
    }
  };

  const addIngredient = async (type) => {
    console.log("Trying to add ingredient to recipe");

    // Define ingredientData based on type
    let ingredientData;
    switch (type) {
      case "grain":
        ingredientData = { ...grainForm, ingredient_type: "grain" };
        break;
      case "hop":
        ingredientData = { ...hopForm, ingredient_type: "hop" };
        break;
      case "yeast":
        ingredientData = { ...yeastForm, ingredient_type: "yeast" };
        break;
      case "adjunct":
        ingredientData = { ...adjunctForm, ingredient_type: "adjunct" };
        break;
      default:
        return;
    }

    console.log("ingredientData for ingredient trying to add:", ingredientData);
    console.log(
      "recipeIngredients before adding new ingredient:",
      recipeIngredients,
    );
    try {
      // If recipe exists, add ingredient to it
      if (id) {
        console.log("Adding ingredient to EXISTING recipe");
        const response = await ApiService.recipes.addIngredient(
          id,
          ingredientData,
        );
        // Add new ingredient to the list
        setRecipeIngredients([...recipeIngredients, response.data]);
      } else {
        console.log(
          "Recipe doesn't exist yet - Adding ingredient to NEW recipe",
        );
        // If no recipe yet, store ingredient temporarily
        setRecipeIngredients([
          ...recipeIngredients,
          {
            // ...ingredientData,
            id: `temp-${Date.now()}`,
            // ingredient_name: getIngredientName(
            //   type,
            //   ingredientData.ingredient_id,
            ingredient_name: ingredientData.ingredient_id,
            amount: ingredientData.amount,
            unit: ingredientData.unit,
            ingredient_type: ingredientData.ingredient_type,
          },
        ]);
        console.log("recipeIngredients:", recipeIngredients);
      }

      // Reset the form
      switch (type) {
        case "grain":
          setGrainForm({ ingredient_id: "", amount: "", unit: "lb" });
          break;
        case "hop":
          setHopForm({
            ingredient_id: "",
            amount: "",
            unit: "oz",
            use: "boil",
            time: 60,
          });
          break;
        case "yeast":
          setYeastForm({ ingredient_id: "", amount: "", unit: "pkg" });
          break;
        case "adjunct":
          setAdjunctForm({
            ingredient_id: "",
            amount: "",
            unit: "oz",
            use: "boil",
            time: 0,
          });
          break;
        default:
          break;
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

  const getIngredientName = (type, ingredientId) => {
    console.log("Getting ingredient name for type:", type);
    const ingredient = ingredients[type].find(
      (i) => i.id.toString() === ingredientId.toString(),
    );
    return ingredient ? ingredient.name : "Unknown Ingredient";
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
          const gravityPoints = 0.036 * parseFloat(grain.amount); // Very simplified
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

  const formatGravity = (gravity) => {
    return gravity ? parseFloat(gravity).toFixed(3) : "1.000";
  };

  const formatAbv = (abv) => {
    return abv ? `${parseFloat(abv).toFixed(1)}%` : "0.0%";
  };

  const formatIbu = (ibu) => {
    return ibu ? Math.round(ibu).toString() : "0";
  };

  const formatSrm = (srm) => {
    return srm ? parseFloat(srm).toFixed(1) : "0.0";
  };

  const getSrmColor = (srm) => {
    if (!srm || srm <= 0) return "#FFE699";
    if (srm <= 2) return "#FFD878";
    if (srm <= 3) return "#FFCA5A";
    if (srm <= 4) return "#FFBF42";
    if (srm <= 6) return "#FBB123";
    if (srm <= 8) return "#F8A600";
    if (srm <= 10) return "#F39C00";
    if (srm <= 13) return "#EA8F00";
    if (srm <= 17) return "#E58500";
    if (srm <= 20) return "#D37600";
    if (srm <= 24) return "#CB6600";
    if (srm <= 29) return "#C05600";
    if (srm <= 35) return "#A64C00";
    return "#8D4000";
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
    <div id="recipe-builder" className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {id ? "Edit Recipe" : "Create New Recipe"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recipe Details Form */}
        <div className="lg:col-span-2">
          <form
            id="recipe-form"
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Recipe Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Recipe Name*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={recipe.name}
                  onChange={handleRecipeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="style"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Style
                </label>
                <input
                  type="text"
                  id="style"
                  name="style"
                  value={recipe.style}
                  onChange={handleRecipeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="batch_size"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Batch Size (gallons)*
                </label>
                <input
                  type="number"
                  id="batch_size"
                  name="batch_size"
                  value={recipe.batch_size}
                  onChange={handleRecipeChange}
                  step="0.1"
                  min="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="boil_time"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Boil Time (minutes)
                </label>
                <input
                  type="number"
                  id="boil_time"
                  name="boil_time"
                  value={recipe.boil_time}
                  onChange={handleRecipeChange}
                  step="5"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-gray-700 font-medium mb-1"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={recipe.description}
                onChange={handleRecipeChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="efficiency"
                  className="block text-gray-700 font-medium mb-1"
                >
                  Efficiency (%)
                </label>
                <input
                  type="number"
                  id="efficiency"
                  name="efficiency"
                  value={recipe.efficiency}
                  onChange={handleRecipeChange}
                  step="1"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  id="is_public"
                  name="is_public"
                  checked={recipe.is_public}
                  onChange={handleRecipeChange}
                  className="mr-2"
                />
                <label htmlFor="is_public" className="text-gray-700">
                  Make Recipe Public
                </label>
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="notes"
                className="block text-gray-700 font-medium mb-1"
              >
                Brewer's Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={recipe.notes}
                onChange={handleRecipeChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
              ></textarea>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/recipes")}
                className="px-4 py-2 border border-gray-300 rounded mr-2 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                {id ? "Update Recipe" : "Create Recipe"}
              </button>
            </div>
          </form>
        </div>

        {/* Recipe Metrics */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Recipe Metrics</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center">
                <div className="text-gray-600 text-sm">Original Gravity</div>
                <div id="og-display" className="text-2xl font-bold">
                  {formatGravity(metrics.og)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-600 text-sm">Final Gravity</div>
                <div id="fg-display" className="text-2xl font-bold">
                  {formatGravity(metrics.fg)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-600 text-sm">ABV</div>
                <div id="abv-display" className="text-2xl font-bold">
                  {formatAbv(metrics.abv)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-600 text-sm">IBU</div>
                <div id="ibu-display" className="text-2xl font-bold">
                  {formatIbu(metrics.ibu)}
                </div>
              </div>
            </div>

            <div className="flex items-center mb-4">
              <div className="mr-3">
                <div className="text-gray-600 text-sm">Color</div>
                <div id="srm-display" className="text-lg font-bold">
                  {formatSrm(metrics.srm)} SRM
                </div>
              </div>
              <div
                id="color-swatch"
                className="w-16 h-16 rounded-full border border-gray-300"
                style={{ backgroundColor: getSrmColor(metrics.srm) }}
              ></div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Malty</span>
                <span>Balanced</span>
                <span>Hoppy</span>
              </div>
              <div className="h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  id="balance-meter-progress"
                  className="h-full bg-amber-600"
                  style={{
                    width: `${Math.min((metrics.ibu / ((metrics.og - 1) * 1000) / 2) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <div
                id="balance-description"
                className="text-center text-sm mt-1"
              >
                {/* Balance description */}
                {metrics.ibu === 0
                  ? "Not calculated"
                  : metrics.ibu / ((metrics.og - 1) * 1000) < 0.3
                    ? "Very Malty"
                    : metrics.ibu / ((metrics.og - 1) * 1000) < 0.6
                      ? "Malty"
                      : metrics.ibu / ((metrics.og - 1) * 1000) < 0.8
                        ? "Balanced (Malt)"
                        : metrics.ibu / ((metrics.og - 1) * 1000) < 1.2
                          ? "Balanced"
                          : metrics.ibu / ((metrics.og - 1) * 1000) < 1.5
                            ? "Balanced (Hoppy)"
                            : metrics.ibu / ((metrics.og - 1) * 1000) < 2.0
                              ? "Hoppy"
                              : "Very Hoppy"}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Recipe Scaling</h3>
              <div className="flex">
                <input
                  type="number"
                  id="scale-volume"
                  name="scale-volume"
                  placeholder="New batch size"
                  step="0.1"
                  min="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  id="scale-recipe-btn"
                  type="button"
                  className="px-4 py-2 bg-amber-600 text-white rounded-r hover:bg-amber-700"
                >
                  Scale
                </button>
              </div>
            </div>
          </div>

          <button
            id="calculate-recipe-btn"
            type="button"
            onClick={calculateRecipeMetrics}
            className="w-full px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 mb-6"
          >
            Calculate Recipe
          </button>
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">Ingredients</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fermentables */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Fermentables</h3>

            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <select
                    id="grain-select"
                    name="ingredient_id"
                    value={grainForm.ingredient_id}
                    onChange={(e) => handleFormChange("grain", e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select Grains</option>
                    {ingredients.grain.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex">
                    <input
                      type="number"
                      id="grain-amount"
                      name="amount"
                      value={grainForm.amount}
                      onChange={(e) => handleFormChange("grain", e)}
                      step="0.1"
                      min="0"
                      placeholder="Amount"
                      className="w-full px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      id="grain-unit"
                      name="unit"
                      value={grainForm.unit}
                      onChange={(e) => handleFormChange("grain", e)}
                      className="px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="lb">lb</option>
                      <option value="oz">oz</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    id="add-grain-btn"
                    type="button"
                    onClick={() => addIngredient("grain")}
                    className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full ingredients-table-grain">
                <thead>
                  <tr className="bg-amber-50">
                    <th className="px-4 py-2 text-left">Fermentable</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recipeIngredients
                    .filter((i) => i.ingredient_type === "grain")
                    .map((ingredient) => (
                      <tr
                        key={ingredient.id}
                        id={`ingredient-row-${ingredient.id}`}
                        className="ingredient-row border-b"
                      >
                        <td className="px-4 py-2">
                          <strong>{ingredient.ingredient_name}</strong>
                        </td>
                        <td className="px-4 py-2">
                          {ingredient.amount} {ingredient.unit}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="px-2 py-1 text-red-600 hover:text-red-800"
                            onClick={() => removeIngredient(ingredient.id)}
                          >
                            <i className="fas fa-trash-alt"></i> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Hops */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-xl font-semibold mb-4">Hops</h3>

          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <select
                  id="hop-select"
                  name="ingredient_id"
                  value={hopForm.ingredient_id}
                  onChange={(e) => handleFormChange("hop", e)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Hop</option>
                  {ingredients.hop.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex">
                  <input
                    type="number"
                    id="hop-amount"
                    name="amount"
                    value={hopForm.amount}
                    onChange={(e) => handleFormChange("hop", e)}
                    step="0.1"
                    min="0"
                    placeholder="Amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    id="hop-unit"
                    name="unit"
                    value={hopForm.unit}
                    onChange={(e) => handleFormChange("hop", e)}
                    className="px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="oz">oz</option>
                    <option value="g">g</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  id="hop-use"
                  name="use"
                  value={hopForm.use}
                  onChange={(e) => handleFormChange("hop", e)}
                  placeholder="Use (e.g., Boil, Dry Hop)"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <button
                  id="add-hop-btn"
                  type="button"
                  onClick={() => addIngredient("hop")}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Yeast */}
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-4">Yeast</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <select
                  id="yeast-select"
                  name="ingredient_id"
                  value={yeastForm.ingredient_id}
                  onChange={(e) => handleFormChange("yeast", e)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Yeast</option>
                  {ingredients.yeast.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex">
                  <input
                    type="number"
                    id="yeast-amount"
                    name="amount"
                    value={yeastForm.amount}
                    onChange={(e) => handleFormChange("yeast", e)}
                    step="0.1"
                    min="0"
                    placeholder="Amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    id="yeast-unit"
                    name="unit"
                    value={yeastForm.unit}
                    onChange={(e) => handleFormChange("yeast", e)}
                    className="px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="pkg">pkg</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  id="add-yeast-btn"
                  type="button"
                  onClick={() => addIngredient("yeast")}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Adjuncts */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h3 className="text-xl font-semibold mb-4">Adjuncts</h3>

            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <select
                    id="adjunct-select"
                    name="ingredient_id"
                    value={adjunctForm.ingredient_id}
                    onChange={(e) => handleFormChange("adjunct", e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select Adjunct</option>
                    {ingredients.adjunct.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex">
                    <input
                      type="number"
                      id="adjunct-amount"
                      name="amount"
                      value={adjunctForm.amount}
                      onChange={(e) => handleFormChange("adjunct", e)}
                      step="0.1"
                      min="0"
                      placeholder="Amount"
                      className="w-full px-3 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                      id="adjunct-unit"
                      name="unit"
                      value={adjunctForm.unit}
                      onChange={(e) => handleFormChange("adjunct", e)}
                      className="px-3 py-2 border border-gray-300 rounded-r focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="oz">oz</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    id="add-adjunct-btn"
                    type="button"
                    onClick={() => addIngredient("adjunct")}
                    className="w-full px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default RecipeBuilder;
