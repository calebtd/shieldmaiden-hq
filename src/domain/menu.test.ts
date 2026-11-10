import { describe, expect, it } from "vitest";
import { assertValidMenuItem, canDo, earnsCommission, priceAtEvent } from "./menu";
import { cents } from "./money";

describe("earnsCommission", () => {
  it("braids and add-ons earn commission; retail doesn't", () => {
    expect(earnsCommission("braid")).toBe(true);
    expect(earnsCommission("addon")).toBe(true);
    expect(earnsCommission("retail")).toBe(false);
  });
});

describe("assertValidMenuItem", () => {
  it("accepts free items and no time estimate", () => {
    expect(() => assertValidMenuItem({ priceCents: 0, minutes: null })).not.toThrow();
  });

  it.each([
    [{ priceCents: -1, minutes: 10 }, /Price/],
    [{ priceCents: 300000, minutes: 10 }, /Price/],
    [{ priceCents: 2000, minutes: 600 }, /Time/],
    [{ priceCents: 2000, minutes: 2.5 }, /Time/],
  ])("rejects %o", (item, message) => {
    expect(() => assertValidMenuItem(item)).toThrow(message);
  });
});

describe("canDo", () => {
  const has = new Set(["dutch", "cornrows"]);
  it("needs every skill the braid lists", () => {
    expect(canDo(has, ["dutch"])).toBe(true);
    expect(canDo(has, ["dutch", "cornrows"])).toBe(true);
    expect(canDo(has, ["dutch", "five-strand"])).toBe(false);
  });

  it("anyone can do a braid with no skills listed", () => {
    expect(canDo(new Set(), [])).toBe(true);
  });
});

describe("priceAtEvent", () => {
  const crown = { priceCents: 2500, openPrice: false };
  const pick = { priceCents: 0, openPrice: true };

  it("uses the usual price when the event doesn't change it", () => {
    expect(priceAtEvent(crown, null)).toEqual({ price: 2500, offered: true });
    expect(priceAtEvent(crown, { price: null, offered: true })).toEqual({
      price: 2500,
      offered: true,
    });
  });

  it("uses the event's price, including a lower one", () => {
    expect(priceAtEvent(crown, { price: cents(1500), offered: true })).toEqual({
      price: 1500,
      offered: true,
    });
  });

  it("an item can be left off an event's menu", () => {
    expect(priceAtEvent(crown, { price: null, offered: false }).offered).toBe(false);
  });

  it("price-at-checkout items have no fixed price unless the event sets one", () => {
    expect(priceAtEvent(pick, null).price).toBeNull();
    expect(priceAtEvent(pick, { price: cents(4500), offered: true }).price).toBe(4500);
  });
});
