import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { overlaps, timeProblem, type Span } from "@domain/time";
import type { TimeKind } from "@shared/entities/time";
import { DomainError, type AuthedUser, type Db } from "../context";
import { eventStaff, staff, timeEntries } from "../db/schema";
import { nextVersion } from "../sync/version";
import { requireEditableEvent } from "./guards";
import type { MutationHandler } from "./types";

/* ---------- checks ---------- */

function requireSelfOrOwner(user: AuthedUser, staffId: string) {
  if (user.role !== "owner" && user.staffId !== staffId) {
    throw new DomainError("You can only change your own time.", 403);
  }
}

async function requireOnCrew(db: Db, eventId: string, staffId: string, eventName: string) {
  const row = await db
    .select({ working: eventStaff.working, name: staff.name })
    .from(staff)
    .leftJoin(eventStaff, and(eq(eventStaff.staffId, staff.id), eq(eventStaff.eventId, eventId)))
    .where(eq(staff.id, staffId))
    .get();
  if (!row) throw new DomainError("That staff member doesn't exist.", 404);
  if (!row.working) {
    throw new DomainError(
      `${row.name} isn't on the crew for ${eventName}. Ask the owner to add them.`,
      409,
    );
  }
}

/** The entry, as long as it hasn't been removed or replaced. */
async function requireLiveEntry(db: Db, id: string) {
  const entry = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).get();
  if (!entry) throw new DomainError("That time entry doesn't exist.", 404);
  if (entry.voidedAt !== null) {
    throw new DomainError(
      "That entry was already changed or removed. Check the latest times.",
      409,
    );
  }
  return entry;
}

async function requireNewId(db: Db, id: string) {
  const clash = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(eq(timeEntries.id, id))
    .get();
  if (clash) throw new DomainError("That time entry already exists.", 409);
}

function checkTimes(span: Span, now: number, allowOpen = false) {
  const problem = timeProblem(span, now, allowOpen);
  if (problem) throw new DomainError(problem);
}

/** No two shifts (or two breaks) for one person can cover the same time. */
async function requireNoOverlap(
  db: Db,
  staffId: string,
  kind: TimeKind,
  span: Span,
  exceptId?: string,
) {
  const others = await db
    .select({ id: timeEntries.id, start: timeEntries.startAt, end: timeEntries.endAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.staffId, staffId),
        eq(timeEntries.kind, kind),
        isNull(timeEntries.voidedAt),
        exceptId ? ne(timeEntries.id, exceptId) : undefined,
      ),
    );
  if (others.some((o) => overlaps(o, span))) {
    throw new DomainError(
      kind === "work"
        ? "That overlaps another shift. Fix or remove the other one first."
        : "That overlaps another break.",
      409,
    );
  }
}

async function openEntry(db: Db, staffId: string, kind: TimeKind, eventId?: string) {
  return db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.staffId, staffId),
        eq(timeEntries.kind, kind),
        isNull(timeEntries.endAt),
        isNull(timeEntries.voidedAt),
        eventId ? eq(timeEntries.eventId, eventId) : undefined,
      ),
    )
    .get();
}

function newEntry(
  user: AuthedUser,
  now: number,
  e: {
    id: string;
    eventId: string;
    staffId: string;
    kind: TimeKind;
    startAt: number;
    endAt: number | null;
  },
  extra: { replacesId?: string; reason?: string } = {},
) {
  return {
    ...e,
    replacesId: extra.replacesId ?? null,
    reason: extra.reason ?? null,
    createdBy: user.staffId,
    createdAt: now,
    updatedAt: now,
    version: nextVersion,
  };
}

/* ---------- clock taps ---------- */

export const clockIn: MutationHandler<"time.clockIn"> = async ({ db, user, args, now }) => {
  requireSelfOrOwner(user, args.staffId);
  const event = await requireEditableEvent(db, args.eventId);
  await requireOnCrew(db, args.eventId, args.staffId, event.name);
  await requireNewId(db, args.id);
  if (await openEntry(db, args.staffId, "work")) {
    throw new DomainError("Already clocked in. Clock out first.", 409);
  }
  const span = { start: args.at, end: null };
  checkTimes(span, now, true);
  await requireNoOverlap(db, args.staffId, "work", span);
  const entry = {
    id: args.id,
    eventId: args.eventId,
    staffId: args.staffId,
    kind: "work" as const,
  };
  return [
    db.insert(timeEntries).values(newEntry(user, now, { ...entry, startAt: args.at, endAt: null })),
  ];
};

