/** The Lab's one table: everything it sees, kept raw. */

/** Secrets aren't in wrangler.jsonc, so they're declared here. */
export type LabEnv = Env & { SQUARE_ACCESS_TOKEN?: string; SQUARE_WEBHOOK_SIGNATURE_KEY?: string };

export async function log(
  env: LabEnv,
  kind: string,
  ref: string | null,
  summary: string,
  payload: unknown,
) {
  await env.DB.prepare(
    "INSERT INTO events (kind, ref, at, summary, payload) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(kind, ref, Date.now(), summary, JSON.stringify(payload, null, 2))
    .run();
}
