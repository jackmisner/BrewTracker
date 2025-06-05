import RecipeService from "../../src/services/RecipeService";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("RecipeService", () => {
  let recipeService;
  let consoleErrorSpy;

  beforeEach(() => {
    recipeService = RecipeService;
    jest.clearAllMocks();

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console mocks
    consoleErrorSpy.mockRestore();
  });

  describe("fetchRecipe", () => {
    const mockRecipeResponse = {
      data: {
        recipe_id: "recipe-1",
        name: "Test Recipe",
        style: "IPA",
        batch_size: 5,
        ingredients: [
          {
            ingredient_id: 1,
            name: "Pale Malt",
            type: "grain",
            amount: 10,
            unit: "lb",
          },
        ],
      },
    };

    test("fetches and processes recipe successfully", async () => {
      ApiService.recipes.getById.mockResolvedValue(mockRecipeResponse);

      const result = await recipeService.fetchRecipe("recipe-1");

      expect(ApiService.recipes.getById).toHaveBeenCalledWith("recipe-1");
      expect(result.recipe_id).toBe("recipe-1");
      expect(result.name).toBe("Test Recipe");
      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].id).toBeDefined();
    });

    test("handles API errors", async () => {
      ApiService.recipes.getById.mockRejectedValue(new Error("API Error"));

      await expect(recipeService.fetchRecipe("recipe-1")).rejects.toThrow(
        "Failed to load recipe"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching recipe:",
        expect.any(Error)
      );
    });
  });

  describe("saveRecipe", () => {
    const validRecipeData = {
      name: "Test Recipe",
      style: "IPA",
      batch_size: 5,
      description: "Test description",
      is_public: false,
      boil_time: 60,
      efficiency: 75,
      notes: "Test notes",
    };

    const validIngredients = [
      {
        ingredient_id: 1,
        name: "Pale Malt",
        type: "grain",
        amount: 10,
        unit: "lb",
      },
      {
        ingredient_id: 2,
        name: "US-05",
        type: "yeast",
        amount: 1,
        unit: "pkg",
      },
    ];

    const validMetrics = {
      og: 1.055,
      fg: 1.012,
      abv: 5.6,
      ibu: 35,
      srm: 4,
    };

    test("creates new recipe successfully", async () => {
      const mockResponse = {
        data: {
          recipe_id: "new-recipe",
          ...validRecipeData,
          ingredients: validIngredients,
        },
      };
      ApiService.recipes.create.mockResolvedValue(mockResponse);

      const result = await recipeService.saveRecipe(
        null,
        validRecipeData,
        validIngredients,
        validMetrics
      );

      expect(ApiService.recipes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Recipe",
          batch_size: 5,
          estimated_og: 1.055,
          ingredients: expect.arrayContaining([
            expect.objectContaining({
              ingredient_id: 1,
              amount: 10,
            }),
          ]),
        })
      );
      expect(result.recipe_id).toBe("new-recipe");
    });

    test("updates existing recipe successfully", async () => {
      const mockResponse = {
        data: {
          recipe_id: "recipe-1",
          ...validRecipeData,
          ingredients: validIngredients,
        },
      };
      ApiService.recipes.update.mockResolvedValue(mockResponse);

      const result = await recipeService.saveRecipe(
        "recipe-1",
        validRecipeData,
        validIngredients,
        validMetrics
      );

      expect(ApiService.recipes.update).toHaveBeenCalledWith(
        "recipe-1",
        expect.objectContaining({
          name: "Test Recipe",
          estimated_fg: 1.012,
        })
      );
      expect(result.recipe_id).toBe("recipe-1");
    });

    test("validates recipe data before saving", async () => {
      const invalidRecipeData = {
        name: "", // Empty name
        batch_size: 0, // Invalid batch size
      };

      await expect(
        recipeService.saveRecipe(null, invalidRecipeData, [])
      ).rejects.toThrow("Validation failed");
    });

    test("handles API errors during save", async () => {
      ApiService.recipes.create.mockRejectedValue(new Error("API Error"));

      await expect(
        recipeService.saveRecipe(null, validRecipeData, validIngredients)
      ).rejects.toThrow("Failed to save recipe");
    });

    test("handles invalid server response", async () => {
      ApiService.recipes.create.mockResolvedValue({}); // No data property

      await expect(
        recipeService.saveRecipe(null, validRecipeData, validIngredients)
      ).rejects.toThrow("Invalid server response");
    });
  });

  describe("cloneRecipe", () => {
    test("clones recipe successfully", async () => {
      const mockResponse = {
        data: {
          recipe_id: "cloned-recipe",
          name: "Test Recipe (Clone)",
          style: "IPA",
        },
      };
      ApiService.recipes.clone.mockResolvedValue(mockResponse);

      const result = await recipeService.cloneRecipe("recipe-1");

      expect(ApiService.recipes.clone).toHaveBeenCalledWith("recipe-1");
      expect(result.recipe_id).toBe("cloned-recipe");
      expect(result.name).toBe("Test Recipe (Clone)");
    });

    test("handles API errors during clone", async () => {
      ApiService.recipes.clone.mockRejectedValue(new Error("API Error"));

      await expect(recipeService.cloneRecipe("recipe-1")).rejects.toThrow(
        "Failed to clone recipe"
      );
    });
  });

  describe("scaleRecipe", () => {
    test("scales recipe correctly", () => {
      const recipe = { batch_size: 5 };
      const ingredients = [
        { amount: 10, unit: "lb" },
        { amount: 1, unit: "oz" },
      ];
      const newBatchSize = 10;

      const result = recipeService.scaleRecipe(
        recipe,
        ingredients,
        newBatchSize
      );

      expect(result.scaledRecipe.batch_size).toBe(10);
      expect(result.scalingFactor).toBe(2);
    });
  });

  describe("calculateRecipeStats", () => {
    test("calculates recipe stats successfully", async () => {
      const mockStats = {
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 35,
        srm: 4,
      };
      ApiService.recipes.calculateMetrics.mockResolvedValue({
        data: mockStats,
      });

      const result = await recipeService.calculateRecipeStats("recipe-1");

      expect(ApiService.recipes.calculateMetrics).toHaveBeenCalledWith(
        "recipe-1"
      );
      expect(result).toEqual(mockStats);
    });

    test("returns default stats on API error", async () => {
      ApiService.recipes.calculateMetrics.mockRejectedValue(
        new Error("API Error")
      );

      const result = await recipeService.calculateRecipeStats("recipe-1");

      expect(result).toEqual({
        og: 1.0,
        fg: 1.0,
        abv: 0.0,
        ibu: 0,
        srm: 0,
      });
    });
  });

  describe("getVersionHistory", () => {
    test("gets version history successfully", async () => {
      const mockHistory = [
        { version: 1, created_at: "2024-01-01" },
        { version: 2, created_at: "2024-01-02" },
      ];
      ApiService.recipes.getVersionHistory.mockResolvedValue({
        data: mockHistory,
      });

      const result = await recipeService.getVersionHistory("recipe-1");

      expect(ApiService.recipes.getVersionHistory).toHaveBeenCalledWith(
        "recipe-1"
      );
      expect(result).toEqual(mockHistory);
    });

    test("returns null on API error", async () => {
      ApiService.recipes.getVersionHistory.mockRejectedValue(
        new Error("API Error")
      );

      const result = await recipeService.getVersionHistory("recipe-1");

      expect(result).toBeNull();
    });
  });

  describe("validateRecipeData", () => {
    test("validates valid recipe data", () => {
      const validData = {
        name: "Test Recipe",
        batch_size: 5,
        efficiency: 75,
        boil_time: 60,
      };
      const validIngredients = [
        { type: "grain", ingredient_id: 1 },
        { type: "yeast", ingredient_id: 2 },
      ];

      const result = recipeService.validateRecipeData(
        validData,
        validIngredients
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("catches basic validation errors", () => {
      const invalidData = {
        name: "",
        batch_size: 0,
        efficiency: 150,
        boil_time: -5,
      };

      const result = recipeService.validateRecipeData(invalidData, []);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Recipe name is required");
      expect(result.errors).toContain("Batch size must be greater than 0");
      expect(result.errors).toContain("Efficiency must be between 0 and 100%");
      expect(result.errors).toContain("Boil time cannot be negative");
      expect(result.errors).toContain("At least one ingredient is required");
    });

    test("validates yeast requirement", () => {
      const validData = {
        name: "Test Recipe",
        batch_size: 5,
      };
      const ingredientsWithoutYeast = [
        { type: "grain", ingredient_id: 1 },
        { type: "hop", ingredient_id: 2 },
      ];

      const result = recipeService.validateRecipeData(
        validData,
        ingredientsWithoutYeast
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Yeast is required for fermentation");
    });

    test("handles undefined ingredients", () => {
      const validData = {
        name: "Test Recipe",
        batch_size: 5,
      };

      const result = recipeService.validateRecipeData(validData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("At least one ingredient is required");
    });
  });

  describe("formatRecipeForApi", () => {
    test("formats recipe data correctly", () => {
      const recipeData = {
        name: "  Test Recipe  ",
        style: "  IPA  ",
        batch_size: "5",
        description: "  Test description  ",
        is_public: true,
        boil_time: "60",
        efficiency: "75",
        notes: "  Test notes  ",
      };

      const ingredients = [
        {
          ingredient_id: 1,
          name: "Pale Malt",
          type: "grain",
          amount: "10",
          unit: "lb",
          time: "0",
        },
      ];

      const metrics = {
        og: 1.055,
        fg: 1.012,
        abv: 5.6,
        ibu: 35,
        srm: 4,
      };

      const result = recipeService.formatRecipeForApi(
        recipeData,
        ingredients,
        metrics
      );

      expect(result).toEqual({
        name: "Test Recipe",
        style: "IPA",
        batch_size: 5,
        description: "Test description",
        is_public: true,
        boil_time: 60,
        efficiency: 75,
        notes: "Test notes",
        estimated_og: 1.055,
        estimated_fg: 1.012,
        estimated_abv: 5.6,
        estimated_ibu: 35,
        estimated_srm: 4,
        ingredients: [
          {
            ingredient_id: 1,
            name: "Pale Malt",
            type: "grain",
            amount: 10,
            unit: "lb",
            use: "",
            time: 0,
            potential: undefined,
            color: undefined,
            grain_type: undefined,
            alpha_acid: undefined,
            attenuation: undefined,
          },
        ],
      });
    });

    test("handles missing optional fields", () => {
      const minimalData = {
        name: "Test Recipe",
        batch_size: 5,
      };

      const result = recipeService.formatRecipeForApi(minimalData, []);

      expect(result).toEqual({
        name: "Test Recipe",
        style: "",
        batch_size: 5,
        description: "",
        is_public: false,
        boil_time: null,
        efficiency: null,
        notes: "",
      });
    });
  });

  describe("processRecipeData", () => {
    test("processes recipe data with all fields", () => {
      const rawRecipe = {
        recipe_id: "recipe-1",
        name: "Test Recipe",
        style: "IPA",
        batch_size: "5",
        efficiency: "75",
        boil_time: "60",
        ingredients: [
          {
            ingredient_id: 1,
            name: "Pale Malt",
          },
        ],
      };

      const result = recipeService.processRecipeData(rawRecipe);

      expect(result.recipe_id).toBe("recipe-1");
      expect(result.batch_size).toBe(5);
      expect(result.efficiency).toBe(75);
      expect(result.boil_time).toBe(60);
      expect(result.ingredients[0].id).toBeDefined();
    });

    test("handles alternative ID fields", () => {
      const rawRecipe = {
        _id: "mongo-id",
        name: "Test Recipe",
      };

      const result = recipeService.processRecipeData(rawRecipe);

      expect(result.recipe_id).toBe("mongo-id");
    });

    test("provides defaults for missing fields", () => {
      const rawRecipe = {
        name: "Test Recipe",
      };

      const result = recipeService.processRecipeData(rawRecipe);

      expect(result.batch_size).toBe(5);
      expect(result.efficiency).toBe(75);
      expect(result.boil_time).toBe(60);
      expect(result.style).toBe("");
      expect(result.description).toBe("");
      expect(result.is_public).toBe(false);
      expect(result.notes).toBe("");
      expect(result.ingredients).toEqual([]);
    });

    test("generates IDs for ingredients", () => {
      const rawRecipe = {
        name: "Test Recipe",
        ingredients: [
          { ingredient_id: 1, name: "Ingredient 1" },
          { _id: "mongo-id", name: "Ingredient 2" },
          { name: "Ingredient 3" }, // No ID
        ],
      };

      const result = recipeService.processRecipeData(rawRecipe);

      expect(result.ingredients[0].id).toBe("ing-1");
      expect(result.ingredients[1].id).toBe("mongo-id");
      expect(result.ingredients[2].id).toMatch(/^existing-/);
    });

    test("handles null recipe", () => {
      const result = recipeService.processRecipeData(null);
      expect(result).toBeNull();
    });
  });

  describe("getRecipeDisplayName", () => {
    test("returns recipe name", () => {
      const recipe = { name: "My Recipe" };
      const result = recipeService.getRecipeDisplayName(recipe);
      expect(result).toBe("My Recipe");
    });

    test("handles null recipe", () => {
      const result = recipeService.getRecipeDisplayName(null);
      expect(result).toBe("Unknown Recipe");
    });
  });

  describe("hasUnsavedChanges", () => {
    const originalRecipe = {
      name: "Original Recipe",
      style: "IPA",
      batch_size: 5,
      description: "Original description",
      is_public: false,
      boil_time: 60,
      efficiency: 75,
      notes: "Original notes",
      ingredients: [{ ingredient_id: 1 }, { ingredient_id: 2 }],
    };

    test("returns true for new recipe", () => {
      const currentRecipe = { name: "New Recipe" };
      const currentIngredients = [];

      const result = recipeService.hasUnsavedChanges(
        null,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(true);
    });

    test("returns false for unchanged recipe", () => {
      const currentRecipe = { ...originalRecipe };
      const currentIngredients = [{ ingredient_id: 1 }, { ingredient_id: 2 }];

      const result = recipeService.hasUnsavedChanges(
        originalRecipe,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(false);
    });

    test("detects changes in basic fields", () => {
      const currentRecipe = {
        ...originalRecipe,
        name: "Modified Recipe",
      };
      const currentIngredients = [{ ingredient_id: 1 }, { ingredient_id: 2 }];

      const result = recipeService.hasUnsavedChanges(
        originalRecipe,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(true);
    });

    test("detects changes in ingredient count", () => {
      const currentRecipe = { ...originalRecipe };
      const currentIngredients = [
        { ingredient_id: 1 },
        { ingredient_id: 2 },
        { ingredient_id: 3 }, // Added ingredient
      ];

      const result = recipeService.hasUnsavedChanges(
        originalRecipe,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(true);
    });

    test("detects changes in ingredient IDs", () => {
      const currentRecipe = { ...originalRecipe };
      const currentIngredients = [
        { ingredient_id: 1 },
        { ingredient_id: 3 }, // Changed from 2 to 3
      ];

      const result = recipeService.hasUnsavedChanges(
        originalRecipe,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(true);
    });

    test("ignores ingredient order when same IDs", () => {
      const currentRecipe = { ...originalRecipe };
      const currentIngredients = [
        { ingredient_id: 2 }, // Swapped order
        { ingredient_id: 1 },
      ];

      const result = recipeService.hasUnsavedChanges(
        originalRecipe,
        currentRecipe,
        currentIngredients
      );

      expect(result).toBe(false);
    });
  });

  describe("createRecipeError", () => {
    test("creates standardized recipe error with API response", () => {
      const originalError = new Error("Original error");
      originalError.response = {
        data: { error: "API specific error" },
      };

      const error = recipeService.createRecipeError(
        "Test message",
        originalError
      );

      expect(error.message).toBe("Test message: API specific error");
      expect(error.isRecipeError).toBe(true);
      expect(error.originalError).toBe(originalError);
    });

    test("creates standardized recipe error with simple message", () => {
      const originalError = new Error("Simple error");

      const error = recipeService.createRecipeError(
        "Test message",
        originalError
      );

      expect(error.message).toBe("Test message: Simple error");
      expect(error.isRecipeError).toBe(true);
    });

    test("creates error without original error message", () => {
      const originalError = {};

      const error = recipeService.createRecipeError(
        "Test message",
        originalError
      );

      expect(error.message).toBe("Test message");
      expect(error.isRecipeError).toBe(true);
    });
  });

  describe("edge cases and error handling", () => {
    test("handles malformed API responses gracefully", async () => {
      ApiService.recipes.getById.mockResolvedValue({ data: null });

      const result = await recipeService.fetchRecipe("recipe-1");
      expect(result).toBeNull();
    });

    test("handles empty ingredients array in formatRecipeForApi", () => {
      const recipeData = {
        name: "Test Recipe",
        batch_size: 5,
      };

      const result = recipeService.formatRecipeForApi(recipeData, null);

      expect(result.ingredients).toBeUndefined();
    });

    test("handles numeric conversion edge cases", () => {
      const rawRecipe = {
        name: "Test Recipe",
        batch_size: "invalid",
        efficiency: null,
        boil_time: undefined,
      };

      const result = recipeService.processRecipeData(rawRecipe);

      expect(result.batch_size).toBe(5); // Default
      expect(result.efficiency).toBe(75); // Default
      expect(result.boil_time).toBe(60); // Default
    });

    test("validates edge case values", () => {
      const edgeCaseData = {
        name: "Test Recipe",
        batch_size: 0.1, // Very small but valid
        efficiency: 0, // Minimum valid
        boil_time: 0, // Valid edge case
      };
      const validIngredients = [{ type: "yeast", ingredient_id: 1 }];

      const result = recipeService.validateRecipeData(
        edgeCaseData,
        validIngredients
      );

      expect(result.isValid).toBe(true);
    });

    test("handles very large ingredient arrays", () => {
      const largeIngredientArray = Array(100)
        .fill()
        .map((_, i) => ({
          ingredient_id: i + 1,
          name: `Ingredient ${i + 1}`,
          type: i === 0 ? "yeast" : "grain", // Ensure yeast requirement
        }));

      const recipeData = {
        name: "Test Recipe",
        batch_size: 5,
      };

      const result = recipeService.validateRecipeData(
        recipeData,
        largeIngredientArray
      );

      expect(result.isValid).toBe(true);
    });
  });
});
