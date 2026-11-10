import { app } from "./app";
import { readConfig } from "./config";
import { createDb } from "./context";
import { resetDemoData } from "./demo";
import { syncAccessList } from "./integrations/accessList";
import { BACKUP_CRON, backupBucket, runBackup } from "./ops/backup";
import { recordProblem } from "./ops/health";

export default {
  fetch: app.fetch,

  async scheduled(controller, env) {
    const config = readConfig(env);
    try {
      if (controller.cron === BACKUP_CRON) {
        const bucket = backupBucket(env);
        if (!bucket) return console.warn("nightly backup skipped: no BACKUPS bucket connected");
        await runBackup({
          d1: env.DB,
          bucket,
          site: config.appEnv,
          keepDays: config.backupKeepDays,
        });
        return;
      }
      const db = createDb(env.DB);
      // Demo: start each day with fresh sample data.
      if (config.appEnv === "demo") await resetDemoData(db);
      // Dev/production: hourly safety net in case a sign-in list update was missed.
      if (config.accessList) await syncAccessList(db, config);
    } catch (err) {
      console.error(`scheduled job "${controller.cron}" failed`, err);
      await recordProblem(env.DB, `scheduled ${controller.cron}`, err);
      throw err;
    }
  },
} satisfies ExportedHandler<Env>;
