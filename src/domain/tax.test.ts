import { describe, expect, it } from "vitest";
import { bps, cents } from "./money";
import { splitTaxIncluded } from "./tax";

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
