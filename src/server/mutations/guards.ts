import { eq } from "drizzle-orm";
import { DomainError, type Db } from "../context";
import { events, staff } from "../db/schema";

/** Checks used by more than one mutation. */

export async function requireStaff(db: Db, staffId: string) {
  const row = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  if (!row) throw new DomainError("That staff member doesn't exist.", 404);
  return row;
}

/** The event, as long as it can still be changed. A locked event's setup is final. */
export async function requireEditableEvent(db: Db, eventId: string) {
  const row = await db.select().from(events).where(eq(events.id, eventId)).get();
  if (!row) throw new DomainError("That event doesn't exist.", 404);
  if (row.status === "locked") {
    throw new DomainError(`${row.name} is locked, so its setup can't change.`, 409);
  }
  return row;
}
