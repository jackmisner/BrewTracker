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
  },
);

// API service methods
const ApiService = {
  // Auth endpoints
  auth: {
    register: (userData) => api.post("/auth/register", userData),
    login: (credentials) => api.post("/auth/login", credentials),
    getProfile: () => api.get("/auth/profile"),
  },

  // Recipe endpoints
  recipes: {
    getAll: () => api.get("/recipes"),
    getById: (id) => api.get(`/recipes/${id}`),
    create: (recipeData) => api.post("/recipes", recipeData),
    update: (id, recipeData) => api.put(`/recipes/${id}`, recipeData),
    delete: (id) => api.delete(`/recipes/${id}`),
  },

  // Brew session endpoints
  brewSessions: {
    getAll: () => api.get("/brew-sessions"),
    getById: (id) => api.get(`/brew-sessions/${id}`),
    create: (sessionData) => api.post("/brew-sessions", sessionData),
    update: (id, sessionData) => api.put(`/brew-sessions/${id}`, sessionData),
    delete: (id) => api.delete(`/brew-sessions/${id}`),
  },
};

export default ApiService;
