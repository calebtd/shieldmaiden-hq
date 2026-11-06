import { eq, gt } from "drizzle-orm";
import type { PullResponse } from "@shared/sync";
import type { AuthedUser, Db } from "../context";
import { serverMeta, staff, syncCounter } from "../db/schema";

/**
 * Everything changed after `cursor` that this person is allowed to see.
 * All reads run in one batch, so the cursor and the rows are consistent.
 */
export async function pull(db: Db, user: AuthedUser, cursor: number): Promise<PullResponse> {
  const [counterRows, epochRows, staffRows] = await db.batch([
    db.select().from(syncCounter).where(eq(syncCounter.id, 1)),
    db.select().from(serverMeta).where(eq(serverMeta.key, "epoch")),
    db.select().from(staff).where(gt(staff.version, cursor)),
  ]);
  const counter = counterRows[0]?.value;
  const epoch = epochRows[0]?.value;
  if (counter === undefined || epoch === undefined) {
    throw new Error("Database is missing sync rows; run migrations.");
  }

  const isOwner = user.role === "owner";
  return {
    epoch,
    cursor: counter,
    changes: {
      // Only owners see staff contact details.
      staff: staffRows.map((s) => (isOwner ? s : { ...s, email: null, phone: null })),
    },
  };
}
