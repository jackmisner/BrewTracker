/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Keep the existing REACT_APP_* variable names so current Vercel/CI
  // environment settings keep working after the move off Create React App.
  envPrefix: ["VITE_", "REACT_APP_"],
  server: {
    port: 3000,
  },
  build: {
    // Output layout matches vercel.json (distDir "build", /static/ cache rule)
    outDir: "build",
    assetsDir: "static",
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    include: ["tests/**/*.test.{js,ts,tsx}"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        "src/**/*.test.{js,jsx,ts,tsx}",
        "src/**/*.spec.{js,jsx,ts,tsx}",
        "src/index.{js,ts,tsx}",
        "src/reportWebVitals.{js,ts}",
        "src/**/*.d.ts",
        "src/types/**/*",
      ],
      thresholds: {
        branches: 65,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
