import React, { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import ApiService from "../services/api";
import CompactRecipeCard from "../components/CompactRecipeCard";
import { useNavigate } from "react-router";
import { Recipe } from "../types";
import "../styles/AllRecipes.css";

const AllRecipes: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updated_at_desc");
  const navigate = useNavigate();

  const fetchRecipes = async (): Promise<void> => {
    try {
      setLoading(true);
      // Fetch all user recipes by using a large page size to avoid pagination limits
      // Default API call only returns first 10 recipes due to pagination
      const recipesResponse = await ApiService.recipes.getAll(1, 1000);
      if (recipesResponse.status !== 200) {
        throw new Error("Failed to fetch recipes");
      }
      // Don't sort here - we'll sort later based on user selection
      setRecipes(recipesResponse.data.recipes || []);
    } catch (err: any) {
      console.error("Error fetching recipes:", err);
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (!recipes || recipes.length === 0) return null;

    return new Fuse(recipes, {
      keys: [
        { name: "name", weight: 1.0 },
        { name: "style", weight: 0.8 },
        { name: "description", weight: 0.6 },
        { name: "notes", weight: 0.4 },
        { name: "username", weight: 0.3 },
      ],
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 100,
      minMatchCharLength: 1,
      includeScore: false,
      includeMatches: false,
      ignoreLocation: true,
      useExtendedSearch: false,
    });
  }, [recipes]);

  // Sort recipes based on selected criteria
  const sortRecipes = (recipesToSort: Recipe[]): Recipe[] => {
    const sorted = [...recipesToSort];

    switch (sortBy) {
      case "name_asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name_desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "created_at_asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.created_at || "").getTime() -
            new Date(b.created_at || "").getTime()
        );
      case "created_at_desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at || "").getTime() -
            new Date(a.created_at || "").getTime()
        );
      case "updated_at_asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.updated_at || "").getTime() -
            new Date(b.updated_at || "").getTime()
        );
      case "updated_at_desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.updated_at || "").getTime() -
            new Date(a.updated_at || "").getTime()
        );
      case "abv_asc":
        return sorted.sort(
          (a, b) => (a.estimated_abv || 0) - (b.estimated_abv || 0)
        );
      case "abv_desc":
        return sorted.sort(
          (a, b) => (b.estimated_abv || 0) - (a.estimated_abv || 0)
        );
      case "ibu_asc":
        return sorted.sort(
          (a, b) => (a.estimated_ibu || 0) - (b.estimated_ibu || 0)
        );
      case "ibu_desc":
        return sorted.sort(
          (a, b) => (b.estimated_ibu || 0) - (a.estimated_ibu || 0)
        );
      case "srm_asc":
        return sorted.sort(
          (a, b) => (a.estimated_srm || 0) - (b.estimated_srm || 0)
        );
      case "srm_desc":
        return sorted.sort(
          (a, b) => (b.estimated_srm || 0) - (a.estimated_srm || 0)
        );
      case "og_asc":
        return sorted.sort(
          (a, b) => (a.estimated_og || 0) - (b.estimated_og || 0)
        );
      case "og_desc":
        return sorted.sort(
          (a, b) => (b.estimated_og || 0) - (a.estimated_og || 0)
        );
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.updated_at || "").getTime() -
            new Date(a.updated_at || "").getTime()
        );
    }
  };

  // Filter and sort recipes
  const filteredAndSortedRecipes = useMemo(() => {
    let recipesToProcess = recipes || [];

    // Apply search filter if there's a search term
    if (searchTerm && searchTerm.length >= 2 && fuse) {
      const results = fuse.search(searchTerm);
      recipesToProcess = results.map((result) => result.item);
    }

    // Apply sorting
    return sortRecipes(recipesToProcess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuse, searchTerm, recipes, sortBy]);

  // Fetch recipes when the component mounts
  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <div className="all-recipes-container">
      <div className="all-recipes-header">
        <h1 className="all-recipes-title">All Recipes</h1>
        <button
          onClick={() => navigate("/recipes/new")}
          className="primary-button"
        >
          + New Recipe
        </button>
      </div>

      {/* Search and Sort Controls */}
      {!loading && !error && recipes && recipes.length > 0 && (
        <div className="search-and-sort-container">
          <div className="search-container">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search recipes by name, style, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <div className="search-icon-container">
                <svg
                  className="search-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchTerm && (
                <div className="search-clear-container">
                  <button
                    onClick={() => setSearchTerm("")}
                    className="search-clear-button"
                  >
                    <svg
                      className="search-clear-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="sort-container">
            <label htmlFor="sort-select" className="sort-label">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="updated_at_desc">Last Updated (Newest)</option>
              <option value="updated_at_asc">Last Updated (Oldest)</option>
              <option value="created_at_desc">Date Created (Newest)</option>
              <option value="created_at_asc">Date Created (Oldest)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="abv_desc">ABV (High to Low)</option>
              <option value="abv_asc">ABV (Low to High)</option>
              <option value="ibu_desc">IBU (High to Low)</option>
              <option value="ibu_asc">IBU (Low to High)</option>
              <option value="srm_desc">SRM (Dark to Light)</option>
              <option value="srm_asc">SRM (Light to Dark)</option>
              <option value="og_desc">OG (High to Low)</option>
              <option value="og_asc">OG (Low to High)</option>
            </select>
          </div>

          {searchTerm && searchTerm.length >= 2 && (
            <p className="search-results-count">
              Showing {filteredAndSortedRecipes.length} of{" "}
              {recipes?.length || 0} recipes
            </p>
          )}
        </div>
      )}

      {loading && <div className="loading-state">Loading...</div>}

      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (!recipes || recipes.length === 0) && (
        <div className="empty-state">No recipes found.</div>
      )}

      {!loading &&
        !error &&
        recipes &&
        recipes.length > 0 &&
        filteredAndSortedRecipes.length === 0 &&
        searchTerm && (
          <div className="no-search-results">
            <p>No recipes found matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm("")}
              className="clear-search-link"
            >
              Clear search
            </button>
          </div>
        )}

      {!loading && !error && filteredAndSortedRecipes.length > 0 && (
        <div className="recipes-grid">
          {filteredAndSortedRecipes.map((recipe) => (
            <CompactRecipeCard key={recipe.recipe_id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllRecipes;
