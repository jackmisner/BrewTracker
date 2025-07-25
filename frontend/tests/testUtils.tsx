import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UnitProvider } from "../src/contexts/UnitContext";

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  {
    // Router options
    initialEntries = ["/"],

    // React Query options
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),

    // Other options
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <UnitProvider>
            {children}
          </UnitProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock data factories
export const mockData = {
  recipe: (overrides: Record<string, any> = {}) => ({
    id: "test-id",
    recipe_id: "test-recipe-id",
    name: "Test Recipe",
    style: "IPA",
    batch_size: 5,
    batch_size_unit: "gal" as const,
    boil_time: 60,
    efficiency: 75,
    is_public: false,
    version: 1,
    estimated_og: 1.065,
    estimated_fg: 1.012,
    estimated_abv: 6.9,
    estimated_ibu: 65,
    estimated_srm: 6.5,
    ingredients: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }),

  brewSession: (overrides: Record<string, any> = {}) => ({
    session_id: "test-session-id",
    name: "Test Brew Session",
    recipe_id: "test-recipe-id",
    status: "fermenting",
    brew_date: "2024-01-15T00:00:00Z",
    actual_og: 1.064,
    actual_fg: null,
    actual_abv: null,
    ...overrides,
  }),

  ingredient: (type: string = "grain", overrides: Record<string, any> = {}) => ({
    id: `test-ingredient-${Math.random().toString(36).substr(2, 9)}`,
    ingredient_id: 1,
    name: "Test Ingredient",
    type,
    amount: 1,
    unit: type === "grain" ? "lb" : type === "hop" ? "oz" : "pkg",
    ...(type === "grain" && {
      grain_type: "base_malt",
      potential: 1.037,
      color: 2,
    }),
    ...(type === "hop" && {
      alpha_acid: 5.5,
      use: "boil",
      time: 60,
    }),
    ...(type === "yeast" && {
      attenuation: 81,
    }),
    ...overrides,
  }),

  user: (overrides: Record<string, any> = {}) => ({
    user_id: "test-user-id",
    username: "testuser",
    email: "test@example.com",
    ...overrides,
  }),
};

// Common test scenarios
export const scenarios = {
  // Simulate loading state
  loading: () => new Promise(() => {}),

  // Simulate successful API response
  success: (data: any) => Promise.resolve({ data }),

  // Simulate API error
  error: (message: string = "API Error") => Promise.reject(new Error(message)),

  // Simulate network error
  networkError: () => Promise.reject(new Error("Network Error")),

  // Simulate validation error
  validationError: (errors: string[] = ["Validation failed"]) =>
    Promise.reject({
      response: {
        status: 400,
        data: { error: "Validation failed", errors },
      },
    }),
};

// Re-export testing library utilities
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
