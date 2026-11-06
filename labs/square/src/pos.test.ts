import { describe, expect, it } from "vitest";
import {
  androidChargeUrl,
  iosChargeUrl,
  parseCallback,
  parseDollars,
  type ChargeRequest,
} from "./pos";

const req: ChargeRequest = {
  appId: "sq0idp-abc",
  callbackUrl: "https://square-lab.shieldmaiden.hair/callback",
  amountCents: 1250,
  notes: "Lab test",
  ref: "t-1",
  tenderTypes: ["CREDIT_CARD", "CASH"],
  skipReceipt: true,
};

describe("iosChargeUrl", () => {
  it("encodes the request as Square expects", () => {
    const url = new URL(iosChargeUrl(req).replace("square-commerce-v1:", "https:"));
    const data = JSON.parse(url.searchParams.get("data") ?? "{}") as Record<string, unknown>;
    expect(data).toMatchObject({
      amount_money: { amount: 1250, currency_code: "USD" },
      client_id: "sq0idp-abc",
      version: "1.3",
      state: "t-1",
      options: { supported_tender_types: ["CREDIT_CARD", "CASH"], skip_receipt: true },
    });
  });
});

describe("androidChargeUrl", () => {
  it("builds an intent URL", () => {
    const url = androidChargeUrl(req);
    expect(url.startsWith("intent:#Intent;action=com.squareup.pos.action.CHARGE;")).toBe(true);
    expect(url).toContain("i.com.squareup.pos.TOTAL_AMOUNT=1250");
    expect(url).toContain("TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CASH");
    expect(url.endsWith(";end")).toBe(true);
  });
});

describe("parseCallback", () => {
  it("reads an iOS success", () => {
    const data = JSON.stringify({
      status: "ok",
      transaction_id: "ORDER1",
      client_transaction_id: "CLIENT1",
      state: "t-1",
    });
    expect(parseCallback(new URLSearchParams({ data }))).toMatchObject({
      platform: "ios",
      ok: true,
      transactionId: "ORDER1",
      clientTransactionId: "CLIENT1",
      ref: "t-1",
    });
  });

  it("reads an iOS cancel", () => {
    const data = JSON.stringify({ status: "error", error_code: "payment_canceled", state: "t-1" });
    expect(parseCallback(new URLSearchParams({ data }))).toMatchObject({
      ok: false,
      errorCode: "payment_canceled",
    });
  });

  it("reads an Android offline success (no server ID yet)", () => {
    const p = new URLSearchParams({
      "com.squareup.pos.CLIENT_TRANSACTION_ID": "CLIENT2",
      "com.squareup.pos.REQUEST_METADATA": "t-2",
    });
    expect(parseCallback(p)).toMatchObject({
      platform: "android",
      ok: true,
      transactionId: null,
      clientTransactionId: "CLIENT2",
      ref: "t-2",
    });
  });

  it("handles garbage", () => {
    expect(parseCallback(new URLSearchParams({ data: "{not json" })).ok).toBe(false);
    expect(parseCallback(new URLSearchParams()).platform).toBe("unknown");
  });
});

describe("parseDollars", () => {
  it.each([
    ["12.50", 1250],
    ["$1", 100],
    ["0", null],
    ["abc", null],
  ] as const)("%s → %s", (input, expected) => {
    expect(parseDollars(input)).toBe(expected);
  });
});
