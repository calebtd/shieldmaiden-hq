import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Migrations are read in vitest.config.ts and passed in as a test-only binding.
const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
await applyD1Migrations(env.DB, migrations);
