import { describe, expect, it } from "vitest";
import { bps, cents } from "./money";
import { assertValidTaxRate, splitTaxIncluded } from "./tax";

describe("splitTaxIncluded", () => {
  it("backs tax out of a tax-included price", () => {
    // $108.25 at 8.25% → $100.00 + $8.25
    expect(splitTaxIncluded(cents(10825), bps(825))).toEqual({
      gross: 10825,
      preTax: 10000,
      tax: 825,
    });
  });

  it("zero tax rate leaves everything as revenue", () => {
    expect(splitTaxIncluded(cents(5000), bps(0))).toEqual({ gross: 5000, preTax: 5000, tax: 0 });
  });

  it("pre-tax plus tax always equals what was paid", () => {
    for (const rate of [0, 600, 725, 825, 1025]) {
      for (let gross = 0; gross < 30000; gross += 37) {
        const s = splitTaxIncluded(cents(gross), bps(rate));
        expect(s.preTax + s.tax).toBe(gross);
        expect(s.tax).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("assertValidTaxRate", () => {
  it("accepts 0% to 20%", () => {
    expect(() => assertValidTaxRate(bps(0))).not.toThrow();
    expect(() => assertValidTaxRate(bps(2000))).not.toThrow();
  });

  it("rejects typos like 825% instead of 8.25%", () => {
    expect(() => assertValidTaxRate(bps(82500))).toThrow(/between 0% and 20%/);
  });
});
