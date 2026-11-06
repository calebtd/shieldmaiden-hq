import { z } from "zod";
import { idSchema } from "../ids";
import { roleSchema } from "../roles";

const phoneDigits = z
  .string()
  .transform((s) => {
    const d = s.replace(/\D/g, "");
    return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  })
  .pipe(z.string().regex(/^\d{10}$/, "Enter a 10-digit phone number"));

export const staffNameSchema = z.string().trim().min(1, "Add a name").max(80);
export const staffEmailSchema = z.email("Enter a valid email").trim().toLowerCase().max(200);
export const staffPhoneSchema = phoneDigits;

/** A staff member as stored on devices. Contact details are only sent to owners. */
export const staffSchema = z.object({
  id: idSchema,
  name: staffNameSchema,
  role: roleSchema,
  active: z.boolean(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type Staff = z.infer<typeof staffSchema>;
