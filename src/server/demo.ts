import { count, eq } from "drizzle-orm";
import { newId } from "@shared/ids";
import type { Role } from "@shared/roles";
import type { Db } from "./context";
import {
  auditLog,
  discountTypes,
  events,
  eventStaff,
  mutationsApplied,
  payProfiles,
  serverMeta,
  staff,
} from "./db/schema";
import { bumpVersion, nextVersion } from "./sync/version";

/** Fictional staff for demo.shieldmaiden.hair and local development. */
const DEMO_STAFF: { name: string; role: Role; email: string; pay: [number, number, number] }[] = [
  // pay: hourly cents, commission bps, tip share bps
  { name: "Astrid", role: "owner", email: "owner@demo.test", pay: [0, 0, 10000] },
  { name: "Freya", role: "checkout", email: "checkout@demo.test", pay: [1500, 0, 0] },
  { name: "Sigrun", role: "braider", email: "sigrun@demo.test", pay: [500, 2000, 10000] },
  { name: "Ingrid", role: "braider", email: "ingrid@demo.test", pay: [500, 2000, 10000] },
  { name: "Liv", role: "braider", email: "liv@demo.test", pay: [500, 2000, 10000] },
];

const DEMO_DISCOUNTS = [
  { name: "Friends & Family", kind: "percent", percentBps: 2000, amountCents: null },
  { name: "Referral", kind: "amount", percentBps: null, amountCents: 1000 },
  { name: "Comp", kind: "percent", percentBps: 10000, amountCents: null },
] as const;

/** A sample upcoming event about two months out, so the demo always has one to look at. */
function demoEvent(now: number) {
  const start = new Date(now + 60 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return {
    id: newId(now),
    name: "Midsummer Faire",
    city: "Boise",
    startDate: day(start),
    endDate: day(end),
    taxRateBps: 600,
    status: "planning" as const,
    createdAt: now,
    updatedAt: now,
    version: nextVersion,
  };
}

export async function seedDemoDataIfEmpty(db: Db): Promise<void> {
  const [row] = await db.select({ n: count() }).from(staff);
  if ((row?.n ?? 0) > 0) return;
  const now = Date.now();
  const people = DEMO_STAFF.map((s) => ({ ...s, id: newId(now) }));
  const event = demoEvent(now);
  await db.batch([
    bumpVersion(db),
    ...people.map(({ pay: _pay, ...s }) =>
      db.insert(staff).values({
        ...s,
        active: true,
        phone: null,
        createdAt: now,
        updatedAt: now,
        version: nextVersion,
      }),
    ),
    ...people.map(({ id, pay: [hourlyCents, commissionBps, tipShareBps] }) =>
      db.insert(payProfiles).values({
        staffId: id,
        hourlyCents,
        commissionBps,
        tipShareBps,
        updatedAt: now,
        version: nextVersion,
      }),
    ),
    db.insert(events).values(event),
    ...people
      .filter((p) => p.role !== "owner")
      .map((p) =>
        db.insert(eventStaff).values({
          eventId: event.id,
          staffId: p.id,
          working: true,
          // Liv is training at this one: a flat $12/hr and no commission.
          ...(p.name === "Liv"
            ? { hourlyCents: 1200, commissionBps: 0, note: "Training day" }
            : {}),
          updatedAt: now,
          version: nextVersion,
        }),
      ),
    ...DEMO_DISCOUNTS.map((d) =>
      db.insert(discountTypes).values({
        id: newId(now),
        ...d,
        reducesCommission: d.name === "Comp",
        active: true,
        createdAt: now,
        updatedAt: now,
        version: nextVersion,
      }),
    ),
  ]);
}

/**
 * Wipes all data and reseeds. Changing the epoch tells every device to discard its
 * local copy on next sync. Only ever runs on the demo environment.
 */
export async function resetDemoData(db: Db): Promise<void> {
  const epoch = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await db.batch([
    db.delete(staff),
    db.delete(payProfiles),
    db.delete(events),
    db.delete(eventStaff),
    db.delete(discountTypes),
    db.delete(mutationsApplied),
    db.delete(auditLog),
    db.update(serverMeta).set({ value: epoch }).where(eq(serverMeta.key, "epoch")),
  ]);
  await seedDemoDataIfEmpty(db);
}
