import ApiService from "../api";
import {
  BrewSession,
  ID,
  GravityStabilizationAnalysis,
  DryHopAddition,
} from "../../types";
import { AddDryHopAdditionRequest } from "../../types/api";

// Service-specific interfaces
interface BrewSessionValidation {
  isValid: boolean;
  errors: string[];
}

interface FermentationEntryValidation {
  isValid: boolean;
  errors: string[];
}

interface BrewSessionSummary {
  total: number;
  active: number;
  completed: number;
  mostRecent: BrewSession | null;
  mostRelevant: BrewSession | null;
  averageRating: number | null;
  averageABV: number | null;
  successRate: number | null;
}

interface BrewingStats {
  totalBrewed: number;
  completedBatches: number;
  averageOG: number | null;
  averageFG: number | null;
  averageABV: number | null;
  averageEfficiency: number | null;
  averageRating: number | null;
  consistency: {
    og: number;
    fg: number;
    abv: number;
  } | null;
  trends: {
    abv: string;
    rating: string;
  } | null;
}

interface BrewSessionCacheEntry {
  data: BrewSession[];
  timestamp: number;
}

interface BrewSessionsResponse {
  sessions: BrewSession[];
  pagination: any;
}

interface ProcessedBrewSession extends BrewSession {
  displayName: string;
  formattedStatus: string;
  statusColor: string;
  duration: number | null;
  isActive: boolean;
}

/**
 * Service class for managing brew session business logic
 */
class BrewSessionService {
  private sessionsCache: Map<string, BrewSessionCacheEntry>;
  private readonly CACHE_DURATION: number;

