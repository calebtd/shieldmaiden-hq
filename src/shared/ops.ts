import { z } from "zod";
import { accessListResponseSchema } from "./accessList";

/** The latest nightly copy of the database to the backup bucket. */
export const backupStatusSchema = z.object({
  at: z.number(),
  ok: z.boolean(),
  /** File name in the backup bucket, e.g. "production/2026-11-10.sql". */
  key: z.string().nullable(),
  bytes: z.number(),
  rows: z.number(),
  /** Older copies removed this run (past the keep window). */
  pruned: z.number(),
  error: z.string().nullable(),
});
export type BackupStatus = z.infer<typeof backupStatusSchema>;

/** The most recent unexpected server error, so owners can see something went wrong. */
export const serverProblemSchema = z.object({
  at: z.number(),
  where: z.string(),
  message: z.string(),
});
export type ServerProblem = z.infer<typeof serverProblemSchema>;

export const healthResponseSchema = z.object({
  appEnv: z.string(),
  backups: z.object({
    /** False when this site has no backup bucket connected. */
    enabled: z.boolean(),
    keepDays: z.number(),
    status: backupStatusSchema.nullable(),
  }),
  accessList: accessListResponseSchema,
  lastProblem: serverProblemSchema.nullable(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
