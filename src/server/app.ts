import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { idSchema } from "@shared/ids";
import type { AccessListResponse } from "@shared/accessList";
import { pushRequestSchema, type Persona, type Session } from "@shared/sync";
import { PERSONA_COOKIE, requireUser } from "./auth";
import { readConfig } from "./config";
import { createDb, DomainError, type AppEnv } from "./context";
import { staff } from "./db/schema";
import { seedDemoDataIfEmpty } from "./demo";
import { readAccessListStatus, syncAccessList } from "./integrations/accessList";
import { opsRoutes } from "./ops/routes";
import { recordProblem } from "./ops/health";
import { pull } from "./sync/pull";
import { push } from "./sync/push";

export const app = new Hono<AppEnv>().basePath("/api");

app.use(async (c, next) => {
  c.set("config", readConfig(c.env));
  c.set("db", createDb(c.env.DB));
  await next();
  c.header("Cache-Control", "no-store");
});

app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json({ error: err.message, code: err.code }, err.status);
  }
  console.error(err);
  c.executionCtx.waitUntil(recordProblem(c.env.DB, `${c.req.method} ${c.req.path}`, err));
  return c.json({ error: "Something went wrong on the server." }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.get("/health", (c) => c.json({ ok: true, env: c.var.config.appEnv }));

// ---- Demo / local only: pick who to act as ----------------------------------------

const personaRoutes = new Hono<AppEnv>();
personaRoutes.use(async (c, next) => {
  if (c.var.config.authMode === "access") throw new DomainError("Not available here.", 404);
  await next();
});

personaRoutes.get("/", async (c) => {
  await seedDemoDataIfEmpty(c.var.db);
  const rows = await c.var.db
    .select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .where(eq(staff.active, true))
    .orderBy(asc(staff.createdAt));
  return c.json<{ personas: Persona[] }>({ personas: rows });
});

personaRoutes.post("/select", async (c) => {
  const body = z.object({ staffId: idSchema }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw new DomainError("Pick someone from the list.");
  const row = await c.var.db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.id, body.data.staffId), eq(staff.active, true)))
    .get();
  if (!row) throw new DomainError("That person isn't available.", 404);
  setCookie(c, PERSONA_COOKIE, row.id, {
    httpOnly: true,
    secure: c.var.config.appEnv !== "local",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return c.json({ ok: true });
});

personaRoutes.post("/clear", (c) => {
  deleteCookie(c, PERSONA_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.route("/personas", personaRoutes);

// ---- Signed-in routes ----------------------------------------------------------------

app.use("/session", requireUser);
app.use("/sync/*", requireUser);

app.get("/session", (c) => {
  const { staffId, name, role } = c.var.user;
  return c.json<Session>({
    staffId,
    name,
    role,
    appEnv: c.var.config.appEnv,
    authMode: c.var.config.authMode,
  });
});

app.post("/sync/push", async (c) => {
  const body = pushRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw new DomainError("Malformed sync request.");
  const { mutations } = body.data;
  const response = await push(c.var.db, c.var.user, mutations);

  // Staff changes update the Cloudflare sign-in list, after the response is sent.
  const applied = new Set(response.results.filter((r) => r.status === "applied").map((r) => r.id));
  const staffChanged = mutations.some((m) => applied.has(m.id) && m.name.startsWith("staff."));
  if (staffChanged && c.var.config.accessList) {
    c.executionCtx.waitUntil(syncAccessList(c.var.db, c.var.config));
  }
  return c.json(response);
});

// ---- Owners: the Cloudflare sign-in list mirrored from staff ---------------------------

export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.user.role !== "owner") throw new DomainError("Only owners can do that.", 403);
  await next();
});

app.use("/access-list/*", requireUser, requireOwner);
app.use("/access-list", requireUser, requireOwner);

app.get("/access-list", async (c) =>
  c.json<AccessListResponse>({
    managed: c.var.config.accessList !== null,
    status: await readAccessListStatus(c.var.db),
  }),
);

app.post("/access-list/sync", async (c) =>
  c.json<AccessListResponse>({
    managed: c.var.config.accessList !== null,
    status: await syncAccessList(c.var.db, c.var.config),
  }),
);

app.get("/sync/pull", async (c) => {
  const cursor = Number(c.req.query("cursor") ?? "0");
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new DomainError("Bad cursor.");
  return c.json(await pull(c.var.db, c.var.user, cursor));
});

// ---- Owners: health (backups, sign-in list, last server problem) -----------------------

app.use("/ops/*", requireUser, requireOwner);
app.route("/ops", opsRoutes);
