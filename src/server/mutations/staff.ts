import { and, eq, ne } from "drizzle-orm";
import { definedOnly } from "@shared/objects";
import { DomainError, type Db } from "../context";
import { staff } from "../db/schema";
import { nextVersion } from "../sync/version";
import type { MutationHandler } from "./types";

async function assertEmailFree(db: Db, email: string | null, exceptId?: string) {
  if (!email) return;
  const clash = await db
    .select({ id: staff.id })
    .from(staff)
    .where(exceptId ? and(eq(staff.email, email), ne(staff.id, exceptId)) : eq(staff.email, email))
    .get();
  if (clash) throw new DomainError("Someone on staff already uses that email.", 409);
}

export const createStaff: MutationHandler<"staff.create"> = async ({ db, args, now }) => {
  const existing = await db.select({ id: staff.id }).from(staff).where(eq(staff.id, args.id)).get();
  if (existing) throw new DomainError("That staff member already exists.", 409);
  await assertEmailFree(db, args.email);

  return [
    db.insert(staff).values({
      id: args.id,
      name: args.name,
      role: args.role,
      active: true,
      email: args.email,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
  ];
};

export const updateStaff: MutationHandler<"staff.update"> = async ({ db, user, args, now }) => {
  const current = await db.select().from(staff).where(eq(staff.id, args.id)).get();
  if (!current) throw new DomainError("That staff member doesn't exist.", 404);

  // Nobody can lock themselves out; another owner has to make these changes.
  if (args.id === user.staffId) {
    if (args.active === false) throw new DomainError("You can't turn off your own account.", 409);
    if (args.role !== undefined && args.role !== current.role) {
      throw new DomainError("You can't change your own role.", 409);
    }
  }
  if (args.email !== undefined) await assertEmailFree(db, args.email, args.id);

  const losesOwner =
    current.role === "owner" &&
    current.active &&
    ((args.role !== undefined && args.role !== "owner") || args.active === false);
  if (losesOwner) {
    const otherOwner = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.role, "owner"), eq(staff.active, true), ne(staff.id, args.id)))
      .get();
    if (!otherOwner) throw new DomainError("There must always be at least one active owner.", 409);
  }

  const { id, ...changes } = args;
  return [
    db
      .update(staff)
      .set({ ...definedOnly(changes), updatedAt: now, version: nextVersion })
      .where(eq(staff.id, id)),
  ];
};
