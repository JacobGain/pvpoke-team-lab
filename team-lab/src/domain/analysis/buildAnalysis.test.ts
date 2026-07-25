import { describe, expect, it } from "vitest";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

function createRecord(chargedMoveIds: string[] = ["ICE_BEAM"]) {
  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId: "azumarill",
      currentBuild: {
        cp: 1499,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds,
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => "78ce2157-a008-49a1-bbcc-563998b76800",
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

describe("inventory build analysis", () => {
  it("combines exact stats, IV rank, moves, and upstream meta rank", () => {
    const analysis = analyzeInventoryBuild(
      createRecord(),
      inventoryTestCatalog,
    );

    expect(analysis.current).toMatchObject({
      speciesId: "azumarill",
      context: "current",
      cp: 1499,
      cpSource: "recorded",
      levels: [{ level: 45.5, isBestBuddy: false }],
      ivRanking: { rank: 1, count: 4096, percentile: 100 },
      moves: {
        fastMoveMatches: true,
        missingRecommendedChargedMoveIds: ["PLAY_ROUGH"],
      },
      metaRanking: {
        status: "ranked",
        rank: 5,
        score: 94.2,
        rating: 612,
        isMeta: true,
        strongestRole: {
          role: "consistency",
          score: 93.1,
          rank: 1,
          count: 2,
        },
      },
      dataVersion: "test-data-v1",
    });
    expect(analysis.requirements).toContainEqual({
      code: "unlock-second-charged-move",
      message: "Unlock a second charged move for PLAY_ROUGH.",
    });
  });

  it("keeps current and planned analysis separate", () => {
    const current = createRecord();
    const planned = {
      ...current,
      buildStatus: "planned" as const,
      plannedBuild: {
        targetSpeciesId: "azumarill",
        targetCp: 1499,
        desiredMoveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
        },
      },
    };
    const analysis = analyzeInventoryBuild(planned, inventoryTestCatalog);

    expect(analysis.current.moves.enteredChargedMoveIds).toEqual(["ICE_BEAM"]);
    expect(analysis.planned?.moves.enteredChargedMoveIds).toEqual([
      "ICE_BEAM",
      "PLAY_ROUGH",
    ]);
    expect(analysis.requirements).toContainEqual({
      code: "unlock-second-charged-move",
      message: "Unlock a second charged move for PLAY_ROUGH.",
    });
  });
});
