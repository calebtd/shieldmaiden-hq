import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/server/db/schema.ts into migrations/.
// Wrangler applies them: `wrangler d1 migrations apply DB --env <env>`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
});
