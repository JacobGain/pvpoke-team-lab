import { describe, expect, it } from "vitest";

import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { deriveTeamAlternatives } from "@/domain/teamAnalysis/alternatives";
import type { SavedTeamAnalysis } from "@/domain/teamAnalysis/teamAnalysis";

function catalog(): PokemonCatalog {
  const azumarill = inventoryTestCatalog.entries.find(
    (entry) => entry.speciesId === "azumarill",
  )!;
  const whiscash = inventoryTestCatalog.entries.find(
    (entry) => entry.speciesId === "whiscash",
  )!;
  const altaria = inventoryTestCatalog.entries.find(
    (entry) => entry.speciesId === "altaria",
  )!;
  const ownedCounter = {
    ...whiscash,
    speciesId: "owned_counter",
    speciesName: "Owned Counter",
    dex: 9001,
    ranking: {
      ...azumarill.ranking!,
      rank: 100,
      recommendedMoveIds: ["MUD_SHOT", "SCALD", "BLIZZARD"],
    },
  };
  const unownedCounter = {
    ...whiscash,
    speciesId: "unowned_counter",
    speciesName: "Unowned Counter",
    dex: 9002,
    ranking: {
      ...azumarill.ranking!,
      rank: 101,
      recommendedMoveIds: ["MUD_SHOT", "SCALD", "BLIZZARD"],
    },
  };

  return {
    ...inventoryTestCatalog,
    entries: [
      {
        ...azumarill,
        ranking: {
          ...azumarill.ranking!,
          counters: [
            { speciesId: "owned_counter", rating: 250 },
            { speciesId: "unowned_counter", rating: 300 },
            { speciesId: "altaria", rating: 100 },
          ],
        },
      },
      altaria,
      whiscash,
      ownedCounter,
      unownedCounter,
    ],
  };
}

function analysis(): SavedTeamAnalysis {
  return {
    members: [
      { position: "lead", speciesId: "altaria" },
      { position: "switch", speciesId: "whiscash" },
      { position: "closer", speciesId: "some_team_member" },
    ],
    majorThreats: [
      {
        speciesId: "azumarill",
        speciesName: "Azumarill",
        threatLevel: "team-wall",
      },
    ],
  } as unknown as SavedTeamAnalysis;
}

function inventoryRecord(
  inventoryId: string,
  buildStatus: "current" | "planned",
): InventoryPokemon {
  const base = {
    schemaVersion: 1 as const,
    inventoryId,
    favorite: buildStatus === "planned",
    notes: "",
    sourceDataVersion: "test-data-v1",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
    speciesId: "owned_counter",
    currentBuild: {
      cp: 1400,
      ivProfile: {
        source: "user-entered" as const,
        ivs: { attack: 0, defense: 15, hp: 15 },
      },
      moveset: {
        fastMoveId: "MUD_SHOT",
        chargedMoveIds: ["SCALD"],
      },
    },
  };

  return buildStatus === "current"
    ? { ...base, buildStatus }
    : {
        ...base,
        buildStatus,
        plannedBuild: {
          targetSpeciesId: "owned_counter",
          targetCp: 1495,
          desiredMoveset: {
            fastMoveId: "MUD_SHOT",
            chargedMoveIds: ["SCALD", "BLIZZARD"],
          },
        },
      };
}

describe("team alternatives", () => {
  it("separates exact owned builds from theoretical unowned counters", () => {
    const result = deriveTeamAlternatives(
      analysis(),
      [
        inventoryRecord(
          "78ce2157-a008-49a1-bbcc-563998b76800",
          "planned",
        ),
        inventoryRecord(
          "fd17fe2f-1d87-4879-8850-d95476cd9070",
          "current",
        ),
      ],
      catalog(),
    );

    expect(result).toMatchObject({
      counterEvidenceSource: "pvpoke-overall-ranking-counters",
      dataVersion: "test-data-v1",
      threats: [
        {
          threatSpeciesId: "azumarill",
          owned: [
            {
              source: "owned-exact-build",
              speciesId: "owned_counter",
              buildStatus: "current",
              cp: 1400,
              counterRating: 250,
              alternativeRating: 750,
            },
          ],
          unowned: [
            {
              source: "unowned-pvpoke-default",
              speciesId: "unowned_counter",
              counterRating: 300,
              alternativeRating: 700,
              defaultIvs: {
                level: 27,
                attack: 4,
                defense: 15,
                hp: 15,
              },
            },
          ],
        },
      ],
    });
    expect(
      result.threats[0]?.owned.some(
        (alternative) => alternative.speciesId === "altaria",
      ),
    ).toBe(false);
  });
});
