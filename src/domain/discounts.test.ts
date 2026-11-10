import { describe, expect, it } from "vitest";
import { assertValidDiscount, commissionBase, discountOff } from "./discounts";
import { applyRate, bps, cents } from "./money";

describe("discountOff", () => {
  it("takes a percentage off, rounded to the cent", () => {
    expect(discountOff(cents(6000), { kind: "percent", percent: bps(1500) })).toBe(900);
    expect(discountOff(cents(3333), { kind: "percent", percent: bps(1000) })).toBe(333);
    expect(discountOff(cents(5), { kind: "percent", percent: bps(5000) })).toBe(3); // 2.5 → 3
  });

  it("takes a fixed amount off", () => {
    expect(discountOff(cents(6000), { kind: "amount", amount: cents(1000) })).toBe(1000);
  });

  it("never takes off more than the price", () => {
    expect(discountOff(cents(800), { kind: "amount", amount: cents(1000) })).toBe(800);
    expect(discountOff(cents(800), { kind: "percent", percent: bps(10000) })).toBe(800);
    expect(discountOff(cents(0), { kind: "amount", amount: cents(1000) })).toBe(0);
  });
});

describe("assertValidDiscount", () => {
  it("accepts a comp (100%)", () => {
    expect(() => assertValidDiscount({ kind: "percent", percent: bps(10000) })).not.toThrow();
  });

  it("rejects nothing-off and over-100% discounts", () => {
    expect(() => assertValidDiscount({ kind: "percent", percent: bps(0) })).toThrow();
    expect(() => assertValidDiscount({ kind: "percent", percent: bps(10001) })).toThrow();
    expect(() => assertValidDiscount({ kind: "amount", amount: cents(0) })).toThrow();
  });
});

describe("commissionBase", () => {
  // $108.25 braid at 8.25% tax → $100.00 pre-tax.
  const listPrice = cents(10825);
  const taxRate = bps(825);
  const discount = discountOff(listPrice, { kind: "percent", percent: bps(2000) }); // $21.65

  it("by default pays commission on the pre-tax list price", () => {
    expect(commissionBase({ listPrice, discount, taxRate, reducesCommission: false })).toBe(10000);
  });

  it("uses the pre-tax amount charged when the discount reduces commission", () => {
    // $108.25 − $21.65 = $86.60 → $80.00 pre-tax
    expect(commissionBase({ listPrice, discount, taxRate, reducesCommission: true })).toBe(8000);
  });

  it("a comp that reduces commission pays nothing", () => {
    expect(
      commissionBase({ listPrice, discount: listPrice, taxRate, reducesCommission: true }),
    ).toBe(0);
  });

  it("works with a real commission rate", () => {
    const base = commissionBase({ listPrice, discount, taxRate, reducesCommission: false });
    expect(applyRate(base, bps(2000))).toBe(2000);
  });
});
