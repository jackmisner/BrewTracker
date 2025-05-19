import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle ObjectID conversion in responses (if needed)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle different error codes, including MongoDB-specific errors
    if (error.response && error.response.data && error.response.data.error) {
      // Log or handle specific MongoDB errors
      console.error("API Error:", error.response.data.error);
    }
    return Promise.reject(error);
  }
);

const ApiService = {
  // Auth endpoints
  auth: {
    register: (userData) => api.post("/auth/register", userData),
    login: (credentials) => api.post("/auth/login", credentials),
    getProfile: () => api.get("/auth/profile"),
  },

  // Recipe endpoints
  recipes: {
    getAll: (page = 1, perPage = 10) =>
      api.get(`/recipes?page=${page}&per_page=${perPage}`),
    getById: (id) => api.get(`/recipes/${id}`),
    create: (recipeData) => {
      // console.log("Sending recipe data to create:", recipeData);
      return api.post("/recipes", recipeData);
    },
    update: (id, recipeData) => {
      // console.log("Sending recipe data to update:", recipeData);
      return api.put(`/recipes/${id}`, recipeData);
    },
    delete: (id) => api.delete(`/recipes/${id}`),
    search: (query, page = 1, perPage = 10) =>
      api.get(`/search/recipes?q=${query}&page=${page}&per_page=${perPage}`),
    calculateMetrics: (recipeId) => api.get(`/recipes/${recipeId}/metrics`),
    calculateMetricsPreview: (recipeData) =>
      api.post("/recipes/calculate-metrics-preview", recipeData),
    clone: (id) => api.post(`/recipes/${id}/clone`),
    getVersionHistory: (id) => api.get(`/recipes/${id}/versions`),
  },

  // Ingredient endpoints
  ingredients: {
    getAll: (type, search) => {
      let url = "/ingredients";
      const params = [];
      if (type) params.push(`type=${type}`);
      if (search) params.push(`search=${search}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      return api.get(url);
    },
    getById: (id) => api.get(`/ingredients/${id}`),
    create: (ingredientData) => api.post("/ingredients", ingredientData),
    update: (id, ingredientData) =>
      api.put(`/ingredients/${id}`, ingredientData),
    delete: (id) => api.delete(`/ingredients/${id}`),
    getRecipes: (ingredientId, page = 1, perPage = 10) =>
      api.get(
        `/ingredients/${ingredientId}/recipes?page=${page}&per_page=${perPage}`
      ),
  },

  // Brew session endpoints
  brewSessions: {
    getAll: (page = 1, perPage = 10) =>
      api.get(`/brew-sessions?page=${page}&per_page=${perPage}`),
    getById: (id) => api.get(`/brew-sessions/${id}`),
    create: (sessionData) => api.post("/brew-sessions", sessionData),
    update: (id, sessionData) => api.put(`/brew-sessions/${id}`, sessionData),
    delete: (id) => api.delete(`/brew-sessions/${id}`),

    // Fermentation data endpoints
    getFermentationData: (sessionId) =>
      api.get(`/brew-sessions/${sessionId}/fermentation`),
    addFermentationEntry: (sessionId, entryData) =>
      api.post(`/brew-sessions/${sessionId}/fermentation`, entryData),
    updateFermentationEntry: (sessionId, entryIndex, entryData) =>
      api.put(
        `/brew-sessions/${sessionId}/fermentation/${entryIndex}`,
        entryData
      ),
    deleteFermentationEntry: (sessionId, entryIndex) =>
      api.delete(`/brew-sessions/${sessionId}/fermentation/${entryIndex}`),
    getFermentationStats: (sessionId) =>
      api.get(`/brew-sessions/${sessionId}/fermentation/stats`),
  },

  // Dashboard and statistics
  dashboard: {
    getData: () => api.get("/dashboard"),
  },
};

export default ApiService;
