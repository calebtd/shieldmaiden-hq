import { app } from "./app";
import { readConfig } from "./config";
import { createDb } from "./context";
import { resetDemoData } from "./demo";
import { syncAccessList } from "./integrations/accessList";

export default {
  fetch: app.fetch,

  async scheduled(_controller, env) {
    const config = readConfig(env);
    const db = createDb(env.DB);
    // Demo: start each day with fresh sample data.
    if (config.appEnv === "demo") await resetDemoData(db);
    // Dev/production: hourly safety net in case a sign-in list update was missed.
    if (config.accessList) await syncAccessList(db, config);
  },
} satisfies ExportedHandler<Env>;
