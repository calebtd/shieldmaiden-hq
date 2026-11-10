import { expect, test, type Page } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);

async function signInAsOwner(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Astrid/ }).click();
}

test("an owner sets someone's pay, then sets up an event with special pay", async ({ page }) => {
  await signInAsOwner(page);

  // Usual pay, on the Staff screen.
  const person = `Becca ${unique()}`;
  await page.getByRole("link", { name: "Staff" }).click();
  await page.getByLabel("Name").fill(person);
  await page.getByRole("button", { name: "Add to staff" }).click();
  const row = page.getByRole("article").filter({ hasText: person });
  await expect(row.getByText("No pay set yet")).toBeVisible();
  await row.getByRole("button", { name: "Set pay" }).click();
  await row.getByLabel("Commission (%)").fill("120");
  await row.getByRole("button", { name: "Save pay" }).click();
  await expect(row.getByText("Must be 100% or less")).toBeVisible();
  await row.getByRole("button", { name: "Braider" }).click();
  await row.getByRole("button", { name: "Save pay" }).click();
  await expect(row.getByText("$5.00/hr · 20% commission · keeps 100% of tips")).toBeVisible();

  // A new event, with the tax rate typed as a percent.
  const eventName = `Harvest Faire ${unique()}`;
  await page.getByRole("link", { name: "Events" }).click();
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("City").fill("Nampa");
  await page.getByLabel("First day").fill("2030-09-14");
  await expect(page.getByLabel("Last day")).toHaveValue("2030-09-14");
  await page.getByLabel("Last day").fill("2030-09-15");
  await page.getByLabel("Sales tax (%)").fill("6.25");
  await page.getByRole("button", { name: "Add event" }).click();
  const card = page.getByRole("article").filter({ hasText: eventName });
  await expect(card).toContainText("Nampa · Sep 14–15, 2030 · tax 6.25% · 0 working");
  await card.getByRole("link", { name: "Open" }).click();

  // Put them on the crew with training-day pay.
  await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
  const notWorking = page.getByRole("region", { name: "Not working this event" });
  await notWorking
    .getByRole("article")
    .filter({ hasText: person })
    .getByRole("button", { name: "Add to event" })
    .click();
  const crewRow = page
    .getByRole("region", { name: "Working this event" })
    .getByRole("article")
    .filter({ hasText: person });
  await expect(crewRow).toContainText("$5.00/hr · 20% commission");
  await crewRow.getByRole("button", { name: "Pay at this event" }).click();
  await crewRow.getByLabel("Hourly ($)").fill("12");
  await crewRow.getByLabel("Commission (%)").fill("0");
  await crewRow.getByLabel("Why (optional)").fill("Training day");
  await crewRow.getByRole("button", { name: "Save" }).click();
  await expect(crewRow).toContainText(
    "$12.00/hr · 0% commission · keeps 100% of tips · Training day",
  );
  await expect(crewRow.getByText("Special pay")).toBeVisible();
  await expect(page.getByText("All saved")).toBeVisible();

  // It's all still there after a reload (saved on the device and the server).
  await page.reload();
  await expect(crewRow).toContainText("$12.00/hr");
});

test("an owner adds a discount; it doesn't lower commission unless switched on", async ({
  page,
}) => {
  await signInAsOwner(page);
  await page.getByRole("link", { name: "Discounts" }).click();

  const name = `Promo ${unique()}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Type").selectOption("amount");
  await page.getByLabel("Dollars off ($)").fill("5");
  await expect(page.getByLabel("Lowers the braider's commission")).not.toBeChecked();
  await page.getByRole("button", { name: "Add discount" }).click();

  const row = page.getByRole("article").filter({ hasText: name });
  await expect(row).toContainText("$5.00 off");
  await expect(row.getByText("Lowers commission")).toHaveCount(0);

  await row.getByRole("button", { name: "Turn off" }).click();
  await expect(
    page.getByRole("region", { name: "Turned off discounts" }).getByText(name),
  ).toBeVisible();
  await expect(page.getByText("All saved")).toBeVisible();
});
