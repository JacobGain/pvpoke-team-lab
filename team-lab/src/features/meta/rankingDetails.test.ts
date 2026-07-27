import { describe, expect, it } from "vitest";

import type {
  CatalogMove,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import {
  buildDefensiveProfile,
  formatEffectiveness,
  getMoveUsagePercent,
  getRankingStats,
} from "@/features/meta/rankingDetails";

const chargedMove: CatalogMove = {
  id: "ICE_BEAM",
  name: "Ice Beam",
  type: "ice",
  kind: "charged",
  power: 90,
  energy: 55,
  energyGain: 0,
  turns: 1,
  isLegacy: false,
  isElite: false,
};

const pokemon: PokemonCatalogEntry = {
  speciesId: "azumarill",
  speciesName: "Azumarill",
  dex: 184,
  types: ["water", "fairy"],
  tags: [],
  isReleased: true,
  isShadow: false,
  isShadowEligible: false,
  baseStats: { attack: 112, defense: 152, hp: 225 },
  levelFloor: 1,
  levelCap: 50,
  evolutionIds: [],
  fastMoves: [],
  chargedMoves: [chargedMove],
  defaultGreatLeagueIvs: {
    level: 45.5,
    attack: 0,
    defense: 15,
    hp: 15,
  },
  ranking: {
    rank: 1,
    score: 95,
    rating: 650,
    recommendedMoveIds: ["ICE_BEAM"],
    moveUsage: {
      fastMoves: [],
      chargedMoves: [
        { moveId: "ICE_BEAM", uses: 75 },
        { moveId: "PLAY_ROUGH", uses: 25 },
      ],
    },
    stats: {
      attack: 94.8,
      defense: 131.9,
      hp: 189,
      statProduct: 2363,
    },
    roleScores: {
      lead: 90,
      closer: 85,
      switch: 80,
      charger: 75,
      attacker: 70,
      consistency: 95,
    },
    matchups: [],
    counters: [],
  },
  isMeta: true,
};

describe("ranking details", () => {
  it("derives Pokémon GO weaknesses and resistances for dual typing", () => {
    const profile = buildDefensiveProfile(["water", "fairy"]);

    expect(profile.weaknesses.map(({ type }) => type)).toEqual([
      "electric",
      "grass",
      "poison",
      "steel",
    ]);
    expect(profile.resistances.map(({ type }) => type)).toEqual([
      "dragon",
      "bug",
      "dark",
      "fighting",
      "fire",
      "ice",
      "water",
    ]);
    expect(formatEffectiveness(profile.resistances[0]!.multiplier)).toBe(
      "0.39×",
    );
  });

  it("uses exact upstream stat totals and move usage", () => {
    expect(getRankingStats(pokemon)).toEqual(pokemon.ranking?.stats);
    expect(getMoveUsagePercent(pokemon, chargedMove)).toBe(75);
  });

  it("returns no usage when upstream counts are absent", () => {
    expect(
      getMoveUsagePercent(
        { ...pokemon, ranking: undefined },
        chargedMove,
      ),
    ).toBeUndefined();
  });
});
