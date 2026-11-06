import { eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import { syncCounter } from "../db/schema";

/**
 * Use as the `version` value of any row written inside a sync batch. Because the batch
 * starts with `bumpVersion`, every row it touches gets the same new version.
 */
export const nextVersion = sql<number>`(select value from sync_counter where id = 1)`;

export function bumpVersion(db: Db) {
  return db
    .update(syncCounter)
    .set({ value: sql`${syncCounter.value} + 1` })
    .where(eq(syncCounter.id, 1));
}
