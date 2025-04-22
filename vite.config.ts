import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
      // Polyfills for specific Node.js globals and modules
      globals: {
        process: true,
        Buffer: true,
      },
      // Override Node.js built-ins
      include: ["buffer", "process", "util", "events", "path", "url"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Default Vite behavior should handle SPA routing
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
