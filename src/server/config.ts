import { z } from "zod";

/**
 * Settings from wrangler.jsonc `vars`, checked once per request so a typo in config
 * fails loudly instead of quietly changing how sign-in works.
 */
const configSchema = z
  .object({
    APP_ENV: z.enum(["local", "dev", "demo", "production"]),
    AUTH_MODE: z.enum(["access", "demo", "local"]),
    OWNER_EMAILS: z.string(),
    ACCESS_TEAM_DOMAIN: z.string(),
    ACCESS_AUD: z.string(),
  })
  .refine((c) => c.APP_ENV !== "production" || c.AUTH_MODE === "access", {
    message: "Production must use Cloudflare Access sign-in.",
  });

export type Config = {
  appEnv: z.infer<typeof configSchema>["APP_ENV"];
  authMode: z.infer<typeof configSchema>["AUTH_MODE"];
  ownerEmails: string[];
  access: { teamDomain: string; audience: string } | null;
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
  };
}
