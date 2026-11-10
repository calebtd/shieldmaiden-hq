import { eq } from "drizzle-orm";
import { definedOnly } from "@shared/objects";
import { DomainError } from "../context";
import { events, eventStaff } from "../db/schema";
import { nextVersion } from "../sync/version";
import { requireEditableEvent, requireStaff } from "./guards";
import type { MutationHandler } from "./types";

export const createEvent: MutationHandler<"event.create"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, args.id))
    .get();
  if (existing) throw new DomainError("That event already exists.", 409);
  return [
    db.insert(events).values({
      ...args,
      status: "planning",
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
  ];
};

export const updateEvent: MutationHandler<"event.update"> = async ({ db, args, now }) => {
  await requireEditableEvent(db, args.id);
  const { id, ...changes } = args;
  return [
    db
      .update(events)
      .set({ ...definedOnly(changes), updatedAt: now, version: nextVersion })
      .where(eq(events.id, id)),
  ];
};

export const setWorking: MutationHandler<"event.setWorking"> = async ({ db, args, now }) => {
  await requireEditableEvent(db, args.eventId);
  const person = await requireStaff(db, args.staffId);
  if (args.working && !person.active) {
    throw new DomainError(`${person.name} is turned off. Turn them back on first.`, 409);
  }
  const changes = { working: args.working, updatedAt: now, version: nextVersion };
  return [
    db
      .insert(eventStaff)
      .values({ eventId: args.eventId, staffId: args.staffId, ...changes })
      .onConflictDoUpdate({ target: [eventStaff.eventId, eventStaff.staffId], set: changes }),
  ];
};

export const setPayOverride: MutationHandler<"event.setPayOverride"> = async ({
  db,
  args,
  now,
}) => {
  await requireEditableEvent(db, args.eventId);
  await requireStaff(db, args.staffId);
  const { eventId, staffId, ...override } = args;
  const changes = { ...override, updatedAt: now, version: nextVersion };
  return [
    db
      .insert(eventStaff)
      // Setting someone's pay for an event puts them on it.
      .values({ eventId, staffId, working: true, ...changes })
      .onConflictDoUpdate({ target: [eventStaff.eventId, eventStaff.staffId], set: changes }),
  ];
};
