import React, { useState, useEffect } from "react";
import ApiService from "../services/api";
import RecipeCardContainer from "../components/RecipeCardContainer";
import { useNavigate } from "react-router";
import { Recipe } from "../types";

const AllRecipes: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [refresh, setRefresh] = useState<number>(0);
  const navigate = useNavigate();

  const fetchRecipes = async (): Promise<void> => {
    try {
      setLoading(true);
      const recipesResponse = await ApiService.recipes.getAll();
      if (recipesResponse.status !== 200) {
        throw new Error("Failed to fetch recipes");
      }
      const sortedRecipes = recipesResponse.data.recipes
        .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())
        .slice(0, 5);
      setRecipes(sortedRecipes);
    } catch (err: any) {
      console.error("Error fetching recipes:", err);
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  // Function to trigger a refresh of the recipes
  const refreshTrigger = (): void => {
    setRefresh((prev) => prev + 1);
  };

  // Fetch recipes when the component mounts or when refresh is triggered
  useEffect(() => {
    fetchRecipes();
  }, [refresh]);

  return (
    <div className="container mx-auto px-4 py-6">
      {loading && <div className="text-center py-10">Loading...</div>}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
          {error}
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="text-center py-10">No recipes found.</div>
      )}
      <button
        onClick={() => navigate("/recipes/new")}
        className="primary-button"
      >
        + New Recipe
      </button>

      {!loading && !error && recipes.length > 0 && (
        <RecipeCardContainer
          recipes={recipes}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  );
};

export default AllRecipes;