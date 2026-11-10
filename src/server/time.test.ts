import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { HOUR, MINUTE } from "@domain/time";
import { newId } from "@shared/ids";
import { createDb } from "./context";
import { events } from "./db/schema";
import { TestClient } from "./test/client";

const owner = new TestClient();
const braider = new TestClient();
const checkout = new TestClient();
let braiderId: string;
let checkoutId: string;

const status = (r: { results: { status: string }[] }) => r.results[0]?.status;
const error = (r: { results: unknown[] }) => (r.results[0] as { error?: string }).error;

async function makeEvent(crew: string[]) {
  const id = newId();
  await owner.mutate("event.create", {
    id,
    name: "Timeclock Faire",
    city: "Boise",
    startDate: "2027-06-05",
    endDate: "2027-06-06",
    taxRateBps: 600,
  });
  for (const staffId of crew) {
    await owner.mutate("event.setWorking", { eventId: id, staffId, working: true });
  }
  return id;
}

/** A fresh person on a fresh event, so tests never share an open shift. */
async function freshBraider() {
  const staffId = newId();
  await owner.mutate("staff.create", {
    id: staffId,
    name: "Clock Tester",
    role: "braider",
    email: "",
    phone: "",
  });
  return { staffId, eventId: await makeEvent([staffId]) };
}

async function myEntries(client: TestClient, staffId: string) {
  return (await client.pull()).changes.timeEntries.filter((t) => t.staffId === staffId);
}

beforeAll(async () => {
  await owner.signInAs("owner");
  braiderId = (await braider.signInAs("braider")).id;
  checkoutId = (await checkout.signInAs("checkout")).id;
});

describe("clocking in and out", () => {
  it("records a shift with a break, ending the break on clock-out", async () => {
    const eventId = await makeEvent([braiderId]);
    const now = Date.now();
    const shift = newId();
    const brk = newId();
    expect(
      status(
        await braider.mutate("time.clockIn", {
          id: shift,
          eventId,
          staffId: braiderId,
          at: now - 3 * HOUR,
        }),
      ),
    ).toBe("applied");
    expect(
      status(
        await braider.mutate("time.startBreak", {
          id: brk,
          eventId,
          staffId: braiderId,
          at: now - HOUR,
        }),
      ),
    ).toBe("applied");
    expect(
      status(await braider.mutate("time.clockOut", { entryId: shift, at: now - 30 * MINUTE })),
    ).toBe("applied");

    const rows = await myEntries(braider, braiderId);
    expect(rows.find((r) => r.id === shift)).toMatchObject({
      kind: "work",
      endAt: now - 30 * MINUTE,
    });
    expect(rows.find((r) => r.id === brk)).toMatchObject({
      kind: "break",
      endAt: now - 30 * MINUTE,
    });
  });

  it("won't clock in twice or start a break off the clock", async () => {
    const { staffId, eventId } = await freshBraider();
    const brk = await owner.mutate("time.startBreak", {
      id: newId(),
      eventId,
      staffId,
      at: Date.now(),
    });
    expect(error(brk)).toBe("Clock in before starting a break.");
    await owner.mutate("time.clockIn", { id: newId(), eventId, staffId, at: Date.now() - HOUR });
    const again = await owner.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId,
      at: Date.now(),
    });
    expect(error(again)).toBe("Already clocked in. Clock out first.");
  });

  it("only lets people clock in for events they're working", async () => {
    const eventId = await makeEvent([]);
    const res = await braider.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId: braiderId,
      at: Date.now(),
    });
    expect(error(res)).toMatch(/isn't on the crew for Timeclock Faire/);
  });

  it("people can't touch someone else's time; the owner can", async () => {
    const eventId = await makeEvent([checkoutId]);
    const res = await braider.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId: checkoutId,
      at: Date.now(),
    });
    expect(error(res)).toBe("You can only change your own time.");
    const ok = await owner.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId: checkoutId,
      at: Date.now() - HOUR,
    });
    expect(status(ok)).toBe("applied");
  });

  it("rejects times in the future", async () => {
    const { staffId, eventId } = await freshBraider();
    const res = await owner.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId,
      at: Date.now() + HOUR,
    });
    expect(error(res)).toBe("The start time can't be in the future.");
  });

  it("keeps time private: others don't receive it", async () => {
    const { staffId, eventId } = await freshBraider();
    await owner.mutate("time.clockIn", { id: newId(), eventId, staffId, at: Date.now() - HOUR });
    expect(await myEntries(checkout, staffId)).toEqual([]);
    expect(await myEntries(owner, staffId)).toHaveLength(1);
  });
});

