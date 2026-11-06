/**
 * Money is always an integer number of cents. Rates are always integer basis points
 * (1 bp = 0.01%, so 20% = 2000 bp). Floats never hold money.
 *
 * The brands stop a plain number (or a rate) being passed where cents are expected.
 */

declare const centsBrand: unique symbol;
declare const bpsBrand: unique symbol;

export type Cents = number & { readonly [centsBrand]: true };
export type Bps = number & { readonly [bpsBrand]: true };

export const BPS_PER_WHOLE = 10_000;

export const ZERO = 0 as Cents;

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a whole number, got ${value}`);
  }
  return value as Cents;
}

export function bps(value: number): Bps {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Basis points must be a whole number ≥ 0, got ${value}`);
  }
  return value as Bps;
}

/** Percent as typed by a person (e.g. 8.25) → basis points (825). */
export function percentToBps(percent: number): Bps {
  return bps(Math.round(percent * 100));
}

export function bpsToPercent(rate: Bps): number {
  return rate / 100;
}

/** Dollars as typed by a person (e.g. "12.5" or 12.5) → cents. */
export function dollarsToCents(dollars: number | string): Cents {
  const n = typeof dollars === "string" ? Number(dollars.replace(/[$,\s]/g, "")) : dollars;
  if (!Number.isFinite(n)) throw new RangeError(`Not a dollar amount: ${dollars}`);
  return cents(Math.round(n * 100));
}

export function add(...values: Cents[]): Cents {
  return values.reduce<number>((sum, v) => sum + v, 0) as Cents;
}

export function subtract(a: Cents, b: Cents): Cents {
  return (a - b) as Cents;
}

export function multiply(amount: Cents, quantity: number): Cents {
  if (!Number.isSafeInteger(quantity)) throw new RangeError(`Quantity must be whole: ${quantity}`);
  return (amount * quantity) as Cents;
}

/**
 * amount × rate, rounded half away from zero to the nearest cent.
 * Integer math only: no floating-point error on large or awkward values.
 */
export function applyRate(amount: Cents, rate: Bps): Cents {
  return divideRounded(amount * rate, BPS_PER_WHOLE);
}

/** numerator ÷ denominator rounded half away from zero, for integers. */
export function divideRounded(numerator: number, denominator: number): Cents {
  if (denominator <= 0) throw new RangeError("Denominator must be positive");
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  const quotient = Math.floor(abs / denominator);
  const remainder = abs - quotient * denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return (sign * rounded || 0) as Cents;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(amount: Cents): string {
  return usd.format(amount / 100);
}
