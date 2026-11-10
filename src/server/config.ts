import { z } from "zod";

/**
 * Settings from wrangler.jsonc `vars` (and optional secrets), checked once per request so
 * a typo in config fails loudly instead of quietly changing how sign-in works.
 */
const configSchema = z
  .object({
    APP_ENV: z.enum(["local", "dev", "demo", "production"]),
    AUTH_MODE: z.enum(["access", "demo", "local"]),
    OWNER_EMAILS: z.string(),
    ACCESS_TEAM_DOMAIN: z.string(),
    ACCESS_AUD: z.string(),
    CF_ACCOUNT_ID: z.string().default(""),
    ACCESS_STAFF_POLICY_ID: z.string().default(""),
    /** Secret. A Cloudflare token limited to editing Access policies. */
    ACCESS_ADMIN_TOKEN: z.string().optional(),
  })
  .refine((c) => c.APP_ENV !== "production" || c.AUTH_MODE === "access", {
    message: "Production must use Cloudflare Access sign-in.",
  });

export interface AccessListConfig {
  accountId: string;
  policyId: string;
  token: string;
}

export interface Config {
  appEnv: z.infer<typeof configSchema>["APP_ENV"];
  authMode: z.infer<typeof configSchema>["AUTH_MODE"];
  ownerEmails: string[];
  access: { teamDomain: string; audience: string } | null;
  /** When set, the staff list is mirrored into this Cloudflare Access policy. */
  accessList: AccessListConfig | null;
  /** How many days of nightly backups to keep in the backup bucket. */
  backupKeepDays: number;
}

const BACKUP_KEEP_DAYS: Record<Config["appEnv"], number> = {
  production: 30,
  dev: 14,
  demo: 3,
  local: 3,
};

export function readConfig(env: Env): Config {
  const c = configSchema.parse(env);
  return {
    appEnv: c.APP_ENV,
    authMode: c.AUTH_MODE,
    ownerEmails: c.OWNER_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    access:
      c.ACCESS_TEAM_DOMAIN && c.ACCESS_AUD
        ? { teamDomain: c.ACCESS_TEAM_DOMAIN, audience: c.ACCESS_AUD }
        : null,
    accessList:
      c.AUTH_MODE === "access" &&
      c.CF_ACCOUNT_ID &&
      c.ACCESS_STAFF_POLICY_ID &&
      c.ACCESS_ADMIN_TOKEN
        ? {
            accountId: c.CF_ACCOUNT_ID,
            policyId: c.ACCESS_STAFF_POLICY_ID,
            token: c.ACCESS_ADMIN_TOKEN,
          }
        : null,
    backupKeepDays: BACKUP_KEEP_DAYS[c.APP_ENV],
  };
}
