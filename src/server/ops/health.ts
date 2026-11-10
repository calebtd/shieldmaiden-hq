import { backupStatusSchema, serverProblemSchema, type ServerProblem } from "@shared/ops";
import { readMeta, writeMeta } from "./meta";
import { BACKUP_STATUS_KEY } from "./backup";

/**
 * Owner-visible health facts. Full logs live in Cloudflare (Workers → the site's Worker →
 * Observability); this keeps the most recent problem in the database so it shows in the app.
 */

const PROBLEM_KEY = "last_server_problem";

export async function recordProblem(
  d1: D1Database,
  where: string,
  err: unknown,
  now = Date.now(),
): Promise<void> {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  const problem: ServerProblem = { at: now, where, message };
  try {
    await writeMeta(d1, PROBLEM_KEY, problem);
  } catch (writeErr) {
    // The database itself may be the problem; the log line is still in Cloudflare.
    console.error("could not record server problem", writeErr);
  }
}

export const readLastProblem = (d1: D1Database) => readMeta(d1, PROBLEM_KEY, serverProblemSchema);

export const readBackupStatus = (d1: D1Database) =>
  readMeta(d1, BACKUP_STATUS_KEY, backupStatusSchema);
