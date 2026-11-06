import { beforeEach, describe, expect, it } from "vitest";
import type { Staff } from "@shared/entities/staff";
import { newId } from "@shared/ids";
import { mutations } from "@shared/mutations";
import { definedOnly } from "@shared/objects";
import type { Me, MutationEnvelope, PullResponse, PushResponse } from "@shared/sync";
import { LocalDb } from "../db/local";
import { SyncEngine } from "./engine";
import { OfflineError, type SyncTransport } from "./transport";

/** A tiny stand-in for the real server, enough to exercise the engine. */
class FakeServer implements SyncTransport {
  online = true;
  epoch = "e1";
  version = 0;
  staff = new Map<string, Staff>();
  applied = new Set<string>();
  rejectAll = false;
  pushes = 0;
  me: Me = { staffId: newId(), name: "Astrid", role: "owner" };

  push(envelopes: MutationEnvelope[]): Promise<PushResponse> {
    if (!this.online) return Promise.reject(new OfflineError("offline"));
    this.pushes++;
    return Promise.resolve({
      results: envelopes.map((m) => {
        if (this.applied.has(m.id)) return { id: m.id, status: "duplicate" as const };
        if (this.rejectAll) return { id: m.id, status: "rejected" as const, error: "Nope" };
        this.applied.add(m.id);
        this.version++;
        if (m.name === "staff.create") {
          const a = mutations["staff.create"].args.parse(m.args);
          this.staff.set(a.id, {
            ...a,
            active: true,
            createdAt: 1,
            updatedAt: 1,
            version: this.version,
          });
        }
        if (m.name === "staff.update") {
          const { id, ...rest } = mutations["staff.update"].args.parse(m.args);
          const s = this.staff.get(id);
          if (s) this.staff.set(id, { ...s, ...definedOnly(rest), version: this.version });
        }
        return { id: m.id, status: "applied" as const };
      }),
    });
  }

  pull(cursor: number): Promise<PullResponse> {
    if (!this.online) return Promise.reject(new OfflineError("offline"));
    return Promise.resolve({
      me: this.me,
      epoch: this.epoch,
      cursor: this.version,
      changes: { staff: [...this.staff.values()].filter((s) => s.version > cursor) },
    });
  }
}

let db: LocalDb;
let server: FakeServer;
let engine: SyncEngine;

beforeEach(() => {
  db = new LocalDb(`test-${newId()}`);
  server = new FakeServer();
  engine = new SyncEngine(db, server);
});

const person = (name: string) => ({
  id: newId(),
  name,
  role: "braider" as const,
  email: "",
  phone: "",
});

describe("SyncEngine", () => {
  it("shows a change immediately and keeps it queued while offline", async () => {
    server.online = false;
    const p = person("Sigrun");
    await engine.mutate("staff.create", p);
    await engine.sync();

    expect(await db.staff.get(p.id)).toMatchObject({ name: "Sigrun", version: 0 });
    expect(engine.getState()).toMatchObject({ status: "offline", pending: 1 });
  });

  it("sends queued changes when the connection returns", async () => {
    server.online = false;
    const p = person("Ingrid");
    await engine.mutate("staff.create", p);
    await engine.sync();

    server.online = true;
    await engine.sync();
    expect(engine.getState()).toMatchObject({ status: "idle", pending: 0 });
    expect(server.staff.get(p.id)?.name).toBe("Ingrid");
    expect((await db.staff.get(p.id))?.version).toBe(1);
    expect((await db.meta.get("cursor"))?.value).toBe(1);
  });

  it("validates before queueing anything", async () => {
    await expect(engine.mutate("staff.create", { ...person("X"), phone: "12" })).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it("receives changes made on other devices", async () => {
    const other = new SyncEngine(new LocalDb(`other-${newId()}`), server);
    const p = person("Liv");
    await other.mutate("staff.create", p);
    await other.sync();

    await engine.sync();
    expect((await db.staff.get(p.id))?.name).toBe("Liv");
  });

  it("keeps a queued edit visible when older server data arrives", async () => {
    const p = person("Astrid");
    await engine.mutate("staff.create", p);
    await engine.sync();

    server.online = false;
    await engine.mutate("staff.update", { id: p.id, name: "Astrid R." });
    await engine.sync();

    // Server comes back but our push fails this time; the pull must not undo the edit.
    server.online = true;
    server.push = () => Promise.resolve({ results: [], error: "temporary" });
    await engine.sync();
    expect((await db.staff.get(p.id))?.name).toBe("Astrid R.");
    expect(engine.getState()).toMatchObject({ status: "error", pending: 1 });
  });

  it("rolls back a rejected change and records why", async () => {
    server.rejectAll = true;
    const p = person("Rejected");
    await engine.mutate("staff.create", p);
    await engine.sync();

    expect(await db.staff.get(p.id)).toBeUndefined();
    expect(await db.rejections.toArray()).toEqual([expect.objectContaining({ error: "Nope" })]);
    expect(engine.getState().pending).toBe(0);
  });

  it("starts over when the server's data was reset", async () => {
    const p = person("Old");
    await engine.mutate("staff.create", p);
    await engine.sync();

    server.epoch = "e2";
    server.staff.clear();
    await engine.sync();
    expect(await db.staff.count()).toBe(0);
    expect((await db.meta.get("epoch"))?.value).toBe("e2");
  });

  it("treats a retried change the server already has as done", async () => {
    const p = person("Twice");
    await engine.mutate("staff.create", p);
    const [item] = await db.outbox.toArray();
    if (!item) throw new Error("expected a queued change");
    server.applied.add(item.id);

    await engine.sync();
    expect(engine.getState()).toMatchObject({ status: "idle", pending: 0 });
  });

  it("starts over when the login now belongs to someone else", async () => {
    await engine.mutate("staff.create", person("Seen by the old person"));
    await engine.sync();
    // Another device removes that row; an incremental pull wouldn't notice, a rebuild does.
    server.staff.clear();
    server.version++;
    server.me = { staffId: newId(), name: "iPad", role: "checkout" };

    await engine.sync();
    expect(await db.staff.count()).toBe(0);
    expect((await db.meta.get("me"))?.value).toMatchObject({ name: "iPad", role: "checkout" });
  });

  it("starts over when this person's role changes", async () => {
    await engine.mutate("staff.create", person("Someone"));
    await engine.sync();
    server.staff.clear();
    server.me = { ...server.me, role: "braider" };

    await engine.sync();
    expect(await db.staff.count()).toBe(0);
  });

  it("keeps data when only the name changes", async () => {
    await engine.mutate("staff.create", person("Kept"));
    await engine.sync();
    server.me = { ...server.me, name: "Astrid R." };

    await engine.sync();
    expect(await db.staff.count()).toBe(1);
    expect((await db.meta.get("me"))?.value).toMatchObject({ name: "Astrid R." });
  });
});
