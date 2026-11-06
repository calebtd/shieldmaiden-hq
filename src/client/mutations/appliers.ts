import type { MutationArgs, MutationName } from "@shared/mutations";
import { definedOnly } from "@shared/objects";
import type { LocalDb } from "../db/local";

/**
 * Applies a change to the device's copy right away, before the server has seen it.
 * Appliers must be safe to run more than once with the same args: after each pull the
 * still-queued changes are re-applied on top of the server's data.
 */
type Applier<N extends MutationName> = (
  db: LocalDb,
  args: MutationArgs<N>,
  now: number,
) => Promise<void>;
type Appliers = { [N in MutationName]: Applier<N> };

export const appliers: Appliers = {
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
};
