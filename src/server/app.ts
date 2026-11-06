import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { idSchema } from "@shared/ids";
import { pushRequestSchema, type Persona, type Session } from "@shared/sync";
import { PERSONA_COOKIE, requireUser } from "./auth";
import { readConfig } from "./config";
import { createDb, DomainError, type AppEnv } from "./context";
import { staff } from "./db/schema";
import { seedDemoDataIfEmpty } from "./demo";
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
  return c.json(await push(c.var.db, c.var.user, body.data.mutations));
});

app.get("/sync/pull", async (c) => {
  const cursor = Number(c.req.query("cursor") ?? "0");
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new DomainError("Bad cursor.");
  return c.json(await pull(c.var.db, c.var.user, cursor));
});
