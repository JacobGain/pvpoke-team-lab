import { describe, expect, it } from "vitest";
import gm from "../../../public/vendor/pvpoke/data/gamemaster.min.json";
import great from "../../../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import ultra from "../../../public/vendor/pvpoke/data/rankings/all/overall/rankings-2500.json";
import master from "../../../public/vendor/pvpoke/data/rankings/all/overall/rankings-10000.json";
import megaGreat from "../../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-1500.json";
import megaUltra from "../../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-2500.json";
import megaMaster from "../../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-10000.json";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import { gameMasterSchema, rankingCollectionSchema } from "@/pvpoke/types/schemas";
import { LEAGUES, LEAGUE_IDS } from "@/domain/leagues";
import { createMetaDefaultBuild } from "./teamRanker";

describe("published defaults across the supported format boundary", () => {
  const sources = { "great-league": great, "ultra-league": ultra, "master-league": master,
    "mega-great-league": megaGreat, "mega-ultra-league": megaUltra, "mega-master-league": megaMaster };
  it("retains exactly six supported formats", () => {
    expect([...LEAGUE_IDS].sort()).toEqual(Object.keys(sources).sort());
  });
  for (const id of LEAGUE_IDS) {
    it(`preserves every representable published attack slot in ${id}`, () => {
      const catalog = buildPokemonCatalog(gameMasterSchema.parse(gm), rankingCollectionSchema.parse(sources[id]), [], LEAGUES[id].cp, id);
      let count = 0;
      for (const pokemon of catalog.entries.filter(entry => entry.ranking)) {
        const build = createMetaDefaultBuild(pokemon);
        if (!build) continue; // Unavailable published IVs remain explicit exclusions.
        expect([build.fastMoveId, ...build.chargedMoveIds, ...(build.extraChargedMoveId ? [build.extraChargedMoveId] : [])], pokemon.speciesId)
          .toEqual(pokemon.ranking!.recommendedMoveIds);
        expect(build.cp, pokemon.speciesId).toBeLessThanOrEqual(LEAGUES[id].cp);
        expect(build.level, pokemon.speciesId).toBeLessThanOrEqual(build.megaLevel === 4 ? 52 : pokemon.levelCap);
        count++;
      }
      expect(count).toBeGreaterThan(250);
    });
  }
});
