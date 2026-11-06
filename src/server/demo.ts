import { count, eq } from "drizzle-orm";
import { newId } from "@shared/ids";
import type { Role } from "@shared/roles";
import type { Db } from "./context";
import { auditLog, mutationsApplied, serverMeta, staff } from "./db/schema";
import { bumpVersion, nextVersion } from "./sync/version";

/** Fictional staff for demo.shieldmaiden.hair and local development. */
const DEMO_STAFF: { name: string; role: Role; email: string }[] = [
  { name: "Astrid", role: "owner", email: "owner@demo.test" },
  { name: "Freya", role: "checkout", email: "checkout@demo.test" },
  { name: "Sigrun", role: "braider", email: "sigrun@demo.test" },
  { name: "Ingrid", role: "braider", email: "ingrid@demo.test" },
  { name: "Liv", role: "braider", email: "liv@demo.test" },
];

export async function seedDemoDataIfEmpty(db: Db): Promise<void> {
  const [row] = await db.select({ n: count() }).from(staff);
  if ((row?.n ?? 0) > 0) return;
  const now = Date.now();
  await db.batch([
    bumpVersion(db),
    ...DEMO_STAFF.map((s) =>
      db.insert(staff).values({
        id: newId(now),
        ...s,
        active: true,
        phone: null,
        createdAt: now,
        updatedAt: now,
        version: nextVersion,
      }),
    ),
  ]);
}

/**
 * Wipes all data and reseeds. Changing the epoch tells every device to discard its
 * local copy on next sync. Only ever runs on the demo environment.
 */
export async function resetDemoData(db: Db): Promise<void> {
  const epoch = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  await db.batch([
    db.delete(staff),
    db.delete(mutationsApplied),
    db.delete(auditLog),
    db.update(serverMeta).set({ value: epoch }).where(eq(serverMeta.key, "epoch")),
  ]);
  await seedDemoDataIfEmpty(db);
}
