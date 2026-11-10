import { z } from "zod";
import { MAX_MENU_PRICE, MAX_MINUTES } from "@domain/menu";
import { idSchema } from "../ids";
import { centsSchema } from "./money";

export const MENU_KINDS = ["braid", "addon", "retail"] as const;
export const menuKindSchema = z.enum(MENU_KINDS);
export type MenuKind = z.infer<typeof menuKindSchema>;

export const MENU_KIND_LABELS: Record<MenuKind, string> = {
  braid: "Braids",
  addon: "Add-ons & enchantments",
  retail: "Retail",
};

export const menuNameSchema = z.string().trim().min(1, "Add a name").max(80);
export const menuPriceSchema = centsSchema.max(
  MAX_MENU_PRICE,
  `Price must be $${MAX_MENU_PRICE / 100} or less`,
);
export const minutesSchema = z
  .number()
  .int("Whole minutes only")
  .min(0, "Can't be negative")
  .max(MAX_MINUTES, `At most ${MAX_MINUTES} minutes`);
export const descriptionSchema = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .nullable();

/**
 * Something on the menu. Prices are tax-included. `openPrice` items (Braider's Pick,
 * ribbon) have their price decided at checkout; `priceCents` is then 0.
 * `skillIds`: skills a braider needs to do it (empty = anyone).
 */
export const menuItemSchema = z.object({
  id: idSchema,
  kind: menuKindSchema,
  name: menuNameSchema,
  priceCents: z.number().int(),
  openPrice: z.boolean(),
  minutes: z.number().int().nullable(),
  description: z.string().nullable(),
  skillIds: z.array(idSchema),
  active: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const skillNameSchema = z.string().trim().min(1, "Add a name").max(40);

/** A technique or braid someone can be trusted to do (Dutch, Crown, 5 Strand…). */
export const skillSchema = z.object({
  id: idSchema,
  name: skillNameSchema,
  active: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type Skill = z.infer<typeof skillSchema>;

/** Whether one person has one skill. Rows are never deleted; `has` turns off. */
export const staffSkillSchema = z.object({
  staffId: idSchema,
  skillId: idSchema,
  has: z.boolean(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type StaffSkill = z.infer<typeof staffSkillSchema>;

/** One menu item at one event: a different price, or left off that event's menu. */
export const eventMenuSchema = z.object({
  eventId: idSchema,
  menuItemId: idSchema,
  priceCents: z.number().int().nullable(),
  offered: z.boolean(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type EventMenu = z.infer<typeof eventMenuSchema>;
