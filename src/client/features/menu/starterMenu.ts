import type { MenuKind } from "@shared/entities/menu";

/**
 * The menu as of Nov 10, 2026, from the Square item library, the Square service list,
 * and the booth price board. Loaded once with "Load our current menu"; after that the
 * Menu screen is the source of truth.
 *
 * Braid prices are the price board's (usually the top of Square's range). Minutes are
 * Square's durations. Items with no known price are "price at checkout".
 */
export interface StarterItem {
  kind: MenuKind;
  name: string;
  /** Dollars; null = price decided at checkout. */
  price: number | null;
  minutes?: number;
  description?: string;
  /** Skill names (see STARTER_SKILLS) a braider needs. */
  skills?: string[];
}

export const STARTER_SKILLS = [
  "5 Strand",
  "Cornrows",
  "Crown",
  "Maiden's Heart",
  "Twist of Fae",
  "Wolftail",
  "Dutch",
  "Beard",
] as const;

const braid = (
  name: string,
  price: number | null,
  minutes?: number,
  skills?: string[],
  description?: string,
): StarterItem => ({
  kind: "braid",
  name,
  price,
  ...(minutes === undefined ? {} : { minutes }),
  ...(skills ? { skills } : {}),
  ...(description ? { description } : {}),
});
const addon = (name: string, price: number | null, description?: string): StarterItem => ({
  kind: "addon",
  name,
  price,
  ...(description ? { description } : {}),
});
const retail = (name: string, price: number, description?: string): StarterItem => ({
  kind: "retail",
  name,
  price,
  ...(description ? { description } : {}),
});

export const STARTER_MENU: StarterItem[] = [
  braid("Full Valkyrie", 70, 35),
  braid("Little Valkyrie", 55, 25),
  braid("Shieldmaiden", 40, 15),
  braid("Double Shieldmaiden", 50, 20),
  braid("Warrior Wolftail", 35, 20, ["Wolftail"]),
  braid("Twist of Fae", 30, 15, ["Twist of Fae"]),
  braid("Maiden's Heart", 30, 15, ["Maiden's Heart"]),
  braid("Buccaneer Braids", 30, 20),
  braid("Battle Buns", 30, 15),
  braid("Double Battle Braids", 25, 15),
  braid("Battle Braid", 20, 10),
  braid("The Crown", 25, 10, ["Crown"]),
  braid("Katniss", 20, 10),
  braid("Beard Braids", 10, 5, ["Beard"]),
  braid("Plunder and Pearl", 10, 10),
  braid("Hiccup Braids", 7, 5),
  braid("Rumi", 15, 10),
  braid("Head Paint", 10, 10),
  braid("Braider's Pick", null, undefined, undefined, "Mystery braid. Ask about pricing."),

  addon("Charms (3)", 3),
  addon("White beads (3)", 2),
  addon("Sea Treasures upgrade", 5, "Upgrade Plunder and Pearl to sea treasures."),
  addon("Viking Charms", null),
  addon("Ribbon", null),
  addon("Extra Charms", null),
  addon("Tinsel", null),
  addon("Leather", null),
  addon("Beads", null),
  addon("Glitter", null),
  addon("Extra cornrow", null, "Square had 1 to 4 extra cornrows."),
  addon("Extra difficulty: tangled", null),
  addon("Extra difficulty: long", null),
  addon("Extra difficulty: difficult", null),

  retail(
    "Druid/Fairy charm pack",
    10,
    "Can include ladybug, leaf, butterfly, feather, and flower charms",
  ),
  retail("Flower Crown", 5),
  retail("Glitter Gel", 5),
  retail("Large claw clips", 12),
  retail("Large flower crowns", 8),
  retail("Mannequin Head", 30),
  retail("Medium claw clips", 7),
  retail("Normal Charms", 1),
  retail(
    "Pirate/Mermaid charm pack",
    10,
    "Can include wooden beads, skulls, pearls, crosses, shells, crowns, snakes, feathers, etc.",
  ),
  retail(
    "Pit kit",
    10,
    "Large and small hair bands, bobby pins, a few charms, a hair clippy (mushroom, leaf, butterfly, etc.)",
  ),
  retail("Raven hair pins", 15),
  retail(
    "Regular charm pack",
    5,
    "Can include hoops, normal charms, butterflies, flowers, shells, pearls",
  ),
  retail("Satin Bonnet", 15),
  retail("Satin Pillowcase", 7),
  retail("Satin Scarf", 10),
  retail("Small claw clips", 3),
  retail("Star clips", 3, "Set of 2"),
  retail("Sword hair pin", 15),
  retail("Viking Charms", 5),
  retail("Viking charm pack", 20, "Metal viking charms"),
  retail("Viking hair pin", 8),
  retail("Wooden hair pin", 15),
];

/** The braider skills sheet (Nov 10, 2026): first name → skills they have. */
export const STARTER_STAFF_SKILLS: Record<string, string[]> = {
  Becca: ["Crown", "Maiden's Heart", "Twist of Fae", "Dutch", "Beard"],
  Bri: ["Dutch", "Beard"],
  Grace: [],
  Harmony: [],
  Lexi: [],
  Maddi: ["5 Strand", "Cornrows", "Crown", "Maiden's Heart", "Wolftail", "Dutch", "Beard"],
  Makayla: [...STARTER_SKILLS],
  Malia: ["Cornrows", "Maiden's Heart", "Twist of Fae", "Wolftail", "Dutch"],
  Raya: [],
  Savanah: ["Cornrows", "Twist of Fae", "Wolftail", "Dutch", "Beard"],
  Stephany: [],
  Summer: ["Dutch"],
};
