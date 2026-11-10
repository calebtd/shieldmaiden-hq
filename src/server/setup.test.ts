import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { newId } from "@shared/ids";
import { createDb } from "./context";
import { events } from "./db/schema";
import { TestClient } from "./test/client";

const owner = new TestClient();
const braider = new TestClient();
const checkout = new TestClient();
let braiderId: string;
let checkoutId: string;

beforeAll(async () => {
  await owner.signInAs("owner");
  braiderId = (await braider.signInAs("braider")).id;
  checkoutId = (await checkout.signInAs("checkout")).id;
});

const status = (r: { results: { status: string }[] }) => r.results[0]?.status;
const error = (r: { results: unknown[] }) => (r.results[0] as { error?: string }).error;

async function makeEvent(overrides: Record<string, unknown> = {}) {
  const id = newId();
  const res = await owner.mutate("event.create", {
    id,
    name: "Spring Faire",
    city: "Boise",
    startDate: "2027-04-10",
    endDate: "2027-04-11",
    taxRateBps: 600,
    ...overrides,
  });
  return { id, res };
}

describe("pay profiles", () => {
  it("an owner sets and changes someone's usual pay", async () => {
    const set = (hourlyCents: number) =>
      owner.mutate("pay.set", {
        staffId: braiderId,
        hourlyCents,
        commissionBps: 2000,
        tipShareBps: 10000,
      });
    expect(status(await set(500))).toBe("applied");
    expect(status(await set(700))).toBe("applied");
    const rows = (await owner.pull()).changes.payProfiles.filter((p) => p.staffId === braiderId);
    expect(rows).toEqual([expect.objectContaining({ hourlyCents: 700, commissionBps: 2000 })]);
  });

  it("people only see their own pay", async () => {
    await owner.mutate("pay.set", {
      staffId: checkoutId,
      hourlyCents: 1500,
      commissionBps: 0,
      tipShareBps: 0,
    });
    const seen = (await braider.pull()).changes.payProfiles.map((p) => p.staffId);
    expect(seen).toContain(braiderId);
    expect(seen).not.toContain(checkoutId);
  });

  it("rejects rates over 100% and non-owners", async () => {
    const bad = await owner.mutate("pay.set", {
      staffId: braiderId,
      hourlyCents: 500,
      commissionBps: 20000,
      tipShareBps: 10000,
    });
    expect(error(bad)).toBe("Must be 100% or less");
    const sneaky = await braider.mutate("pay.set", {
      staffId: braiderId,
      hourlyCents: 9900,
      commissionBps: 10000,
      tipShareBps: 10000,
    });
    expect(error(sneaky)).toBe("You don't have permission to make that change.");
  });

  it("rejects pay for someone who doesn't exist", async () => {
    const res = await owner.mutate("pay.set", {
      staffId: newId(),
      hourlyCents: 500,
      commissionBps: 0,
      tipShareBps: 0,
    });
    expect(error(res)).toBe("That staff member doesn't exist.");
  });
});

describe("events", () => {
  it("creates an event that everyone can see", async () => {
    const { id, res } = await makeEvent();
    expect(status(res)).toBe("applied");
    const seen = (await braider.pull()).changes.events.find((e) => e.id === id);
    expect(seen).toMatchObject({ name: "Spring Faire", taxRateBps: 600, status: "planning" });
  });

  it("rejects dates out of order, too long, or not real", async () => {
    expect(error((await makeEvent({ endDate: "2027-04-09" })).res)).toBe("Ends before it starts");
    expect(error((await makeEvent({ endDate: "2028-04-11" })).res)).toMatch(/Check the year/);
    expect(error((await makeEvent({ startDate: "2027-02-30" })).res)).toBe("Pick a date");
  });

  it("rejects a tax rate that's clearly a typo", async () => {
    expect(error((await makeEvent({ taxRateBps: 82500 })).res)).toBe(
      "Sales tax must be 20% or less",
    );
  });

  it("updates details, checking dates as a pair", async () => {
    const { id } = await makeEvent();
    const ok = await owner.mutate("event.update", { id, city: "Meridian", taxRateBps: 625 });
    expect(status(ok)).toBe("applied");
    const half = await owner.mutate("event.update", { id, startDate: "2027-04-12" });
    expect(error(half)).toBe("Send both dates together");
    const row = (await owner.pull()).changes.events.find((e) => e.id === id);
    expect(row).toMatchObject({ city: "Meridian", taxRateBps: 625, startDate: "2027-04-10" });
  });

  it("refuses changes once an event is locked", async () => {
    const { id } = await makeEvent();
    // Locking arrives with close-out (Phase 3); set it directly for now.
    await createDb(env.DB).update(events).set({ status: "locked" }).where(eq(events.id, id));
    const res = await owner.mutate("event.update", { id, name: "Renamed" });
    expect(error(res)).toBe("Spring Faire is locked, so its setup can't change.");
    const crew = await owner.mutate("event.setWorking", {
      eventId: id,
      staffId: braiderId,
      working: true,
    });
    expect(status(crew)).toBe("rejected");
  });
});

