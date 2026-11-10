import type { Cents } from "./money";

/** Braids and add-ons are the braider's work; retail is merchandise. */
export type MenuKind = "braid" | "addon" | "retail";

/** Retail (charms, clips, bonnets) never earns commission; braids and add-ons do. */
export function earnsCommission(kind: MenuKind): boolean {
  return kind !== "retail";
}

/** Highest menu price the app accepts, to catch typos like 3000 instead of 30.00. */
export const MAX_MENU_PRICE = 500_00 as Cents;
/** Longest a single braid or add-on can be estimated to take. */
export const MAX_MINUTES = 240;

export function assertValidMenuItem(item: { priceCents: number; minutes: number | null }): void {
  const { priceCents, minutes } = item;
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > MAX_MENU_PRICE) {
    throw new RangeError(`Price must be between $0 and $${MAX_MENU_PRICE / 100}`);
  }
  if (
    minutes !== null &&
    (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES)
  ) {
    throw new RangeError(`Time must be between 0 and ${MAX_MINUTES} minutes`);
  }
}

/** A braid can be done by someone who has every skill it needs. No skills = anyone. */
export function canDo(hasSkills: ReadonlySet<string>, needs: readonly string[]): boolean {
  return needs.every((s) => hasSkills.has(s));
}

/** Per-event changes to one menu item. `price` null = usual price. */
export interface EventMenuChange {
  price: Cents | null;
  offered: boolean;
}

export interface PriceAtEvent {
  /** Null when the price is decided at checkout (e.g. Braider's Pick). */
  price: Cents | null;
  offered: boolean;
}

/**
 * What an item costs at a particular event: the event's price if one is set,
 * otherwise the usual price. Items set to "price at checkout" have no fixed price
 * unless the event gives them one.
 */
export function priceAtEvent(
  item: { priceCents: number; openPrice: boolean },
  change: EventMenuChange | null,
): PriceAtEvent {
  const usual = item.openPrice ? null : (item.priceCents as Cents);
  return { price: change?.price ?? usual, offered: change?.offered ?? true };
}
