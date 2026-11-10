import { definedOnly } from "@shared/objects";
import type { Applier } from "./appliers";

type MenuMutation = "menu.create" | "menu.update" | "skill.create" | "skill.update";
type MenuAppliers = { [N in MenuMutation | "staff.setSkill" | "event.setMenuItem"]: Applier<N> };

/** Device-side copies of the menu and skills mutations (see appliers.ts). */
export const menuAppliers: MenuAppliers = {
  "menu.create": async (db, args, now) => {
    const existing = await db.menuItems.get(args.id);
    await db.menuItems.put({
      ...args,
      skillIds: args.kind === "braid" ? args.skillIds : [],
      minutes: args.kind === "retail" ? null : args.minutes,
      active: existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "menu.update": async (db, { id, ...changes }, now) => {
    const existing = await db.menuItems.get(id);
    if (!existing) return;
    const next = { ...existing, ...definedOnly(changes), updatedAt: now };
    await db.menuItems.put(next.openPrice ? { ...next, priceCents: 0 } : next);
  },

  "skill.create": async (db, args, now) => {
    const existing = await db.skills.get(args.id);
    await db.skills.put({
      ...args,
      active: existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "skill.update": async (db, { id, ...changes }, now) => {
    const existing = await db.skills.get(id);
    if (!existing) return;
    await db.skills.put({ ...existing, ...definedOnly(changes), updatedAt: now });
  },

  "staff.setSkill": async (db, { staffId, skillId, has }, now) => {
    const existing = await db.staffSkills.get([staffId, skillId]);
    await db.staffSkills.put({
      staffId,
      skillId,
      has,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },

  "event.setMenuItem": async (db, { eventId, menuItemId, priceCents, offered }, now) => {
    const existing = await db.eventMenu.get([eventId, menuItemId]);
    await db.eventMenu.put({
      eventId,
      menuItemId,
      priceCents,
      offered,
      updatedAt: now,
      version: existing?.version ?? 0,
    });
  },
};
