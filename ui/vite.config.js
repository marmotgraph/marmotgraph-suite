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
      // The documentation is served by the service as well (see Documentation.java)
      "/docs": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom", // use 'node' if not testing DOM
    setupFiles: "./src/test/setup.ts",
    // The suite runs many jsdom workers in parallel - interaction-heavy tests need headroom on loaded CI runners
    testTimeout: 20000,
    coverage: {
      // lcov is picked up by Sonar (sonar.javascript.lcov.reportPaths=coverage/lcov.info)
      reporter: ["text", "html", "lcov"],
    },
  },
});
