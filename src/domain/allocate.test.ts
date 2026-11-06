import { describe, expect, it } from "vitest";
import { allocate, assertSharesTotalWhole, equalShares } from "./allocate";
import { bps, cents } from "./money";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("splits evenly when it divides", () => {
    expect(allocate(cents(1000), [1, 1])).toEqual([500, 500]);
  });

  it("gives leftover cents to the largest remainders, earliest first on ties", () => {
    expect(allocate(cents(1000), [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(cents(5), [1, 1])).toEqual([3, 2]);
  });

  it("respects weights", () => {
    expect(allocate(cents(1000), [8000, 2000])).toEqual([800, 200]);
  });

  it("handles negative totals symmetrically", () => {
    expect(allocate(cents(-1000), [1, 1, 1])).toEqual([-334, -333, -333]);
  });

  it("always adds up exactly", () => {
    for (let total = 0; total < 2000; total += 7) {
      for (const weights of [
        [1, 1, 1],
        [7, 3],
        [3333, 3333, 3334],
        [1, 0, 2],
        [9999, 1],
      ]) {
        expect(sum(allocate(cents(total), weights))).toBe(total);
      }
    }
  });

  it("rejects bad weights", () => {
    expect(() => allocate(cents(100), [])).toThrow();
    expect(() => allocate(cents(100), [0, 0])).toThrow();
    expect(() => allocate(cents(100), [-1, 2])).toThrow();
  });
});

describe("equalShares", () => {
  it("adds up to 100%", () => {
    for (let n = 1; n <= 12; n++) {
      expect(() => assertSharesTotalWhole(equalShares(n))).not.toThrow();
    }
    expect(equalShares(3)).toEqual([3334, 3333, 3333]);
  });
});

describe("assertSharesTotalWhole", () => {
  it("rejects shares that do not total 100%", () => {
    expect(() => assertSharesTotalWhole([bps(5000), bps(4000)])).toThrow(/90%/);
  });
});
