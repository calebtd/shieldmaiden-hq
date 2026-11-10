import { and, eq, ne, sql } from "drizzle-orm";
import { definedOnly } from "@shared/objects";
import { DomainError, type Db } from "../context";
import { skills, staffSkills } from "../db/schema";
import { nextVersion } from "../sync/version";
import { requireStaff } from "./guards";
import type { MutationHandler } from "./types";

async function assertNameFree(db: Db, name: string, exceptId?: string) {
  const sameName = sql`lower(${skills.name}) = lower(${name})`;
  const clash = await db
    .select({ id: skills.id })
    .from(skills)
    .where(exceptId ? and(sameName, ne(skills.id, exceptId)) : sameName)
    .get();
  if (clash) throw new DomainError(`There's already a skill called "${name}".`, 409);
}

export const createSkill: MutationHandler<"skill.create"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.id, args.id))
    .get();
  if (existing) throw new DomainError("That skill already exists.", 409);
  await assertNameFree(db, args.name);
  return [
    db.insert(skills).values({
      ...args,
      active: true,
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
  ];
};

export const updateSkill: MutationHandler<"skill.update"> = async ({ db, args, now }) => {
  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.id, args.id))
    .get();
  if (!existing) throw new DomainError("That skill doesn't exist.", 404);
  if (args.name !== undefined) await assertNameFree(db, args.name, args.id);
  const { id, ...changes } = args;
  return [
    db
      .update(skills)
      .set({ ...definedOnly(changes), updatedAt: now, version: nextVersion })
      .where(eq(skills.id, id)),
  ];
};

export const setStaffSkill: MutationHandler<"staff.setSkill"> = async ({ db, args, now }) => {
  await requireStaff(db, args.staffId);
  const skill = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.id, args.skillId))
    .get();
  if (!skill) throw new DomainError("That skill doesn't exist.", 404);
  const changes = { has: args.has, updatedAt: now, version: nextVersion };
  return [
    db
      .insert(staffSkills)
      .values({ staffId: args.staffId, skillId: args.skillId, ...changes })
      .onConflictDoUpdate({ target: [staffSkills.staffId, staffSkills.skillId], set: changes }),
  ];
};
