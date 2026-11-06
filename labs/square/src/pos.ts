/**
 * Square Point of Sale API, web flavour: our page opens the Square app with an amount,
 * Square takes the card, then sends the browser back to our callback URL.
 * These helpers build the launch URLs and read the callback, and are unit tested.
 */

export const TENDER_TYPES = [
  "CREDIT_CARD",
  "CASH",
  "OTHER",
  "SQUARE_GIFT_CARD",
  "CARD_ON_FILE",
] as const;
export type TenderType = (typeof TENDER_TYPES)[number];

export interface ChargeRequest {
  appId: string;
  callbackUrl: string;
  amountCents: number;
  /** Shown in Square on the payment. */
  notes: string;
  /** Our reference; Square hands it back in the callback so we can match the payment. */
  ref: string;
  tenderTypes: TenderType[];
  skipReceipt: boolean;
}

/** iPhone / iPad: square-commerce-v1://payment/create?data=<json> */
export function iosChargeUrl(req: ChargeRequest): string {
  const data = {
    amount_money: { amount: req.amountCents, currency_code: "USD" },
    callback_url: req.callbackUrl,
    client_id: req.appId,
    version: "1.3",
    notes: req.notes,
    state: req.ref,
    options: {
      supported_tender_types: req.tenderTypes,
      skip_receipt: req.skipReceipt,
      auto_return: true,
    },
  };
  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
}

const ANDROID_TENDERS: Partial<Record<TenderType, string>> = {
  CREDIT_CARD: "com.squareup.pos.TENDER_CARD",
  CASH: "com.squareup.pos.TENDER_CASH",
  OTHER: "com.squareup.pos.TENDER_OTHER",
  SQUARE_GIFT_CARD: "com.squareup.pos.TENDER_GIFT_CARD",
  CARD_ON_FILE: "com.squareup.pos.TENDER_CARD_ON_FILE",
};

/** Android phones: an intent: URL that opens the Square app. */
export function androidChargeUrl(req: ChargeRequest): string {
  const tenders = req.tenderTypes
    .map((t) => ANDROID_TENDERS[t])
    .filter(Boolean)
    .join(",");
  const parts = [
    "action=com.squareup.pos.action.CHARGE",
    "package=com.squareup",
    `S.browser_fallback_url=${encodeURIComponent(req.callbackUrl)}`,
    `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(req.callbackUrl)}`,
    `S.com.squareup.pos.CLIENT_ID=${encodeURIComponent(req.appId)}`,
    "S.com.squareup.pos.API_VERSION=v2.0",
    `i.com.squareup.pos.TOTAL_AMOUNT=${req.amountCents}`,
    "S.com.squareup.pos.CURRENCY_CODE=USD",
    `S.com.squareup.pos.TENDER_TYPES=${tenders}`,
    `S.com.squareup.pos.NOTE=${encodeURIComponent(req.notes)}`,
    `S.com.squareup.pos.REQUEST_METADATA=${encodeURIComponent(req.ref)}`,
  ];
  return `intent:#Intent;${parts.join(";")};end`;
}

export interface CallbackResult {
  platform: "ios" | "android" | "unknown";
  ok: boolean;
  /** Square's ID for the payment's order. Missing if the payment was taken offline. */
  transactionId: string | null;
  /** ID made on the device; always present on success, even offline. */
  clientTransactionId: string | null;
  ref: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

/** Reads whatever the Square app sent back, from either platform. */
export function parseCallback(params: URLSearchParams): CallbackResult {
  const iosData = params.get("data");
  if (iosData) {
    let d: Record<string, unknown> = {};
    try {
      d = JSON.parse(iosData) as Record<string, unknown>;
    } catch {
      /* keep empty; raw params are still logged */
    }
    const str = (k: string) => (typeof d[k] === "string" ? d[k] : null);
    return {
      platform: "ios",
      ok: str("status") === "ok",
      transactionId: str("transaction_id"),
      clientTransactionId: str("client_transaction_id"),
      ref: str("state"),
      errorCode: str("error_code"),
      errorDescription: str("error_description"),
    };
  }

  const a = (k: string) => params.get(`com.squareup.pos.${k}`);
  if ([...params.keys()].some((k) => k.startsWith("com.squareup.pos."))) {
    const errorCode = a("ERROR_CODE");
    return {
      platform: "android",
      ok: !errorCode,
      transactionId: a("SERVER_TRANSACTION_ID"),
      clientTransactionId: a("CLIENT_TRANSACTION_ID"),
      ref: a("REQUEST_METADATA"),
      errorCode,
      errorDescription: a("ERROR_DESCRIPTION"),
    };
  }

  return {
    platform: "unknown",
    ok: false,
    transactionId: null,
    clientTransactionId: null,
    ref: null,
    errorCode: null,
    errorDescription: "No Square data in the callback.",
  };
}

/** "12.50" → 1250. Returns null for anything that isn't a positive dollar amount. */
export function parseDollars(input: string): number | null {
  const n = Number(input.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
