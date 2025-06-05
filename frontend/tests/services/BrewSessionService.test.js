import BrewSessionService from "../../src/services/BrewSessionService";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("BrewSessionService", () => {
  let brewSessionService;
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    brewSessionService = BrewSessionService;
    brewSessionService.clearCache();
    jest.clearAllMocks();

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console mocks
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("fetchBrewSessions", () => {
    const mockApiResponse = {
      data: {
        brew_sessions: [
          {
            session_id: "session-1",
            name: "Test Session 1",
            status: "completed",
            brew_date: "2024-01-15T10:00:00Z",
            recipe_id: "recipe-1",
          },
          {
            session_id: "session-2",
            name: "Test Session 2",
            status: "in-progress",
            brew_date: "2024-01-20T10:00:00Z",
            recipe_id: "recipe-2",
          },
        ],
        pagination: {
          page: 1,
          per_page: 10,
          total: 2,
        },
      },
    };

    test("fetches and processes brew sessions successfully", async () => {
      ApiService.brewSessions.getAll.mockResolvedValue(mockApiResponse);

      const result = await brewSessionService.fetchBrewSessions(1, 10);

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(1, 10);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0]).toMatchObject({
        session_id: "session-2",
        name: "Test Session 2",
        status: "in-progress",
      });
      expect(result.sessions[0].brew_date).toBeInstanceOf(Date);
      expect(result.pagination).toEqual(mockApiResponse.data.pagination);
    });

    test("handles empty sessions array", async () => {
      ApiService.brewSessions.getAll.mockResolvedValue({
        data: { brew_sessions: [], pagination: {} },
      });

      const result = await brewSessionService.fetchBrewSessions();

      expect(result.sessions).toEqual([]);
      expect(result.pagination).toEqual({});
    });

    test("handles API errors", async () => {
      ApiService.brewSessions.getAll.mockRejectedValue(new Error("API Error"));

      await expect(brewSessionService.fetchBrewSessions()).rejects.toThrow(
        "Failed to load brew sessions"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching brew sessions:",
        expect.any(Error)
      );
    });

    test("uses default pagination values", async () => {
      ApiService.brewSessions.getAll.mockResolvedValue(mockApiResponse);

      await brewSessionService.fetchBrewSessions();

      expect(ApiService.brewSessions.getAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe("fetchBrewSession", () => {
    const mockSession = {
      session_id: "session-1",
      name: "Test Session",
      status: "completed",
      brew_date: "2024-01-15T10:00:00Z",
      recipe_id: "recipe-1",
    };

    test("fetches and processes single brew session", async () => {
      ApiService.brewSessions.getById.mockResolvedValue({ data: mockSession });

      const result = await brewSessionService.fetchBrewSession("session-1");

      expect(ApiService.brewSessions.getById).toHaveBeenCalledWith("session-1");
      expect(result).toMatchObject({
        session_id: "session-1",
        name: "Test Session",
      });
      expect(result.brew_date).toBeInstanceOf(Date);
    });

    test("handles API errors", async () => {
      ApiService.brewSessions.getById.mockRejectedValue(new Error("API Error"));

      await expect(
        brewSessionService.fetchBrewSession("session-1")
      ).rejects.toThrow("Failed to load brew session");
    });
  });

  describe("createBrewSession", () => {
    const validSessionData = {
      name: "New Session",
      recipe_id: "recipe-1",
      status: "planned",
      notes: "Test notes",
    };

    test("creates brew session successfully", async () => {
      const mockResponse = {
        data: {
          session_id: "new-session",
          ...validSessionData,
          brew_date: "2024-01-15T10:00:00Z",
        },
      };
      ApiService.brewSessions.create.mockResolvedValue(mockResponse);

      const result = await brewSessionService.createBrewSession(
        validSessionData
      );

      expect(ApiService.brewSessions.create).toHaveBeenCalledWith({
        name: "New Session",
        status: "planned",
        notes: "Test notes",
        recipe_id: "recipe-1",
      });
      expect(result.session_id).toBe("new-session");
    });

    test("validates session data before creation", async () => {
      const invalidData = {
        name: "", // Empty name
        // Missing recipe_id
        status: "planned",
      };

      await expect(
        brewSessionService.createBrewSession(invalidData)
      ).rejects.toThrow("Validation failed");
    });

    test("clears recipe cache after creation", async () => {
      ApiService.brewSessions.create.mockResolvedValue({
        data: { session_id: "new-session", ...validSessionData },
      });

      const clearCacheSpy = jest.spyOn(brewSessionService, "clearRecipeCache");

      await brewSessionService.createBrewSession(validSessionData);

      expect(clearCacheSpy).toHaveBeenCalledWith("recipe-1");
    });

    test("handles API errors during creation", async () => {
      ApiService.brewSessions.create.mockRejectedValue(new Error("API Error"));

      await expect(
        brewSessionService.createBrewSession(validSessionData)
      ).rejects.toThrow("Failed to create brew session");
    });
  });

  describe("updateBrewSession", () => {
    const validUpdateData = {
      name: "Updated Session",
      status: "completed",
      actual_og: 1.055,
      actual_fg: 1.012,
      actual_abv: 5.6,
      recipe_id: "recipe-1",
    };

    test("updates brew session successfully", async () => {
      const mockResponse = {
        data: {
          session_id: "session-1",
          ...validUpdateData,
        },
      };
      ApiService.brewSessions.update.mockResolvedValue(mockResponse);

      const result = await brewSessionService.updateBrewSession(
        "session-1",
        validUpdateData
      );

      expect(ApiService.brewSessions.update).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          name: "Updated Session",
          status: "completed",
          actual_og: 1.055,
        })
      );
      expect(result.session_id).toBe("session-1");
    });

    test("validates update data", async () => {
      const invalidData = {
        name: "Valid Name",
        actual_og: 1.5, // Invalid gravity
      };

      await expect(
        brewSessionService.updateBrewSession("session-1", invalidData)
      ).rejects.toThrow("Validation failed");
    });

    test("clears caches after update", async () => {
      ApiService.brewSessions.update.mockResolvedValue({
        data: { session_id: "session-1", ...validUpdateData },
      });

      const clearSessionCacheSpy = jest.spyOn(
        brewSessionService,
        "clearSessionCache"
      );
      const clearRecipeCacheSpy = jest.spyOn(
        brewSessionService,
        "clearRecipeCache"
      );

      await brewSessionService.updateBrewSession("session-1", validUpdateData);

      expect(clearSessionCacheSpy).toHaveBeenCalledWith("session-1");
      expect(clearRecipeCacheSpy).toHaveBeenCalledWith("recipe-1");
    });
  });

  describe("deleteBrewSession", () => {
    test("deletes brew session successfully", async () => {
      // Mock fetching session to get recipe_id
      ApiService.brewSessions.getById.mockResolvedValue({
        data: { session_id: "session-1", recipe_id: "recipe-1" },
      });
      ApiService.brewSessions.delete.mockResolvedValue({});

      const result = await brewSessionService.deleteBrewSession("session-1");

      expect(ApiService.brewSessions.delete).toHaveBeenCalledWith("session-1");
      expect(result).toBe(true);
    });

    test("clears all relevant caches", async () => {
      ApiService.brewSessions.getById.mockResolvedValue({
        data: { session_id: "session-1", recipe_id: "recipe-1" },
      });
      ApiService.brewSessions.delete.mockResolvedValue({});

      const clearSessionCacheSpy = jest.spyOn(
        brewSessionService,
        "clearSessionCache"
      );
      const clearRecipeCacheSpy = jest.spyOn(
        brewSessionService,
        "clearRecipeCache"
      );
      const clearAllRecipeCachesSpy = jest.spyOn(
        brewSessionService,
        "clearAllRecipeCaches"
      );

      await brewSessionService.deleteBrewSession("session-1");

      expect(clearSessionCacheSpy).toHaveBeenCalledWith("session-1");
      expect(clearRecipeCacheSpy).toHaveBeenCalledWith("recipe-1");
      expect(clearAllRecipeCachesSpy).toHaveBeenCalled();
    });

    test("handles case where session fetch fails before deletion", async () => {
      ApiService.brewSessions.getById.mockRejectedValue(new Error("Not found"));
      ApiService.brewSessions.delete.mockResolvedValue({});

      const result = await brewSessionService.deleteBrewSession("session-1");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Could not fetch session before deletion:",
        expect.any(Error)
      );
      expect(result).toBe(true);
    });
  });

  describe("getBrewSessionsForRecipe", () => {
    const mockSessions = [
      {
        session_id: "session-1",
        name: "Session 1",
        recipe_id: "recipe-1",
        status: "completed",
        brew_date: "2024-01-15T10:00:00Z",
      },
    ];

    test("fetches and caches recipe sessions", async () => {
      ApiService.recipes.getBrewSessions.mockResolvedValue({
        data: { brew_sessions: mockSessions },
      });

      const result = await brewSessionService.getBrewSessionsForRecipe(
        "recipe-1"
      );

      expect(ApiService.recipes.getBrewSessions).toHaveBeenCalledWith(
        "recipe-1"
      );
      expect(result).toHaveLength(1);
      expect(result[0].session_id).toBe("session-1");

      // Second call should use cache
      const cachedResult = await brewSessionService.getBrewSessionsForRecipe(
        "recipe-1"
      );
      expect(ApiService.recipes.getBrewSessions).toHaveBeenCalledTimes(1);
      expect(cachedResult).toEqual(result);
    });

    test("respects force refresh flag", async () => {
      ApiService.recipes.getBrewSessions.mockResolvedValue({
        data: { brew_sessions: mockSessions },
      });

      // First call
      await brewSessionService.getBrewSessionsForRecipe("recipe-1");
      // Force refresh
      await brewSessionService.getBrewSessionsForRecipe("recipe-1", true);

      expect(ApiService.recipes.getBrewSessions).toHaveBeenCalledTimes(2);
    });

    test("returns cached data on API error", async () => {
      ApiService.recipes.getBrewSessions
        .mockResolvedValueOnce({
          data: { brew_sessions: mockSessions },
        })
        .mockRejectedValueOnce(new Error("API Error"));

      // First call succeeds and caches
      const result1 = await brewSessionService.getBrewSessionsForRecipe(
        "recipe-1"
      );

      // Clear cache to simulate expired cache, then force an error
      brewSessionService.sessionsCache.delete("recipe-recipe-1");
      brewSessionService.sessionsCache.set("recipe-recipe-1", {
        data: result1,
        timestamp: Date.now(),
      });

      // Second call fails but returns cached data
      const result2 = await brewSessionService.getBrewSessionsForRecipe(
        "recipe-1",
        true
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Using cached data due to fetch error"
      );
      expect(result2).toEqual(result1);
    });

    test("returns empty array when no cache available and API fails", async () => {
      ApiService.recipes.getBrewSessions.mockRejectedValue(
        new Error("API Error")
      );

      const result = await brewSessionService.getBrewSessionsForRecipe(
        "recipe-1"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getBrewSessionSummary", () => {
    const mockSessions = [
      {
        session_id: "session-1",
        status: "completed",
        batch_rating: 4,
        actual_abv: 5.5,
        brew_date: new Date("2024-01-20"),
      },
      {
        session_id: "session-2",
        status: "in-progress",
        batch_rating: null,
        actual_abv: null,
        brew_date: new Date("2024-01-15"),
      },
      {
        session_id: "session-3",
        status: "completed",
        batch_rating: 5,
        actual_abv: 6.0,
        brew_date: new Date("2024-01-10"),
      },
    ];

    test("calculates brew session summary correctly", async () => {
      jest
        .spyOn(brewSessionService, "getBrewSessionsForRecipe")
        .mockResolvedValue(mockSessions);

      const summary = await brewSessionService.getBrewSessionSummary(
        "recipe-1"
      );

      expect(summary.total).toBe(3);
      expect(summary.active).toBe(1); // in-progress
      expect(summary.completed).toBe(2);
      expect(summary.mostRecent.session_id).toBe("session-1");
      expect(summary.averageRating).toBeCloseTo(4.5, 1);
      expect(summary.averageABV).toBeCloseTo(5.75, 2);
      expect(summary.successRate).toBeCloseTo(66.67, 2);
    });

    test("returns default summary on error", async () => {
      jest
        .spyOn(brewSessionService, "getBrewSessionsForRecipe")
        .mockRejectedValue(new Error("API Error"));

      const summary = await brewSessionService.getBrewSessionSummary(
        "recipe-1"
      );

      expect(summary).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        mostRecent: null,
        mostRelevant: null,
        averageRating: null,
        averageABV: null,
        successRate: null,
      });
    });
  });

  describe("processBrewSessionData", () => {
    test("processes session data with date conversion", () => {
      const rawSession = {
        session_id: "session-1",
        name: "Test Session",
        status: "completed",
        brew_date: "2024-01-15T10:00:00Z",
        fermentation_start_date: "2024-01-16T10:00:00Z",
      };

      const processed = brewSessionService.processBrewSessionData(rawSession);

      expect(processed.brew_date).toBeInstanceOf(Date);
      expect(processed.fermentation_start_date).toBeInstanceOf(Date);
      expect(processed.displayName).toBe("Test Session");
      expect(processed.formattedStatus).toBe("Completed");
      expect(processed.statusColor).toBe("#059669");
      expect(processed.isActive).toBe(false);
    });

    test("handles null session", () => {
      const result = brewSessionService.processBrewSessionData(null);
      expect(result).toBeNull();
    });

    test("handles session without dates", () => {
      const rawSession = {
        session_id: "session-1",
        name: "Test Session",
        status: "planned",
      };

      const processed = brewSessionService.processBrewSessionData(rawSession);

      expect(processed.brew_date).toBeNull();
      expect(processed.isActive).toBe(true);
    });
  });

  describe("processBrewSessionsData", () => {
    test("processes and sorts sessions by brew date", () => {
      const rawSessions = [
        {
          session_id: "session-1",
          brew_date: "2024-01-10T10:00:00Z",
        },
        {
          session_id: "session-2",
          brew_date: "2024-01-20T10:00:00Z",
        },
        {
          session_id: "session-3",
          brew_date: "2024-01-15T10:00:00Z",
        },
      ];

      const processed = brewSessionService.processBrewSessionsData(rawSessions);

      expect(processed).toHaveLength(3);
      expect(processed[0].session_id).toBe("session-2"); // Most recent first
      expect(processed[1].session_id).toBe("session-3");
      expect(processed[2].session_id).toBe("session-1");
    });

    test("handles non-array input", () => {
      expect(brewSessionService.processBrewSessionsData(null)).toEqual([]);
      expect(brewSessionService.processBrewSessionsData("not-array")).toEqual(
        []
      );
    });
  });

  describe("validateBrewSessionData", () => {
    test("validates valid session data for creation", () => {
      const validData = {
        name: "Test Session",
        recipe_id: "recipe-1",
        status: "planned",
      };

      const result = brewSessionService.validateBrewSessionData(
        validData,
        true
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("validates valid session data for update", () => {
      const validData = {
        name: "Test Session",
        status: "planned",
        // No recipe_id required for update
      };

      const result = brewSessionService.validateBrewSessionData(
        validData,
        false
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("catches validation errors", () => {
      const invalidData = {
        name: "",
        // Missing recipe_id for creation
        status: "",
        actual_og: 1.5, // Invalid gravity
        actual_fg: 1.6, // Invalid and higher than OG
        actual_abv: 25, // Too high
        batch_rating: 6, // Too high
      };

      const result = brewSessionService.validateBrewSessionData(
        invalidData,
        true
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Session name is required");
      expect(result.errors).toContain("Recipe is required");
      expect(result.errors).toContain("Session status is required");
      expect(result.errors).toContain(
        "Original gravity must be between 0.99 and 1.2"
      );
      expect(result.errors).toContain(
        "Final gravity must be between 0.99 and 1.2"
      );
      expect(result.errors).toContain("ABV must be between 0 and 20%");
      expect(result.errors).toContain("Rating must be between 1 and 5");
    });

    test("validates gravity relationship", () => {
      const invalidData = {
        name: "Test",
        recipe_id: "recipe-1",
        status: "completed",
        actual_og: 1.045,
        actual_fg: 1.05, // Higher than OG
      };

      const result = brewSessionService.validateBrewSessionData(
        invalidData,
        true
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Final gravity must be less than original gravity"
      );
    });
  });

  describe("validateFermentationEntry", () => {
    test("validates valid fermentation entry", () => {
      const validEntry = {
        gravity: 1.045,
        temperature: 68,
        ph: 4.5,
      };

      const result = brewSessionService.validateFermentationEntry(validEntry);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("catches fermentation validation errors", () => {
      const invalidEntry = {
        gravity: 1.5, // Too high
        temperature: 150, // Too high
        ph: 12, // Too high
      };

      const result = brewSessionService.validateFermentationEntry(invalidEntry);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Gravity must be between 0.99 and 1.2");
      expect(result.errors).toContain(
        "Temperature must be between 32°F and 120°F"
      );
      expect(result.errors).toContain("pH must be between 3.0 and 9.0");
    });
  });

  describe("formatBrewSessionForApi", () => {
    test("formats session data for API submission", () => {
      const sessionData = {
        name: "  Test Session  ",
        status: "completed",
        notes: "  Test notes  ",
        recipe_id: "recipe-1",
        actual_og: "1.055",
        actual_fg: "1.012",
        batch_rating: "4",
      };

      const formatted = brewSessionService.formatBrewSessionForApi(sessionData);

      expect(formatted).toEqual({
        name: "Test Session",
        status: "completed",
        notes: "Test notes",
        recipe_id: "recipe-1",
        actual_og: 1.055,
        actual_fg: 1.012,
        batch_rating: 4,
      });
    });

    test("handles missing optional fields", () => {
      const sessionData = {
        name: "Test Session",
        status: "planned",
      };

      const formatted = brewSessionService.formatBrewSessionForApi(sessionData);

      expect(formatted).toEqual({
        name: "Test Session",
        status: "planned",
        notes: "",
      });
    });
  });

  describe("calculation methods", () => {
    describe("calculateAverage", () => {
      test("calculates average correctly", () => {
        const sessions = [
          { actual_abv: 5.0 },
          { actual_abv: 6.0 },
          { actual_abv: 7.0 },
        ];

        const avg = brewSessionService.calculateAverage(sessions, "actual_abv");
        expect(avg).toBeCloseTo(6.0);
      });

      test("handles null and undefined values", () => {
        const sessions = [
          { actual_abv: 5.0 },
          { actual_abv: null },
          { actual_abv: undefined },
          { actual_abv: 6.0 },
        ];

        const avg = brewSessionService.calculateAverage(sessions, "actual_abv");
        expect(avg).toBeCloseTo(5.5);
      });

      test("returns null for no valid values", () => {
        const sessions = [{ actual_abv: null }, { actual_abv: undefined }];

        const avg = brewSessionService.calculateAverage(sessions, "actual_abv");
        expect(avg).toBeNull();
      });
    });

    describe("calculateSuccessRate", () => {
      test("calculates success rate correctly", () => {
        const sessions = [
          { status: "completed" },
          { status: "completed" },
          { status: "in-progress" },
          { status: "planned" },
        ];

        const rate = brewSessionService.calculateSuccessRate(sessions);
        expect(rate).toBe(50); // 2 out of 4
      });

      test("returns null for empty sessions", () => {
        const rate = brewSessionService.calculateSuccessRate([]);
        expect(rate).toBeNull();
      });
    });

    describe("calculateTrend", () => {
      test("identifies improving trend", () => {
        const values = [4.0, 4.5, 5.0, 5.5];
        const trend = brewSessionService.calculateTrend(values);
        expect(trend).toBe("improving");
      });

      test("identifies declining trend", () => {
        const values = [5.5, 5.0, 4.5, 4.0];
        const trend = brewSessionService.calculateTrend(values);
        expect(trend).toBe("declining");
      });

      test("identifies stable trend", () => {
        const values = [5.0, 5.1, 4.9, 5.0];
        const trend = brewSessionService.calculateTrend(values);
        expect(trend).toBe("stable");
      });

      test("handles insufficient data", () => {
        const trend = brewSessionService.calculateTrend([5.0]);
        expect(trend).toBe("stable");
      });
    });

    describe("calculateStandardDeviation", () => {
      test("calculates standard deviation correctly", () => {
        const values = [2, 4, 4, 4, 5, 5, 7, 9];
        const stdDev = brewSessionService.calculateStandardDeviation(values);
        expect(stdDev).toBeCloseTo(2.0, 1);
      });

      test("returns 0 for insufficient data", () => {
        const stdDev = brewSessionService.calculateStandardDeviation([5.0]);
        expect(stdDev).toBe(0);
      });
    });
  });

  describe("utility methods", () => {
    test("getSessionDisplayName", () => {
      const sessionWithName = { name: "My Session" };
      const sessionWithoutName = { session_id: "abc123def456" };

      expect(brewSessionService.getSessionDisplayName(sessionWithName)).toBe(
        "My Session"
      );
      expect(brewSessionService.getSessionDisplayName(sessionWithoutName)).toBe(
        "Session #abc123"
      );
    });

    test("formatStatus", () => {
      expect(brewSessionService.formatStatus("in-progress")).toBe(
        "In progress"
      );
      expect(brewSessionService.formatStatus("completed")).toBe("Completed");
      expect(brewSessionService.formatStatus(null)).toBe("Unknown");
    });

    test("getStatusColor", () => {
      expect(brewSessionService.getStatusColor("completed")).toBe("#059669");
      expect(brewSessionService.getStatusColor("in-progress")).toBe("#f59e0b");
      expect(brewSessionService.getStatusColor("unknown")).toBe("#6b7280");
    });

    test("isSessionActive", () => {
      expect(brewSessionService.isSessionActive("planned")).toBe(true);
      expect(brewSessionService.isSessionActive("in-progress")).toBe(true);
      expect(brewSessionService.isSessionActive("fermenting")).toBe(true);
      expect(brewSessionService.isSessionActive("conditioning")).toBe(true);
      expect(brewSessionService.isSessionActive("completed")).toBe(false);
      expect(brewSessionService.isSessionActive("archived")).toBe(false);
    });
  });

  describe("cache management", () => {
    test("clearSessionCache removes session-related caches", () => {
      brewSessionService.sessionsCache.set("recipe-recipe1", { data: [] });
      brewSessionService.sessionsCache.set("session-123-data", { data: {} });
      brewSessionService.sessionsCache.set("other-cache", { data: {} });

      brewSessionService.clearSessionCache("session-123");

      expect(brewSessionService.sessionsCache.has("recipe-recipe1")).toBe(true);
      expect(brewSessionService.sessionsCache.has("session-123-data")).toBe(
        false
      );
      expect(brewSessionService.sessionsCache.has("other-cache")).toBe(true);
    });

    test("clearRecipeCache removes specific recipe cache", () => {
      brewSessionService.sessionsCache.set("recipe-recipe1", { data: [] });
      brewSessionService.sessionsCache.set("recipe-recipe2", { data: [] });

      brewSessionService.clearRecipeCache("recipe1");

      expect(brewSessionService.sessionsCache.has("recipe-recipe1")).toBe(
        false
      );
      expect(brewSessionService.sessionsCache.has("recipe-recipe2")).toBe(true);
    });

    test("clearAllRecipeCaches removes all recipe-related caches", () => {
      brewSessionService.sessionsCache.set("recipe-recipe1", { data: [] });
      brewSessionService.sessionsCache.set("recipe-recipe2", { data: [] });
      brewSessionService.sessionsCache.set("other-cache", { data: {} });

      brewSessionService.clearAllRecipeCaches();

      expect(brewSessionService.sessionsCache.has("recipe-recipe1")).toBe(
        false
      );
      expect(brewSessionService.sessionsCache.has("recipe-recipe2")).toBe(
        false
      );
      expect(brewSessionService.sessionsCache.has("other-cache")).toBe(true);
    });

    test("clearCache removes all caches", () => {
      brewSessionService.sessionsCache.set("cache1", { data: [] });
      brewSessionService.sessionsCache.set("cache2", { data: [] });

      brewSessionService.clearCache();

      expect(brewSessionService.sessionsCache.size).toBe(0);
    });
  });

  describe("fermentation methods", () => {
    test("getFermentationData", async () => {
      const mockData = { entries: [] };
      ApiService.brewSessions.getFermentationData.mockResolvedValue({
        data: mockData,
      });

      const result = await brewSessionService.getFermentationData("session-1");

      expect(ApiService.brewSessions.getFermentationData).toHaveBeenCalledWith(
        "session-1"
      );
      expect(result).toEqual(mockData);
    });

    test("addFermentationEntry validates and adds entry", async () => {
      const validEntry = { gravity: 1.045, temperature: 68 };
      const mockResponse = { data: { id: "entry-1", ...validEntry } };
      ApiService.brewSessions.addFermentationEntry.mockResolvedValue(
        mockResponse
      );

      const result = await brewSessionService.addFermentationEntry(
        "session-1",
        validEntry
      );

      expect(ApiService.brewSessions.addFermentationEntry).toHaveBeenCalledWith(
        "session-1",
        validEntry
      );
      expect(result).toEqual(mockResponse.data);
    });

    test("addFermentationEntry validates entry data", async () => {
      const invalidEntry = { gravity: 1.5 }; // Invalid gravity

      await expect(
        brewSessionService.addFermentationEntry("session-1", invalidEntry)
      ).rejects.toThrow("Validation failed");
    });
  });

  describe("sessionExists", () => {
    test("returns true for existing session", async () => {
      ApiService.brewSessions.getById.mockResolvedValue({
        data: { session_id: "session-1" },
      });

      const exists = await brewSessionService.sessionExists("session-1");
      expect(exists).toBe(true);
    });

    test("returns false for non-existing session", async () => {
      ApiService.brewSessions.getById.mockRejectedValue(new Error("Not found"));

      const exists = await brewSessionService.sessionExists("session-1");
      expect(exists).toBe(false);
    });
  });

  describe("error handling", () => {
    test("createBrewSessionError creates standardized error", () => {
      const originalError = new Error("Original error");
      originalError.response = {
        data: { error: "API specific error" },
      };

      const error = brewSessionService.createBrewSessionError(
        "Test message",
        originalError
      );

      expect(error.message).toBe("Test message: API specific error");
      expect(error.isBrewSessionError).toBe(true);
      expect(error.originalError).toBe(originalError);
    });

    test("createBrewSessionError handles simple error", () => {
      const originalError = new Error("Simple error");

      const error = brewSessionService.createBrewSessionError(
        "Test message",
        originalError
      );

      expect(error.message).toBe("Test message: Simple error");
    });
  });
});
