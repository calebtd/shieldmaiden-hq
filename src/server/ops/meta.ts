import type { z } from "zod";

/** Small JSON facts kept in `server_meta` (backup result, last server problem). */

export async function writeMeta(d1: D1Database, key: string, value: unknown): Promise<void> {
  await d1
    .prepare(
      "INSERT INTO server_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key, JSON.stringify(value))
    .run();
}

export async function readMeta<T>(
  d1: D1Database,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const row = await d1
    .prepare("SELECT value FROM server_meta WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
