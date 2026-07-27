import { describe, expect, it } from "vitest";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { serializeAnalyzedBuildForSimulation } from "@/domain/simulation/buildSerialization";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

describe("simulation build serialization", () => {
  it("translates an exact inventory analysis without leaking upstream objects", () => {
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
      },
    );
    const analysis = analyzeInventoryBuild(record, inventoryTestCatalog);
    const pokemon = inventoryTestCatalog.entries.find(
      (entry) => entry.speciesId === "azumarill",
    )!;

    expect(
      serializeAnalyzedBuildForSimulation(analysis.current, pokemon),
    ).toEqual({
      speciesId: "azumarill",
      speciesName: "Azumarill",
      level: 45.5,
      cp: 1499,
      ivs: { attack: 0, defense: 15, hp: 15 },
      fastMoveId: "BUBBLE",
      chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
      isShadow: false,
      source: "inventory-current",
    });
  });
});
