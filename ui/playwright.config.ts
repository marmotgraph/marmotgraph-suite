import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run build && npm run preview -- --host --port 4173",
    port: 4173,
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
  testDir: "./tests/e2e", // only run tests from this directory
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
});
