import { describe, expect, it } from "vitest";
import {
  add,
  applyRate,
  bps,
  cents,
  divideRounded,
  dollarsToCents,
  formatCents,
  percentToBps,
} from "./money";

describe("cents", () => {
  it("rejects fractions", () => {
    expect(() => cents(1.5)).toThrow(RangeError);
  });
});

describe("dollarsToCents", () => {
  it.each([
    ["12.50", 1250],
    ["$1,234.56", 123456],
    [0.1 + 0.2, 30],
    ["19.999", 2000],
  ] as const)("%s → %i", (input, expected) => {
    expect(dollarsToCents(input)).toBe(expected);
  });

  it("rejects text", () => {
    expect(() => dollarsToCents("twelve")).toThrow(RangeError);
  });
});

describe("percentToBps", () => {
  it("handles decimal tax rates", () => {
    expect(percentToBps(8.25)).toBe(825);
    expect(percentToBps(20)).toBe(2000);
  });
});

describe("applyRate", () => {
  it("20% commission", () => {
    expect(applyRate(cents(25000), bps(2000))).toBe(5000);
  });

  it("rounds half away from zero", () => {
    expect(applyRate(cents(5), bps(5000))).toBe(3); // 2.5 → 3
    expect(applyRate(cents(-5), bps(5000))).toBe(-3);
    expect(applyRate(cents(4), bps(3333))).toBe(1); // 1.3332 → 1
  });
});

describe("divideRounded", () => {
  it("never returns -0", () => {
    expect(Object.is(divideRounded(-1, 10), 0)).toBe(true);
  });
});

describe("add / formatCents", () => {
  it("adds and formats", () => {
    expect(formatCents(add(cents(1999), cents(1)))).toBe("$20.00");
  });
});
