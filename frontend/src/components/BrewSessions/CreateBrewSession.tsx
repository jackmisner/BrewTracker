import React, { useReducer, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Services } from "../../services";
import { invalidateBrewSessionCaches } from "../../services/CacheManager";
// Recipe type used in state interface
import {
  brewSessionReducer,
  createInitialBrewSessionState,
  type CreateBrewSessionFormData,
} from "../../reducers";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
} from "../../utils/formatUtils";
import "../../styles/BrewSessions.css";

// Interface now imported from reducer

const CreateBrewSession: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const recipeId = queryParams.get("recipeId");

  // Initialize reducer
  const [state, dispatch] = useReducer(
    brewSessionReducer,
    createInitialBrewSessionState("create", recipeId)
  );

  // Destructure state for cleaner access
  const { loading, creating, error, recipe, formData } = state;

  useEffect(() => {
    // If recipeId is provided, fetch the recipe details
    if (recipeId) {
      const fetchRecipeData = async (): Promise<void> => {
        try {
          dispatch({ type: "FETCH_START" });
          const recipeData = await Services.recipe.fetchRecipe(recipeId);
          dispatch({ type: "FETCH_SUCCESS", payload: { recipe: recipeData } });

          // Pre-populate the session name based on recipe
          dispatch({
            type: "UPDATE_FORM_FIELD",
            payload: {
              field: "name",
              value: `${recipeData.name} - ${new Date().toLocaleDateString()}`,
            },
          });
        } catch (err: any) {
          console.error("Error fetching recipe:", err);
          dispatch({
            type: "FETCH_ERROR",
            payload: "Failed to load recipe details",
          });
        }
      };

      fetchRecipeData();
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [recipeId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ): void => {
    const { name, value } = e.target;
    dispatch({
      type: "UPDATE_FORM_FIELD",
      payload: { field: name, value },
    });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    try {
      dispatch({ type: "SUBMIT_START" });

      // Convert form data to session data, ensuring recipe_id is not null
      const sessionData = {
        ...(formData as CreateBrewSessionFormData),
        recipe_id:
          (formData as CreateBrewSessionFormData).recipe_id || undefined,
      };

      // Create the brew session using the service
      const newSession =
        await Services.brewSession.createBrewSession(sessionData);

      // Invalidate caches to update all related components
      invalidateBrewSessionCaches.onCreated({
        session_id: newSession.session_id,
        recipe_id: newSession.recipe_id,
      });

      // Navigate to the newly created brew session
      navigate(`/brew-sessions/${newSession.session_id}`);
    } catch (err: any) {
      console.error("Error creating brew session:", err);
      dispatch({
        type: "SUBMIT_ERROR",
        payload:
          err.message ||
          `Failed to create brew session: ${
            err.response?.data?.error || "Unknown error"
          }`,
      });
    }
  };

  const handleErrorDismiss = (): void => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  if (loading) {
    return <div className="loading-message">Loading...</div>;
  }

  if (error && !recipe && recipeId) {
    return (
      <div role="alert" className="error-message">
        {error}
      </div>
    );
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

      {error && (
        <div
          role="alert"
          className="error-message"
          style={{ marginBottom: "1rem" }}
        >
          {error}
          <button
            onClick={handleErrorDismiss}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              marginLeft: "10px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {recipe && (
        <div data-testid="recipe-preview" className="recipe-preview">
          <h2>{recipe.name}</h2>
          {recipe.style && <p>{recipe.style}</p>}
          <div className="recipe-preview-metrics">
            <div className="recipe-preview-metric">
              <p>Batch Size: {recipe.batch_size} gallons</p>
              {recipe.estimated_og && (
                <p>Est. OG: {formatGravity(recipe.estimated_og)}</p>
              )}
              {recipe.estimated_fg && (
                <p>Est. FG: {formatGravity(recipe.estimated_fg)}</p>
              )}
            </div>
            <div className="recipe-preview-metric">
              {recipe.estimated_abv && (
                <p>Est. ABV: {formatAbv(recipe.estimated_abv)}</p>
              )}
              {recipe.estimated_ibu && (
                <p>Est. IBU: {formatIbu(recipe.estimated_ibu)}</p>
              )}
              {recipe.estimated_srm && (
                <p>Est. SRM: {formatSrm(recipe.estimated_srm)}</p>
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
            disabled={creating}
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
            disabled={creating}
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
            disabled={creating}
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
            value={(formData as CreateBrewSessionFormData).notes}
            onChange={handleChange}
            rows={4}
            className="brew-session-form-control brew-session-form-textarea"
            disabled={creating}
          ></textarea>
        </div>

        <div className="brew-session-form-actions">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="brew-session-form-button brew-session-cancel-button"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="brew-session-form-button brew-session-submit-button"
            disabled={creating}
          >
            {creating ? "Creating..." : "Start Brew Session"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBrewSession;
