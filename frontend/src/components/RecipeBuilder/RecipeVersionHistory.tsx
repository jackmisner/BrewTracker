import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import ApiService from "@/services/api";
import { ID } from "@/types";

interface RecipeVersionHistoryProps {
  recipeId: ID;
  version: number;
  parentRecipeId?: ID | null;
}

interface VersionHistoryData {
  parent_recipe?: {
    recipe_id: ID;
    name: string;
    version: number;
  };
  child_versions?: Array<{
    recipe_id: ID;
    name: string;
    version: number;
  }>;
}

const RecipeVersionHistory: React.FC<RecipeVersionHistoryProps> = ({
  recipeId,
  version,
  parentRecipeId,
}) => {
  const [versionHistory, setVersionHistory] =
    useState<VersionHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) return;

    const fetchVersionHistory = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await ApiService.recipes.getVersionHistory(recipeId);
        setVersionHistory(response.data as VersionHistoryData);
      } catch (err: any) {
        console.error("Error fetching version history:", err);
        setError("Failed to load version history");
      } finally {
        setLoading(false);
      }
    };

    // Only fetch history if this is a versioned recipe
    if (version > 1 || parentRecipeId) {
      fetchVersionHistory();
    } else {
      setLoading(false);
    }
  }, [recipeId, version, parentRecipeId]);

  if (!version || (version <= 1 && !parentRecipeId)) {
    return null; // No version history to display
  }

  if (loading) {
    return (
      <div className="version-history-loading">Loading version history...</div>
    );
  }

  if (error) {
    return <div className="version-history-error">{error}</div>;
  }

  return (
    <div className="version-history">
      <h3 className="version-history-title">Recipe Version History</h3>

      {versionHistory?.parent_recipe && (
        <div className="parent-version">
          <h4>Based on:</h4>
          <Link
            to={`/recipes/${versionHistory.parent_recipe.recipe_id}`}
            className="parent-link"
          >
            {versionHistory.parent_recipe.name}
          </Link>
        </div>
      )}

      <div className="current-version">
        <h4>Current Version:</h4>
        <div className="version-badge">v{version}</div>
      </div>

      {versionHistory?.child_versions &&
        versionHistory.child_versions.length > 0 && (
          <div className="child-versions">
            <h4>Derived Recipes:</h4>
            <ul className="derived-recipes-list">
              {versionHistory.child_versions.map(v => (
                <li key={v.recipe_id}>
                  <Link to={`/recipes/${v.recipe_id}`}>
                    {v.name} (v{v.version})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
};

export default RecipeVersionHistory;
