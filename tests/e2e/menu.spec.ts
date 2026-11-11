import { expect, test, type Page } from "@playwright/test";

// These share one database and the first one loads the menu, so run them in order.
test.describe.configure({ mode: "serial" });

const unique = () => Math.random().toString(36).slice(2, 7);

async function signInAsOwner(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
}

/** Loads the real menu if this database still has only the small demo one. */
async function ensureFullMenu(page: Page) {
  await page.getByRole("link", { name: "Braid menu" }).click();
  await expect(page.getByRole("heading", { name: "Add to the menu" })).toBeVisible();
  const load = page.getByRole("button", { name: "Load our current menu" });
  const loaded = page.getByRole("article").filter({ hasText: "Full Valkyrie" });
  // The load button only appears once the first sync has finished, so wait until the
  // screen shows one or the other before deciding.
  await expect(load.or(loaded)).toBeVisible({ timeout: 15_000 });
  if (await load.isVisible()) {
    await load.click();
    await expect(load).toHaveCount(0, { timeout: 15_000 });
  }
  await expect(loaded).toBeVisible();
}

test("the owner loads the current menu and adds an item", async ({ page }) => {
  await signInAsOwner(page);
  await ensureFullMenu(page);

  const braids = page.getByRole("region", { name: "Braids" });
  await expect(braids.getByRole("article").filter({ hasText: "Full Valkyrie" })).toContainText(
    "$70.00",
  );
  await expect(braids.getByRole("article").filter({ hasText: "Braider's Pick" })).toContainText(
    "Price at checkout",
  );
  await expect(braids.getByRole("article").filter({ hasText: "The Crown" })).toContainText(
    "Needs Crown",
  );
  await expect(braids.getByRole("article").filter({ hasText: "Full Valkyrie" })).toContainText(
    "Needs 5 Strand + Cornrows",
  );
  const addons = page.getByRole("region", { name: "Add-ons & enchantments" });
  await expect(addons.getByRole("article").filter({ hasText: "Leather" })).toContainText("$8.00");
  await expect(addons.getByRole("article").filter({ hasText: "Tinsel" })).toContainText(
    "Turned off",
  );
  const retail = page.getByRole("region", { name: "Retail" });
  await expect(retail.getByRole("article").filter({ hasText: "Pit kit" })).toContainText(
    "bobby pins",
  );

  const name = `Fishtail ${unique()}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Price with tax ($)").fill("22");
  await page.getByLabel("About how long (minutes)").fill("12");
  await page.getByRole("button", { name: "Add braid" }).click();
  const row = braids.getByRole("article").filter({ hasText: name });
  await expect(row).toContainText("$22.00");
  await expect(row).toContainText("12 min");
  await expect(page.getByText("All saved")).toBeVisible();
});

test("the owner loads the skills sheet and ticks a skill", async ({ page }) => {
  await signInAsOwner(page);
  await ensureFullMenu(page);
  await page.getByRole("link", { name: "Skills" }).click();
  await page.getByRole("button", { name: "Load skills sheet" }).click();
  await expect(page.getByText(/Not on staff yet: .*Grace/)).toBeVisible();

  const box = page.getByRole("checkbox", { name: "Sigrun: 5 Strand" });
  const before = await box.isChecked();
  await box.click();
  await expect(box).toBeChecked({ checked: !before });
  await expect(page.getByText("All saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Sigrun: 5 Strand" })).toBeChecked({
    checked: !before,
  });
});

test("an event can charge a different price for one braid", async ({ page }) => {
  await signInAsOwner(page);
  await ensureFullMenu(page);
  await page.getByRole("link", { name: "Events" }).click();
  const eventName = `Market ${unique()}`;
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("City").fill("Eagle");
  await page.getByLabel("First day").fill("2031-06-07");
  await page.getByLabel("Sales tax (%)").fill("6");
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByRole("article").filter({ hasText: eventName }).getByRole("link").click();

  const prices = page.getByRole("region", { name: "Prices at this event" });
  await expect(prices).toContainText("Same as the usual menu.");
  await prices.getByRole("button", { name: "Show" }).click();
  const input = prices.getByLabel("Price at this event for Full Valkyrie");
  await input.fill("60");
  await input.press("Enter");
  await prices.getByRole("button", { name: "Hide" }).click();
  await expect(prices).toContainText("1 item differs from the usual menu.");
  await expect(page.getByText("All saved")).toBeVisible();
});