describe("who's working and event pay", () => {
  it("adds and removes people from an event", async () => {
    const { id } = await makeEvent();
    const set = (working: boolean) =>
      owner.mutate("event.setWorking", { eventId: id, staffId: braiderId, working });
    expect(status(await set(true))).toBe("applied");
    expect(status(await set(false))).toBe("applied");
    const rows = (await owner.pull()).changes.eventStaff.filter((r) => r.eventId === id);
    expect(rows).toEqual([expect.objectContaining({ staffId: braiderId, working: false })]);
  });

  it("overrides pay for one event and keeps whether they're working", async () => {
    const { id } = await makeEvent();
    await owner.mutate("event.setWorking", { eventId: id, staffId: braiderId, working: true });
    const res = await owner.mutate("event.setPayOverride", {
      eventId: id,
      staffId: braiderId,
      hourlyCents: 1200,
      commissionBps: 0,
      tipShareBps: null,
      note: "  Training day ",
    });
    expect(status(res)).toBe("applied");
    const row = (await owner.pull()).changes.eventStaff.find(
      (r) => r.eventId === id && r.staffId === braiderId,
    );
    expect(row).toMatchObject({
      working: true,
      hourlyCents: 1200,
      commissionBps: 0,
      tipShareBps: null,
      note: "Training day",
    });
  });

  it("shows others who's working but not their event pay", async () => {
    const { id } = await makeEvent();
    await owner.mutate("event.setPayOverride", {
      eventId: id,
      staffId: checkoutId,
      hourlyCents: 2000,
      commissionBps: null,
      tipShareBps: null,
      note: "Bonus rate",
    });
    await owner.mutate("event.setPayOverride", {
      eventId: id,
      staffId: braiderId,
      hourlyCents: 900,
      commissionBps: null,
      tipShareBps: null,
      note: "",
    });
    const rows = (await braider.pull()).changes.eventStaff.filter((r) => r.eventId === id);
    expect(rows.find((r) => r.staffId === checkoutId)).toMatchObject({
      working: true,
      hourlyCents: null,
      note: null,
    });
    expect(rows.find((r) => r.staffId === braiderId)).toMatchObject({ hourlyCents: 900 });
  });

  it("won't put someone who's turned off on an event", async () => {
    const { id } = await makeEvent();
    const personId = newId();
    await owner.mutate("staff.create", {
      id: personId,
      name: "Gone",
      role: "braider",
      email: "",
      phone: "",
    });
    await owner.mutate("staff.update", { id: personId, active: false });
    const res = await owner.mutate("event.setWorking", {
      eventId: id,
      staffId: personId,
      working: true,
    });
    expect(error(res)).toBe("Gone is turned off. Turn them back on first.");
  });
});

describe("discount types", () => {
  it("creates percent and dollar discounts; commission is unaffected by default", async () => {
    const pct = newId();
    const amt = newId();
    await owner.mutate("discount.create", {
      id: pct,
      name: "Friends & Family",
      rule: { kind: "percent", percentBps: 2000 },
    });
    await owner.mutate("discount.create", {
      id: amt,
      name: "Referral",
      rule: { kind: "amount", amountCents: 1000 },
      reducesCommission: true,
    });
    const rows = (await checkout.pull()).changes.discountTypes;
    expect(rows.find((d) => d.id === pct)).toMatchObject({
      kind: "percent",
      percentBps: 2000,
      amountCents: null,
      reducesCommission: false,
      active: true,
    });
    expect(rows.find((d) => d.id === amt)).toMatchObject({
      kind: "amount",
      amountCents: 1000,
      percentBps: null,
      reducesCommission: true,
    });
  });

  it("switches a discount between percent and dollars, and turns it off", async () => {
    const id = newId();
    await owner.mutate("discount.create", {
      id,
      name: "Promo",
      rule: { kind: "percent", percentBps: 1000 },
    });
    await owner.mutate("discount.update", {
      id,
      rule: { kind: "amount", amountCents: 500 },
      active: false,
    });
    const row = (await owner.pull()).changes.discountTypes.find((d) => d.id === id);
    expect(row).toMatchObject({
      kind: "amount",
      amountCents: 500,
      percentBps: null,
      active: false,
    });
  });

  it("rejects discounts over 100% or of nothing", async () => {
    const make = (rule: unknown) =>
      owner.mutate("discount.create", { id: newId(), name: "Bad", rule } as never);
    expect(error(await make({ kind: "percent", percentBps: 15000 }))).toBe(
      "A discount can't be more than 100%",
    );
    expect(error(await make({ kind: "amount", amountCents: 0 }))).toBe(
      "Enter an amount more than $0",
    );
  });
});
