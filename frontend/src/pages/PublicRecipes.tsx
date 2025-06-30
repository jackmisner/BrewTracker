import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import ApiService from "../services/api";
import RecipeCard from "../components/RecipeCard";
import { Recipe, ID } from "../types";

interface Pagination {
  page: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
  total: number;
}

interface PublicRecipeFilters {
  style?: string;
  search?: string;
}

const PublicRecipes: React.FC = () => {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pages: 1,
    has_prev: false,
    has_next: false,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [styleFilter, setStyleFilter] = useState<string>("");

  const fetchPublicRecipes = useCallback(async (searchTerm?: string): Promise<void> => {
    try {
      setLoading(true);
      const filters: PublicRecipeFilters = {};
      if (styleFilter) filters.style = styleFilter;
      if (searchTerm) filters.search = searchTerm;

      const response = await ApiService.recipes.getPublic(currentPage, 12, filters);

      setRecipes(response.data.recipes);
      setPagination(response.data.pagination);
    } catch (err: any) {
      console.error("Error fetching public recipes:", err);
      setError("Failed to load public recipes");
    } finally {
      setLoading(false);
    }
  }, [currentPage, styleFilter]);

  useEffect(() => {
    fetchPublicRecipes();
  }, [currentPage, styleFilter, fetchPublicRecipes]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPublicRecipes(searchQuery);
  };

  const handleCloneRecipe = async (recipeId: ID): Promise<void> => {
    try {
      const response = await ApiService.recipes.clone(recipeId);

      navigate(`/recipes/${(response.data as any).recipe_id}/edit`);
    } catch (err: any) {
      alert("Failed to clone recipe: " + err.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Public Recipe Library</h1>

      {/* Search and Filter Bar */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded"
          />
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="">All Styles</option>
            <option value="IPA">IPA</option>
            <option value="Stout">Stout</option>
            <option value="Lager">Lager</option>
            <option value="Wheat">Wheat Beer</option>
            <option value="Porter">Porter</option>
            <option value="Pale Ale">Pale Ale</option>
          </select>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Search
          </button>
        </form>
      </div>

      {loading && <div className="text-center py-10">Loading...</div>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <div key={recipe.recipe_id} className="recipe-card">
                <RecipeCard recipe={recipe} />
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    by {recipe.username || 'Unknown'}
                  </span>
                  <button
                    onClick={() => handleCloneRecipe(recipe.recipe_id)}
                    className="px-4 py-2 bg-green-500 text-white rounded text-sm"
                  >
                    Clone Recipe
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.has_prev}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.has_next}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PublicRecipes;