  constructor() {
    this.sessionsCache = new Map();
    this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter cache for more dynamic data)
  }

  /**
   * Fetch all brew sessions for the user
   */
  async fetchBrewSessions(
    page: number = 1,
    perPage: number = 10
  ): Promise<BrewSessionsResponse> {
    try {
      const response = await ApiService.brewSessions.getAll(page, perPage);

      return {
        sessions: this.processBrewSessionsData(
          (response.data as any).brew_sessions || []
        ),
        pagination: (response.data as any).pagination || {},
      };
    } catch (error) {
      console.error("Error fetching brew sessions:", error);
      throw this.createBrewSessionError("Failed to load brew sessions", error);
    }
  }

  /**
   * Fetch a single brew session by ID
   */
  async fetchBrewSession(sessionId: ID): Promise<ProcessedBrewSession> {
    try {
      const response = await ApiService.brewSessions.getById(sessionId);
      return this.processBrewSessionData(response.data);
    } catch (error) {
      console.error("Error fetching brew session:", error);
      throw this.createBrewSessionError("Failed to load brew session", error);
    }
  }

  /**
   * Create a new brew session
   */
  async createBrewSession(
    sessionData: Partial<BrewSession>
  ): Promise<ProcessedBrewSession> {
    try {
      const validation = this.validateBrewSessionData(sessionData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const formattedData = this.formatBrewSessionForApi(sessionData);
      const response = await ApiService.brewSessions.create(formattedData);

      const processedSession = this.processBrewSessionData(response.data);

      // Clear relevant caches
      if (sessionData.recipe_id) {
        this.clearRecipeCache(sessionData.recipe_id);
      }

      return processedSession;
    } catch (error) {
      console.error("Error creating brew session:", error);
      throw this.createBrewSessionError("Failed to create brew session", error);
    }
  }

  /**
   * Update an existing brew session
   */
  async updateBrewSession(
    sessionId: ID,
    sessionData: Partial<BrewSession>
  ): Promise<ProcessedBrewSession> {
    try {
      const validation = this.validateBrewSessionData(sessionData, false);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const formattedData = this.formatBrewSessionForApi(sessionData);
      const response = await ApiService.brewSessions.update(
        sessionId,
        formattedData
      );

      const processedSession = this.processBrewSessionData(response.data);

      // Clear caches
      this.clearSessionCache(sessionId);
      if (sessionData.recipe_id) {
        this.clearRecipeCache(sessionData.recipe_id);
      }

      return processedSession;
    } catch (error) {
      console.error("Error updating brew session:", error);
      throw this.createBrewSessionError("Failed to update brew session", error);
    }
  }

  /**
   * Delete a brew session
   */
  async deleteBrewSession(sessionId: ID): Promise<boolean> {
    try {
      // First get the session to know which recipe cache to clear
      let recipeId: ID | null = null;
      try {
        const session = await this.fetchBrewSession(sessionId);
        recipeId = session.recipe_id || null;
      } catch (err) {
        // If we can't fetch the session, it might already be deleted
        console.warn("Could not fetch session before deletion:", err);
      }

      await ApiService.brewSessions.delete(sessionId);

      // Clear both session and recipe caches
      this.clearSessionCache(sessionId);
      if (recipeId) {
        this.clearRecipeCache(recipeId);
      }

      // Also clear all recipe caches as we might not have the recipe ID
      this.clearAllRecipeCaches();

      return true;
    } catch (error) {
      console.error("Error deleting brew session:", error);
      throw this.createBrewSessionError("Failed to delete brew session", error);
    }
  }

  /**
   * Get brew sessions for a specific recipe with caching and force refresh option
   */
  async getBrewSessionsForRecipe(
    recipeId: ID,
    forceRefresh: boolean = false
  ): Promise<BrewSession[]> {
    const cacheKey = `recipe-${recipeId}`;

    // Check cache first (unless force refresh is requested)
    if (!forceRefresh && this.sessionsCache.has(cacheKey)) {
      const cached = this.sessionsCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }
    }

    try {
      const response = await ApiService.recipes.getBrewSessions(recipeId);
      const sessions = this.processBrewSessionsData(
        (response.data as any).brew_sessions || []
      );

      // Cache the result
      this.sessionsCache.set(cacheKey, {
        data: sessions,
        timestamp: Date.now(),
      });

      return sessions;
    } catch (error) {
      console.error("Error fetching recipe brew sessions:", error);
      // If we have cached data and the request failed, return cached data
      if (this.sessionsCache.has(cacheKey)) {
        console.warn("Using cached data due to fetch error");
        return this.sessionsCache.get(cacheKey)!.data;
      }
      // Return empty array instead of throwing to maintain UX
      return [];
    }
  }

  /**
   * Get brew session summary for a recipe with force refresh option
   */
  async getBrewSessionSummary(
    recipeId: ID,
    forceRefresh: boolean = false
  ): Promise<BrewSessionSummary> {
    try {
      const sessions = await this.getBrewSessionsForRecipe(
        recipeId,
        forceRefresh
      );

      return {
        total: sessions.length,
        active: sessions.filter((s) =>
          ["planned", "in-progress", "fermenting", "conditioning"].includes(
            s.status || ""
          )
        ).length,
        completed: sessions.filter((s) => s.status === "completed").length,
        mostRecent: sessions.length > 0 ? sessions[0] : null,
        mostRelevant: this.findMostRelevantSession(sessions),
        averageRating: this.calculateAverageRating(sessions),
        averageABV: this.calculateAverageABV(sessions),
        successRate: this.calculateSuccessRate(sessions),
      };
    } catch (error) {
      console.error("Error getting brew session summary:", error);
      return this.getDefaultSummary();
    }
  }

  /**
   * Get brewing statistics across all sessions for a recipe
   */
  async getBrewingStats(recipeId: ID): Promise<BrewingStats | null> {
    try {
      const sessions = await this.getBrewSessionsForRecipe(recipeId);
      const completedSessions = sessions.filter(
        (s) =>
          s.status === "completed" && s.actual_og && s.actual_fg && s.actual_abv
      );

      if (completedSessions.length === 0) {
        return null;
      }

      return {
        totalBrewed: sessions.length,
        completedBatches: completedSessions.length,
        averageOG: this.calculateAverage(completedSessions, "actual_og"),
        averageFG: this.calculateAverage(completedSessions, "actual_fg"),
        averageABV: this.calculateAverage(completedSessions, "actual_abv"),
        averageEfficiency: this.calculateAverage(
          completedSessions,
          "actual_efficiency"
        ),
        averageRating: this.calculateAverageRating(completedSessions),
        consistency: this.calculateConsistency(completedSessions),
        trends: this.calculateTrends(completedSessions),
      };
    } catch (error) {
      console.error("Error calculating brewing stats:", error);
      return null;
    }
  }

  /**
   * Get fermentation data for a session
   */
  async getFermentationData(sessionId: ID): Promise<any[]> {
    try {
      const response = await ApiService.brewSessions.getFermentationData(
        sessionId
      );
      // Backend returns fermentation data as a direct array, not wrapped in ApiResponse
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error("Error fetching fermentation data:", error);
      throw this.createBrewSessionError(
        "Failed to load fermentation data",
        error
      );
    }
  }

  /**
   * Add fermentation entry
   */
  async addFermentationEntry(
    sessionId: ID,
    entryData: any,
    unitSystem: string = "imperial"
  ): Promise<any> {
    try {
      const validation = this.validateFermentationEntry(entryData, unitSystem);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const response = await ApiService.brewSessions.addFermentationEntry(
        sessionId,
        entryData
      );
      // Backend returns updated fermentation data as a direct array, not wrapped in ApiResponse
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error("Error adding fermentation entry:", error);
      throw this.createBrewSessionError(
        "Failed to add fermentation entry",
        error
      );
    }
  }

  /**
   * Delete fermentation entry
   */
  async deleteFermentationEntry(
    sessionId: ID,
    entryIndex: number
  ): Promise<void> {
    try {
      await ApiService.brewSessions.deleteFermentationEntry(
        sessionId,
        entryIndex
      );
    } catch (error) {
      console.error("Error deleting fermentation entry:", error);
      throw this.createBrewSessionError(
        "Failed to delete fermentation entry",
        error
      );
    }
  }

  /**
   * Update fermentation entry
   */
  async updateFermentationEntry(
    sessionId: ID,
    entryIndex: number,
    entryData: any,
    unitSystem: string = "imperial"
  ): Promise<any> {
    try {
      // Validate entry data
      this.validateFermentationEntry(entryData, unitSystem);

      const response = await ApiService.brewSessions.updateFermentationEntry(
        sessionId,
        entryIndex,
        entryData
      );
      return response.data;
    } catch (error) {
      console.error("Error updating fermentation entry:", error);
      throw this.createBrewSessionError(
        "Failed to update fermentation entry",
        error
      );
    }
  }

  /**
   * Get fermentation statistics
   */
  async getFermentationStats(sessionId: ID): Promise<any | null> {
    try {
      const response = await ApiService.brewSessions.getFermentationStats(
        sessionId
      );
      // Backend returns fermentation stats as a direct object, not wrapped in ApiResponse
      return response.data;
    } catch (error) {
      console.error("Error fetching fermentation stats:", error);
      return null;
    }
  }

  /**
   * Analyze gravity stabilization to detect fermentation completion
   */
  async analyzeFermentationCompletion(
    sessionId: ID
  ): Promise<GravityStabilizationAnalysis | null> {
    try {
      const response =
        await ApiService.brewSessions.analyzeFermentationCompletion(sessionId);
      // Backend returns analysis as a direct object, not wrapped in ApiResponse
      return response.data;
    } catch (error) {
      console.error("Error analyzing fermentation completion:", error);
      return null;
    }
  }

  // ===== DATA PROCESSING METHODS =====

  /**
   * Process multiple brew sessions data
   */
  processBrewSessionsData(sessions: any[]): BrewSession[] {
    if (!Array.isArray(sessions)) return [];

    return sessions
      .map((session) => this.processBrewSessionData(session))
      .sort((a, b) => {
        // Sort by brew date, most recent first
        if (!a.brew_date && !b.brew_date) return 0;
        if (!a.brew_date) return 1;
        if (!b.brew_date) return -1;
        return (
          new Date(b.brew_date).getTime() - new Date(a.brew_date).getTime()
        );
      });
  }

  /**
   * Process single brew session data
   */
  processBrewSessionData(session: any): ProcessedBrewSession {
    if (!session) throw new Error("No session data provided");

    const processedSession: ProcessedBrewSession = {
      ...session,
      brew_date: session.brew_date ? new Date(session.brew_date) : null,
      fermentation_start_date: session.fermentation_start_date
        ? new Date(session.fermentation_start_date)
        : null,
      fermentation_end_date: session.fermentation_end_date
        ? new Date(session.fermentation_end_date)
        : null,
      packaging_date: session.packaging_date
        ? new Date(session.packaging_date)
        : null,
      // Add computed fields
      displayName: this.getSessionDisplayName(session),
      formattedStatus: this.formatStatus(session.status),
      statusColor: this.getStatusColor(session.status),
      duration: this.calculateSessionDuration(session),
      isActive: this.isSessionActive(session.status),
    };

    return processedSession;
  }

  /**
   * Find the most relevant session (active first, then most recent)
   */
  findMostRelevantSession(sessions: BrewSession[]): BrewSession | null {
    if (!sessions || sessions.length === 0) return null;

    // Priority: active sessions first
    const activeSessions = sessions.filter((s) =>
      this.isSessionActive(s.status)
    );

    if (activeSessions.length > 0) {
      return activeSessions[0]; // Most recent active session
    }

    // If no active sessions, return most recent
    return sessions[0];
  }

  // ===== VALIDATION METHODS =====

  /**
   * Validate brew session data
   */
  validateBrewSessionData(
    sessionData: Partial<BrewSession>,
    isCreate: boolean = true
  ): BrewSessionValidation {
    const errors: string[] = [];

    if (isCreate && !sessionData.recipe_id) {
      errors.push("Recipe is required");
    }

    // For creation, always require name
    // For updates, only require name if the name field is present and empty
    if (isCreate) {
      if (!sessionData.name || sessionData.name.trim().length === 0) {
        errors.push("Session name is required");
      }
    } else {
      // For updates, only validate name if it's being explicitly set
      if (
        sessionData.hasOwnProperty("name") &&
        (!sessionData.name || sessionData.name.trim().length === 0)
      ) {
        errors.push("Session name is required");
      }
    }

    if (isCreate && !sessionData.status) {
      errors.push("Session status is required");
    }

    if (
      sessionData.actual_og &&
      (sessionData.actual_og < 0.99 || sessionData.actual_og > 1.2)
    ) {
      errors.push("Original gravity must be between 0.99 and 1.2");
    }

    if (
      sessionData.actual_fg &&
      (sessionData.actual_fg < 0.99 || sessionData.actual_fg > 1.2)
    ) {
      errors.push("Final gravity must be between 0.99 and 1.2");
    }

    if (
      sessionData.actual_og &&
      sessionData.actual_fg &&
      sessionData.actual_fg >= sessionData.actual_og
    ) {
      errors.push("Final gravity must be less than original gravity");
    }

    if (
      sessionData.actual_abv &&
      (sessionData.actual_abv < 0 || sessionData.actual_abv > 20)
    ) {
      errors.push("ABV must be between 0 and 20%");
    }

    if (
      sessionData.batch_rating &&
      (sessionData.batch_rating < 1 || sessionData.batch_rating > 5)
    ) {
      errors.push("Rating must be between 1 and 5");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate fermentation entry data
   */
  validateFermentationEntry(
    entryData: any,
    unitSystem: string = "imperial"
  ): FermentationEntryValidation {
    const errors: string[] = [];

    if (
      entryData.gravity &&
      (entryData.gravity < 0.99 || entryData.gravity > 1.2)
    ) {
      errors.push("Gravity must be between 0.99 and 1.2");
    }

    if (entryData.temperature) {
      // Temperature validation based on unit system
      if (unitSystem === "metric") {
        // Celsius range: 0°C to 49°C (32°F to 120°F equivalent)
        if (entryData.temperature < 0 || entryData.temperature > 49) {
          errors.push("Temperature must be between 0°C and 49°C");
        }
      } else {
        // Fahrenheit range: 32°F to 120°F
        if (entryData.temperature < 32 || entryData.temperature > 120) {
          errors.push("Temperature must be between 32°F and 120°F");
        }
      }
    }

    if (entryData.ph && (entryData.ph < 3.0 || entryData.ph > 9.0)) {
      errors.push("pH must be between 3.0 and 9.0");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== FORMATTING METHODS =====

  /**
   * Format session data for API submission
   */
  formatBrewSessionForApi(sessionData: Partial<BrewSession>): any {
    const formatted: any = {};

    // Only include fields that are explicitly provided
    if (sessionData.hasOwnProperty("name")) {
      formatted.name = sessionData.name?.trim() || "";
    }
    if (sessionData.hasOwnProperty("status")) {
      formatted.status = sessionData.status || "planned";
    }
    if (sessionData.hasOwnProperty("notes")) {
      formatted.notes = sessionData.notes?.trim() || "";
    }

    // Add optional fields only if they have values
    if (sessionData.recipe_id) formatted.recipe_id = sessionData.recipe_id;
    if (sessionData.brew_date) formatted.brew_date = sessionData.brew_date;
    if (sessionData.mash_temp)
      formatted.mash_temp = parseFloat(sessionData.mash_temp.toString());
    if (sessionData.actual_og)
      formatted.actual_og = parseFloat(sessionData.actual_og.toString());
    if (sessionData.actual_fg)
      formatted.actual_fg = parseFloat(sessionData.actual_fg.toString());
    if (sessionData.actual_abv)
      formatted.actual_abv = parseFloat(sessionData.actual_abv.toString());
    if (sessionData.actual_efficiency)
      formatted.actual_efficiency = parseFloat(
        sessionData.actual_efficiency.toString()
      );
    if (sessionData.fermentation_start_date)
      formatted.fermentation_start_date = sessionData.fermentation_start_date;
    if (sessionData.fermentation_end_date)
      formatted.fermentation_end_date = sessionData.fermentation_end_date;
    if (sessionData.packaging_date)
      formatted.packaging_date = sessionData.packaging_date;
    if (sessionData.tasting_notes)
      formatted.tasting_notes = sessionData.tasting_notes.trim();
    if (sessionData.batch_rating)
      formatted.batch_rating = parseInt(sessionData.batch_rating.toString());

    return formatted;
  }

  /**
   * Get session display name
   */
  getSessionDisplayName(session: Partial<BrewSession>): string {
    if (session.name) return session.name;
    return `Session #${
      session.session_id?.toString().substring(0, 6) || "Unknown"
    }`;
  }

  /**
   * Format status for display
   */
  formatStatus(status?: string): string {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ");
  }

  /**
   * Get status color
   */
  getStatusColor(status?: string): string {
    const colors: Record<string, string> = {
      planned: "#3b82f6",
      "in-progress": "#f59e0b",
      fermenting: "#8b5cf6",
      conditioning: "#10b981",
      completed: "#059669",
      archived: "#6b7280",
    };
    return colors[status || ""] || "#6b7280";
  }

  /**
   * Check if session is active
   */
  isSessionActive(status?: string): boolean {
    return ["planned", "in-progress", "fermenting", "conditioning"].includes(
      status || ""
    );
  }

  // ===== CALCULATION METHODS =====

  /**
   * Calculate average for a numeric field across sessions
   */
  calculateAverage(
    sessions: BrewSession[],
    field: keyof BrewSession
  ): number | null {
    const validValues = sessions
      .map((s) => s[field] as number)
      .filter((val) => val !== null && val !== undefined && !isNaN(val));

    if (validValues.length === 0) return null;

    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

  /**
   * Calculate average rating across sessions
   */
  calculateAverageRating(sessions: BrewSession[]): number | null {
    const ratings = sessions
      .map((s) => s.batch_rating)
      .filter((rating) => rating && rating > 0);

    if (ratings.length === 0) return null;

    return (
      ratings.reduce((sum: number, rating) => sum + (rating || 0), 0) /
      ratings.length
    );
  }

  /**
   * Calculate average ABV across completed sessions
   */
  calculateAverageABV(sessions: BrewSession[]): number | null {
    return this.calculateAverage(
      sessions.filter((s) => s.status === "completed"),
      "actual_abv"
    );
  }

  /**
   * Calculate success rate (completed vs planned)
   */
  calculateSuccessRate(sessions: BrewSession[]): number | null {
    if (sessions.length === 0) return null;

    const completed = sessions.filter((s) => s.status === "completed").length;
    return (completed / sessions.length) * 100;
  }

  /**
   * Calculate brewing consistency
   */
  calculateConsistency(
    sessions: BrewSession[]
  ): { og: number; fg: number; abv: number } | null {
    if (sessions.length < 2) return null;

    const ogValues = sessions
      .map((s) => s.actual_og)
      .filter((v): v is number => v !== undefined && v !== null);
    const fgValues = sessions
      .map((s) => s.actual_fg)
      .filter((v): v is number => v !== undefined && v !== null);
    const abvValues = sessions
      .map((s) => s.actual_abv)
      .filter((v): v is number => v !== undefined && v !== null);

    return {
      og: this.calculateStandardDeviation(ogValues),
      fg: this.calculateStandardDeviation(fgValues),
      abv: this.calculateStandardDeviation(abvValues),
    };
  }

  /**
   * Calculate trends over time
   */
  calculateTrends(
    sessions: BrewSession[]
  ): { abv: string; rating: string } | null {
    const sortedSessions = [...sessions].sort((a, b) => {
      if (!a.brew_date || !b.brew_date) return 0;
      return new Date(a.brew_date).getTime() - new Date(b.brew_date).getTime();
    });

    if (sortedSessions.length < 2) return null;

    const abvValues = sortedSessions
      .map((s) => s.actual_abv)
      .filter((v): v is number => v !== undefined && v !== null);
    const ratingValues = sortedSessions
      .map((s) => s.batch_rating)
      .filter((v): v is number => v !== undefined && v !== null);

    return {
      abv: this.calculateTrend(abvValues),
      rating: this.calculateTrend(ratingValues),
    };
  }

  /**
   * Calculate trend direction for a series of values
   */
  calculateTrend(values: number[]): string {
    if (values.length < 2) return "stable";

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) return "stable";
    return change > 0 ? "improving" : "declining";
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate session duration
   */
  calculateSessionDuration(session: Partial<BrewSession>): number | null {
    if (!session.brew_date) return null;

    const endDate =
      session.packaging_date ||
      session.fermentation_end_date ||
      new Date().toISOString();
    const startDate = session.brew_date;

    const diffTime = Math.abs(
      new Date(endDate).getTime() - new Date(startDate).getTime()
    );
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get default summary when data fetch fails
   */
  getDefaultSummary(): BrewSessionSummary {
    return {
      total: 0,
      active: 0,
      completed: 0,
      mostRecent: null,
      mostRelevant: null,
      averageRating: null,
      averageABV: null,
      successRate: null,
    };
  }

  /**
   * Create standardized brew session error
   */
  createBrewSessionError(message: string, originalError?: any): Error {
    const error = new Error(message) as any;
    error.originalError = originalError;
    error.isBrewSessionError = true;

    if (originalError?.response?.data?.error) {
      error.message = `${message}: ${originalError.response.data.error}`;
    } else if (originalError?.message) {
      error.message = `${message}: ${originalError.message}`;
    }

    return error;
  }

  /**
   * Clear cache for a specific session
   */
  clearSessionCache(sessionId: ID): void {
    // Clear any session-specific caches if implemented
    for (const [key] of this.sessionsCache) {
      if (key.includes(sessionId.toString())) {
        this.sessionsCache.delete(key);
      }
    }
  }

  /**
   * Clear cache for a specific recipe
   */
  clearRecipeCache(recipeId: ID): void {
    const cacheKey = `recipe-${recipeId}`;
    this.sessionsCache.delete(cacheKey);
  }

  /**
   * Clear all recipe-related caches
   */
  clearAllRecipeCaches(): void {
    for (const [key] of this.sessionsCache) {
      if (key.startsWith("recipe-")) {
        this.sessionsCache.delete(key);
      }
    }
  }

  /**
   * Check if a session exists (with error handling)
   */
  async sessionExists(sessionId: ID): Promise<boolean> {
    try {
      await this.fetchBrewSession(sessionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Safely navigate to session (checks existence first)
   */
  async safeNavigateToSession(
    sessionId: ID,
    navigate: (path: string) => void
  ): Promise<void> {
    const exists = await this.sessionExists(sessionId);
    if (exists) {
      navigate(`/brew-sessions/${sessionId}`);
    } else {
      console.error(`Session ${sessionId} no longer exists`);
      // Optionally show a toast notification here
      throw new Error("Session no longer exists");
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.sessionsCache.clear();
  }

  // Dry Hop Addition Methods

  /**
   * Get all dry hop additions for a brew session
   */
  async getDryHopAdditions(sessionId: ID) {
    return ApiService.brewSessions.getDryHopAdditions(sessionId);
  }

  /**
   * Add a new dry hop addition to a brew session
   */
  async addDryHopAddition(
    sessionId: ID,
    additionData: AddDryHopAdditionRequest
  ) {
    const result = await ApiService.brewSessions.addDryHopAddition(
      sessionId,
      additionData
    );

    // Clear session cache to ensure fresh data
    this.clearSessionCache(sessionId);

    return result;
  }

  /**
   * Update a dry hop addition (e.g., mark as removed)
   */
  async updateDryHopAddition(
    sessionId: ID,
    additionIndex: number,
    updateData: Partial<DryHopAddition>
  ) {
    const result = await ApiService.brewSessions.updateDryHopAddition(
      sessionId,
      additionIndex,
      updateData
    );

    // Clear session cache to ensure fresh data
    this.clearSessionCache(sessionId);

    return result;
  }

  /**
   * Delete a dry hop addition
   */
  async deleteDryHopAddition(sessionId: ID, additionIndex: number) {
    const result = await ApiService.brewSessions.deleteDryHopAddition(
      sessionId,
      additionIndex
    );

    // Clear session cache to ensure fresh data
    this.clearSessionCache(sessionId);

    return result;
  }
}

// Export as singleton
const brewSessionServiceInstance = new BrewSessionService();
export default brewSessionServiceInstance;
