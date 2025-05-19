import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import ApiService from "../../services/api";
import { RecipeService } from "../../services/RecipeService";

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
    return <div className="text-center py-10">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
        {error}
      </div>
    );
  }

  if (!recipeId) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mt-4">
        No recipe selected. Please select a recipe to brew.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Start New Brew Session</h1>

      {recipe && (
        <div className="mb-6 p-4 bg-amber-50 rounded-lg">
          <h2 className="text-lg font-semibold">Recipe: {recipe.name}</h2>
          {recipe.style && <p>Style: {recipe.style}</p>}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p>Batch Size: {recipe.batch_size} gallons</p>
              {recipe.estimated_og && (
                <p>Est. OG: {recipe.estimated_og.toFixed(3)}</p>
              )}
              {recipe.estimated_fg && (
                <p>Est. FG: {recipe.estimated_fg.toFixed(3)}</p>
              )}
            </div>
            <div>
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

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-gray-700 font-semibold mb-2"
          >
            Session Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
            required
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="brew_date"
            className="block text-gray-700 font-semibold mb-2"
          >
            Brew Date
          </label>
          <input
            type="date"
            id="brew_date"
            name="brew_date"
            value={formData.brew_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
            required
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="status"
            className="block text-gray-700 font-semibold mb-2"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
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

        <div className="mb-4">
          <label
            htmlFor="notes"
            className="block text-gray-700 font-semibold mb-2"
          >
            Brew Day Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-amber-500"
          ></textarea>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2 hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
          >
            Start Brew Session
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBrewSession;
