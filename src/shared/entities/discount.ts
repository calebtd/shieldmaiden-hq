import { z } from "zod";
import type { DiscountRule } from "@domain/discounts";
import type { Bps, Cents } from "@domain/money";
import { idSchema } from "../ids";
import { centsSchema } from "./money";

export const discountNameSchema = z.string().trim().min(1, "Add a name").max(60);

/** What a discount takes off: a percent (more than 0, up to 100%) or a dollar amount. */
export const discountRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("percent"),
    percentBps: z
      .number()
      .int()
      .min(1, "Enter a percent more than 0")
      .max(10_000, "A discount can't be more than 100%"),
  }),
  z.object({
    kind: z.literal("amount"),
    amountCents: centsSchema.min(1, "Enter an amount more than $0"),
  }),
]);
export type DiscountRuleInput = z.infer<typeof discountRuleSchema>;

export const discountTypeSchema = z.object({
  id: idSchema,
  name: discountNameSchema,
  kind: z.enum(["percent", "amount"]),
  /** Set when kind is "percent". */
  percentBps: z.number().int().nullable(),
  /** Set when kind is "amount". */
  amountCents: z.number().int().nullable(),
  /** Off by default: commission is paid on the list price unless this is on. */
  reducesCommission: z.boolean(),
  active: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  version: z.number().int(),
});
export type DiscountType = z.infer<typeof discountTypeSchema>;

/** The stored columns for a rule (the other kind's column is null). */
export function ruleColumns(rule: DiscountRuleInput) {
  return rule.kind === "percent"
    ? { kind: rule.kind, percentBps: rule.percentBps, amountCents: null }
    : { kind: rule.kind, percentBps: null, amountCents: rule.amountCents };
}

/** A stored discount type as the rule the domain math uses. */
export function toDiscountRule(d: DiscountType): DiscountRule {
  return d.kind === "percent"
    ? { kind: "percent", percent: (d.percentBps ?? 0) as Bps }
    : { kind: "amount", amount: (d.amountCents ?? 0) as Cents };
}
