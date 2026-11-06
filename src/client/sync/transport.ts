import {
  pullResponseSchema,
  pushResponseSchema,
  type MutationEnvelope,
  type PullResponse,
  type PushResponse,
} from "@shared/sync";

/** No connection, or the server couldn't be reached. Changes stay queued. */
export class OfflineError extends Error {
  override name = "OfflineError";
}

/** The sign-in has expired (Cloudflare Access) or no persona is picked (demo). */
export class SignedOutError extends Error {
  override name = "SignedOutError";
  constructor(readonly code: "signed_out" | "pick_persona") {
    super(code === "pick_persona" ? "Pick who to sign in as." : "Sign in again.");
  }
}

/** The server answered with an error worth showing. */
export class ServerError extends Error {
  override name = "ServerError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface SyncTransport {
  push(mutations: MutationEnvelope[]): Promise<PushResponse>;
  pull(cursor: number): Promise<PullResponse>;
}

/**
 * Fetch wrapper for the API. Cloudflare Access answers an expired sign-in with a
 * redirect to its login page, so redirects are treated as "signed out".
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      redirect: "manual",
      headers: init.body ? { "Content-Type": "application/json" } : {},
    });
  } catch {
    throw new OfflineError("Can't reach the server.");
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new SignedOutError("signed_out");
  }
  const isJson = (res.headers.get("Content-Type") ?? "").includes("application/json");
  if (!isJson) {
    if (res.status === 401 || res.status === 403) throw new SignedOutError("signed_out");
    throw new ServerError(
      `The server returned an unexpected response (${res.status}).`,
      res.status,
    );
  }

  const body = (await res.json()) as { error?: string; code?: string };
  if (res.status === 401) {
    throw new SignedOutError(body.code === "pick_persona" ? "pick_persona" : "signed_out");
  }
  if (!res.ok) throw new ServerError(body.error ?? `Server error (${res.status}).`, res.status);
  return body;
}

export const httpTransport: SyncTransport = {
  async push(mutations) {
    const body = await apiFetch("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({ mutations }),
    });
    return pushResponseSchema.parse(body);
  },
  async pull(cursor) {
    return pullResponseSchema.parse(await apiFetch(`/api/sync/pull?cursor=${cursor}`));
  },
};
