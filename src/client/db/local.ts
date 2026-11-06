import Dexie, { type EntityTable } from "dexie";
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
  key: "cursor" | "epoch" | "session";
  value: unknown;
}

/**
 * The device's copy of the data. The UI only ever reads from here, so it works the
 * same with or without signal. Add each new synced table to `SYNCED_TABLES` too.
 */
export class LocalDb extends Dexie {
  staff!: EntityTable<Staff, "id">;
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
  }
}

export const SYNCED_TABLES = ["staff"] as const satisfies readonly SyncedTable[];
