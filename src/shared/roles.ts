import { z } from "zod";

export const ROLES = ["owner", "checkout", "braider"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  checkout: "Checkout",
  braider: "Braider",
};
