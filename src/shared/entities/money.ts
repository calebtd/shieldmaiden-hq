import { z } from "zod";
import { BPS_PER_WHOLE, parseDollars, parsePercent } from "@domain/money";
import { MAX_HOURLY } from "@domain/pay";

/** Stored amounts: whole cents, never negative. */
export const centsSchema = z.number().int("Must be whole cents").nonnegative();
/** Stored rates: basis points between 0 and 100%. */
export const percentBpsSchema = z
  .number()
  .int()
  .min(0, "Must be 0% or more")
  .max(BPS_PER_WHOLE, "Must be 100% or less");
export const hourlyCentsSchema = centsSchema.max(
  MAX_HOURLY,
  `Hourly pay must be $${MAX_HOURLY / 100} or less`,
);

/** Turns text typed into a form into a number, with the parser's message on failure. */
function fromText<T>(parse: (text: string) => T) {
  return z.string().transform((text, ctx) => {
    try {
      return parse(text);
    } catch (err) {
      ctx.addIssue({ code: "custom", message: (err as Error).message });
      return z.NEVER;
    }
  });
}

const blankOr =
  (parse: (text: string) => number) =>
  (text: string): number | null =>
    text.trim() === "" ? null : parse(text);

/** A dollar amount as typed ("12.50") → cents. */
export const dollarsInput = fromText((t) => parseDollars(t) as number);
/** A percent as typed ("8.25") → basis points. */
export const percentInput = fromText((t) => parsePercent(t) as number);
/** Same, but a blank field means "not set" (null). */
export const optionalDollarsInput = fromText(blankOr(parseDollars));
export const optionalPercentInput = fromText(blankOr(parsePercent));
