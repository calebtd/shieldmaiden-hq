import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../context";
import { auditLog, staff } from "../db/schema";
import { dumpDatabase, pruneBackups, runBackup, sqlLiteral } from "./backup";
import { readBackupStatus } from "./health";

const db = createDb(env.DB);
const bucket = env.BACKUPS as R2Bucket;
const restoreDb = (env as unknown as { RESTORE_TEST: D1Database }).RESTORE_TEST;
const DAY = 24 * 60 * 60 * 1000;

async function emptyBucket() {
  const { objects } = await bucket.list();
  if (objects.length) await bucket.delete(objects.map((o) => o.key));
}

/** What a restore does: run the file statement by statement into an empty database. */
async function restore(target: D1Database, sql: string) {
  const statements = sql.split("\n").filter((line) => line.trim());
  for (const s of statements) await target.prepare(s).run();
}

beforeEach(async () => {
  await db.delete(staff);
  await emptyBucket();
});

describe("sqlLiteral", () => {
  it("quotes text, escapes quotes and keeps everything on one line", () => {
    expect(sqlLiteral("O'Neil")).toBe("'O''Neil'");
    expect(sqlLiteral("a\nb\r\nc")).toBe("'a' || char(10) || 'b' || char(13, 10) || 'c'");
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(42)).toBe("42");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral([0, 255, 16])).toBe("X'00ff10'");
  });
});

describe("dumpDatabase", () => {
  it("restores into an empty database with the same rows", async () => {
    await db.insert(staff).values([
      {
        id: "s1",
        name: "Brynja O'Neil",
        role: "owner",
        active: true,
        email: "b@x.test",
        phone: null,
        createdAt: 1,
        updatedAt: 2,
        version: 3,
      },
      {
        id: "s2",
        name: "Two\nLines",
        role: "braider",
        active: false,
        email: null,
        phone: "555",
        createdAt: 4,
        updatedAt: 5,
        version: 6,
      },
    ]);
    await db.insert(auditLog).values({
      mutationId: "m1",
      staffId: "s1",
      mutation: "staff.create",
      args: '{"note":"it\'s"}',
      at: 7,
    });

    const { sql, rows } = await dumpDatabase(env.DB);
    expect(rows).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain("_cf_");

    await restore(restoreDb, sql);
    const restored = createDb(restoreDb);
    expect(await restored.select().from(staff).orderBy(staff.id)).toEqual(
      await db.select().from(staff).orderBy(staff.id),
    );
    expect(await restored.select().from(auditLog)).toEqual(await db.select().from(auditLog));
    // Migration history comes along, so later migrations apply cleanly to a restored copy.
    const migrations = await restoreDb.prepare("SELECT count(*) AS n FROM d1_migrations").first();
    expect(migrations).toEqual(
      await env.DB.prepare("SELECT count(*) AS n FROM d1_migrations").first(),
    );
  });
});

describe("runBackup", () => {
  it("writes one file per day into the site's folder and records the result", async () => {
    const now = Date.UTC(2026, 10, 10, 8, 41);
    const status = await runBackup({ d1: env.DB, bucket, site: "dev", keepDays: 14, now });
    expect(status).toMatchObject({ ok: true, key: "dev/2026-11-10.sql", pruned: 0, error: null });
    const obj = await bucket.get("dev/2026-11-10.sql");
    expect(obj?.size).toBe(status.bytes);
    expect(await obj?.text()).toContain("CREATE TABLE `staff`");
    expect(await readBackupStatus(env.DB)).toEqual(status);
  });

  it("records a failure instead of throwing", async () => {
    const broken = { put: () => Promise.reject(new Error("bucket gone")) } as unknown as R2Bucket;
    const status = await runBackup({ d1: env.DB, bucket: broken, site: "dev", keepDays: 14 });
    expect(status).toMatchObject({ ok: false, error: "bucket gone" });
    expect(await readBackupStatus(env.DB)).toMatchObject({ ok: false });
  });
});

describe("pruneBackups", () => {
  it("only deletes this site's copies older than the keep window", async () => {
    await bucket.put("production/old.sql", "x");
    await bucket.put("dev/old.sql", "x");
    const later = Date.now() + 31 * DAY;
    expect(await pruneBackups(bucket, "production/", 30, Date.now())).toBe(0);
    expect(await pruneBackups(bucket, "production/", 30, later)).toBe(1);
    expect(await bucket.head("production/old.sql")).toBeNull();
    expect(await bucket.head("dev/old.sql")).not.toBeNull();
  });
});
