import { BPS_PER_WHOLE, divideRounded, subtract, type Bps, type Cents } from "./money";

export interface TaxSplit {
  /** What the customer paid, tax included. */
  gross: Cents;
  /** The business's revenue before tax. Commission is calculated on this. */
  preTax: Cents;
  /** Sales tax owed. */
  tax: Cents;
}

/**
 * Prices are tax-included. Given what the customer paid and the local tax rate,
 * returns the pre-tax amount and the tax inside it: preTax = gross ÷ (1 + rate).
 * preTax + tax always equals gross exactly.
 */
export function splitTaxIncluded(gross: Cents, rate: Bps): TaxSplit {
  const preTax = divideRounded(gross * BPS_PER_WHOLE, BPS_PER_WHOLE + rate);
  return { gross, preTax, tax: subtract(gross, preTax) };
}
