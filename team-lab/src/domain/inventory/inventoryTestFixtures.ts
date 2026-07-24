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
