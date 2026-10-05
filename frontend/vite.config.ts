import { defineConfig } from "vite";
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
});
