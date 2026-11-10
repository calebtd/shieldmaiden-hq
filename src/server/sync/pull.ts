import { eq, gt } from "drizzle-orm";
import type { PullResponse } from "@shared/sync";
import type { AuthedUser, Db } from "../context";
import {
  discountTypes,
  events,
  eventStaff,
  payProfiles,
  serverMeta,
  staff,
  syncCounter,
} from "../db/schema";

/**
 * Everything changed after `cursor` that this person is allowed to see.
 * All reads run in one batch, so the cursor and the rows are consistent.
 */
export async function pull(db: Db, user: AuthedUser, cursor: number): Promise<PullResponse> {
  const [counterRows, epochRows, staffRows, payRows, eventRows, eventStaffRows, discountRows] =
    await db.batch([
      db.select().from(syncCounter).where(eq(syncCounter.id, 1)),
      db.select().from(serverMeta).where(eq(serverMeta.key, "epoch")),
      db.select().from(staff).where(gt(staff.version, cursor)),
      db.select().from(payProfiles).where(gt(payProfiles.version, cursor)),
      db.select().from(events).where(gt(events.version, cursor)),
      db.select().from(eventStaff).where(gt(eventStaff.version, cursor)),
      db.select().from(discountTypes).where(gt(discountTypes.version, cursor)),
    ]);
  const counter = counterRows[0]?.value;
  const epoch = epochRows[0]?.value;
  if (counter === undefined || epoch === undefined) {
    throw new Error("Database is missing sync rows; run migrations.");
  }

  const isOwner = user.role === "owner";
  const mine = (staffId: string) => isOwner || staffId === user.staffId;
  return {
    me: { staffId: user.staffId, name: user.name, role: user.role },
    epoch,
    cursor: counter,
    changes: {
      // Only owners see staff contact details.
      staff: staffRows.map((s) => (isOwner ? s : { ...s, email: null, phone: null })),
      // Pay is private: everyone else sees only their own.
      payProfiles: payRows.filter((p) => mine(p.staffId)),
      events: eventRows,
      // Everyone can see who's working; only the person themselves sees their event pay.
      eventStaff: eventStaffRows.map((r) =>
        mine(r.staffId)
          ? r
          : { ...r, hourlyCents: null, commissionBps: null, tipShareBps: null, note: null },
      ),
      discountTypes: discountRows,
    },
  };
}
