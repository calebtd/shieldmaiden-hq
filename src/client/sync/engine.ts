import type { Table } from "dexie";
import { newId } from "@shared/ids";
import { mutations, type MutationInput, type MutationName } from "@shared/mutations";
import { meSchema, type PullResponse } from "@shared/sync";
import { SYNCED_TABLES, type LocalDb, type OutboxItem, type Rejection } from "../db/local";
import { appliers } from "../mutations/appliers";
import { OfflineError, SignedOutError, type SyncTransport } from "./transport";

export type SyncStatus = "idle" | "syncing" | "offline" | "signed-out" | "error";

export interface SyncState {
  status: SyncStatus;
  /** Changes made on this device that the server hasn't confirmed yet. */
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

const PUSH_BATCH = 50;

/**
 * Keeps the device's copy and the server in step.
 *
 *   mutate()  → validate → apply locally + add to outbox (one transaction) → sync soon
 *   sync()    → push outbox in order → pull changes since cursor → re-apply anything
 *               still queued on top, so local edits never flicker away
 *
 * If the server rejects a change, or its data was reset (epoch changed), the device
 * rebuilds its copy from scratch so nothing it shows is out of step with the server.
 */
export class SyncEngine {
  private state: SyncState = { status: "idle", pending: 0, lastSyncedAt: null, error: null };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private readonly db: LocalDb,
    private readonly transport: SyncTransport,
    private readonly now: () => number = Date.now,
  ) {}

  // ---- state for the UI ---------------------------------------------------------------

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private async refreshPending() {
    this.setState({ pending: await this.db.outbox.count() });
  }

  // ---- making changes -----------------------------------------------------------------

  /**
   * Validates and applies a change locally, then queues it for the server.
   * Throws the validation error (a ZodError) if the input is invalid, so forms can show it.
   */
  async mutate<N extends MutationName>(name: N, input: MutationInput<N>): Promise<void> {
    const args = mutations[name].args.parse(input);
    const item: OutboxItem = { id: newId(), name, args: input, createdAt: this.now() };
    await this.db.transaction("rw", [this.db.outbox, ...this.syncedTables()], async () => {
      await this.apply(name, args);
      await this.db.outbox.add(item);
    });
    await this.refreshPending();
    void this.sync();
  }

  /**
   * Forgets everything on this device: data, queued changes, and sync position.
   * Used when a different person signs in, since roles see different data.
   */
  async resetLocal(): Promise<void> {
    await this.running;
    await this.db.transaction(
      "rw",
      [this.db.outbox, this.db.rejections, this.db.meta, ...this.syncedTables()],
      async () => {
        await Promise.all([
          this.db.outbox.clear(),
          this.db.rejections.clear(),
          this.db.meta.clear(),
        ]);
        await Promise.all(this.syncedTables().map((t) => t.clear()));
      },
    );
    this.setState({ pending: 0, lastSyncedAt: null, error: null, status: "idle" });
  }

  // ---- syncing ------------------------------------------------------------------------

  /** Runs a sync; if one is already running, runs once more after it. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.syncOnce();
      } while (this.syncRequestedMeanwhile());
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private syncRequestedMeanwhile(): boolean {
    return this.again;
  }

  private async syncOnce(): Promise<void> {
    this.setState({ status: "syncing" });
    try {
      const { rejected, stoppedEarly } = await this.pushOutbox();
      if (rejected.length > 0) await this.rebuild();
      else await this.pullChanges();
      this.setState({
        status: stoppedEarly ? "error" : "idle",
        error: stoppedEarly ? "Some changes couldn't be saved yet. Retrying." : null,
        lastSyncedAt: this.now(),
      });
    } catch (err) {
      if (err instanceof OfflineError) this.setState({ status: "offline", error: null });
      else if (err instanceof SignedOutError)
        this.setState({ status: "signed-out", error: err.message });
      else
        this.setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
    } finally {
      await this.refreshPending();
    }
  }

  private async pushOutbox(): Promise<{ rejected: Rejection[]; stoppedEarly: boolean }> {
    const rejected: Rejection[] = [];
    for (;;) {
      const batch = await this.db.outbox.orderBy("seq").limit(PUSH_BATCH).toArray();
      if (batch.length === 0) return { rejected, stoppedEarly: false };

      const response = await this.transport.push(
        batch.map(({ id, name, args, createdAt }) => ({ id, name, args, createdAt })),
      );
      const done: string[] = [];
      for (const result of response.results) {
        done.push(result.id);
        if (result.status === "rejected") {
          const item = batch.find((b) => b.id === result.id);
          rejected.push({
            id: result.id,
            name: item?.name ?? "?",
            error: result.error,
            at: this.now(),
          });
        }
      }
      await this.db.transaction("rw", [this.db.outbox, this.db.rejections], async () => {
        await this.db.outbox.where("id").anyOf(done).delete();
        await this.db.rejections.bulkPut(rejected);
      });
      if (response.error || response.results.length < batch.length) {
        return { rejected, stoppedEarly: true };
      }
    }
  }

  private async pullChanges(): Promise<void> {
    const cursor = ((await this.db.meta.get("cursor"))?.value as number | undefined) ?? 0;
    const storedEpoch = (await this.db.meta.get("epoch"))?.value as string | undefined;
    const storedMe = meSchema.safeParse((await this.db.meta.get("me"))?.value);
    const response = await this.transport.pull(cursor);

    if (storedEpoch !== undefined && storedEpoch !== response.epoch) {
      // The server's data was reset. Queued changes refer to data that no longer exists.
      await this.db.outbox.clear();
      await this.rebuild();
      return;
    }
    if (
      storedMe.success &&
      (storedMe.data.staffId !== response.me.staffId || storedMe.data.role !== response.me.role)
    ) {
      // A different person, or a new role: what this device may see has changed.
      await this.rebuild();
      return;
    }
    await this.savePull(response, false);
  }

  /** Throws away the local copy and downloads everything again. */
  private async rebuild(): Promise<void> {
    const response = await this.transport.pull(0);
    await this.savePull(response, true);
  }

  private async savePull(response: PullResponse, replaceAll: boolean): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.meta, this.db.outbox, ...this.syncedTables()],
      async () => {
        if (replaceAll) await Promise.all(this.syncedTables().map((t) => t.clear()));
        for (const table of SYNCED_TABLES) {
          // Each table gets its own rows; TypeScript can't pair them up across the loop.
          const rows: unknown[] = response.changes[table];
          await (this.db[table] as Table<unknown>).bulkPut(rows);
        }
        await this.db.meta.bulkPut([
          { key: "cursor", value: response.cursor },
          { key: "epoch", value: response.epoch },
          { key: "me", value: response.me },
        ]);
        // Re-apply changes still waiting to be sent, so they stay visible.
        const queued = await this.db.outbox.orderBy("seq").toArray();
        for (const item of queued) {
          const parsed = mutations[item.name].args.safeParse(item.args);
          if (parsed.success) await this.apply(item.name, parsed.data);
        }
      },
    );
  }

  private apply(name: MutationName, args: unknown): Promise<void> {
    const applier = appliers[name] as (db: LocalDb, args: unknown, now: number) => Promise<void>;
    return applier(this.db, args, this.now());
  }

  private syncedTables() {
    return SYNCED_TABLES.map((t) => this.db[t]);
  }
}
