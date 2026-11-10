import { BPS_PER_WHOLE, type Bps, type Cents } from "./money";

/** What one person earns: an hourly rate, a commission rate, and their share of tips. */
export interface PayRates {
  hourly: Cents;
  commission: Bps;
  tipShare: Bps;
}

/** Per-event changes to someone's usual rates. `null` means "use their usual rate". */
export interface PayOverride {
  hourly: Cents | null;
  commission: Bps | null;
  tipShare: Bps | null;
}

/** Highest hourly rate the app accepts, to catch typos like 500 instead of 5.00. */
export const MAX_HOURLY: Cents = 100_00 as Cents;

/** Starting points offered when setting someone's pay. */
export const PAY_PRESETS = {
  braider: { hourly: 5_00, commission: 2000, tipShare: BPS_PER_WHOLE },
  checkout: { hourly: null, commission: 0, tipShare: 0 },
  family: { hourly: 0, commission: 0, tipShare: BPS_PER_WHOLE },
} as const;

/** Throws if any rate is out of range. */
export function assertValidRates(rates: Partial<PayRates>): void {
  const { hourly, commission, tipShare } = rates;
  if (
    hourly !== undefined &&
    (!Number.isSafeInteger(hourly) || hourly < 0 || hourly > MAX_HOURLY)
  ) {
    throw new RangeError(`Hourly pay must be between $0 and $${MAX_HOURLY / 100}`);
  }
  for (const [label, rate] of [
    ["Commission", commission],
    ["Tip share", tipShare],
  ] as const) {
    if (rate !== undefined && (!Number.isSafeInteger(rate) || rate < 0 || rate > BPS_PER_WHOLE)) {
      throw new RangeError(`${label} must be between 0% and 100%`);
    }
  }
}

/**
 * The rates that apply to one person at one event: their usual profile, with any
 * per-event override taking its place field by field.
 *
 * Returns null when a rate is still unknown (no profile and the override doesn't
 * cover everything), so pay is never silently worked out as zero.
 */
export function resolvePayRates(
  profile: PayRates | null,
  override: PayOverride | null,
): PayRates | null {
  const hourly = override?.hourly ?? profile?.hourly;
  const commission = override?.commission ?? profile?.commission;
  const tipShare = override?.tipShare ?? profile?.tipShare;
  if (hourly === undefined || commission === undefined || tipShare === undefined) return null;
  return { hourly, commission, tipShare };
}

/** True when the override changes nothing, so it can be shown as "usual pay". */
export function isEmptyOverride(override: PayOverride | null): boolean {
  return (
    !override ||
    (override.hourly === null && override.commission === null && override.tipShare === null)
  );
}
