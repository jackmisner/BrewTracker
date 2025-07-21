import {
  Recipe,
  RecipeMetrics,
  RecipeFormData,
  Ingredient,
  RecipeSearchFilters,
} from "./recipe";
import { BeerStyleGuide, StyleAnalysis, StyleSuggestion } from "./beer-styles";
import { BrewSession, FermentationEntry } from "./brew-session";
import { User, UserSettings } from "./user";
import { ApiResponse, PaginatedResponse, ID } from "./common";

// Authentication API types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface ProfileResponse {
  user: User;
}

// User API types
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountRequest {
  password: string;
  confirmation: string;
}

export interface UserSettingsResponse {
  settings: UserSettings;
}

export interface UpdateSettingsRequest extends Partial<UserSettings> {}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
}

// Recipe API types
export interface RecipeResponse extends ApiResponse<Recipe> {}

export interface RecipesListResponse extends PaginatedResponse<Recipe> {
  recipes: Recipe[];
}

export interface CreateRecipeRequest extends RecipeFormData {}

export interface UpdateRecipeRequest extends Partial<RecipeFormData> {}

export interface CloneRecipeResponse extends ApiResponse<Recipe> {}

export interface ClonePublicRecipeRequest {
  originalAuthor: string;
}

export interface ClonePublicRecipeResponse extends ApiResponse<Recipe> {}

export interface RecipeMetricsResponse extends ApiResponse<RecipeMetrics> {
  data: RecipeMetrics & {
    og?: number;
    avg_og?: number;
    fg?: number;
    avg_fg?: number;
    abv?: number;
    avg_abv?: number;
    ibu?: number;
    srm?: number;
  };
}

export interface CalculateMetricsPreviewRequest {
  batch_size: number;
  batch_size_unit: string;
  efficiency: number;
  boil_time: number;
  ingredients: Recipe["ingredients"];
}

export interface CalculateMetricsPreviewResponse
  extends ApiResponse<RecipeMetrics> {}

export interface RecipeVersionHistoryResponse extends ApiResponse<Recipe[]> {}

export interface PublicRecipesResponse extends PaginatedResponse<Recipe> {
  recipes: Recipe[];
  pagination: {
    page: number;
    pages: number;
    has_prev: boolean;
    has_next: boolean;
    total: number;
  };
}

// Ingredient API types
export interface IngredientsResponse extends ApiResponse<Ingredient[]> {}

export interface IngredientResponse extends ApiResponse<Ingredient> {}

export interface CreateIngredientRequest
  extends Omit<Ingredient, "ingredient_id" | "created_at" | "updated_at"> {}

export interface UpdateIngredientRequest
  extends Partial<CreateIngredientRequest> {}

export interface IngredientRecipesResponse extends PaginatedResponse<Recipe> {}

// Beer Style API types
export interface BeerStylesResponse extends ApiResponse<BeerStyleGuide[]> {}

export interface BeerStyleResponse extends ApiResponse<BeerStyleGuide> {}

export interface StyleSuggestionsResponse
  extends ApiResponse<StyleSuggestion[]> {}

export interface StyleAnalysisResponse extends ApiResponse<StyleAnalysis> {}

export interface BeerStyleSearchResponse
  extends ApiResponse<BeerStyleGuide[]> {}

// Brew Session API types
export interface BrewSessionsResponse extends PaginatedResponse<BrewSession> {
  brew_sessions: BrewSession[];
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    total: number;
    has_prev: boolean;
    has_next: boolean;
    prev_num?: number;
    next_num?: number;
  };
}

export interface BrewSessionResponse extends ApiResponse<BrewSession> {}

export interface CreateBrewSessionRequest
  extends Omit<BrewSession, "session_id" | "created_at" | "updated_at"> {}

export interface UpdateBrewSessionRequest
  extends Partial<CreateBrewSessionRequest> {}

// Note: Backend returns fermentation data as a direct array, not wrapped in ApiResponse
export interface FermentationDataResponse extends Array<FermentationEntry> {}

export interface AddFermentationEntryRequest
  extends Omit<FermentationEntry, "entry_date"> {}

export interface UpdateFermentationEntryRequest
  extends Partial<FermentationEntry> {}

