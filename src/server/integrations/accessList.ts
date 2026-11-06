import { eq } from "drizzle-orm";
import { z } from "zod";
import { accessListStatusSchema, type AccessListStatus } from "@shared/accessList";
import type { AccessListConfig, Config } from "../config";
import type { Db } from "../context";
import { serverMeta, staff } from "../db/schema";

/**
 * Keeps one Cloudflare Access policy's email list equal to: every active staff member's
 * email, plus the owner emails from config (so owners can never be locked out).
 *
 * Safety: it only ever writes the single policy ID from config, never saves an empty list,
 * and records every attempt so the Staff screen can show whether the list is current.
 */

const STATUS_KEY = "access_list_status";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function desiredEmails(staffEmails: (string | null)[], ownerEmails: string[]): string[] {
  const all = [...staffEmails, ...ownerEmails]
    .filter((e): e is string => Boolean(e))
    .map((e) => e.trim().toLowerCase());
  return [...new Set(all)].sort();
}

const policySchema = z.object({
  name: z.string(),
  decision: z.string(),
  include: z.array(z.record(z.string(), z.unknown())),
});

function currentEmails(include: z.infer<typeof policySchema>["include"]): string[] | null {
  const emails: string[] = [];
  for (const rule of include) {
    const email = (rule.email as { email?: unknown } | undefined)?.email;
    // Anything other than plain email rules was set up by hand: don't overwrite it.
    if (typeof email !== "string" || Object.keys(rule).length !== 1) return null;
    emails.push(email.toLowerCase());
  }
  return emails.sort();
}

async function cf(
  cfg: AccessListConfig,
  fetchFn: Fetch,
  method: "GET" | "PUT",
  body?: unknown,
): Promise<unknown> {
  const res = await fetchFn(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/access/policies/${cfg.policyId}`,
    {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: unknown;
    errors?: { message?: string }[];
  };
  if (!res.ok || !json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare ${method} policy failed: ${msg}`);
  }
  return json.result;
}

export async function syncAccessList(
  db: Db,
  config: Config,
  fetchFn: Fetch = (input, init) => fetch(input, init),
  now: () => number = Date.now,
): Promise<AccessListStatus | null> {
  const cfg = config.accessList;
  if (!cfg) return null;

  let status: AccessListStatus;
  try {
    const rows = await db.select({ email: staff.email }).from(staff).where(eq(staff.active, true));
    const wanted = desiredEmails(
      rows.map((r) => r.email),
      config.ownerEmails,
    );
    if (wanted.length === 0) throw new Error("Refusing to save an empty sign-in list.");

    const policy = policySchema.parse(await cf(cfg, fetchFn, "GET"));
    if (policy.decision !== "allow") throw new Error("That policy isn't an allow policy.");
    const existing = currentEmails(policy.include);
    if (existing === null) {
      throw new Error("That policy has rules besides plain emails; edit it by hand instead.");
    }

    const changed = existing.join(",") !== wanted.join(",");
    if (changed) {
      await cf(cfg, fetchFn, "PUT", {
        name: policy.name,
        decision: "allow",
        include: wanted.map((email) => ({ email: { email } })),
      });
    }
    status = { at: now(), ok: true, emails: wanted.length, changed, error: null };
  } catch (err) {
    console.error("access list sync failed", err);
    status = {
      at: now(),
      ok: false,
      emails: 0,
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  await db
    .insert(serverMeta)
    .values({ key: STATUS_KEY, value: JSON.stringify(status) })
    .onConflictDoUpdate({ target: serverMeta.key, set: { value: JSON.stringify(status) } });
  return status;
}

export async function readAccessListStatus(db: Db): Promise<AccessListStatus | null> {
  const row = await db.select().from(serverMeta).where(eq(serverMeta.key, STATUS_KEY)).get();
  if (!row) return null;
  const parsed = accessListStatusSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : null;
}
