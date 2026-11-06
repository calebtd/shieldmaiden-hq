import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const alias = {
  "@domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
  "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic and the client's sync engine: plain Node, fake IndexedDB.
        resolve: { alias },
        test: {
          name: "unit",
          include: [
            "src/domain/**/*.test.ts",
            "src/shared/**/*.test.ts",
            "src/client/**/*.test.ts",
          ],
          setupFiles: ["fake-indexeddb/auto"],
        },
      },
      {
        // API tests run inside the real Workers runtime with a fresh local D1 per test file.
        resolve: { alias },
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
            },
          })),
        ],
        test: {
          name: "server",
          include: ["src/server/**/*.test.ts"],
          setupFiles: ["./src/server/test/apply-migrations.ts"],
        },
      },
    ],
  },
});
