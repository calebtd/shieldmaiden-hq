import { expect, test } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);

test("an owner can add staff, keep working offline, and sync on reconnect", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
  await page.getByRole("link", { name: "Staff" }).click();

  // Validation happens on the device, before anything is queued.
  const onlineName = `Brynja ${unique()}`;
  await page.getByLabel("Name").fill(onlineName);
  await page.getByLabel("Phone").fill("123");
  await page.getByRole("button", { name: "Add to staff" }).click();
  await expect(page.getByText("Enter a 10-digit phone number")).toBeVisible();

  await page.getByLabel("Phone").fill("(555) 123-4567");
  await page.getByRole("button", { name: "Add to staff" }).click();
  const onlineRow = page.getByRole("article").filter({ hasText: onlineName });
  await expect(onlineRow).toBeVisible();
  await expect(onlineRow.getByText("Not synced yet")).toHaveCount(0);
  await expect(page.getByText("All saved")).toBeVisible();

  // Once the service worker controls the page, the app opens with no signal.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  const offlineName = `Olga ${unique()}`;
  await page.getByLabel("Name").fill(offlineName);
  await page.getByRole("button", { name: "Add to staff" }).click();
  await expect(page.getByText(offlineName)).toBeVisible();
  await expect(page.getByText(/Offline · 1 change waiting/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(offlineName)).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("All saved")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Not synced yet")).toHaveCount(0);
});

test("braiders can't reach owner screens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Sigrun/ }).click();
  await expect(page.getByRole("heading", { name: /Hi, Sigrun/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/$/);
});

test("on a phone, the screens list opens from the top bar and closes after picking one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
  const staffLink = page.getByRole("link", { name: "Staff" });
  await expect(staffLink).not.toBeInViewport();
  await page.getByRole("button", { name: "☰ Screens" }).click();
  await expect(staffLink).toBeInViewport();
  await staffLink.click();
  await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();
  await expect(staffLink).not.toBeInViewport();
});

test.describe(() => {
  // Playwright's offline switch doesn't cover requests made by the offline helper
  // (service worker), so turn it off here to be truly offline.
  test.use({ serviceWorkers: "block" });

  test("switching person with unsent changes warns instead of losing them", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Astrid/ }).click();
    await page.getByRole("link", { name: "Staff" }).click();
    await expect(page.getByText("All saved")).toBeVisible();
    await context.setOffline(true);
    const name = `Unsent ${Math.random().toString(36).slice(2, 7)}`;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Add to staff" }).click();
    await expect(page.getByText(/1 change waiting/)).toBeVisible();

    let message = "(no warning)";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Switch person" }).click();
    await expect.poll(() => message).toContain("1 change hasn't been sent yet");
    // Still signed in, change still there.
    await expect(page.getByText(name)).toBeVisible();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("All saved")).toBeVisible({ timeout: 15_000 });
  });
});