describe("fixing time", () => {
  it("a correction keeps the old entry, crossed out, with the reason", async () => {
    const { staffId, eventId } = await freshBraider();
    const shift = newId();
    const now = Date.now();
    await owner.mutate("time.clockIn", { id: shift, eventId, staffId, at: now - 5 * HOUR });
    const fixed = newId();
    const res = await owner.mutate("time.correct", {
      id: fixed,
      replacesId: shift,
      startAt: now - 4 * HOUR,
      endAt: now - HOUR,
      reason: "Forgot to clock out",
    });
    expect(status(res)).toBe("applied");
    const rows = await myEntries(owner, staffId);
    expect(rows.find((r) => r.id === shift)).toMatchObject({ voidReason: "Forgot to clock out" });
    expect(rows.find((r) => r.id === shift)?.voidedAt).not.toBeNull();
    expect(rows.find((r) => r.id === fixed)).toMatchObject({
      replacesId: shift,
      endAt: now - HOUR,
      voidedAt: null,
    });

    const twice = await owner.mutate("time.correct", {
      id: newId(),
      replacesId: shift,
      startAt: now - 2 * HOUR,
      endAt: now - HOUR,
      reason: "Again",
    });
    expect(error(twice)).toBe("That entry was already changed or removed. Check the latest times.");
  });

  it("adds a missed shift, but not one that overlaps", async () => {
    const { staffId, eventId } = await freshBraider();
    const now = Date.now();
    const add = (start: number, end: number) =>
      owner.mutate("time.add", {
        id: newId(),
        eventId,
        staffId,
        kind: "work",
        startAt: start,
        endAt: end,
        reason: "Forgot to clock in",
      });
    expect(status(await add(now - 10 * HOUR, now - 6 * HOUR))).toBe("applied");
    expect(error(await add(now - 7 * HOUR, now - 5 * HOUR))).toBe(
      "That overlaps another shift. Fix or remove the other one first.",
    );
    expect(status(await add(now - 6 * HOUR, now - 5 * HOUR))).toBe("applied");
  });

  it("needs a reason, and removes an entry made by mistake", async () => {
    const { staffId, eventId } = await freshBraider();
    const shift = newId();
    await owner.mutate("time.clockIn", { id: shift, eventId, staffId, at: Date.now() - HOUR });
    expect(error(await owner.mutate("time.void", { entryId: shift, reason: "" }))).toMatch(
      /Say briefly why/,
    );
    expect(
      status(await owner.mutate("time.void", { entryId: shift, reason: "Wrong person" })),
    ).toBe("applied");
    // With that removed, they can clock in again.
    const again = await owner.mutate("time.clockIn", {
      id: newId(),
      eventId,
      staffId,
      at: Date.now(),
    });
    expect(status(again)).toBe("applied");
  });

  it("refuses changes once the event is locked", async () => {
    const { staffId, eventId } = await freshBraider();
    const shift = newId();
    await owner.mutate("time.clockIn", { id: shift, eventId, staffId, at: Date.now() - HOUR });
    await createDb(env.DB).update(events).set({ status: "locked" }).where(eq(events.id, eventId));
    const res = await owner.mutate("time.clockOut", { entryId: shift, at: Date.now() });
    expect(error(res)).toBe("Timeclock Faire is locked. Nothing can change after close-out.");
  });
});
