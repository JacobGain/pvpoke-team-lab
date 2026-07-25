import { describe, expect, it } from "vitest";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import {
  analyzeNamedOpponent,
  getTypeEffectiveness,
} from "@/domain/analysis/matchupThresholds";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

function createAnalysis() {
  const record = createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId: "azumarill",
      currentBuild: {
        cp: 1499,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => "78ce2157-a008-49a1-bbcc-563998b76800",
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );

  return analyzeInventoryBuild(record, inventoryTestCatalog);
}

describe("named-opponent thresholds", () => {
  it("applies Pokémon Go effectiveness across dual types", () => {
    expect(getTypeEffectiveness("ice", ["dragon", "flying"])).toBeCloseTo(
      1.600000023841858 ** 2,
    );
    expect(getTypeEffectiveness("dragon", ["water", "fairy"])).toBeCloseTo(
      0.390625,
    );
  });

  it("compares an exact build with the named default meta build", () => {
    const analysis = createAnalysis();
    const azumarill = inventoryTestCatalog.entries[0]!;
    const altaria = inventoryTestCatalog.entries[1]!;
    const matchup = analyzeNamedOpponent(
      analysis.current,
      azumarill,
      altaria,
    );
    const result = matchup.levels[0]!;

    expect(matchup).toMatchObject({
      opponent: { speciesId: "altaria" },
      opponentLevel: 29,
      opponentIvs: { attack: 0, defense: 14, hp: 15 },
      opponentFastMove: { id: "DRAGON_BREATH" },
      dataVersion: "test-data-v1",
      matchupImpact: "not-simulated",
    });
    expect(result.outgoing.damage).toBeGreaterThanOrEqual(1);
    expect(result.outgoing.nextDamage).toBe(
      result.outgoing.damage + 1,
    );
    expect(
      result.outgoing.attackRequiredForNextDamage,
    ).toBeGreaterThan(0);
    expect(result.incoming.damage).toBe(1);
    expect(result.incoming.defenseRequiredForReducedDamage).toBeUndefined();
  });
});
