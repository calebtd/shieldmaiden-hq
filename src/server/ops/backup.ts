import type { BackupStatus } from "@shared/ops";
import { writeMeta } from "./meta";

/**
 * Nightly backup: copies every table in this site's database into one SQL file in the
 * `shieldmaiden-backups` R2 bucket, under a folder per site (`production/2026-11-10.sql`).
 * Copies older than the keep window are deleted. Restore steps are in README ("Backups").
 *
 * It reads through the Worker's own database binding, so it needs no extra secrets.
 */

export const BACKUP_STATUS_KEY = "backup_status";

/** Must match the nightly backup cron in wrangler.jsonc (08:41 UTC ≈ 2:41–3:41am US Central). */
export const BACKUP_CRON = "41 8 * * *";

/** The backup bucket is connected per site in wrangler.jsonc; it may not be set up yet. */
export const backupBucket = (env: Env): R2Bucket | undefined => env.BACKUPS;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 500;

type Value = string | number | null | ArrayBuffer | number[];

/** One SQL literal. Blobs come back from D1 as byte arrays. */
export function sqlLiteral(v: Value | boolean | bigint | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "string") {
    // Line breaks become char(...) so every statement stays on one line of the file.
    return v
      .split(/(\r\n|\n|\r)/)
      .map((part) => {
        if (part === "\r\n") return "char(13, 10)";
        if (part === "\n") return "char(10)";
        if (part === "\r") return "char(13)";
        return `'${part.replaceAll("'", "''")}'`;
      })
      .join(" || ");
  }
  const bytes = Array.isArray(v) ? v : [...new Uint8Array(v)];
  return `X'${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}'`;
}

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * Builds a SQL file that recreates every table, its rows and its indexes, one statement
 * per line, so it can be run with `wrangler d1 execute --file`.
 */
export async function dumpDatabase(d1: D1Database): Promise<{ sql: string; rows: number }> {
  const { results: objects } = await d1
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
       ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END,
                name`,
    )
    .all<{ type: "table" | "index" | "trigger" | "view"; name: string; sql: string }>();

  const out: string[] = ["PRAGMA defer_foreign_keys = TRUE;"];
  let rows = 0;
  for (const obj of objects) {
    out.push(`${obj.sql.replace(/\s*[\r\n]+\s*/g, " ")};`);
    if (obj.type !== "table") continue;
    for (let offset = 0; ; offset += PAGE) {
      const page = await d1
        .prepare(`SELECT * FROM ${ident(obj.name)} ORDER BY rowid LIMIT ? OFFSET ?`)
        .bind(PAGE, offset)
        .raw<Value[]>({ columnNames: true });
      const [columns, ...data] = page;
      if (data.length === 0) break;
      const cols = columns.map(ident).join(", ");
      for (const row of data) {
        out.push(
          `INSERT INTO ${ident(obj.name)} (${cols}) VALUES (${row.map(sqlLiteral).join(", ")});`,
        );
      }
      rows += data.length;
      if (data.length < PAGE) break;
    }
  }
  return { sql: out.join("\n") + "\n", rows };
}

/** Deletes this site's copies uploaded more than `keepDays` ago. Returns how many. */
export async function pruneBackups(
  bucket: R2Bucket,
  prefix: string,
  keepDays: number,
  now: number,
): Promise<number> {
  const cutoff = now - keepDays * DAY_MS;
  const old: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list(cursor ? { prefix, cursor } : { prefix });
    for (const obj of page.objects) if (obj.uploaded.getTime() < cutoff) old.push(obj.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (old.length > 0) await bucket.delete(old);
  return old.length;
}

export async function runBackup(opts: {
  d1: D1Database;
  bucket: R2Bucket;
  site: string;
  keepDays: number;
  now?: number;
}): Promise<BackupStatus> {
  const now = opts.now ?? Date.now();
  let status: BackupStatus;
  try {
    const { sql, rows } = await dumpDatabase(opts.d1);
    const key = `${opts.site}/${new Date(now).toISOString().slice(0, 10)}.sql`;
    const obj = await opts.bucket.put(key, sql, {
      httpMetadata: { contentType: "application/sql; charset=utf-8" },
      customMetadata: { site: opts.site, rows: String(rows) },
    });
    const pruned = await pruneBackups(opts.bucket, `${opts.site}/`, opts.keepDays, now);
    status = { at: now, ok: true, key, bytes: obj.size, rows, pruned, error: null };
  } catch (err) {
    console.error("backup failed", err);
    const error = err instanceof Error ? err.message : String(err);
    status = { at: now, ok: false, key: null, bytes: 0, rows: 0, pruned: 0, error };
  }
  await writeMeta(opts.d1, BACKUP_STATUS_KEY, status);
  return status;
}
