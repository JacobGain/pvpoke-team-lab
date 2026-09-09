import { describe, expect, it } from "vitest";

import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "@/pvpoke/types/schemas";

describe("buildPokemonCatalog", () => {
  it("normalizes PvPoke's missing recommended-move sentinel", () => {
    const gameMaster = gameMasterSchema.parse({
      id: "gamemaster",
      title: "Default",
      timestamp: "test-data-v1",
      settings: {
        partySize: 3,
        maxBuffStages: 4,
        buffDivisor: 4,
      },
      pokemon: [
        {
          dex: 201,
          speciesName: "Unown",
          speciesId: "unown",
          baseStats: { atk: 136, def: 91, hp: 134 },
          types: ["psychic", "none"],
          fastMoves: ["HIDDEN_POWER_PSYCHIC"],
          chargedMoves: ["STRUGGLE"],
          released: true,
        },
      ],
      moves: [
        {
          moveId: "HIDDEN_POWER_PSYCHIC",
          name: "Hidden Power",
          type: "psychic",
          power: 9,
          energy: 0,
          energyGain: 8,
          cooldown: 1_500,
        },
        {
          moveId: "STRUGGLE",
          name: "Struggle",
          type: "normal",
          power: 35,
          energy: 100,
          energyGain: 0,
          cooldown: 500,
        },
      ],
      formats: [],
      cups: [],
    });
    const rankings = rankingCollectionSchema.parse([
      {
        speciesId: "unown",
        speciesName: "Unown",
        rating: 291,
        matchups: [],
        counters: [],
        moveset: ["HIDDEN_POWER_PSYCHIC", "STRUGGLE", "none"],
        score: 27,
        scores: [],
      },
    ]);
    const catalog = buildPokemonCatalog(
      gameMaster,
      rankings,
      metaGroupSchema.parse([]),
    );

    expect(catalog.entries[0]?.ranking?.recommendedMoveIds).toEqual([
      "HIDDEN_POWER_PSYCHIC",
      "STRUGGLE",
    ]);
    expect(catalog.diagnostics.rankingMoveIdsNotInGameMaster).toEqual([]);
  });
});
