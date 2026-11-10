import { Hono } from "hono";
import type { HealthResponse } from "@shared/ops";
import type { AppEnv } from "../context";
import { DomainError } from "../context";
import { readAccessListStatus } from "../integrations/accessList";
import { backupBucket, runBackup } from "./backup";
import { readBackupStatus, readLastProblem } from "./health";

/** Owner-only (guarded in app.ts). */
export const opsRoutes = new Hono<AppEnv>();

opsRoutes.get("/health", async (c) => {
  const d1 = c.env.DB;
  const [backup, accessList, lastProblem] = await Promise.all([
    readBackupStatus(d1),
    readAccessListStatus(c.var.db),
    readLastProblem(d1),
  ]);
  return c.json<HealthResponse>({
    appEnv: c.var.config.appEnv,
    backups: {
      enabled: backupBucket(c.env) !== undefined,
      keepDays: c.var.config.backupKeepDays,
      status: backup,
    },
    accessList: { managed: c.var.config.accessList !== null, status: accessList },
    lastProblem,
  });
});

opsRoutes.post("/backup", async (c) => {
  const bucket = backupBucket(c.env);
  if (!bucket) throw new DomainError("Backups aren't connected on this site yet.", 409);
  const status = await runBackup({
    d1: c.env.DB,
    bucket,
    site: c.var.config.appEnv,
    keepDays: c.var.config.backupKeepDays,
  });
  return c.json(status);
});
