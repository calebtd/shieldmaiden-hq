import { ruleColumns } from "@shared/entities/discount";
import type { EventStaff } from "@shared/entities/event";
import type { MutationArgs, MutationName } from "@shared/mutations";
import { definedOnly } from "@shared/objects";
import type { LocalDb } from "../db/local";
import { menuAppliers } from "./menuAppliers";

/**
 * Applies a change to the device's copy right away, before the server has seen it.
 * Appliers must be safe to run more than once with the same args: after each pull the
 * still-queued changes are re-applied on top of the server's data.
 */
export type Applier<N extends MutationName> = (
  db: LocalDb,
  args: MutationArgs<N>,
  now: number,
) => Promise<void>;
type Appliers = { [N in MutationName]: Applier<N> };

export const appliers: Appliers = {
  ...menuAppliers,
  "staff.create": async (db, args, now) => {
    const existing = await db.staff.get(args.id);
    await db.staff.put({
      ...args,
      active: existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "staff.update": async (db, { id, ...changes }, now) => {
    const existing = await db.staff.get(id);
    if (!existing) return;
    await db.staff.put({ ...existing, ...definedOnly(changes), updatedAt: now });
  },

  "pay.set": async (db, args, now) => {
    const existing = await db.payProfiles.get(args.staffId);
    await db.payProfiles.put({ ...args, updatedAt: now, version: existing?.version ?? 0 });
  },

  "event.create": async (db, args, now) => {
    const existing = await db.events.get(args.id);
    await db.events.put({
      ...args,
      status: existing?.status ?? "planning",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "event.update": async (db, { id, ...changes }, now) => {
    const existing = await db.events.get(id);
    if (!existing) return;
    await db.events.put({ ...existing, ...definedOnly(changes), updatedAt: now });
  },

  "event.setWorking": async (db, { eventId, staffId, working }, now) => {
    const existing = await db.eventStaff.get([eventId, staffId]);
    await db.eventStaff.put({
      ...(existing ?? blankEventStaff(eventId, staffId)),
      working,
      updatedAt: now,
    });
  },

  "event.setPayOverride": async (db, { eventId, staffId, ...override }, now) => {
    const existing = await db.eventStaff.get([eventId, staffId]);
    await db.eventStaff.put({
      ...(existing ?? { ...blankEventStaff(eventId, staffId), working: true }),
      ...override,
      updatedAt: now,
    });
  },

  "discount.create": async (db, { rule, ...args }, now) => {
    const existing = await db.discountTypes.get(args.id);
    await db.discountTypes.put({
      ...args,
      ...ruleColumns(rule),
      active: existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "discount.update": async (db, { id, rule, ...changes }, now) => {
    const existing = await db.discountTypes.get(id);
    if (!existing) return;
    await db.discountTypes.put({
      ...existing,
      ...definedOnly(changes),
      ...(rule ? ruleColumns(rule) : {}),
      updatedAt: now,
    });
  },
};

function blankEventStaff(eventId: string, staffId: string): EventStaff {
  return {
    eventId,
    staffId,
    working: false,
    hourlyCents: null,
    commissionBps: null,
    tipShareBps: null,
    note: null,
    updatedAt: 0,
    version: 0,
  };
}
