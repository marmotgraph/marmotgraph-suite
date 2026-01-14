import { expect, test } from "@playwright/test";

test.describe("React Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Vite + React");
  });
});
