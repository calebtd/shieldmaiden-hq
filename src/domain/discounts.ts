import { applyRate, BPS_PER_WHOLE, subtract, type Bps, type Cents } from "./money";
import { splitTaxIncluded } from "./tax";

/** A discount is either a percentage off or a fixed dollar amount off. */
export type DiscountRule = { kind: "percent"; percent: Bps } | { kind: "amount"; amount: Cents };

/** Throws if a discount can't make sense (over 100% or a negative amount). */
export function assertValidDiscount(rule: DiscountRule): void {
  if (rule.kind === "percent") {
    if (!Number.isSafeInteger(rule.percent) || rule.percent <= 0 || rule.percent > BPS_PER_WHOLE) {
      throw new RangeError("A percent discount must be more than 0% and at most 100%");
    }
  } else if (!Number.isSafeInteger(rule.amount) || rule.amount <= 0) {
    throw new RangeError("A dollar discount must be more than $0");
  }
}

/**
 * How much comes off a tax-included price. Never more than the price itself, so a
 * $10 discount on an $8 add-on makes it free rather than negative.
 */
export function discountOff(price: Cents, rule: DiscountRule): Cents {
  if (price <= 0) return 0 as Cents;
  const off = rule.kind === "percent" ? applyRate(price, rule.percent) : rule.amount;
  return Math.min(off, price) as Cents;
}

/**
 * What commission is calculated on for discounted work (braid + add-ons).
 *
 * By default braiders aren't penalized for discounts the business chooses to give:
 * commission is on the pre-tax **list** price. Only a discount type with
 * "reduces commission" switched on lowers it to the pre-tax amount actually charged.
 */
export function commissionBase(args: {
  listPrice: Cents;
  discount: Cents;
  taxRate: Bps;
  reducesCommission: boolean;
}): Cents {
  const charged = args.reducesCommission ? subtract(args.listPrice, args.discount) : args.listPrice;
  return splitTaxIncluded(charged, args.taxRate).preTax;
}
