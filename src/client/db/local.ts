import Dexie, { type EntityTable } from "dexie";
import type { DiscountType } from "@shared/entities/discount";
import type { EventStaff, ShowEvent } from "@shared/entities/event";
import type { PayProfile } from "@shared/entities/pay";
import type { Staff } from "@shared/entities/staff";
import type { MutationName } from "@shared/mutations";
import type { SyncedTable } from "@shared/sync";

/** A change waiting to be sent to the server. `args` is exactly what the person entered. */
export interface OutboxItem {
  seq?: number;
  id: string;
  name: MutationName;
  args: unknown;
  createdAt: number;
}

/** A change the server refused, kept so the person can see what didn't save and why. */
export interface Rejection {
  id: string;
  name: string;
  error: string;
  at: number;
}

export interface MetaRow {
  /** session: as of sign-in. me: who the server confirmed on the latest sync. */
  key: "cursor" | "epoch" | "session" | "me";
  value: unknown;
}

/**
 * The device's copy of the data. The UI only ever reads from here, so it works the
 * same with or without signal. Add each new synced table to `SYNCED_TABLES` too.
 */
export class LocalDb extends Dexie {
  staff!: EntityTable<Staff, "id">;
  payProfiles!: EntityTable<PayProfile, "staffId">;
  events!: EntityTable<ShowEvent, "id">;
  /** Keyed by [eventId+staffId]. */
  eventStaff!: Dexie.Table<EventStaff, [string, string]>;
  discountTypes!: EntityTable<DiscountType, "id">;
  outbox!: EntityTable<OutboxItem, "seq">;
  rejections!: EntityTable<Rejection, "id">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = "shieldmaiden-hq") {
    super(name);
    this.version(1).stores({
      staff: "id, role, active",
      outbox: "++seq, &id",
      rejections: "id, at",
      meta: "key",
    });
    // New tables: start syncing from the beginning, since an older app version may
    // already have moved its position past rows it didn't know how to store.
    this.version(2)
      .stores({
        payProfiles: "staffId",
        events: "id, startDate",
        eventStaff: "[eventId+staffId], eventId, staffId",
        discountTypes: "id, active",
      })
      .upgrade((tx) => tx.table<MetaRow, string>("meta").delete("cursor"));
  }
}

export const SYNCED_TABLES = [
  "staff",
  "payProfiles",
  "events",
  "eventStaff",
  "discountTypes",
] as const satisfies readonly SyncedTable[];
