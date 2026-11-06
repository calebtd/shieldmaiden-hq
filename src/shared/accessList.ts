import { z } from "zod";

/** The latest attempt to mirror the staff list into Cloudflare's sign-in list. */
export const accessListStatusSchema = z.object({
  at: z.number(),
  ok: z.boolean(),
  emails: z.number(),
  changed: z.boolean(),
  error: z.string().nullable(),
});
export type AccessListStatus = z.infer<typeof accessListStatusSchema>;

export const accessListResponseSchema = z.object({
  /** False when this site doesn't manage a sign-in list (demo, local, or not set up yet). */
  managed: z.boolean(),
  status: accessListStatusSchema.nullable(),
});
export type AccessListResponse = z.infer<typeof accessListResponseSchema>;
