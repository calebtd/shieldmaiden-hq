import { z } from "zod";
import { reasonSchema, timeKindSchema, timestampSchema } from "./entities/time";
import { idSchema } from "./ids";
import { define } from "./mutationDef";
import type { Role } from "./roles";

const EVERYONE: readonly Role[] = ["owner", "checkout", "braider"];

/**
 * Timeclock changes. Anyone can record their own time; the owner can record anyone's.
 * `at` is when the button was tapped on the device, so time taken with no signal is
 * still exact once it syncs.
 */
export const timeMutations = {
  "time.clockIn": define({
    roles: EVERYONE,
    args: z.object({
      id: idSchema,
      eventId: idSchema,
      /** Whose clock. Only the owner can clock in someone else. */
      staffId: idSchema,
      at: timestampSchema,
    }),
  }),
  /** Ends the shift, and any break that's still running. */
  "time.clockOut": define({
    roles: EVERYONE,
    args: z.object({ entryId: idSchema, at: timestampSchema }),
  }),
  "time.startBreak": define({
    roles: EVERYONE,
    args: z.object({ id: idSchema, eventId: idSchema, staffId: idSchema, at: timestampSchema }),
  }),
  "time.endBreak": define({
    roles: EVERYONE,
    args: z.object({ entryId: idSchema, at: timestampSchema }),
  }),
  /** Adds a shift or break after the fact (forgot to clock in). */
  "time.add": define({
    roles: EVERYONE,
    args: z.object({
      id: idSchema,
      eventId: idSchema,
      staffId: idSchema,
      kind: timeKindSchema,
      startAt: timestampSchema,
      endAt: timestampSchema,
      reason: reasonSchema,
    }),
  }),
  /** Replaces an entry's times: the old one is kept (voided) and a new one added. */
  "time.correct": define({
    roles: EVERYONE,
    args: z.object({
      id: idSchema,
      replacesId: idSchema,
      startAt: timestampSchema,
      /** Null keeps a running shift running (fixing only the start). */
      endAt: timestampSchema.nullable(),
      reason: reasonSchema,
    }),
  }),
  /** Removes an entry made by mistake. It stays in the history, crossed out. */
  "time.void": define({
    roles: EVERYONE,
    args: z.object({ entryId: idSchema, reason: reasonSchema }),
  }),
};
