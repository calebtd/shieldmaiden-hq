import { describe, expect, it } from "vitest";
import { dollarsToCents } from "@domain/money";
import { mutations } from "@shared/mutations";
import { STARTER_MENU, STARTER_SKILLS, STARTER_STAFF_SKILLS } from "./starterMenu";

const skillNames = new Set<string>(STARTER_SKILLS);

describe("starter menu", () => {
  it("only refers to skills that exist", () => {
    const used = [
      ...STARTER_MENU.flatMap((i) => i.skills ?? []),
      ...Object.values(STARTER_STAFF_SKILLS).flat(),
    ];
    expect(used.filter((s) => !skillNames.has(s))).toEqual([]);
  });

  it("has no repeated names within a section", () => {
    const keys = STARTER_MENU.map((i) => `${i.kind}:${i.name.toLowerCase()}`);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it("every item passes the same checks as adding it by hand", () => {
    for (const item of STARTER_MENU) {
      const result = mutations["menu.create"].args.safeParse({
        id: "01900000-0000-7000-8000-000000000000",
        kind: item.kind,
        name: item.name,
        priceCents: item.price === null ? 0 : dollarsToCents(item.price),
        openPrice: item.price === null,
        minutes: item.minutes ?? null,
        description: item.description ?? null,
      });
      expect(result.success, item.name).toBe(true);
    }
  });

  it("matches what the owner told us about skills", () => {
    const needs = (name: string) => STARTER_MENU.find((i) => i.name === name)?.skills;
    expect(needs("Full Valkyrie")).toEqual(["5 Strand", "Cornrows"]);
    expect(needs("Shieldmaiden")).toEqual(["5 Strand"]);
    expect(needs("Buccaneer Braids")).toEqual(["Cornrows"]);
    expect(needs("Battle Braid")).toEqual(["Dutch"]);
  });

  it("has the owner's add-on prices (Nov 11)", () => {
    const price = (name: string) =>
      STARTER_MENU.find((i) => i.kind === "addon" && i.name === name)?.price;
    expect(price("Extra cornrow")).toBe(10);
    // Only Tinsel (sold out) still has no price.
    const unpriced = STARTER_MENU.filter((i) => i.kind === "addon" && i.price === null);
    expect(unpriced.map((i) => i.name)).toEqual(["Tinsel"]);
  });
});
