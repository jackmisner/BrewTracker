import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import ApiService from "../../services/api";
import RecipeService from "../../services/RecipeService";
import "../../styles/BrewSessions.css";

const CreateBrewSession = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const recipeId = queryParams.get("recipeId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState(null);
  const [formData, setFormData] = useState({
    recipe_id: recipeId,
    name: "",
    brew_date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
    status: "planned",
    notes: "",
  });

  useEffect(() => {
    // If recipeId is provided, fetch the recipe details
    if (recipeId) {
      const fetchRecipeData = async () => {
        try {
          setLoading(true);
          const recipeData = await RecipeService.fetchRecipe(recipeId);
          setRecipe(recipeData);

          // Pre-populate the session name based on recipe
          setFormData((prev) => ({
            ...prev,
            name: `${recipeData.name} - ${new Date().toLocaleDateString()}`,
          }));
        } catch (err) {
          console.error("Error fetching recipe:", err);
          setError("Failed to load recipe details");
        } finally {
          setLoading(false);
        }
      };

      fetchRecipeData();
    } else {
      setLoading(false);
    }
  }, [recipeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // console.log("Creating brew session with data:", formData);
      const response = await ApiService.brewSessions.create(formData);

      // Navigate to the newly created brew session
      navigate(`/brew-sessions/${response.data.session_id}`);
    } catch (err) {
      console.error("Error creating brew session:", err);
      setError(
        `Failed to create brew session: ${
          err.response?.data?.error || err.message || "Unknown error"
        }`
      );
    }
  };

  if (loading) {
    return <div className="loading-message">Loading...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!recipeId) {
    return (
      <div className="warning-message">
        No recipe selected. Please select a recipe to brew.
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">Start New Brew Session</h1>

      {recipe && (
        <div className="recipe-preview">
          <h2>{recipe.name}</h2>
          {recipe.style && <p>{recipe.style}</p>}
          <div className="recipe-preview-metrics">
            <div className="recipe-preview-metric">
              <p>Batch Size: {recipe.batch_size} gallons</p>
              {recipe.estimated_og && (
                <p>Est. OG: {recipe.estimated_og.toFixed(3)}</p>
              )}
              {recipe.estimated_fg && (
                <p>Est. FG: {recipe.estimated_fg.toFixed(3)}</p>
              )}
            </div>
            <div className="recipe-preview-metric">
              {recipe.estimated_abv && (
                <p>Est. ABV: {recipe.estimated_abv.toFixed(1)}%</p>
              )}
              {recipe.estimated_ibu && (
                <p>Est. IBU: {recipe.estimated_ibu.toFixed(1)}</p>
              )}
              {recipe.estimated_srm && (
                <p>Est. SRM: {recipe.estimated_srm.toFixed(1)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="brew-session-form">
        <div className="brew-session-form-group">
          <label htmlFor="name" className="brew-session-form-label">
            Session Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="brew-session-form-control"
            required
          />
        </div>

        <div className="brew-session-form-group">
          <label htmlFor="brew_date" className="brew-session-form-label">
            Brew Date
          </label>
          <input
            type="date"
            id="brew_date"
            name="brew_date"
            value={formData.brew_date}
            onChange={handleChange}
            className="brew-session-form-control"
            required
          />
        </div>

        <div className="brew-session-form-group">
          <label htmlFor="status" className="brew-session-form-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="brew-session-form-control"
            required
          >
            <option value="planned">Planned</option>
            <option value="in-progress">In Progress</option>
            <option value="fermenting">Fermenting</option>
            <option value="conditioning">Conditioning</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="brew-session-form-group">
          <label htmlFor="notes" className="brew-session-form-label">
            Brew Day Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="4"
            className="brew-session-form-control brew-session-form-textarea"
          ></textarea>
        </div>

        <div className="brew-session-form-actions">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="brew-session-form-button brew-session-cancel-button"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="brew-session-form-button brew-session-submit-button"
          >
            Start Brew Session
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBrewSession;
