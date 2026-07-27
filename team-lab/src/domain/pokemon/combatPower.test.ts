import { describe, expect, it } from "vitest";

import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import {
  calculateCombatPower,
  getCpMultiplier,
  inferCombatPowerLevel,
} from "@/domain/pokemon/combatPower";

const azumarill = inventoryTestCatalog.entries[0]!;

describe("Pokémon GO combat power", () => {
  it("uses the same level indexing and CP floor as PvPoke", () => {
    expect(getCpMultiplier(1)).toBe(0.0939999967813491);
    expect(getCpMultiplier(40)).toBe(0.790300011634826);
    expect(getCpMultiplier(50)).toBe(0.840300023555755);
    expect(getCpMultiplier(51)).toBe(0.845300018787384);
    expect(getCpMultiplier(1.25)).toBeUndefined();
    expect(
      calculateCombatPower(
        { attack: 1, defense: 1, hp: 1 },
        { attack: 0, defense: 0, hp: 0 },
        1,
      ),
    ).toBe(10);
  });

  it("infers PvPoke's default Azumarill rank-one build", () => {
    const result = inferCombatPowerLevel(
      azumarill,
      { attack: 0, defense: 15, hp: 15 },
      1499,
    );

    expect(result).toEqual({
      status: "unique",
      matches: [
        {
          level: 45.5,
          combatPower: 1499,
          isBestBuddy: false,
        },
      ],
    });
  });

  it("reports impossible and low-CP ambiguous combinations", () => {
    expect(
      inferCombatPowerLevel(
        azumarill,
        { attack: 0, defense: 15, hp: 15 },
        1498,
      ).status,
    ).toBe("no-match");
    expect(
      inferCombatPowerLevel(
        {
          ...azumarill,
          baseStats: { attack: 1, defense: 1, hp: 1 },
        },
        { attack: 0, defense: 0, hp: 0 },
        10,
      ).status,
    ).toBe("ambiguous");
  });
});
