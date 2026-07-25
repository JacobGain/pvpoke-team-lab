import type { PokemonCatalog } from "@/domain/pokemon/catalog";

export const inventoryTestCatalog: PokemonCatalog = {
  dataVersion: "test-data-v1",
  entries: [
    {
      speciesId: "azumarill",
      speciesName: "Azumarill",
      dex: 184,
      types: ["water", "fairy"],
      tags: [],
      isReleased: true,
      isShadow: false,
      isShadowEligible: false,
      baseStats: {
        attack: 112,
        defense: 152,
        hp: 225,
      },
      levelFloor: 1,
      levelCap: 50,
      evolutionIds: [],
      fastMoves: [
        {
          id: "BUBBLE",
          name: "Bubble",
          type: "water",
          kind: "fast",
          isLegacy: false,
          isElite: false,
        },
      ],
      chargedMoves: [
        {
          id: "ICE_BEAM",
          name: "Ice Beam",
          type: "ice",
          kind: "charged",
          isLegacy: false,
          isElite: false,
        },
        {
          id: "PLAY_ROUGH",
          name: "Play Rough",
          type: "fairy",
          kind: "charged",
          isLegacy: false,
          isElite: false,
        },
      ],
      defaultGreatLeagueIvs: {
        level: 45.5,
        attack: 0,
        defense: 15,
        hp: 15,
      },
      ranking: {
        rank: 5,
        score: 94.2,
        rating: 612,
        recommendedMoveIds: ["BUBBLE", "ICE_BEAM", "PLAY_ROUGH"],
        roleScores: {
          lead: 84.5,
          closer: 87.3,
          switch: 69.9,
          charger: 85.7,
          attacker: 92,
          consistency: 93.1,
        },
      },
      isMeta: true,
    },
  ],
  diagnostics: {
    duplicatePokemonIds: [],
    duplicateMoveIds: [],
    duplicateRankingIds: [],
    danglingPokemonMoveIds: [],
    rankingSpeciesNotInGameMaster: [],
    rankingMoveIdsNotInGameMaster: [],
    metaSpeciesNotInGameMaster: [],
    metaMoveIdsNotInGameMaster: [],
  },
};
