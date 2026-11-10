import { z } from "zod";
import { discountTypeSchema } from "./entities/discount";
import { eventSchema, eventStaffSchema } from "./entities/event";
import { eventMenuSchema, menuItemSchema, skillSchema, staffSkillSchema } from "./entities/menu";
import { payProfileSchema } from "./entities/pay";
import { staffSchema } from "./entities/staff";
import { idSchema } from "./ids";
import { roleSchema } from "./roles";

/** One queued change, as sent from a device to the server. */
export const mutationEnvelopeSchema = z.object({
  /** Unique per mutation; lets the server ignore retries it has already applied. */
  id: idSchema,
  name: z.string(),
  args: z.unknown(),
  /** When the change was made on the device (may be long before it syncs). */
  createdAt: z.number().int(),
});
export type MutationEnvelope = z.infer<typeof mutationEnvelopeSchema>;

export const pushRequestSchema = z.object({
  mutations: z.array(mutationEnvelopeSchema).max(100),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const mutationResultSchema = z.discriminatedUnion("status", [
  z.object({ id: z.string(), status: z.literal("applied") }),
  z.object({ id: z.string(), status: z.literal("duplicate") }),
  z.object({ id: z.string(), status: z.literal("rejected"), error: z.string() }),
]);
export type MutationResult = z.infer<typeof mutationResultSchema>;

/**
 * Results are in the same order as the request. If the server hit an unexpected problem
 * it stops early: mutations without a result stay queued on the device and are retried.
 */
export const pushResponseSchema = z.object({
  results: z.array(mutationResultSchema),
  error: z.string().optional(),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

/** Who the server says is signed in, as of this sync. */
export const meSchema = z.object({ staffId: idSchema, name: z.string(), role: roleSchema });
export type Me = z.infer<typeof meSchema>;

/** Everything that changed after `cursor`. Add each new synced table here. */
export const pullResponseSchema = z.object({
  /**
   * Re-confirmed on every sync, so a rename or role change shows up right away, and a
   * device whose login now belongs to someone else notices and starts over.
   */
  me: meSchema,
  /** Changes when the server's data is wiped; the device must then start over. */
  epoch: z.string(),
  cursor: z.number().int(),
  changes: z.object({
    staff: z.array(staffSchema),
    payProfiles: z.array(payProfileSchema),
    events: z.array(eventSchema),
    eventStaff: z.array(eventStaffSchema),
    discountTypes: z.array(discountTypeSchema),
    menuItems: z.array(menuItemSchema),
    skills: z.array(skillSchema),
    staffSkills: z.array(staffSkillSchema),
    eventMenu: z.array(eventMenuSchema),
  }),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
export type SyncedTable = keyof PullResponse["changes"];

export const sessionSchema = z.object({
  staffId: idSchema,
  name: z.string(),
  role: roleSchema,
  appEnv: z.enum(["local", "dev", "demo", "production"]),
  /** "demo" and "local" let the person pick who to sign in as. */
  authMode: z.enum(["access", "demo", "local"]),
});
export type Session = z.infer<typeof sessionSchema>;

export const personaSchema = z.object({ id: idSchema, name: z.string(), role: roleSchema });
export type Persona = z.infer<typeof personaSchema>;
