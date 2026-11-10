import { expect, test, type Page } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);
const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localInput = (d: Date) => `${day(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

async function signInAs(page: Page, name: RegExp | string) {
  await page.goto("/");
  const switcher = page.getByRole("button", { name: "Switch person" });
  const picker = page.getByRole("heading", { name: "Sign in as" });
  await expect(switcher.or(picker)).toBeVisible();
  if (await switcher.isVisible()) await switcher.click();
  await page.getByRole("button", { name }).click();
}

test("a braider clocks in, takes a break and clocks out with no signal, then fixes a time", async ({
  page,
  context,
}) => {
  const person = `Clocky ${unique()}`;
  const eventName = `Today Faire ${unique()}`;

  // The owner adds a braider and puts them on an event happening today.
  await signInAs(page, /Astrid/);
  await page.getByRole("link", { name: "Staff" }).click();
  await page.getByLabel("Name").fill(person);
  await page.getByRole("button", { name: "Add to staff" }).click();
  await page.getByRole("link", { name: "Events" }).click();
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("City").fill("Boise");
  await page.getByLabel("First day").fill(day(new Date()));
  await page.getByLabel("Sales tax (%)").fill("6");
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByRole("article").filter({ hasText: eventName }).getByRole("link").click();
  await page
    .getByRole("region", { name: "Not working this event" })
    .getByRole("article")
    .filter({ hasText: person })
    .getByRole("button", { name: "Add to event" })
    .click();
  await expect(page.getByRole("region", { name: "Working this event", exact: true })).toContainText(
    person,
  );
  await expect(page.getByText("All saved")).toBeVisible();

  // The braider clocks in.
  await signInAs(page, person);
  await page.getByRole("link", { name: "My shift" }).click();
  // A newly signed-in device downloads everything first.
  await expect(page.getByText("All saved")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(eventName).first()).toBeVisible();
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByRole("status")).toContainText("On the clock since");
  await expect(page.getByText("All saved")).toBeVisible();

  // No signal: break and clock out still work, and wait to be sent.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Start break" }).click();
  await expect(page.getByRole("status")).toContainText("On break since");
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByRole("status")).toHaveText("Not clocked in");
  await expect(page.getByText(/Offline · 2 changes waiting/)).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("All saved")).toBeVisible({ timeout: 15_000 });

  // Fix the shift: it really started an hour earlier.
  const times = page.getByRole("region", { name: "My time at this event" });
  const shiftRow = times.getByRole("article").filter({ hasText: "Shift" }).first();
  await shiftRow.getByRole("button", { name: "Fix" }).click();
  const form = page.getByRole("form", { name: "Fix times" });
  await form.getByLabel("Started").fill(localInput(new Date(Date.now() - 60 * 60_000)));
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText(/Say briefly why/)).toBeVisible();
  await form.getByLabel("Why").fill("Forgot to clock in");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(times.getByText("Fixed by " + person + ": Forgot to clock in")).toBeVisible();
  await expect(
    page.getByText("Worked here: 0h 59m").or(page.getByText("Worked here: 1h 00m")),
  ).toBeVisible();
  await times.getByRole("button", { name: "Show changes (1)" }).click();
  await expect(times.getByText("Changed: Forgot to clock in")).toBeVisible();
  await expect(page.getByText("All saved")).toBeVisible();

  // The owner sees it on Timesheets, flagged as fixed by hand.
  await signInAs(page, /Astrid/);
  await page.getByRole("link", { name: "Timesheets" }).click();
  const select = page.getByLabel("Event");
  const value = await select.locator("option", { hasText: eventName }).getAttribute("value");
  await select.selectOption(value ?? "");
  const row = page.getByRole("article").filter({ hasText: person });
  await expect(row).toContainText("1 fixed or added by hand");
  await expect(row).toContainText("no pay set");
});

test("braiders see My shift but not Timesheets", async ({ page }) => {
  await signInAs(page, /Sigrun/);
  await expect(page.getByRole("link", { name: "My shift" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Timesheets" })).toHaveCount(0);
});
