import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import {
  // Authentication types
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ValidateUsernameRequest,
  ValidateUsernameResponse,
  ProfileResponse,
  GoogleAuthRequest,
  GoogleAuthResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendVerificationResponse,
  VerificationStatusResponse,

  // User types
  ChangePasswordRequest,
  DeleteAccountRequest,
  UserSettingsResponse,
  UpdateSettingsRequest,
  UpdateProfileRequest,

  // Recipe types
  RecipeResponse,
  RecipesListResponse,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  CloneRecipeResponse,
  ClonePublicRecipeResponse,
  RecipeMetricsResponse,
  CalculateMetricsPreviewRequest,
  CalculateMetricsPreviewResponse,
  RecipeVersionHistoryResponse,
  PublicRecipesResponse,

  // Ingredient types
  IngredientsResponse,
  IngredientResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
  IngredientRecipesResponse,

  // Beer Style types
  BeerStylesResponse,
  BeerStyleResponse,
  StyleSuggestionsResponse,
  StyleAnalysisResponse,
  BeerStyleSearchResponse,

  // Brew Session types
  BrewSessionsResponse,
  BrewSessionResponse,
  CreateBrewSessionRequest,
  UpdateBrewSessionRequest,
  FermentationDataResponse,
  AddFermentationEntryRequest,
  UpdateFermentationEntryRequest,
  FermentationStatsResponse,
  GravityStabilizationAnalysisResponse,
  DryHopAdditionsResponse,
  AddDryHopAdditionRequest,
  UpdateDryHopAdditionRequest,

  // BeerXML types
  BeerXMLExportResponse,
  BeerXMLParseRequest,
  BeerXMLParseResponse,
  BeerXMLMatchIngredientsRequest,
  BeerXMLMatchIngredientsResponse,
  BeerXMLCreateIngredientsRequest,
  BeerXMLCreateIngredientsResponse,

  // Dashboard types
  DashboardResponse,

  // Common types
  ID,
} from "../types";

// API Configuration
const API_URL: string =
  process.env.REACT_APP_API_URL || "http://127.0.0.1:5000/api";

// Create typed axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Type-safe request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError): Promise<AxiosError> => {
    return Promise.reject(error);
  }
);

// Type-safe response interceptor
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    return response;
  },
  (error: AxiosError): Promise<AxiosError> => {
    // Handle different error codes, including MongoDB-specific errors
    if (
      error.response?.data &&
      typeof error.response.data === "object" &&
      "error" in error.response.data
    ) {
      // Log or handle specific MongoDB errors
      console.error("API Error:", (error.response.data as any).error);
    }
    return Promise.reject(error);
  }
);

// Recipe search filters interface
interface RecipeSearchFilters {
  style?: string;
  search?: string;
}

