import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), svgrPlugin()],
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      "/api/query": {
        target: "https://query.kg-dev.tds.cscs.ch",
        changeOrigin: true,
      },
      "/api/editor": {
        target: "https://editor.kg-dev.tds.cscs.ch",
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
