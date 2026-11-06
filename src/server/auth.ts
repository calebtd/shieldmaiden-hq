import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { newId } from "@shared/ids";
import type { Config } from "./config";
import { DomainError, type AppEnv, type AuthedUser, type Db } from "./context";
import { auditLog, staff } from "./db/schema";
import { bumpVersion, nextVersion } from "./sync/version";

export const PERSONA_COOKIE = "smhq_persona";

/**
 * Works out who is making the request and puts them on `c.var.user`.
 *
 * - access (dev, production): Cloudflare Access sits in front of the site and signs a
 *   token with the person's email. We verify it and look them up in `staff`.
 * - demo, local: no real accounts. The person picks a staff member to act as, and the
 *   choice is kept in a cookie.
 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const { db, config } = c.var;
  const user =
    config.authMode === "access"
      ? await userFromAccess(db, config, c.req.header("Cf-Access-Jwt-Assertion"))
      : await userFromPersona(db, getCookie(c, PERSONA_COOKIE));
  c.set("user", user);
  await next();
});

async function userFromPersona(db: Db, staffId: string | undefined): Promise<AuthedUser> {
  if (!staffId) throw new DomainError("Pick who to sign in as.", 401, "pick_persona");
  const row = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.active, true)))
    .get();
  if (!row) throw new DomainError("Pick who to sign in as.", 401, "pick_persona");
  return { staffId: row.id, name: row.name, role: row.role };
}

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function userFromAccess(
  db: Db,
  config: Config,
  token: string | undefined,
): Promise<AuthedUser> {
  if (!config.access) {
    throw new Error("Cloudflare Access isn't configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD).");
  }
  if (!token) throw new DomainError("Sign in again.", 401, "signed_out");

  const issuer = `https://${config.access.teamDomain}`;
  let jwks = jwksByTeam.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByTeam.set(issuer, jwks);
  }

  let email: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: config.access.audience });
    if (typeof payload.email !== "string") throw new Error("token has no email");
    email = payload.email.toLowerCase();
  } catch {
    throw new DomainError("Sign in again.", 401, "signed_out");
  }

  const row = await db.select().from(staff).where(eq(staff.email, email)).get();
  if (row?.active) return { staffId: row.id, name: row.name, role: row.role };
  if (row) throw new DomainError("Your account has been turned off. Ask the owner.", 403);

  if (config.ownerEmails.includes(email)) return bootstrapOwner(db, email);
  throw new DomainError(`${email} isn't on the staff list. Ask the owner to add you.`, 403);
}

/** First sign-in by an owner email from config creates their staff record. */
async function bootstrapOwner(db: Db, email: string): Promise<AuthedUser> {
  const id = newId();
  const now = Date.now();
  const name = email.split("@")[0] ?? "Owner";
  await db.batch([
    bumpVersion(db),
    db.insert(staff).values({
      id,
      name,
      role: "owner",
      active: true,
      email,
      phone: null,
      createdAt: now,
      updatedAt: now,
      version: nextVersion,
    }),
    db.insert(auditLog).values({
      mutationId: `bootstrap-${id}`,
      staffId: id,
      mutation: "staff.bootstrapOwner",
      args: JSON.stringify({ email }),
      at: now,
    }),
  ]);
  return { staffId: id, name, role: "owner" };
}
