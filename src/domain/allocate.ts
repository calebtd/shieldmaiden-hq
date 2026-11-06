import { BPS_PER_WHOLE, type Bps, type Cents } from "./money";

/**
 * Splits `total` into parts proportional to `weights`, so the parts always add up to
 * exactly `total` (no lost or invented cents).
 *
 * Uses the largest-remainder method: everyone gets the rounded-down share, then the
 * leftover cents go one at a time to the largest fractional remainders. Ties go to the
 * earlier entry, so the result is deterministic.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  if (weights.length === 0) throw new RangeError("Need at least one weight");
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new RangeError("Weights must be whole numbers ≥ 0");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new RangeError("Weights must not all be zero");

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);

  const floors = weights.map((w) => Math.floor((abs * w) / weightSum));
  const remainders = weights.map((w, i) => abs * w - (floors[i] ?? 0) * weightSum);
  let leftover = abs - floors.reduce((a, b) => a + b, 0);

  const order = remainders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map(({ i }) => i);

  const parts = [...floors];
  for (const i of order) {
    if (leftover === 0) break;
    parts[i] = (parts[i] ?? 0) + 1;
    leftover--;
  }
  return parts.map((p) => (sign * p || 0) as Cents);
}

/** Shares in basis points must cover the whole amount exactly. */
export function assertSharesTotalWhole(shares: readonly Bps[]): void {
  const sum = shares.reduce<number>((a, b) => a + b, 0);
  if (sum !== BPS_PER_WHOLE) {
    throw new RangeError(`Shares must add up to 100%, got ${sum / 100}%`);
  }
}

/** Equal shares in basis points for `count` people, adding up to exactly 100%. */
export function equalShares(count: number): Bps[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError("Need at least one person");
  return allocate(BPS_PER_WHOLE as Cents, Array(count).fill(1) as number[]).map(
    (c) => c as number as Bps,
  );
}
