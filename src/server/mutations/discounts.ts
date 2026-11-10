import { eq } from "drizzle-orm";
import { ruleColumns } from "@shared/entities/discount";
import { definedOnly } from "@shared/objects";
import { DomainError } from "../context";
import { discountTypes } from "../db/schema";
import { nextVersion } from "../sync/version";
import type { MutationHandler } from "./types";

/**
 * Discount types can be edited freely: each ticket keeps a copy of the amount it got,
 * so changing a type later never changes past tickets.
 */
export const createDiscount: MutationHandler<"discount.create"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(eq(discountTypes.id, args.id))
    .get();
  if (existing) throw new DomainError("That discount already exists.", 409);
  return [
    db.insert(discountTypes).values({
      id: args.id,
      name: args.name,
      ...ruleColumns(args.rule),
      reducesCommission: args.reducesCommission,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
  ];
};

export const updateDiscount: MutationHandler<"discount.update"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(eq(discountTypes.id, args.id))
    .get();
  if (!existing) throw new DomainError("That discount doesn't exist.", 404);
  const { id, rule, ...rest } = args;
  return [
    db
      .update(discountTypes)
      .set({
        ...definedOnly(rest),
        ...(rule ? ruleColumns(rule) : {}),
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(discountTypes.id, id)),
  ];
};
