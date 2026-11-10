import { count, eq } from "drizzle-orm";
import type { Role } from "@shared/roles";
import type { Db } from "./context";
import {
  auditLog,
  discountTypes,
  eventMenu,
  events,
  eventStaff,
  menuItems,
  mutationsApplied,
  payProfiles,
  serverMeta,
  skills,
  staff,
  staffSkills,
} from "./db/schema";
import { bumpVersion, nextVersion } from "./sync/version";

/**
 * Demo records get fixed IDs. Two first visits at once can both see an empty database
 * and both seed; with fixed IDs the second one's rows are all skipped, instead of
 * leaving a second event or pay rows for people who don't exist.
 */
function demoId(n: number): string {
  return `00000000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

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

/** A small sample menu. Sigrun and Ingrid can do Valkyrie (it needs Dutch); Liv can't yet. */
const DEMO_SKILL = { id: demoId(300), name: "Dutch" };
const DEMO_MENU = [
  {
    kind: "braid",
    name: "Valkyrie (Full)",
    priceCents: 7000,
    minutes: 35,
    skillIds: [demoId(300)],
  },
  { kind: "braid", name: "Shieldmaiden", priceCents: 4000, minutes: 15, skillIds: [] },
  { kind: "braid", name: "Battle Braid", priceCents: 2000, minutes: 10, skillIds: [] },
  { kind: "addon", name: "Charms (3)", priceCents: 300, minutes: null, skillIds: [] },
  { kind: "retail", name: "Satin Bonnet", priceCents: 1500, minutes: null, skillIds: [] },
] as const;

/** A sample upcoming event about two months out, so the demo always has one to look at. */
function demoEvent(now: number) {
  const start = new Date(now + 60 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return {
    id: demoId(100),
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
  const people = DEMO_STAFF.map((s, i) => ({ ...s, id: demoId(i + 1) }));
  const event = demoEvent(now);
  await db.batch([
    bumpVersion(db),
    ...people.map(({ pay: _pay, ...s }) =>
      db
        .insert(staff)
        .values({
          ...s,
          active: true,
          phone: null,
          createdAt: now,
          updatedAt: now,
          version: nextVersion,
        })
        .onConflictDoNothing(),
    ),
    ...people.map(({ id, pay: [hourlyCents, commissionBps, tipShareBps] }) =>
      db
        .insert(payProfiles)
        .values({
          staffId: id,
          hourlyCents,
          commissionBps,
          tipShareBps,
          updatedAt: now,
          version: nextVersion,
        })
        .onConflictDoNothing(),
    ),
    db.insert(events).values(event).onConflictDoNothing(),
    ...people
      .filter((p) => p.role !== "owner")
      .map((p) =>
        db
          .insert(eventStaff)
          .values({
            eventId: event.id,
            staffId: p.id,
            working: true,
            // Liv is training at this one: a flat $12/hr and no commission.
            ...(p.name === "Liv"
              ? { hourlyCents: 1200, commissionBps: 0, note: "Training day" }
              : {}),
            updatedAt: now,
            version: nextVersion,
          })
          .onConflictDoNothing(),
      ),
    db
      .insert(skills)
      .values({ ...DEMO_SKILL, active: true, createdAt: now, updatedAt: now, version: nextVersion })
      .onConflictDoNothing(),
    ...people
      .filter((p) => p.name === "Sigrun" || p.name === "Ingrid")
      .map((p) =>
        db
          .insert(staffSkills)
          .values({
            staffId: p.id,
            skillId: DEMO_SKILL.id,
            has: true,
            updatedAt: now,
            version: nextVersion,
          })
          .onConflictDoNothing(),
      ),
    ...DEMO_MENU.map((m, i) =>
      db
        .insert(menuItems)
        .values({
          id: demoId(400 + i),
          ...m,
          skillIds: [...m.skillIds],
          openPrice: false,
          description: null,
          active: true,
          createdAt: now,
          updatedAt: now,
          version: nextVersion,
        })
        .onConflictDoNothing(),
    ),
    ...DEMO_DISCOUNTS.map((d, i) =>
      db
        .insert(discountTypes)
        .values({
          id: demoId(200 + i),
          ...d,
          reducesCommission: d.name === "Comp",
          active: true,
          createdAt: now,
          updatedAt: now,
          version: nextVersion,
        })
        .onConflictDoNothing(),
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
    db.delete(menuItems),
    db.delete(skills),
    db.delete(staffSkills),
    db.delete(eventMenu),
    db.delete(mutationsApplied),
    db.delete(auditLog),
    db.update(serverMeta).set({ value: epoch }).where(eq(serverMeta.key, "epoch")),
  ]);
  await seedDemoDataIfEmpty(db);
}
