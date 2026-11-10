import type { TimeEntry, TimeKind } from "@shared/entities/time";
import type { LocalDb } from "../db/local";
import type { Applier } from "./appliers";

type TimeMutation =
  | "time.clockIn"
  | "time.clockOut"
  | "time.startBreak"
  | "time.endBreak"
  | "time.add"
  | "time.correct"
  | "time.void";

/** Device-side timeclock changes, so taps show instantly with or without signal. */
export const timeAppliers: { [N in TimeMutation]: Applier<N> } = {
  "time.clockIn": (db, { id, eventId, staffId, at }, now) =>
    put(db, { id, eventId, staffId, kind: "work", startAt: at, endAt: null }, now, staffId),

  "time.clockOut": async (db, { entryId, at }, now) => {
    const entry = await db.timeEntries.get(entryId);
    if (!entry || entry.endAt !== null) return;
    await db.timeEntries.put({ ...entry, endAt: at, updatedAt: now });
    // Also end a break that's still running.
    const breaks = await db.timeEntries.where("staffId").equals(entry.staffId).toArray();
    for (const b of breaks) {
      if (b.kind === "break" && b.endAt === null && b.voidedAt === null && b.startAt < at) {
        await db.timeEntries.put({ ...b, endAt: at, updatedAt: now });
      }
    }
  },

  "time.startBreak": (db, { id, eventId, staffId, at }, now) =>
    put(db, { id, eventId, staffId, kind: "break", startAt: at, endAt: null }, now, staffId),

  "time.endBreak": async (db, { entryId, at }, now) => {
    const entry = await db.timeEntries.get(entryId);
    if (!entry || entry.endAt !== null) return;
    await db.timeEntries.put({ ...entry, endAt: at, updatedAt: now });
  },

  "time.add": (db, { reason, ...entry }, now) => put(db, entry, now, entry.staffId, { reason }),

  "time.correct": async (db, { id, replacesId, startAt, endAt, reason }, now) => {
    const old = await db.timeEntries.get(replacesId);
    if (!old) return;
    if (old.voidedAt === null) {
      await db.timeEntries.put({ ...old, voidedAt: now, voidReason: reason, updatedAt: now });
    }
    const { eventId, staffId, kind } = old;
    await put(db, { id, eventId, staffId, kind, startAt, endAt }, now, staffId, {
      reason,
      replacesId,
    });
  },

  "time.void": async (db, { entryId, reason }, now) => {
    const entry = await db.timeEntries.get(entryId);
    if (!entry || entry.voidedAt !== null) return;
    await db.timeEntries.put({ ...entry, voidedAt: now, voidReason: reason, updatedAt: now });
  },
};

/** Adds an entry if it isn't there yet (appliers can run more than once). */
async function put(
  db: LocalDb,
  e: {
    id: string;
    eventId: string;
    staffId: string;
    kind: TimeKind;
    startAt: number;
    endAt: number | null;
  },
  now: number,
  createdBy: string,
  extra: { reason?: string; replacesId?: string } = {},
) {
  const existing = await db.timeEntries.get(e.id);
  if (existing) return;
  const entry: TimeEntry = {
    ...e,
    replacesId: extra.replacesId ?? null,
    reason: extra.reason ?? null,
    // The server records who really made it; locally the owner may act for someone.
    createdBy,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
  await db.timeEntries.put(entry);
}
