import gmData from "../../public/vendor/pvpoke/data/gamemaster.min.json";
import greatRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import megaUltraRanks from "../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-2500.json";
import greatMeta from "../../public/vendor/pvpoke/data/groups/great.json";
import megaUltraMeta from "../../public/vendor/pvpoke/data/groups/megaultra.json";
import { describe, expect, it } from "vitest";
import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { isPreferredInLeague, megaFormsForSpecies, projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import { gameMasterSchema, metaGroupSchema, rankingCollectionSchema } from "@/pvpoke/types/schemas";

const gm = gameMasterSchema.parse(gmData);
const great = buildPokemonCatalog(gm, rankingCollectionSchema.parse(greatRanks), metaGroupSchema.parse(greatMeta));
const megaUltra = buildPokemonCatalog(gm, rankingCollectionSchema.parse(megaUltraRanks), metaGroupSchema.parse(megaUltraMeta), 2500, "mega-ultra-league");

describe("shared Mega inventory", () => {
  it("uses one owned Greninja as a normal Great build and an exact Mega Ultra build", () => {
    const base = great.entries.find((entry) => entry.speciesId === "greninja")!;
    const mega = megaUltra.entries.find((entry) => entry.speciesId === "greninja_mega")!;
    const ivs = { attack: 0, defense: 0, hp: 0 };
    const level = Array.from({ length: 99 }, (_, index) => 1 + index / 2).find((candidate) => {
      const normalCp = calculateCombatPower(base.baseStats, ivs, candidate);
      const megaCp = calculateCombatPower(mega.baseStats, ivs, candidate);
      return normalCp <= 1500 && megaCp > 1500 && megaCp <= 2500;
    })!;
    expect(level).toBeDefined();
    expect(megaFormsForSpecies("greninja", great).map((form) => form.speciesId)).toContain("greninja_mega");

    const owned = createInventoryPokemon({
      buildStatus: "current",
      speciesId: "greninja",
      megaSpeciesId: "greninja_mega",
      currentBuild: {
        cp: calculateCombatPower(base.baseStats, ivs, level),
        ivProfile: { source: "user-entered", ivs },
        moveset: { fastMoveId: base.fastMoves[0]!.id, chargedMoveIds: [base.chargedMoves[0]!.id] },
      },
    }, { catalog: great });

    expect(projectInventoryForCatalog(owned, great)?.speciesId).toBe("greninja");
    expect(projectInventoryForCatalog(owned, megaUltra)?.speciesId).toBe("greninja_mega");
    expect(isPreferredInLeague(owned, great)).toBe(true);
    expect(isPreferredInLeague(owned, megaUltra)).toBe(true);
    const analysis = analyzeInventoryBuild(owned, megaUltra);
    expect(analysis.current.speciesId).toBe("greninja_mega");
    expect(analysis.current.cp).toBe(calculateCombatPower(mega.baseStats, ivs, level));

    const lowerLevel = Array.from({ length: 99 }, (_, index) => 1 + index / 2)
      .find((candidate) => calculateCombatPower(mega.baseStats, ivs, candidate) > 10 && calculateCombatPower(mega.baseStats, ivs, candidate) <= 1500)!;
    const lowerOwned = {
      ...owned,
      currentBuild: { ...owned.currentBuild, cp: calculateCombatPower(base.baseStats, ivs, lowerLevel) },
    };
    const megaGreat = { ...megaUltra, cpCap: 1500, formatId: "mega-great-league" as const };
    expect(projectInventoryForCatalog(lowerOwned, megaGreat)?.speciesId).toBe("greninja_mega");
    expect(isPreferredInLeague(lowerOwned, megaGreat)).toBe(false);
    expect(isPreferredInLeague(lowerOwned, megaUltra)).toBe(true);
  });
});
