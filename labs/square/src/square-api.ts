/** Thin, read-only calls to Square's REST API, plus webhook signature checks. */

export interface SquareConfig {
  base: string;
  version: string;
  token: string;
}

async function get(cfg: SquareConfig, path: string): Promise<unknown> {
  const res = await fetch(`${cfg.base}${path}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Square-Version": cfg.version,
      Accept: "application/json",
    },
  });
  const body: unknown = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  return { httpStatus: res.status, body };
}

/** The Point of Sale callback's transaction ID is an order ID. Its tenders hold any tip. */
export function retrieveOrder(cfg: SquareConfig, orderId: string): Promise<unknown> {
  return get(cfg, `/v2/orders/${encodeURIComponent(orderId)}`);
}

/** Most recent payments, newest first. Useful to find offline payments by time. */
export function listRecentPayments(cfg: SquareConfig, hours = 24): Promise<unknown> {
  const begin = new Date(Date.now() - hours * 3600_000).toISOString();
  return get(cfg, `/v2/payments?begin_time=${encodeURIComponent(begin)}&sort_order=DESC&limit=25`);
}

/** Square signs webhooks: base64(HMAC-SHA256(key, notificationUrl + rawBody)). */
export async function verifyWebhook(
  signatureKey: string,
  notificationUrl: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(notificationUrl + rawBody),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
