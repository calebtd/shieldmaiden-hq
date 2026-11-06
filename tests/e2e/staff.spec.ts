import { expect, test } from "@playwright/test";

test("an owner can rename staff but can't turn themselves off", async ({ page }) => {
  const name = `Malia ${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
  await page.getByRole("link", { name: "Staff" }).click();

  // Your own row has no Turn off or role menu.
  const me = page.getByRole("article").filter({ hasText: "You" });
  await expect(me).toBeVisible();
  await expect(me.getByRole("button", { name: "Turn off" })).toHaveCount(0);
  await expect(me.getByRole("combobox")).toHaveCount(0);

  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add to staff" }).click();
  const row = page.getByRole("article").filter({ hasText: name });
  await row.getByRole("button", { name: "Edit" }).click();

  const form = page.locator("form").filter({ hasText: `Edit ${name}` });
  await form.getByLabel("Name").fill(`${name} K.`);
  await form.getByLabel("Phone").fill("208-555-0100");
  await form.getByRole("button", { name: "Save" }).click();

  const renamed = page.getByRole("article").filter({ hasText: `${name} K.` });
  await expect(renamed).toContainText("(208) 555-0100");
  await expect(renamed.getByText("Not synced yet")).toHaveCount(0);
  await expect(page.getByText("All saved")).toBeVisible();
});

test("turning someone else off saves and keeps syncing", async ({ page }) => {
  const name = `Savanah ${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
  await page.getByRole("link", { name: "Staff" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add to staff" }).click();

  const row = page.getByRole("article").filter({ hasText: name });
  await expect(row.getByText("Not synced yet")).toHaveCount(0);
  await row.getByRole("button", { name: "Turn off" }).click();

  await expect(row.getByRole("button", { name: "Turn back on" })).toBeVisible();
  await expect(page.getByText("All saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Turned off" }).getByText(name)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