async function finish(
  db: Db,
  user: AuthedUser,
  entryId: string,
  kind: TimeKind,
  at: number,
  now: number,
) {
  const entry = await requireLiveEntry(db, entryId);
  requireSelfOrOwner(user, entry.staffId);
  await requireEditableEvent(db, entry.eventId);
  if (entry.kind !== kind)
    throw new DomainError("That isn't a " + (kind === "work" ? "shift." : "break."));
  if (entry.endAt !== null) {
    throw new DomainError(
      kind === "work" ? "Already clocked out." : "That break already ended.",
      409,
    );
  }
  checkTimes({ start: entry.startAt, end: at }, now);
  return entry;
}

export const clockOut: MutationHandler<"time.clockOut"> = async ({ db, user, args, now }) => {
  const entry = await finish(db, user, args.entryId, "work", args.at, now);
  const set = { endAt: args.at, updatedAt: now, version: nextVersion };
  return [
    db.update(timeEntries).set(set).where(eq(timeEntries.id, entry.id)),
    // Clocking out also ends a break that's still running.
    db
      .update(timeEntries)
      .set(set)
      .where(
        and(
          eq(timeEntries.staffId, entry.staffId),
          eq(timeEntries.kind, "break"),
          isNull(timeEntries.endAt),
          isNull(timeEntries.voidedAt),
          lt(timeEntries.startAt, args.at),
        ),
      ),
  ];
};

export const startBreak: MutationHandler<"time.startBreak"> = async ({ db, user, args, now }) => {
  requireSelfOrOwner(user, args.staffId);
  await requireEditableEvent(db, args.eventId);
  await requireNewId(db, args.id);
  const shift = await openEntry(db, args.staffId, "work", args.eventId);
  if (!shift) throw new DomainError("Clock in before starting a break.", 409);
  if (await openEntry(db, args.staffId, "break")) throw new DomainError("Already on a break.", 409);
  if (args.at < shift.startAt) throw new DomainError("A break can't start before the shift.");
  checkTimes({ start: args.at, end: null }, now, true);
  const entry = {
    id: args.id,
    eventId: args.eventId,
    staffId: args.staffId,
    kind: "break" as const,
  };
  return [
    db.insert(timeEntries).values(newEntry(user, now, { ...entry, startAt: args.at, endAt: null })),
  ];
};

export const endBreak: MutationHandler<"time.endBreak"> = async ({ db, user, args, now }) => {
  const entry = await finish(db, user, args.entryId, "break", args.at, now);
  return [
    db
      .update(timeEntries)
      .set({ endAt: args.at, updatedAt: now, version: nextVersion })
      .where(eq(timeEntries.id, entry.id)),
  ];
};

/* ---------- fixes ---------- */

export const addTime: MutationHandler<"time.add"> = async ({ db, user, args, now }) => {
  requireSelfOrOwner(user, args.staffId);
  const event = await requireEditableEvent(db, args.eventId);
  await requireOnCrew(db, args.eventId, args.staffId, event.name);
  await requireNewId(db, args.id);
  const span = { start: args.startAt, end: args.endAt };
  checkTimes(span, now);
  await requireNoOverlap(db, args.staffId, args.kind, span);
  const { reason, ...entry } = args;
  return [db.insert(timeEntries).values(newEntry(user, now, entry, { reason }))];
};

export const correctTime: MutationHandler<"time.correct"> = async ({ db, user, args, now }) => {
  const old = await requireLiveEntry(db, args.replacesId);
  requireSelfOrOwner(user, old.staffId);
  await requireEditableEvent(db, old.eventId);
  await requireNewId(db, args.id);
  if (old.endAt !== null && args.endAt === null) throw new DomainError("Add the end time.");
  const span = { start: args.startAt, end: args.endAt };
  checkTimes(span, now, old.endAt === null);
  await requireNoOverlap(db, old.staffId, old.kind, span, old.id);
  const entry = { id: args.id, eventId: old.eventId, staffId: old.staffId, kind: old.kind };
  return [
    db
      .update(timeEntries)
      .set({
        voidedAt: now,
        voidedBy: user.staffId,
        voidReason: args.reason,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(timeEntries.id, old.id)),
    db.insert(timeEntries).values(
      newEntry(
        user,
        now,
        { ...entry, startAt: args.startAt, endAt: args.endAt },
        {
          replacesId: old.id,
          reason: args.reason,
        },
      ),
    ),
  ];
};

export const voidTime: MutationHandler<"time.void"> = async ({ db, user, args, now }) => {
  const entry = await requireLiveEntry(db, args.entryId);
  requireSelfOrOwner(user, entry.staffId);
  await requireEditableEvent(db, entry.eventId);
  return [
    db
      .update(timeEntries)
      .set({
        voidedAt: now,
        voidedBy: user.staffId,
        voidReason: args.reason,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(timeEntries.id, entry.id)),
  ];
};
