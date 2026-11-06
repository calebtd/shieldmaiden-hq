import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the built app (Worker + local D1) on port 4173.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm db:migrate:local && pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
