import React, { useState, useEffect } from "react";
import ApiService from "../services/api";
import RecipeCardContainer from "../components/RecipeCardContainer";

const AllRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const recipesResponse = await ApiService.recipes.getAll();
      if (recipesResponse.status !== 200) {
        throw new Error("Failed to fetch recipes");
      }
      const sortedRecipes = recipesResponse.data.recipes
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);
      setRecipes(sortedRecipes);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  // Function to trigger a refresh of the recipes
  const refreshTrigger = () => {
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
