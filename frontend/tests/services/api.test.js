import axios from "axios";
import ApiService from "../../src/services/api";

jest.mock("axios", () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
  };

  return {
    create: jest.fn(() => mockAxiosInstance),
    // Store a reference to the mock instance for tests to access
    __mockInstance: mockAxiosInstance,
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Get reference to the mocked axios instance
const mockedAxios = axios;
const mockAxiosInstance = axios.__mockInstance;

describe("ApiService", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Clear localStorage mock
    mockLocalStorage.getItem.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Auth Endpoints", () => {
    test("auth.register calls correct endpoint", () => {
      const userData = { username: "test", password: "password" };

      ApiService.auth.register(userData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/auth/register",
        userData
      );
    });

    test("auth.login calls correct endpoint", () => {
      const credentials = { username: "test", password: "password" };

      ApiService.auth.login(credentials);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/auth/login",
        credentials
      );
    });

    test("auth.getProfile calls correct endpoint", () => {
      ApiService.auth.getProfile();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/auth/profile");
    });
  });

  describe("Recipe Endpoints", () => {
    test("recipes.getAll uses default pagination", () => {
      ApiService.recipes.getAll();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes?page=1&per_page=10"
      );
    });

    test("recipes.getAll uses custom pagination", () => {
      ApiService.recipes.getAll(2, 20);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes?page=2&per_page=20"
      );
    });

    test("recipes.getById calls correct endpoint", () => {
      ApiService.recipes.getById("recipe-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/recipes/recipe-123");
    });

    test("recipes.create calls correct endpoint", () => {
      const recipeData = { name: "Test Recipe" };

      ApiService.recipes.create(recipeData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/recipes",
        recipeData
      );
    });

    test("recipes.update calls correct endpoint", () => {
      const recipeData = { name: "Updated Recipe" };

      ApiService.recipes.update("recipe-123", recipeData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/recipes/recipe-123",
        recipeData
      );
    });

    test("recipes.delete calls correct endpoint", () => {
      ApiService.recipes.delete("recipe-123");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/recipes/recipe-123"
      );
    });

    test("recipes.search uses default pagination", () => {
      ApiService.recipes.search("test query");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/search/recipes?q=test query&page=1&per_page=10"
      );
    });

    test("recipes.search uses custom pagination", () => {
      ApiService.recipes.search("test query", 2, 20);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/search/recipes?q=test query&page=2&per_page=20"
      );
    });

    test("recipes.calculateMetrics calls correct endpoint", () => {
      ApiService.recipes.calculateMetrics("recipe-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes/recipe-123/metrics"
      );
    });

    test("recipes.calculateMetricsPreview calls correct endpoint", () => {
      const recipeData = { ingredients: [] };

      ApiService.recipes.calculateMetricsPreview(recipeData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/recipes/calculate-metrics-preview",
        recipeData
      );
    });

    test("recipes.clone calls correct endpoint", () => {
      ApiService.recipes.clone("recipe-123");

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/recipes/recipe-123/clone"
      );
    });

    test("recipes.getVersionHistory calls correct endpoint", () => {
      ApiService.recipes.getVersionHistory("recipe-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes/recipe-123/versions"
      );
    });

    test("recipes.getBrewSessions calls correct endpoint", () => {
      ApiService.recipes.getBrewSessions("recipe-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes/recipe-123/brew-sessions"
      );
    });
  });

  describe("Ingredient Endpoints", () => {
    test("ingredients.getAll without parameters", () => {
      ApiService.ingredients.getAll();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/ingredients");
    });

    test("ingredients.getAll with type parameter", () => {
      ApiService.ingredients.getAll("grain");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients?type=grain"
      );
    });

    test("ingredients.getAll with search parameter", () => {
      ApiService.ingredients.getAll(null, "pale malt");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients?search=pale malt"
      );
    });

    test("ingredients.getAll with both parameters", () => {
      ApiService.ingredients.getAll("grain", "pale malt");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients?type=grain&search=pale malt"
      );
    });

    test("ingredients.getById calls correct endpoint", () => {
      ApiService.ingredients.getById("ingredient-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients/ingredient-123"
      );
    });

    test("ingredients.create calls correct endpoint", () => {
      const ingredientData = { name: "Test Ingredient" };

      ApiService.ingredients.create(ingredientData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/ingredients",
        ingredientData
      );
    });

    test("ingredients.update calls correct endpoint", () => {
      const ingredientData = { name: "Updated Ingredient" };

      ApiService.ingredients.update("ingredient-123", ingredientData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/ingredients/ingredient-123",
        ingredientData
      );
    });

    test("ingredients.delete calls correct endpoint", () => {
      ApiService.ingredients.delete("ingredient-123");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/ingredients/ingredient-123"
      );
    });

    test("ingredients.getRecipes uses default pagination", () => {
      ApiService.ingredients.getRecipes("ingredient-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients/ingredient-123/recipes?page=1&per_page=10"
      );
    });

    test("ingredients.getRecipes uses custom pagination", () => {
      ApiService.ingredients.getRecipes("ingredient-123", 2, 20);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/ingredients/ingredient-123/recipes?page=2&per_page=20"
      );
    });
  });

  describe("Brew Session Endpoints", () => {
    test("brewSessions.getAll uses default pagination", () => {
      ApiService.brewSessions.getAll();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/brew-sessions?page=1&per_page=10"
      );
    });

    test("brewSessions.getAll uses custom pagination", () => {
      ApiService.brewSessions.getAll(2, 20);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/brew-sessions?page=2&per_page=20"
      );
    });

    test("brewSessions.getById calls correct endpoint", () => {
      ApiService.brewSessions.getById("session-123");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/brew-sessions/session-123"
      );
    });

    test("brewSessions.create calls correct endpoint", () => {
      const sessionData = { name: "Test Session" };

      ApiService.brewSessions.create(sessionData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/brew-sessions",
        sessionData
      );
    });

    test("brewSessions.update calls correct endpoint", () => {
      const sessionData = { name: "Updated Session" };

      ApiService.brewSessions.update("session-123", sessionData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/brew-sessions/session-123",
        sessionData
      );
    });

    test("brewSessions.delete calls correct endpoint", () => {
      ApiService.brewSessions.delete("session-123");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/brew-sessions/session-123"
      );
    });

    describe("Fermentation Endpoints", () => {
      test("getFermentationData calls correct endpoint", () => {
        ApiService.brewSessions.getFermentationData("session-123");

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          "/brew-sessions/session-123/fermentation"
        );
      });

      test("addFermentationEntry calls correct endpoint", () => {
        const entryData = { gravity: 1.045 };

        ApiService.brewSessions.addFermentationEntry("session-123", entryData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          "/brew-sessions/session-123/fermentation",
          entryData
        );
      });

      test("updateFermentationEntry calls correct endpoint", () => {
        const entryData = { gravity: 1.04 };

        ApiService.brewSessions.updateFermentationEntry(
          "session-123",
          0,
          entryData
        );

        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
          "/brew-sessions/session-123/fermentation/0",
          entryData
        );
      });

      test("deleteFermentationEntry calls correct endpoint", () => {
        ApiService.brewSessions.deleteFermentationEntry("session-123", 0);

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
          "/brew-sessions/session-123/fermentation/0"
        );
      });

      test("getFermentationStats calls correct endpoint", () => {
        ApiService.brewSessions.getFermentationStats("session-123");

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          "/brew-sessions/session-123/fermentation/stats"
        );
      });
    });
  });

  describe("Dashboard Endpoints", () => {
    test("dashboard.getData calls correct endpoint", () => {
      ApiService.dashboard.getData();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("ApiService Structure", () => {
    test("has all expected endpoint groups", () => {
      expect(ApiService).toHaveProperty("auth");
      expect(ApiService).toHaveProperty("recipes");
      expect(ApiService).toHaveProperty("ingredients");
      expect(ApiService).toHaveProperty("brewSessions");
      expect(ApiService).toHaveProperty("dashboard");
    });

    test("auth group has all expected methods", () => {
      expect(ApiService.auth).toHaveProperty("register");
      expect(ApiService.auth).toHaveProperty("login");
      expect(ApiService.auth).toHaveProperty("getProfile");
    });

    test("recipes group has all expected methods", () => {
      expect(ApiService.recipes).toHaveProperty("getAll");
      expect(ApiService.recipes).toHaveProperty("getById");
      expect(ApiService.recipes).toHaveProperty("create");
      expect(ApiService.recipes).toHaveProperty("update");
      expect(ApiService.recipes).toHaveProperty("delete");
      expect(ApiService.recipes).toHaveProperty("search");
      expect(ApiService.recipes).toHaveProperty("calculateMetrics");
      expect(ApiService.recipes).toHaveProperty("calculateMetricsPreview");
      expect(ApiService.recipes).toHaveProperty("clone");
      expect(ApiService.recipes).toHaveProperty("getVersionHistory");
      expect(ApiService.recipes).toHaveProperty("getBrewSessions");
    });

    test("ingredients group has all expected methods", () => {
      expect(ApiService.ingredients).toHaveProperty("getAll");
      expect(ApiService.ingredients).toHaveProperty("getById");
      expect(ApiService.ingredients).toHaveProperty("create");
      expect(ApiService.ingredients).toHaveProperty("update");
      expect(ApiService.ingredients).toHaveProperty("delete");
      expect(ApiService.ingredients).toHaveProperty("getRecipes");
    });

    test("brewSessions group has all expected methods", () => {
      expect(ApiService.brewSessions).toHaveProperty("getAll");
      expect(ApiService.brewSessions).toHaveProperty("getById");
      expect(ApiService.brewSessions).toHaveProperty("create");
      expect(ApiService.brewSessions).toHaveProperty("update");
      expect(ApiService.brewSessions).toHaveProperty("delete");
      expect(ApiService.brewSessions).toHaveProperty("getFermentationData");
      expect(ApiService.brewSessions).toHaveProperty("addFermentationEntry");
      expect(ApiService.brewSessions).toHaveProperty("updateFermentationEntry");
      expect(ApiService.brewSessions).toHaveProperty("deleteFermentationEntry");
      expect(ApiService.brewSessions).toHaveProperty("getFermentationStats");
    });

    test("dashboard group has all expected methods", () => {
      expect(ApiService.dashboard).toHaveProperty("getData");
    });
  });

  describe("Integration Tests", () => {
    test("ApiService methods return axios promises", () => {
      const mockPromise = Promise.resolve({ data: {} });
      mockAxiosInstance.get.mockReturnValue(mockPromise);

      const result = ApiService.recipes.getAll();

      expect(result).toBe(mockPromise);
    });

    test("URL encoding works correctly", () => {
      ApiService.recipes.search("test with spaces");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/search/recipes?q=test with spaces&page=1&per_page=10"
      );
    });

    test("parameter handling works with falsy values", () => {
      ApiService.ingredients.getAll("", "");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/ingredients");
    });

    test("parameter handling works with zero values", () => {
      ApiService.recipes.getAll(0, 0);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/recipes?page=0&per_page=0"
      );
    });
  });

  describe("Error Scenarios", () => {
    test("handles network errors gracefully", () => {
      const networkError = new Error("Network Error");
      mockAxiosInstance.get.mockRejectedValue(networkError);

      return expect(ApiService.recipes.getAll()).rejects.toEqual(networkError);
    });

    test("handles 404 errors", () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: "Not found" },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      return expect(ApiService.recipes.getById("nonexistent")).rejects.toEqual(
        notFoundError
      );
    });

    test("handles 500 errors", () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: "Internal server error" },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(serverError);

      return expect(
        ApiService.recipes.create({ name: "Test" })
      ).rejects.toEqual(serverError);
    });
  });
});
