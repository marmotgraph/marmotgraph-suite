import { expect, test } from "@playwright/test";

test.describe("MarmotGraph Suite Structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should have a title", async ({ page }) => {
    await expect(page).toHaveTitle("MarmotGraph Suite");
  });
});
