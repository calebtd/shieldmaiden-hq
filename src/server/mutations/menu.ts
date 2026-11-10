import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { MENU_KIND_LABELS, type MenuKind } from "@shared/entities/menu";
import { definedOnly } from "@shared/objects";
import { DomainError, type Db } from "../context";
import { menuItems, skills } from "../db/schema";
import { nextVersion } from "../sync/version";
import type { MutationHandler } from "./types";

/**
 * Menu items can be edited freely: tickets keep a copy of the name and price they
 * were sold at, so changing the menu never changes past sales.
 */

async function assertNameFree(db: Db, kind: MenuKind, name: string, exceptId?: string) {
  const sameName = and(eq(menuItems.kind, kind), sql`lower(${menuItems.name}) = lower(${name})`);
  const clash = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(exceptId ? and(sameName, ne(menuItems.id, exceptId)) : sameName)
    .get();
  if (clash) {
    throw new DomainError(`${MENU_KIND_LABELS[kind]} already has "${name}".`, 409);
  }
}

async function assertSkillsExist(db: Db, ids: readonly string[]) {
  if (ids.length === 0) return;
  const found = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids));
  if (found.length !== new Set(ids).size) throw new DomainError("That skill doesn't exist.", 404);
}

export const createMenuItem: MutationHandler<"menu.create"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.id, args.id))
    .get();
  if (existing) throw new DomainError("That item already exists.", 409);
  await assertNameFree(db, args.kind, args.name);
  // Only braids need skills; retail never takes time.
  const skillIds = args.kind === "braid" ? args.skillIds : [];
  await assertSkillsExist(db, skillIds);
  return [
    db.insert(menuItems).values({
      ...args,
      skillIds,
      minutes: args.kind === "retail" ? null : args.minutes,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
  ];
};

export const updateMenuItem: MutationHandler<"menu.update"> = async ({ db, args, now }) => {
  const current = await db.select().from(menuItems).where(eq(menuItems.id, args.id)).get();
  if (!current) throw new DomainError("That item doesn't exist.", 404);
  if (args.name !== undefined) await assertNameFree(db, current.kind, args.name, args.id);
  if (args.skillIds !== undefined) {
    if (current.kind !== "braid" && args.skillIds.length > 0) {
      throw new DomainError("Only braids can need skills.");
    }
    await assertSkillsExist(db, args.skillIds);
  }
  const { id, ...changes } = args;
  const openPrice = changes.openPrice ?? current.openPrice;
  return [
    db
      .update(menuItems)
      .set({
        ...definedOnly(changes),
        ...(openPrice ? { priceCents: 0 } : {}),
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(menuItems.id, id)),
  ];
};
