import { dollarsToCents } from "@domain/money";
import { newId } from "@shared/ids";
import type { LocalDb } from "../../db/local";
import type { SyncEngine } from "../../sync/engine";
import { STARTER_MENU, STARTER_SKILLS, STARTER_STAFF_SKILLS } from "./starterMenu";

const key = (s: string) => s.trim().toLowerCase();

/** Creates any starter skills not there yet; returns name → ID for all of them. */
async function ensureSkills(db: LocalDb, engine: SyncEngine): Promise<Map<string, string>> {
  const byName = new Map((await db.skills.toArray()).map((s) => [key(s.name), s.id]));
  for (const name of STARTER_SKILLS) {
    if (byName.has(key(name))) continue;
    const id = newId();
    await engine.mutate("skill.create", { id, name });
    byName.set(key(name), id);
  }
  return byName;
}

/** Adds the starter menu, skipping anything already on it. Returns how many were added. */
export async function loadStarterMenu(db: LocalDb, engine: SyncEngine): Promise<number> {
  const skillIds = await ensureSkills(db, engine);
  const existing = new Set((await db.menuItems.toArray()).map((i) => `${i.kind}:${key(i.name)}`));
  let added = 0;
  for (const item of STARTER_MENU) {
    if (existing.has(`${item.kind}:${key(item.name)}`)) continue;
    const id = newId();
    await engine.mutate("menu.create", {
      id,
      kind: item.kind,
      name: item.name,
      priceCents: item.price === null ? 0 : dollarsToCents(item.price),
      openPrice: item.price === null,
      minutes: item.minutes ?? null,
      description: item.description ?? null,
      skillIds: (item.skills ?? []).flatMap((s) => skillIds.get(key(s)) ?? []),
    });
    if (item.off) await engine.mutate("menu.update", { id, active: false });
    added++;
  }
  return added;
}

export interface SkillsLoadResult {
  /** Names on the sheet with no matching active staff member (by first name). */
  notFound: string[];
  matched: number;
}

/**
 * Applies the skills sheet to staff whose first name matches. Only adds skills; never
 * removes one someone already has. Safe to run again after adding missing people.
 */
export async function loadStarterSkills(
  db: LocalDb,
  engine: SyncEngine,
): Promise<SkillsLoadResult> {
  const skillIds = await ensureSkills(db, engine);
  const staff = (await db.staff.toArray()).filter((s) => s.active);
  const notFound: string[] = [];
  let matched = 0;
  for (const [firstName, skills] of Object.entries(STARTER_STAFF_SKILLS)) {
    const person = staff.find((s) => key(s.name.split(" ")[0] ?? "") === key(firstName));
    if (!person) {
      notFound.push(firstName);
      continue;
    }
    matched++;
    for (const name of skills) {
      const skillId = skillIds.get(key(name));
      if (!skillId) continue;
      const current = await db.staffSkills.get([person.id, skillId]);
      if (current?.has) continue;
      await engine.mutate("staff.setSkill", { staffId: person.id, skillId, has: true });
    }
  }
  return { notFound, matched };
}
