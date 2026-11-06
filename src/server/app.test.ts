import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { newId } from "@shared/ids";
import { createDb } from "./context";
import { resetDemoData } from "./demo";
import { TestClient } from "./test/client";

describe("health", () => {
  it("responds without signing in", async () => {
    const res = await new TestClient().request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, env: "local" });
  });
});

describe("sign-in (local/demo mode)", () => {
  it("requires picking a persona", async () => {
    const res = await new TestClient().request("/api/session");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "pick_persona" });
  });

  it("returns the session for the chosen persona", async () => {
    const client = new TestClient();
    const owner = await client.signInAs("owner");
    expect(await client.json("/api/session")).toMatchObject({
      staffId: owner.id,
      role: "owner",
      authMode: "local",
    });
  });
});

describe("sync", () => {
  const owner = new TestClient();
  const braider = new TestClient();
  beforeAll(async () => {
    await owner.signInAs("owner");
    await braider.signInAs("braider");
  });

  it("applies a change once, even if the device retries it", async () => {
    const mutationId = newId();
    const args = {
      id: newId(),
      name: "Brynja",
      role: "braider" as const,
      email: "brynja@example.com",
      phone: "(555) 123-4567",
    };
    expect((await owner.mutate("staff.create", args, mutationId)).results).toEqual([
      { id: mutationId, status: "applied" },
    ]);
    expect((await owner.mutate("staff.create", args, mutationId)).results).toEqual([
      { id: mutationId, status: "duplicate" },
    ]);

    const { changes } = await owner.pull();
    const created = changes.staff.filter((s) => s.id === args.id);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "Brynja", phone: "5551234567", active: true });
  });

  it("only sends changes after the cursor", async () => {
    const { cursor } = await owner.pull();
    expect((await owner.pull(cursor)).changes.staff).toEqual([]);

    const id = newId();
    await owner.mutate("staff.create", {
      id,
      name: "Thora",
      role: "braider",
      email: "",
      phone: "",
    });
    const next = await owner.pull(cursor);
    expect(next.changes.staff.map((s) => s.id)).toEqual([id]);
    expect(next.cursor).toBeGreaterThan(cursor);
  });

  it("hides staff contact details from non-owners", async () => {
    const id = newId();
    await owner.mutate("staff.create", {
      id,
      name: "Hilde",
      role: "braider",
      email: "hilde@example.com",
      phone: "5550001111",
    });
    const seen = (await braider.pull()).changes.staff.find((s) => s.id === id);
    expect(seen).toMatchObject({ name: "Hilde", email: null, phone: null });
  });

  it("rejects changes the person isn't allowed to make", async () => {
    const { results } = await braider.mutate("staff.create", {
      id: newId(),
      name: "Sneaky",
      role: "owner",
      email: "",
      phone: "",
    });
    expect(results[0]?.status).toBe("rejected");
    expect(results[0]).toHaveProperty("error", "You don't have permission to make that change.");
  });

  it("rejects invalid input with a readable reason", async () => {
    const { results } = await owner.mutate("staff.create", {
      id: newId(),
      name: "Bad Phone",
      role: "braider",
      email: "",
      phone: "123",
    });
    expect(results[0]).toMatchObject({
      status: "rejected",
      error: "Enter a 10-digit phone number",
    });
  });

  it("rejects a duplicate email", async () => {
    const make = (name: string) =>
      owner.mutate("staff.create", {
        id: newId(),
        name,
        role: "braider",
        email: "same@example.com",
        phone: "",
      });
    expect((await make("First")).results[0]?.status).toBe("applied");
    expect((await make("Second")).results[0]).toMatchObject({ status: "rejected" });
  });

  it("doesn't let anyone turn off their own account or change their own role", async () => {
    const { staffId } = await owner.json<{ staffId: string }>("/api/session");
    const off = await owner.mutate("staff.update", { id: staffId, active: false });
    expect(off.results[0]).toHaveProperty("error", "You can't turn off your own account.");
    const demote = await owner.mutate("staff.update", { id: staffId, role: "braider" });
    expect(demote.results[0]).toHaveProperty("error", "You can't change your own role.");
  });

  it("lets an owner rename someone and change their contact details", async () => {
    const id = newId();
    await owner.mutate("staff.create", {
      id,
      name: "Becca",
      role: "braider",
      email: "",
      phone: "",
    });
    const { results } = await owner.mutate("staff.update", {
      id,
      name: "Becca R.",
      email: "becca@example.com",
      phone: "555 222 3333",
    });
    expect(results[0]?.status).toBe("applied");
    const row = (await owner.pull()).changes.staff.find((s) => s.id === id);
    expect(row).toMatchObject({
      name: "Becca R.",
      email: "becca@example.com",
      phone: "5552223333",
    });
  });

  it("lets an owner turn off another owner", async () => {
    const id = newId();
    await owner.mutate("staff.create", {
      id,
      name: "Co-owner",
      role: "owner",
      email: "",
      phone: "",
    });
    const { results } = await owner.mutate("staff.update", { id, active: false });
    expect(results[0]?.status).toBe("applied");
  });

  it("rejects changes from a newer or older app version it doesn't know", async () => {
    const res = await owner.json<{ results: unknown[] }>("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({
        mutations: [{ id: newId(), name: "nope.nothing", args: {}, createdAt: Date.now() }],
      }),
    });
    expect(res.results).toEqual([expect.objectContaining({ status: "rejected" })]);
  });
});

describe("demo reset", () => {
  it("changes the epoch and reseeds", async () => {
    const client = new TestClient();
    await client.signInAs("owner");
    const before = await client.pull();
    await resetDemoData(createDb(env.DB));

    const after = new TestClient();
    await after.signInAs("owner");
    const pulled = await after.pull();
    expect(pulled.epoch).not.toBe(before.epoch);
    expect(pulled.changes.staff.length).toBe(5);
  });
});