export interface FermentationStatsResponse
  extends ApiResponse<{
    duration_days: number;
    gravity_drop: number;
    average_temperature: number;
    current_attenuation: number;
    projected_fg: number;
  }> {}

// Gravity Stabilization Analysis API types
export interface GravityStabilizationAnalysis {
  is_stable: boolean;
  completion_suggested: boolean;
  reason: string;
  current_gravity: number;
  estimated_fg?: number;
  gravity_difference?: number;
  stabilization_confidence: number;
  stable_reading_count: number;
  total_readings: number;
  recent_changes: number[];
}

// Note: Backend returns gravity analysis as a direct object, not wrapped in ApiResponse
export interface GravityStabilizationAnalysisResponse
  extends GravityStabilizationAnalysis {}

// BeerXML API types
export interface BeerXMLExportResponse
  extends ApiResponse<{
    xml_content: string;
    filename: string;
  }> {}

export interface BeerXMLParseRequest {
  xml_content: string;
}

export interface BeerXMLParseResponse
  extends ApiResponse<{
    recipes: Recipe[];
    ingredients: {
      matched: Ingredient[];
      unmatched: Array<{
        name: string;
        type: string;
        suggestions: Ingredient[];
      }>;
    };
  }> {}

export interface BeerXMLMatchIngredientsRequest {
  ingredients: Array<{
    name: string;
    type: string;
    amount?: number;
    unit?: string;
    use?: string;
    time?: number;
    // Type-specific fields
    potential?: number;
    color?: number;
    grain_type?: string;
    alpha_acid?: number;
    attenuation?: number;
    beerxml_data?: any;
    selected_match?: ID;
  }>;
}

export interface BeerXMLMatchIngredientsResponse
  extends ApiResponse<{
    matched_ingredients: Record<string, Ingredient>;
  }> {}

export interface BeerXMLCreateIngredientsRequest {
  ingredients: Array<
    Omit<Ingredient, "ingredient_id" | "created_at" | "updated_at">
  >;
}

export interface BeerXMLCreateIngredientsResponse
  extends ApiResponse<{
    created_ingredients: Ingredient[];
  }> {}

// Dashboard API types
export interface DashboardData {
  stats: {
    total_recipes: number;
    public_recipes: number;
    total_brews: number;
    active_brews: number;
  };
  recent_recipes: Recipe[];
  recent_brews: BrewSession[];
  brewing_calendar: Array<{
    date: string;
    sessions: BrewSession[];
  }>;
}

export interface DashboardResponse extends ApiResponse<DashboardData> {}

// Search API types
export interface RecipeSearchRequest extends RecipeSearchFilters {
  q?: string;
  page?: number;
  per_page?: number;
}

export interface RecipeSearchResponse extends PaginatedResponse<Recipe> {}

// Generic API query parameters
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface SearchParams extends PaginationParams {
  q?: string;
}

// API Error types
export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ValidationError extends ApiError {
  field_errors?: Record<string, string[]>;
}

// HTTP methods for API calls
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// API endpoint configuration
export interface ApiEndpoint {
  method: HttpMethod;
  url: string;
  requiresAuth?: boolean;
}

// Generic API call options
export interface ApiCallOptions {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

// Attenuation Analytics API types
export interface AttenuationAnalytics {
  ingredient_id: ID;
  name: string;
  manufacturer?: string;
  code?: string;
  theoretical_attenuation?: number;
  actual_attenuation_average?: number;
  actual_attenuation_count?: number;
  attenuation_confidence?: number;
  improved_estimate?: number;
  last_update?: string;
  min_actual?: number;
  max_actual?: number;
  std_deviation?: number;
}

export interface AttenuationAnalyticsResponse
  extends ApiResponse<AttenuationAnalytics> {}

export interface AllYeastAnalyticsResponse
  extends ApiResponse<{
    yeast_analytics: AttenuationAnalytics[];
    total_count: number;
  }> {}

export interface ImprovedAttenuationEstimateResponse
  extends ApiResponse<{
    ingredient_id: ID;
    improved_estimate: number;
  }> {}

export interface AttenuationSystemStatsResponse
  extends ApiResponse<{
    total_yeast_ingredients: number;
    yeast_with_actual_data: number;
    total_attenuation_data_points: number;
    high_confidence_yeast: number;
    data_coverage_percentage: number;
  }> {}
