import { app } from "./app";
import { readConfig } from "./config";
import { createDb } from "./context";
import { resetDemoData } from "./demo";

export default {
  fetch: app.fetch,

  async scheduled(_controller, env) {
    // Demo only: start each day with fresh sample data.
    if (readConfig(env).appEnv === "demo") await resetDemoData(createDb(env.DB));
  },
} satisfies ExportedHandler<Env>;
