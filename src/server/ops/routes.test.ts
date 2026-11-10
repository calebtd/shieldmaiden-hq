import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { BackupStatus, HealthResponse } from "@shared/ops";
import { TestClient } from "../test/client";
import { recordProblem } from "./health";

describe("owner health page", () => {
  it("is owners only", async () => {
    const braider = new TestClient();
    await braider.signInAs("braider");
    expect((await braider.request("/api/ops/health")).status).toBe(403);
    expect((await braider.request("/api/ops/backup", { method: "POST" })).status).toBe(403);
  });

  it("backs up on request and shows the result and the last problem", async () => {
    const owner = new TestClient();
    await owner.signInAs("owner");
    await recordProblem(env.DB, "GET /api/x", new Error("boom"), 123);

    const backup = await owner.json<BackupStatus>("/api/ops/backup", { method: "POST" });
    expect(backup.ok).toBe(true);
    expect(backup.key).toMatch(/^local\//);

    const health = await owner.json<HealthResponse>("/api/ops/health");
    expect(health).toMatchObject({
      appEnv: "local",
      backups: { enabled: true, keepDays: 3, status: backup },
      accessList: { managed: false, status: null },
      lastProblem: { at: 123, where: "GET /api/x", message: "boom" },
    });
  });
});
