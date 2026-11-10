import { z } from "zod";
import { idSchema } from "../ids";

export const TIME_KINDS = ["work", "break"] as const;
export const timeKindSchema = z.enum(TIME_KINDS);
export type TimeKind = z.infer<typeof timeKindSchema>;

/** Milliseconds since 1970, as recorded on the device when the button was tapped. */
export const timestampSchema = z.number().int().positive();

export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Say briefly why (e.g. forgot to clock out)")
  .max(200, "Keep it under 200 characters");

/**
 * One stretch on the clock (`work`) or on break (`break`) for one person at one event.
 * Append-only: a correction voids the entry and adds a new one that `replaces` it, so
 * the history is always there. The only change made in place is the end time being
 * filled in when someone clocks out or ends a break.
 */
export const timeEntrySchema = z.object({
  id: idSchema,
  eventId: idSchema,
  staffId: idSchema,
  kind: timeKindSchema,
  startAt: z.number().int(),
  endAt: z.number().int().nullable(),
  /** The entry this one corrects, if any. */
  replacesId: idSchema.nullable(),
  /** Why it was added by hand or corrected. Null for normal clock taps. */
  reason: z.string().nullable(),
  createdBy: idSchema,
  voidedAt: z.number().int().nullable(),
  voidedBy: idSchema.nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type TimeEntry = z.infer<typeof timeEntrySchema>;
