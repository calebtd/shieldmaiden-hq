import { z } from "zod";
import { idSchema } from "../ids";
import { hourlyCentsSchema, percentBpsSchema } from "./money";

/** Someone's usual pay. One per person; per-event changes live on `EventStaff`. */
export const payProfileSchema = z.object({
  staffId: idSchema,
  hourlyCents: hourlyCentsSchema,
  commissionBps: percentBpsSchema,
  tipShareBps: percentBpsSchema,
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type PayProfile = z.infer<typeof payProfileSchema>;
