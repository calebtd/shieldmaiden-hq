import { describe, expect, it } from "vitest";
import {
  add,
  applyRate,
  bps,
  cents,
  divideRounded,
  dollarsToCents,
  formatCents,
  formatPercent,
  parseDollars,
  parsePercent,
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

describe("parsePercent", () => {
  it.each([
    ["8.25", 825],
    ["8.25%", 825],
    [" 20 ", 2000],
    ["0", 0],
    [".5", 50],
    ["7.1", 710],
    ["100", 10000],
  ] as const)("%s → %i", (input, expected) => {
    expect(parsePercent(input)).toBe(expected);
  });

  it.each(["", "abc", "8.255", "-1", "8.2.5"])("rejects %j", (input) => {
    expect(() => parsePercent(input)).toThrow(RangeError);
  });
});

describe("parseDollars", () => {
  it.each([
    ["12", 1200],
    ["$12.50", 1250],
    ["1,234.5", 123450],
    [".99", 99],
    ["0", 0],
  ] as const)("%s → %i", (input, expected) => {
    expect(parseDollars(input)).toBe(expected);
  });

  it.each(["", "12.345", "-5", "five"])("rejects %j", (input) => {
    expect(() => parseDollars(input)).toThrow(RangeError);
  });
});

describe("formatPercent", () => {
  it("drops needless zeros", () => {
    expect(formatPercent(bps(2000))).toBe("20%");
    expect(formatPercent(bps(825))).toBe("8.25%");
    expect(formatPercent(bps(710))).toBe("7.1%");
  });
});
