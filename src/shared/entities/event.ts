import { z } from "zod";
import { MAX_TAX_RATE } from "@domain/tax";
import { idSchema } from "../ids";
import { hourlyCentsSchema, percentBpsSchema } from "./money";

export const EVENT_STATUSES = ["planning", "live", "closing", "locked"] as const;
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  planning: "Coming up",
  live: "Live",
  closing: "Closing out",
  locked: "Locked",
};

function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** A calendar date, "2027-05-14". Events happen in one place, so no time zones. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine(isRealDate, "Pick a date");

export const eventNameSchema = z.string().trim().min(1, "Add a name").max(100);
export const eventCitySchema = z.string().trim().min(1, "Add the city").max(80);
export const taxRateBpsSchema = z
  .number()
  .int()
  .min(0, "Sales tax can't be negative")
  .max(MAX_TAX_RATE, `Sales tax must be ${MAX_TAX_RATE / 100}% or less`);

/** Longest event the app accepts, to catch a mistyped year. */
export const MAX_EVENT_DAYS = 31;

/** Number of calendar days from start to end, counting both. */
export function eventDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
}

export const eventSchema = z.object({
  id: idSchema,
  name: eventNameSchema,
  city: eventCitySchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  taxRateBps: taxRateBpsSchema,
  status: eventStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
/** Named ShowEvent so it never gets confused with DOM events. */
export type ShowEvent = z.infer<typeof eventSchema>;

/**
 * One person at one event: whether they're working it, and any pay that differs from
 * their usual (training day, family who keep only tips). Null means "usual rate".
 * Rows are never deleted; taking someone off the event sets `working` to false.
 */
export const eventStaffSchema = z.object({
  eventId: idSchema,
  staffId: idSchema,
  working: z.boolean(),
  hourlyCents: hourlyCentsSchema.nullable(),
  commissionBps: percentBpsSchema.nullable(),
  tipShareBps: percentBpsSchema.nullable(),
  note: z.string().nullable(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type EventStaff = z.infer<typeof eventStaffSchema>;
