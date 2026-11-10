import { beforeAll, describe, expect, it } from "vitest";
import { newId } from "@shared/ids";
import { TestClient } from "./test/client";

const owner = new TestClient();
const braider = new TestClient();
let braiderId: string;

beforeAll(async () => {
  await owner.signInAs("owner");
  braiderId = (await braider.signInAs("braider")).id;
});

const status = (r: { results: { status: string }[] }) => r.results[0]?.status;
const error = (r: { results: unknown[] }) => (r.results[0] as { error?: string }).error;

async function addSkill(name: string) {
  const id = newId();
  expect(status(await owner.mutate("skill.create", { id, name }))).toBe("applied");
  return id;
}

async function addItem(args: Record<string, unknown>) {
  const id = newId();
  const res = await owner.mutate("menu.create", {
    id,
    kind: "braid",
    name: `Braid ${id.slice(-6)}`,
    priceCents: 3000,
    minutes: 15,
    ...args,
  } as never);
  return { id, res };
}

describe("menu items", () => {
  it("adds braids, add-ons and retail that everyone can see", async () => {
    const skill = await addSkill("Dutch (menu test)");
    const braid = await addItem({ name: "Valkyrie (Little)", priceCents: 7000, skillIds: [skill] });
    const addon = await addItem({ kind: "addon", name: "White beads (3)", priceCents: 300 });
    const retail = await addItem({
      kind: "retail",
      name: "Satin Scarf",
      priceCents: 1500,
      minutes: 10,
      skillIds: [skill],
    });
    for (const r of [braid, addon, retail]) expect(status(r.res)).toBe("applied");

    const items = (await braider.pull()).changes.menuItems;
    expect(items.find((i) => i.id === braid.id)).toMatchObject({
      priceCents: 7000,
      minutes: 15,
      skillIds: [skill],
      openPrice: false,
      active: true,
    });
    // Retail never takes braiding time or needs skills.
    expect(items.find((i) => i.id === retail.id)).toMatchObject({ minutes: null, skillIds: [] });
  });

  it("keeps price-at-checkout items at $0", async () => {
    const { id } = await addItem({ name: "Braider's Pick", priceCents: 4500, openPrice: true });
    const row = (await owner.pull()).changes.menuItems.find((i) => i.id === id);
    expect(row).toMatchObject({ priceCents: 0, openPrice: true });

    await owner.mutate("menu.update", { id, openPrice: false, priceCents: 4500 });
    const after = (await owner.pull()).changes.menuItems.find((i) => i.id === id);
    expect(after).toMatchObject({ priceCents: 4500, openPrice: false });
  });

  it("won't add the same name twice in one section", async () => {
    await addItem({ name: "Crown" });
    expect(error((await addItem({ name: "crown" })).res)).toBe('Braids already has "crown".');
    // The same name is fine in another section (Viking Charms add-on vs. retail).
    expect(status((await addItem({ kind: "retail", name: "Crown", minutes: null })).res)).toBe(
      "applied",
    );
  });

  it("rejects silly prices, unknown skills, and non-owners", async () => {
    expect(error((await addItem({ priceCents: 999999 })).res)).toBe("Price must be $500 or less");
    expect(error((await addItem({ skillIds: [newId()] })).res)).toBe("That skill doesn't exist.");
    const sneaky = await braider.mutate("menu.create", {
      id: newId(),
      kind: "braid",
      name: "Sneaky",
      priceCents: 100,
      minutes: null,
    });
    expect(error(sneaky)).toBe("You don't have permission to make that change.");
  });

  it("changes a price and turns an item off", async () => {
    const { id } = await addItem({ name: "Katniss", priceCents: 1500 });
    await owner.mutate("menu.update", { id, priceCents: 2000, active: false });
    const row = (await owner.pull()).changes.menuItems.find((i) => i.id === id);
    expect(row).toMatchObject({ priceCents: 2000, active: false });
  });
});

describe("skills", () => {
  it("records who has which skill, and lets the owner take one away", async () => {
    const skill = await addSkill("5 Strand");
    const set = (has: boolean) =>
      owner.mutate("staff.setSkill", { staffId: braiderId, skillId: skill, has });
    expect(status(await set(true))).toBe("applied");
    expect(status(await set(false))).toBe("applied");
    const rows = (await braider.pull()).changes.staffSkills.filter((r) => r.skillId === skill);
    expect(rows).toEqual([expect.objectContaining({ staffId: braiderId, has: false })]);
  });

  it("won't create two skills with the same name", async () => {
    await addSkill("Cornrows");
    const dup = await owner.mutate("skill.create", { id: newId(), name: "cornrows" });
    expect(error(dup)).toBe('There\'s already a skill called "cornrows".');
  });
});

describe("event menu", () => {
  it("sets a different price at one event, or leaves an item off", async () => {
    const eventId = newId();
    await owner.mutate("event.create", {
      id: eventId,
      name: "Small Market",
      city: "Eagle",
      startDate: "2027-06-05",
      endDate: "2027-06-05",
      taxRateBps: 600,
    });
    const { id: itemId } = await addItem({ name: "Wolftail", priceCents: 3500 });
    const set = (priceCents: number | null, offered: boolean) =>
      owner.mutate("event.setMenuItem", { eventId, menuItemId: itemId, priceCents, offered });
    expect(status(await set(2500, true))).toBe("applied");
    expect(status(await set(null, false))).toBe("applied");
    const rows = (await braider.pull()).changes.eventMenu.filter((r) => r.eventId === eventId);
    expect(rows).toEqual([expect.objectContaining({ priceCents: null, offered: false })]);
  });
});
