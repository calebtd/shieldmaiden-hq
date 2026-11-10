import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { newId } from "@shared/ids";
import type { Config } from "../config";
import { createDb } from "../context";
import { staff } from "../db/schema";
import { desiredEmails, readAccessListStatus, syncAccessList } from "./accessList";

const db = createDb(env.DB);
const config: Config = {
  appEnv: "dev",
  authMode: "access",
  ownerEmails: ["owner@shop.test"],
  access: { teamDomain: "team.cloudflareaccess.com", audience: "aud" },
  accessList: { accountId: "acct", policyId: "pol-1", token: "t" },
  backupKeepDays: 14,
};

/** Stands in for Cloudflare's API: one policy, records every write. */
function fakeCloudflare(include: unknown[], decision = "allow") {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let policy = { id: "pol-1", name: "Staff", decision, include };
  const fetchFn = (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body: unknown = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    if (method === "PUT") policy = { ...policy, ...(body as object) };
    return Promise.resolve(Response.json({ success: true, result: policy }));
  };
  return { fetchFn, calls, current: () => policy };
}

async function addStaff(name: string, email: string | null, active = true) {
  await db.insert(staff).values({
    id: newId(),
    name,
    role: "braider",
    active,
    email,
    phone: null,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
  });
}

beforeEach(async () => {
  await db.delete(staff);
});

describe("desiredEmails", () => {
  it("merges staff and owners, lowercased, deduped, sorted", () => {
    expect(desiredEmails(["B@x.com", null, "a@x.com"], ["b@x.com", "o@x.com"])).toEqual([
      "a@x.com",
      "b@x.com",
      "o@x.com",
    ]);
  });
});

describe("syncAccessList", () => {
  it("writes active staff plus owners, and leaves turned-off people out", async () => {
    await addStaff("Becca", "becca@shop.test");
    await addStaff("Gone", "gone@shop.test", false);
    await addStaff("No email", null);
    const cf = fakeCloudflare([{ email: { email: "gone@shop.test" } }]);

    const status = await syncAccessList(db, config, cf.fetchFn);

    expect(status).toMatchObject({ ok: true, changed: true, emails: 2 });
    expect(cf.current().include).toEqual([
      { email: { email: "becca@shop.test" } },
      { email: { email: "owner@shop.test" } },
    ]);
    expect(cf.calls.every((c) => c.url.endsWith("/accounts/acct/access/policies/pol-1"))).toBe(
      true,
    );
  });

  it("doesn't write when nothing changed", async () => {
    await addStaff("Becca", "becca@shop.test");
    const cf = fakeCloudflare([
      { email: { email: "owner@shop.test" } },
      { email: { email: "becca@shop.test" } },
    ]);
    const status = await syncAccessList(db, config, cf.fetchFn);
    expect(status).toMatchObject({ ok: true, changed: false });
    expect(cf.calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("won't overwrite a policy with hand-made rules", async () => {
    const cf = fakeCloudflare([{ everyone: {} }]);
    const status = await syncAccessList(db, config, cf.fetchFn);
    expect(status?.ok).toBe(false);
    expect(status?.error).toContain("by hand");
    expect(cf.calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("refuses to save an empty list", async () => {
    const cf = fakeCloudflare([{ email: { email: "x@shop.test" } }]);
    const status = await syncAccessList(db, { ...config, ownerEmails: [] }, cf.fetchFn);
    expect(status?.ok).toBe(false);
    expect(status?.error).toContain("empty");
    expect(cf.calls).toHaveLength(0);
  });

  it("records failures so owners can see them", async () => {
    const failing = () =>
      Promise.resolve(
        Response.json(
          { success: false, errors: [{ message: "Authentication error" }] },
          { status: 403 },
        ),
      );
    await syncAccessList(db, config, failing);
    const saved = await readAccessListStatus(db);
    expect(saved?.ok).toBe(false);
    expect(saved?.error).toContain("Authentication error");
  });

  it("does nothing on sites that don't manage a list", async () => {
    const cf = fakeCloudflare([]);
    expect(await syncAccessList(db, { ...config, accessList: null }, cf.fetchFn)).toBeNull();
    expect(cf.calls).toHaveLength(0);
  });
});
