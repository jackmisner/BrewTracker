import {
  ingredientServiceInstance,
  recipeServiceInstance,
  metricServiceInstance,
  brewSessionServiceInstance,
  BeerStyleService,
  BeerXMLService,
  IngredientMatchingService,
  CacheManager,
  RecipeDefaultsService,
  UserSettingsService,
  attenuationAnalyticsServiceInstance,
  aiService,
  Services,
  ServiceUtils,
} from "../../src/services/index";

// Mock all the service instances
jest.mock("../../src/services/Data/IngredientService");
jest.mock("../../src/services/Data/RecipeService");
jest.mock("../../src/services/Analytics/MetricService");
jest.mock("../../src/services/Brewing/BrewSessionService");
jest.mock("../../src/services/Data/BeerStyleService");

describe("Services Index", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Service Exports", () => {
    test("exports all individual service instances", () => {
      expect(ingredientServiceInstance).toBeDefined();
      expect(recipeServiceInstance).toBeDefined();
      expect(metricServiceInstance).toBeDefined();
      expect(brewSessionServiceInstance).toBeDefined();
    });

    test("exports Services object with new organized structure", () => {
      // Test the new organized structure
      expect(Services.Data.ingredient).toBe(ingredientServiceInstance);
      expect(Services.Data.recipe).toBe(recipeServiceInstance);
      expect(Services.Data.beerStyle).toBe(BeerStyleService);
      
      expect(Services.Analytics.metrics).toBe(metricServiceInstance);
      expect(Services.Analytics.attenuationAnalytics).toBe(attenuationAnalyticsServiceInstance);
      
      expect(Services.User.settings).toBe(UserSettingsService);
      expect(Services.User.recipeDefaults).toBe(RecipeDefaultsService);
      
      expect(Services.Brewing.brewSession).toBe(brewSessionServiceInstance);
      
      expect(Services.AI.service).toBe(aiService);
      
      expect(Services.BeerXML.service).toBe(BeerXMLService);
      expect(Services.BeerXML.ingredientMatching).toBe(IngredientMatchingService);
      
      expect(Services.cache).toBe(CacheManager);
    });

    test("exports Services object with backward compatibility", () => {
      // Test backward compatibility with flat structure
      expect(Services.ingredient).toBe(ingredientServiceInstance);
      expect(Services.recipe).toBe(recipeServiceInstance);
      expect(Services.metrics).toBe(metricServiceInstance);
      expect(Services.brewSession).toBe(brewSessionServiceInstance);
      expect(Services.beerStyle).toBe(BeerStyleService);
      expect(Services.beerXML).toBe(BeerXMLService);
      expect(Services.ingredientMatching).toBe(IngredientMatchingService);
      expect(Services.recipeDefaults).toBe(RecipeDefaultsService);
      expect(Services.userSettings).toBe(UserSettingsService);
      expect(Services.attenuationAnalytics).toBe(attenuationAnalyticsServiceInstance);
    });

    test("exports ServiceUtils", () => {
      expect(ServiceUtils).toBeDefined();
      expect(ServiceUtils.clearAllCaches).toBeInstanceOf(Function);
      expect(ServiceUtils.healthCheck).toBeInstanceOf(Function);
    });
  });

  describe("ServiceUtils.clearAllCaches", () => {
    test("calls clearCache on all service instances", () => {
      // Mock the clearCache methods
      ingredientServiceInstance.clearCache = jest.fn();
      metricServiceInstance.clearCache = jest.fn();
      brewSessionServiceInstance.clearCache = jest.fn();
      IngredientMatchingService.clearCache = jest.fn();
      UserSettingsService.clearCache = jest.fn();
      attenuationAnalyticsServiceInstance.clearCache = jest.fn();
      CacheManager.clearAllCaches = jest.fn();

      ServiceUtils.clearAllCaches();

      expect(ingredientServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(metricServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(brewSessionServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(IngredientMatchingService.clearCache).toHaveBeenCalledTimes(1);
      expect(UserSettingsService.clearCache).toHaveBeenCalledTimes(1);
      expect(attenuationAnalyticsServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(CacheManager.clearAllCaches).toHaveBeenCalledTimes(1);
    });

    test("handles missing clearCache methods gracefully", () => {
      // Remove clearCache from one service
      ingredientServiceInstance.clearCache = undefined;
      metricServiceInstance.clearCache = jest.fn();
      brewSessionServiceInstance.clearCache = jest.fn();
      IngredientMatchingService.clearCache = jest.fn();
      UserSettingsService.clearCache = jest.fn();
      attenuationAnalyticsServiceInstance.clearCache = jest.fn();
      CacheManager.clearAllCaches = jest.fn();

      // Should not throw
      expect(() => ServiceUtils.clearAllCaches()).not.toThrow();

      expect(metricServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(brewSessionServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(IngredientMatchingService.clearCache).toHaveBeenCalledTimes(1);
      expect(UserSettingsService.clearCache).toHaveBeenCalledTimes(1);
      expect(attenuationAnalyticsServiceInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(CacheManager.clearAllCaches).toHaveBeenCalledTimes(1);
    });
  });

  describe("ServiceUtils.healthCheck", () => {
    beforeEach(() => {
      // Mock service methods
      ingredientServiceInstance.fetchIngredients = jest.fn();
      brewSessionServiceInstance.fetchBrewSessions = jest.fn();
    });

    test("returns healthy status when all services work", async () => {
      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockResolvedValue([]);
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockResolvedValue({
        sessions: [],
      });

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(true);
      expect(health.recipe).toBe(true);
      expect(health.metrics).toBe(true);
      expect(health.brewSession).toBe(true);
      expect(health.timestamp).toBeDefined();
      expect(health.ingredientError).toBeUndefined();
      expect(health.brewSessionError).toBeUndefined();
    });

    test("marks ingredient service as unhealthy on error", async () => {
      const ingredientError = new Error("Ingredient service failed");
      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockRejectedValue(
        ingredientError
      );
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockResolvedValue({
        sessions: [],
      });

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(false);
      expect(health.ingredientError).toBe("Ingredient service failed");
      expect(health.brewSession).toBe(true);
      expect(health.brewSessionError).toBeUndefined();
    });

    test("marks brew session service as unhealthy on error", async () => {
      const brewSessionError = new Error("Brew session service failed");
      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockResolvedValue([]);
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockRejectedValue(
        brewSessionError
      );

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(true);
      expect(health.brewSession).toBe(false);
      expect(health.brewSessionError).toBe("Brew session service failed");
      expect(health.ingredientError).toBeUndefined();
    });

    test("handles multiple service failures", async () => {
      const ingredientError = new Error("Ingredient service failed");
      const brewSessionError = new Error("Brew session service failed");

      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockRejectedValue(
        ingredientError
      );
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockRejectedValue(
        brewSessionError
      );

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(false);
      expect(health.brewSession).toBe(false);
      expect(health.ingredientError).toBe("Ingredient service failed");
      expect(health.brewSessionError).toBe("Brew session service failed");
      expect(health.recipe).toBe(true); // These aren't tested, so default to true
      expect(health.metrics).toBe(true);
    });

    test("calls correct service methods with correct parameters", async () => {
      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockResolvedValue([]);
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockResolvedValue({
        sessions: [],
      });

      await ServiceUtils.healthCheck();

      expect(ingredientServiceInstance.fetchIngredients).toHaveBeenCalledWith();
      expect(brewSessionServiceInstance.fetchBrewSessions).toHaveBeenCalledWith(
        1,
        1
      );
    });

    test("includes timestamp in health check response", async () => {
      const beforeTime = new Date().toISOString();

      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockResolvedValue([]);
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockResolvedValue({
        sessions: [],
      });

      const health = await ServiceUtils.healthCheck();
      const afterTime = new Date().toISOString();

      expect(health.timestamp).toBeDefined();
      expect(health.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(health.timestamp >= beforeTime).toBe(true);
      expect(health.timestamp <= afterTime).toBe(true);
    });

    test("preserves error details in health response", async () => {
      const detailedError = new Error("Connection timeout after 5000ms");
      detailedError.code = "TIMEOUT";
      detailedError.status = 408;

      (ingredientServiceInstance.fetchIngredients as jest.Mock).mockRejectedValue(
        detailedError
      );
      (brewSessionServiceInstance.fetchBrewSessions as jest.Mock).mockResolvedValue({
        sessions: [],
      });

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(false);
      expect(health.ingredientError).toBe("Connection timeout after 5000ms");
    });
  });

  describe("Service Integration", () => {
    test("Services object provides access to all service instances", () => {
      expect(Services.ingredient).toBe(ingredientServiceInstance);
      expect(Services.recipe).toBe(recipeServiceInstance);
      expect(Services.metrics).toBe(metricServiceInstance);
      expect(Services.brewSession).toBe(brewSessionServiceInstance);
      expect(Services.beerStyle).toBe(BeerStyleService);
      expect(Services.beerXML).toBe(BeerXMLService);
      expect(Services.ingredientMatching).toBe(IngredientMatchingService);
      expect(Services.cache).toBe(CacheManager);
      expect(Services.recipeDefaults).toBe(RecipeDefaultsService);
      expect(Services.userSettings).toBe(UserSettingsService);
      expect(Services.attenuationAnalytics).toBe(attenuationAnalyticsServiceInstance);
    });

    test("individual exports match Services object exports", () => {
      expect(ingredientServiceInstance).toBe(Services.ingredient);
      expect(recipeServiceInstance).toBe(Services.recipe);
      expect(metricServiceInstance).toBe(Services.metrics);
      expect(brewSessionServiceInstance).toBe(Services.brewSession);
    });
  });

  describe("Error Handling Edge Cases", () => {
    test("clearAllCaches works when service instances are null", () => {
      // Temporarily replace service instances
      const originalIngredient = ingredientServiceInstance;
      const originalMetrics = metricServiceInstance;

      // Mock the imports to return null (simulate missing services)
      jest.doMock("../../src/services/Data/IngredientService", () => null);
      jest.doMock("../../src/services/Analytics/MetricService", () => null);

      expect(() => ServiceUtils.clearAllCaches()).not.toThrow();

      // Restore
      jest.doMock(
        "../../src/services/Data/IngredientService",
        () => originalIngredient
      );
      jest.doMock("../../src/services/Analytics/MetricService", () => originalMetrics);
    });

    test("healthCheck handles service method that doesn't exist", async () => {
      // Remove the method entirely
      delete ingredientServiceInstance.fetchIngredients;
      brewSessionServiceInstance.fetchBrewSessions = jest
        .fn()
        .mockResolvedValue({ sessions: [] });

      const health = await ServiceUtils.healthCheck();

      expect(health.ingredient).toBe(false);
      expect(health.ingredientError).toContain(
        "fetchIngredients is not a function"
      );
      expect(health.brewSession).toBe(true);
    });
  });
});
