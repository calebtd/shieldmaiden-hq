import { expect, test } from "@playwright/test";

test("an owner sees system health and can back up now", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();

  const health = page.getByRole("region", { name: "System health" });
  await expect(health).toBeVisible();
  await health.getByRole("button", { name: "Back up now" }).click();
  await expect(health).toContainText(/Backed up just now · \d+ KB · 3 days kept/);
  await expect(health.getByRole("heading")).toHaveText("System health: all good");
});

test("braiders don't see system health", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Sigrun/ }).click();
  await expect(page.getByRole("heading", { name: /^Hi, Sigrun/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "System health" })).toHaveCount(0);
});