// Type-safe API Service
const ApiService = {
  // Auth endpoints
  auth: {
    register: (
      userData: RegisterRequest
    ): Promise<AxiosResponse<RegisterResponse>> =>
      api.post("/auth/register", userData),

    login: (credentials: LoginRequest): Promise<AxiosResponse<LoginResponse>> =>
      api.post("/auth/login", credentials),

    googleAuth: (
      googleData: GoogleAuthRequest
    ): Promise<AxiosResponse<GoogleAuthResponse>> =>
      api.post("/auth/google", googleData),

    linkGoogle: (
      googleData: GoogleAuthRequest
    ): Promise<AxiosResponse<GoogleAuthResponse>> =>
      api.post("/auth/link-google", googleData),

    unlinkGoogle: (): Promise<AxiosResponse<GoogleAuthResponse>> =>
      api.post("/auth/unlink-google"),

    getProfile: (): Promise<AxiosResponse<ProfileResponse>> =>
      api.get("/auth/profile"),

    validateUsername: (
      data: ValidateUsernameRequest
    ): Promise<AxiosResponse<ValidateUsernameResponse>> =>
      api.post("/auth/validate-username", data),

    // Email verification endpoints
    sendVerification: (): Promise<AxiosResponse<ResendVerificationResponse>> =>
      api.post("/auth/send-verification"),

    verifyEmail: (
      data: VerifyEmailRequest
    ): Promise<AxiosResponse<VerifyEmailResponse>> =>
      api.post("/auth/verify-email", data),

    resendVerification: (): Promise<
      AxiosResponse<ResendVerificationResponse>
    > => api.post("/auth/resend-verification"),

    getVerificationStatus: (): Promise<
      AxiosResponse<VerificationStatusResponse>
    > => api.get("/auth/verification-status"),
  },

  // User settings endpoints
  user: {
    getSettings: (): Promise<AxiosResponse<UserSettingsResponse>> =>
      api.get("/user/settings"),

    updateSettings: (
      settingsData: UpdateSettingsRequest
    ): Promise<AxiosResponse<UserSettingsResponse>> =>
      api.put("/user/settings", settingsData),

    updateProfile: (
      profileData: UpdateProfileRequest
    ): Promise<AxiosResponse<ProfileResponse>> =>
      api.put("/user/profile", profileData),

    changePassword: (
      passwordData: ChangePasswordRequest
    ): Promise<AxiosResponse<{ message: string }>> =>
      api.post("/user/change-password", passwordData),

    deleteAccount: (
      confirmationData: DeleteAccountRequest
    ): Promise<AxiosResponse<{ message: string }>> =>
      api.post("/user/delete-account", confirmationData),
  },

  // Recipe endpoints
  recipes: {
    getAll: (
      page: number = 1,
      perPage: number = 10
    ): Promise<AxiosResponse<RecipesListResponse>> =>
      api.get(`/recipes?page=${page}&per_page=${perPage}`),

    getById: (id: ID): Promise<AxiosResponse<RecipeResponse>> =>
      api.get(`/recipes/${id}`),

    create: (
      recipeData: CreateRecipeRequest
    ): Promise<AxiosResponse<RecipeResponse>> =>
      api.post("/recipes", recipeData),

    update: (
      id: ID,
      recipeData: UpdateRecipeRequest
    ): Promise<AxiosResponse<RecipeResponse>> =>
      api.put(`/recipes/${id}`, recipeData),

    delete: (id: ID): Promise<AxiosResponse<{ message: string }>> =>
      api.delete(`/recipes/${id}`),

    search: (
      query: string,
      page: number = 1,
      perPage: number = 10
    ): Promise<AxiosResponse<RecipesListResponse>> =>
      api.get(
        `/search/recipes?q=${encodeURIComponent(
          query
        )}&page=${page}&per_page=${perPage}`
      ),

    calculateMetrics: (
      recipeId: ID
    ): Promise<AxiosResponse<RecipeMetricsResponse>> =>
      api.get(`/recipes/${recipeId}/metrics`),

    calculateMetricsPreview: (
      recipeData: CalculateMetricsPreviewRequest
    ): Promise<AxiosResponse<CalculateMetricsPreviewResponse>> =>
      api.post("/recipes/calculate-metrics-preview", recipeData),

    clone: (id: ID): Promise<AxiosResponse<CloneRecipeResponse>> =>
      api.post(`/recipes/${id}/clone`),

    clonePublic: (
      id: ID,
      originalAuthor: string
    ): Promise<AxiosResponse<ClonePublicRecipeResponse>> =>
      api.post(`/recipes/${id}/clone-public`, { originalAuthor }),

    getVersionHistory: (
      id: ID
    ): Promise<AxiosResponse<RecipeVersionHistoryResponse>> =>
      api.get(`/recipes/${id}/versions`),

    getBrewSessions: (id: ID): Promise<AxiosResponse<BrewSessionsResponse>> =>
      api.get(`/recipes/${id}/brew-sessions`),

    getPublic: (
      page: number = 1,
      perPage: number = 10,
      filters: RecipeSearchFilters = {}
    ): Promise<AxiosResponse<PublicRecipesResponse>> => {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        ...(filters.style && { style: filters.style }),
        ...(filters.search && { search: filters.search }),
      });
      return api.get(`/recipes/public?${params}`);
    },
  },

  // Beer Style endpoints
  beerStyles: {
    getAll: (): Promise<AxiosResponse<BeerStylesResponse>> =>
      api.get("/beer-styles"),

    search: (query: string): Promise<AxiosResponse<BeerStyleSearchResponse>> =>
      api.get(`/beer-styles/search?q=${encodeURIComponent(query)}`),

    getById: (styleId: ID): Promise<AxiosResponse<BeerStyleResponse>> =>
      api.get(`/beer-styles/${styleId}`),

    getStyleSuggestions: (
      recipeId: ID
    ): Promise<AxiosResponse<StyleSuggestionsResponse>> =>
      api.get(`/beer-styles/suggestions/${recipeId}`),

    getRecipeStyleAnalysis: (
      recipeId: ID
    ): Promise<AxiosResponse<StyleAnalysisResponse>> =>
      api.get(`/beer-styles/analysis/${recipeId}`),
  },

  // Ingredient endpoints
  ingredients: {
    getAll: (
      type?: string,
      search?: string
    ): Promise<AxiosResponse<IngredientsResponse>> => {
      let url = "/ingredients";
      const params: string[] = [];
      if (type) params.push(`type=${encodeURIComponent(type)}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      return api.get(url);
    },

    getById: (id: ID): Promise<AxiosResponse<IngredientResponse>> =>
      api.get(`/ingredients/${id}`),

    create: (
      ingredientData: CreateIngredientRequest
    ): Promise<AxiosResponse<IngredientResponse>> =>
      api.post("/ingredients", ingredientData),

    update: (
      id: ID,
      ingredientData: UpdateIngredientRequest
    ): Promise<AxiosResponse<IngredientResponse>> =>
      api.put(`/ingredients/${id}`, ingredientData),

    delete: (id: ID): Promise<AxiosResponse<{ message: string }>> =>
      api.delete(`/ingredients/${id}`),

    getRecipes: (
      ingredientId: ID,
      page: number = 1,
      perPage: number = 10
    ): Promise<AxiosResponse<IngredientRecipesResponse>> =>
      api.get(
        `/ingredients/${ingredientId}/recipes?page=${page}&per_page=${perPage}`
      ),
  },

  // Brew session endpoints
  brewSessions: {
    getAll: (
      page: number = 1,
      perPage: number = 10
    ): Promise<AxiosResponse<BrewSessionsResponse>> =>
      api.get(`/brew-sessions?page=${page}&per_page=${perPage}`),

    getById: (id: ID): Promise<AxiosResponse<BrewSessionResponse>> =>
      api.get(`/brew-sessions/${id}`),

    create: (
      sessionData: CreateBrewSessionRequest
    ): Promise<AxiosResponse<BrewSessionResponse>> =>
      api.post("/brew-sessions", sessionData),

    update: (
      id: ID,
      sessionData: UpdateBrewSessionRequest
    ): Promise<AxiosResponse<BrewSessionResponse>> =>
      api.put(`/brew-sessions/${id}`, sessionData),

    delete: (id: ID): Promise<AxiosResponse<{ message: string }>> =>
      api.delete(`/brew-sessions/${id}`),

    // Fermentation data endpoints
    getFermentationData: (
      sessionId: ID
    ): Promise<AxiosResponse<FermentationDataResponse>> =>
      api.get(`/brew-sessions/${sessionId}/fermentation`),

    addFermentationEntry: (
      sessionId: ID,
      entryData: AddFermentationEntryRequest
    ): Promise<AxiosResponse<FermentationDataResponse>> =>
      api.post(`/brew-sessions/${sessionId}/fermentation`, entryData),

    updateFermentationEntry: (
      sessionId: ID,
      entryIndex: number,
      entryData: UpdateFermentationEntryRequest
    ): Promise<AxiosResponse<FermentationDataResponse>> =>
      api.put(
        `/brew-sessions/${sessionId}/fermentation/${entryIndex}`,
        entryData
      ),

    deleteFermentationEntry: (
      sessionId: ID,
      entryIndex: number
    ): Promise<AxiosResponse<{ message: string }>> =>
      api.delete(`/brew-sessions/${sessionId}/fermentation/${entryIndex}`),

    getFermentationStats: (
      sessionId: ID
    ): Promise<AxiosResponse<FermentationStatsResponse>> =>
      api.get(`/brew-sessions/${sessionId}/fermentation/stats`),

    analyzeFermentationCompletion: (
      sessionId: ID
    ): Promise<AxiosResponse<GravityStabilizationAnalysisResponse>> =>
      api.get(`/brew-sessions/${sessionId}/fermentation/analyze-completion`),

    // Dry hop addition endpoints
    getDryHopAdditions: (
      sessionId: ID
    ): Promise<AxiosResponse<DryHopAdditionsResponse>> =>
      api.get(`/brew-sessions/${sessionId}/dry-hops`),
    addDryHopAddition: (
      sessionId: ID,
      additionData: AddDryHopAdditionRequest
    ): Promise<AxiosResponse<{ message: string; addition: any }>> =>
      api.post(`/brew-sessions/${sessionId}/dry-hops`, additionData),
    updateDryHopAddition: (
      sessionId: ID,
      additionIndex: number,
      updateData: UpdateDryHopAdditionRequest
    ): Promise<AxiosResponse<{ message: string; addition: any }>> =>
      api.put(
        `/brew-sessions/${sessionId}/dry-hops/${additionIndex}`,
        updateData
      ),
    deleteDryHopAddition: (
      sessionId: ID,
      additionIndex: number
    ): Promise<AxiosResponse<{ message: string }>> =>
      api.delete(`/brew-sessions/${sessionId}/dry-hops/${additionIndex}`),
  },

  // BeerXML endpoints
  beerxml: {
    export: (recipeId: ID): Promise<AxiosResponse<BeerXMLExportResponse>> =>
      api.get(`/beerxml/export/${recipeId}`),

    parse: (
      data: BeerXMLParseRequest
    ): Promise<AxiosResponse<BeerXMLParseResponse>> =>
      api.post("/beerxml/parse", data),

    matchIngredients: (
      data: BeerXMLMatchIngredientsRequest
    ): Promise<AxiosResponse<BeerXMLMatchIngredientsResponse>> =>
      api.post("/beerxml/match-ingredients", data),

    createIngredients: (
      data: BeerXMLCreateIngredientsRequest
    ): Promise<AxiosResponse<BeerXMLCreateIngredientsResponse>> =>
      api.post("/beerxml/create-ingredients", data),
  },

  // Dashboard and statistics
  dashboard: {
    getData: (): Promise<AxiosResponse<DashboardResponse>> =>
      api.get("/dashboard"),
  },

  // Attenuation Analytics
  attenuationAnalytics: {
    getYeastAnalytics: (ingredientId: ID): Promise<AxiosResponse<any>> =>
      api.get(`/attenuation-analytics/yeast/${ingredientId}`),

    getAllYeastAnalytics: (): Promise<AxiosResponse<any>> =>
      api.get("/attenuation-analytics/yeast"),

    getImprovedEstimate: (ingredientId: ID): Promise<AxiosResponse<any>> =>
      api.get(`/attenuation-analytics/yeast/${ingredientId}/improved-estimate`),

    getSystemStats: (): Promise<AxiosResponse<any>> =>
      api.get("/attenuation-analytics/stats"),
  },

  // AI Recipe Analysis
  ai: {
    analyzeRecipe: (requestData: any): Promise<AxiosResponse<any>> =>
      api.post("/ai/analyze-recipe", requestData),

    checkHealth: (): Promise<AxiosResponse<any>> => api.get("/ai/health"),
  },
};

export default ApiService;
