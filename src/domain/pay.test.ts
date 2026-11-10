import { describe, expect, it } from "vitest";
import { bps, cents } from "./money";
import {
  assertValidRates,
  isEmptyOverride,
  PAY_PRESETS,
  resolvePayRates,
  type PayOverride,
  type PayRates,
} from "./pay";

const braider: PayRates = { hourly: cents(500), commission: bps(2000), tipShare: bps(10000) };
const none: PayOverride = { hourly: null, commission: null, tipShare: null };

describe("resolvePayRates", () => {
  it("uses the usual profile when there's no override", () => {
    expect(resolvePayRates(braider, null)).toEqual(braider);
    expect(resolvePayRates(braider, none)).toEqual(braider);
  });

  it("replaces only the rates the event overrides (training day: hourly only)", () => {
    const training = { ...none, hourly: cents(1500), commission: bps(0) };
    expect(resolvePayRates(braider, training)).toEqual({
      hourly: 1500,
      commission: 0,
      tipShare: 10000,
    });
  });

  it("an override of zero is a real override, not 'use usual'", () => {
    const tipsOnly = { hourly: cents(0), commission: bps(0), tipShare: null };
    expect(resolvePayRates(braider, tipsOnly)).toEqual({
      hourly: 0,
      commission: 0,
      tipShare: 10000,
    });
  });

  it("is unknown (not zero) when someone has no pay set", () => {
    expect(resolvePayRates(null, null)).toBeNull();
    expect(resolvePayRates(null, { ...none, hourly: cents(500) })).toBeNull();
  });

  it("a complete override works even without a profile", () => {
    const full = { hourly: cents(0), commission: bps(0), tipShare: bps(10000) };
    expect(resolvePayRates(null, full)).toEqual(full);
  });
});

describe("assertValidRates", () => {
  it("accepts the presets", () => {
    expect(() => assertValidRates(PAY_PRESETS.braider as unknown as PayRates)).not.toThrow();
    expect(() => assertValidRates(PAY_PRESETS.family as unknown as PayRates)).not.toThrow();
  });

  it.each([
    [{ commission: 10001 }, /Commission/],
    [{ tipShare: -1 }, /Tip share/],
    [{ hourly: 10001 }, /Hourly/],
    [{ hourly: 5.5 }, /Hourly/],
  ])("rejects %o", (rates, message) => {
    expect(() => assertValidRates(rates as Partial<PayRates>)).toThrow(message);
  });

  it("allows 0% and 100% exactly", () => {
    expect(() => assertValidRates({ commission: bps(0), tipShare: bps(10000) })).not.toThrow();
  });
});

describe("isEmptyOverride", () => {
  it("treats all-null as usual pay", () => {
    expect(isEmptyOverride(null)).toBe(true);
    expect(isEmptyOverride(none)).toBe(true);
    expect(isEmptyOverride({ ...none, tipShare: bps(0) })).toBe(false);
  });
});
