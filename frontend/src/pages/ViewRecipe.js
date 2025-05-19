import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ApiService from "../services/api";
import RecipeMetrics from "../components/RecipeBuilder/RecipeMetrics";
import RecipeVersionHistory from "../components/RecipeBuilder/RecipeVersionHistory";
import RecipeActions from "../components/RecipeActions";
import "../styles/ViewRecipe.css";

const ViewRecipe = () => {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        setLoading(true);
        const response = await ApiService.recipes.getById(recipeId);
        setRecipe(response.data);
        setIngredients(response.data.ingredients || []);
      } catch (err) {
        console.error("Error fetching recipe:", err);
        setError("Failed to load recipe");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId]);

  if (loading) {
    return <div className="text-center py-10">Loading recipe...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  if (!recipe) {
    return <div className="text-center py-10">Recipe not found</div>;
  }

  // Group ingredients by type
  const groupedIngredients = ingredients.reduce((acc, ingredient) => {
    const type = ingredient.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(ingredient);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="recipe-header">
        <h1 className="recipe-title">{recipe.name}</h1>
        {recipe.style && <p className="recipe-style">{recipe.style}</p>}
        {recipe.version > 1 && (
          <div className="recipe-version-badge">Version: {recipe.version}</div>
        )}
      </div>

      <RecipeActions recipe={recipe} showViewButton={false} />

      <div className="recipe-content">
        <div className="recipe-details">
          <div className="recipe-section">
            <h2 className="section-title">Recipe Details</h2>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Batch Size:</span>
                <span className="detail-value">
                  {recipe.batch_size} gallons
                </span>
              </div>
              {recipe.boil_time && (
                <div className="detail-item">
                  <span className="detail-label">Boil Time:</span>
                  <span className="detail-value">
                    {recipe.boil_time} minutes
                  </span>
                </div>
              )}
              {recipe.efficiency && (
                <div className="detail-item">
                  <span className="detail-label">Efficiency:</span>
                  <span className="detail-value">{recipe.efficiency}%</span>
                </div>
              )}
            </div>
          </div>

          {recipe.description && (
            <div className="recipe-section">
              <h2 className="section-title">Description</h2>
              <p className="recipe-description">{recipe.description}</p>
            </div>
          )}

          <div className="recipe-section">
            <h2 className="section-title">Recipe Metrics</h2>
            <RecipeMetrics
              metrics={{
                og: recipe.estimated_og,
                fg: recipe.estimated_fg,
                abv: recipe.estimated_abv,
                ibu: recipe.estimated_ibu,
                srm: recipe.estimated_srm,
              }}
            />
          </div>

          <div className="recipe-section">
            <h2 className="section-title">Ingredients</h2>
            {Object.keys(groupedIngredients).length === 0 ? (
              <p>No ingredients added to this recipe.</p>
            ) : (
              Object.entries(groupedIngredients).map(([type, items]) => (
                <div key={type} className="ingredient-group">
                  <h3 className="ingredient-type-title">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </h3>
                  <table className="ingredients-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Amount</th>
                        <th>Use</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ingredient, index) => (
                        <tr key={index}>
                          <td className="ingredient-name">{ingredient.name}</td>
                          <td>
                            {ingredient.amount} {ingredient.unit}
                          </td>
                          <td>{ingredient.use || "-"}</td>
                          <td>
                            {ingredient.time ? `${ingredient.time} min` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>

          {recipe.notes && (
            <div className="recipe-section">
              <h2 className="section-title">Brewing Notes</h2>
              <p className="recipe-notes">{recipe.notes}</p>
            </div>
          )}

          {/* Version History */}
          {(recipe.version > 1 || recipe.parent_recipe_id) && (
            <RecipeVersionHistory
              recipeId={recipe.recipe_id}
              version={recipe.version}
              parentRecipeId={recipe.parent_recipe_id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewRecipe;
