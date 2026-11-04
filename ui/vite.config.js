import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), svgrPlugin()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      // The suite backend - needs to come after the more specific rules above
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom", // use 'node' if not testing DOM
    setupFiles: "./src/test/setup.ts",
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
