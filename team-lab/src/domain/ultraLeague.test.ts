import gmData from "../../public/vendor/pvpoke/data/gamemaster.min.json";
import greatRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import ultraRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-2500.json";
import greatMeta from "../../public/vendor/pvpoke/data/groups/great.json";
import ultraMeta from "../../public/vendor/pvpoke/data/groups/ultra.json";
import { describe, expect, it } from "vitest";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import { gameMasterSchema, metaGroupSchema, rankingCollectionSchema } from "@/pvpoke/types/schemas";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryPokemonSchema } from "@/domain/inventory/schemas";
import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { createMetaDefaultBuild } from "@/domain/simulation/teamRanker";
import { prepareSavedTeamRankerRequest } from "@/domain/simulation/savedTeamRanking";
import { createSavedTeam } from "@/domain/teams/factory";
import { createTeamLabBackup, inspectTeamLabBackup } from "@/domain/backup/teamLabBackup";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

const gm = gameMasterSchema.parse(gmData);
const great = buildPokemonCatalog(gm, rankingCollectionSchema.parse(greatRanks), metaGroupSchema.parse(greatMeta));
const ultra = buildPokemonCatalog(gm, rankingCollectionSchema.parse(ultraRanks), metaGroupSchema.parse(ultraMeta), 2500);
function record(speciesId: string, data = ultra) {
  const pokemon = data.entries.find((entry) => entry.speciesId === speciesId)!;
  const build = createMetaDefaultBuild(pokemon)!;
  return createInventoryPokemon({ buildStatus: "current", speciesId, currentBuild: {
    cp: build.cp, ivProfile: { source: "assumed-rank-1" },
    moveset: { fastMoveId: build.fastMoveId, chargedMoveIds: [...build.chargedMoveIds] },
  } }, { catalog: data });
}
function team(data: PokemonCatalog) {
  const inventory = ["feraligatr", "giratina_altered", "registeel"].map((id) => record(id, data));
  const saved = createSavedTeam({ name: "Ultra test", members: {
    leadInventoryId: inventory[0]!.inventoryId, switchInventoryId: inventory[1]!.inventoryId, closerInventoryId: inventory[2]!.inventoryId,
  } }, { catalog: data, inventory });
  return { inventory, saved };
}

describe("Ultra League", () => {
  it("loads 2500 CP defaults and computes league-specific IV rankings", () => {
    const owned = record("feraligatr");
    const analysis = analyzeInventoryBuild(owned, ultra);
    expect(owned.formatId).toBe("ultra-league");
    expect(owned.currentBuild.cp).toBeGreaterThan(1500);
    expect(analysis.current.ivRanking.rankOne.cp).toBeLessThanOrEqual(2500);
    expect(analysis.current.ivRanking.rankOne.cp).toBeGreaterThan(2400);
    expect(ultra.entries.find((p) => p.speciesId === "feraligatr")!.defaultLeagueIvs).not.toEqual(great.entries.find((p) => p.speciesId === "feraligatr")!.defaultLeagueIvs);
    expect(() => analyzeInventoryBuild(owned, great)).toThrow("league");
    expect(inventoryPokemonSchema.safeParse({ ...owned, formatId: "great-league" }).success).toBe(false);
    expect(inventoryPokemonSchema.safeParse({ ...owned, currentBuild: { ...owned.currentBuild, cp: 2501 } }).success).toBe(false);
  });

  it("derives planned builds at 2500 CP and enforces their target cap", () => {
    const owned = record("feraligatr");
    const planned = inventoryPokemonSchema.parse({
      ...owned,
      buildStatus: "planned",
      plannedBuild: { targetSpeciesId: owned.speciesId, desiredMoveset: owned.currentBuild.moveset },
    });
    const analysis = analyzeInventoryBuild(planned, ultra);
    expect(analysis.planned?.cp).toBeGreaterThan(2400);
    expect(analysis.planned?.cp).toBeLessThanOrEqual(2500);
    expect(inventoryPokemonSchema.safeParse({
      ...planned,
      plannedBuild: { targetSpeciesId: owned.speciesId, desiredMoveset: owned.currentBuild.moveset, targetCp: 2501 },
    }).success).toBe(false);
  });

  it("keeps legacy Great League records and both leagues in portable backups", () => {
    const { inventory, saved } = team(ultra);
    const legacy = { ...record("azumarill", great), formatId: undefined };
    const backup = createTeamLabBackup([legacy, ...inventory], [saved], ultra);
    for (const data of [great, ultra]) {
      const result = inspectTeamLabBackup(JSON.stringify(backup), data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.backup.inventory).toHaveLength(4);
        expect(result.backup.savedTeams[0]!.formatId).toBe("ultra-league");
      }
    }
    expect(inventoryPokemonSchema.parse(legacy).formatId).toBeUndefined();
  });

  it("prepares Ultra League targets and rejects mixed-league teams", () => {
    const { inventory, saved } = team(ultra);
    const prepared = prepareSavedTeamRankerRequest(saved, inventory, ultra, { targetLimit: 5, teamShields: 1, targetShields: 1 });
    expect(prepared.request.cpCap).toBe(2500);
    expect(prepared.request.targets).toHaveLength(5);
    expect(prepared.request.targets.every((p) => p.cp <= 2500)).toBe(true);
    expect(prepared.request.targets.some((p) => p.cp > 1500)).toBe(true);
    expect(() => createSavedTeam({ name: "Mixed", members: saved.members }, { inventory: [ { ...inventory[0]!, formatId: "great-league" }, ...inventory.slice(1) ], catalog: ultra })).toThrow("different league");
    expect(() => prepareSavedTeamRankerRequest(saved, inventory, great, { targetLimit: 5, teamShields: 1, targetShields: 1 })).toThrow("league");
  });

  it("excludes Great League inventory from Ultra League recommendations", () => {
    const { inventory } = team(ultra);
    const foreign = record("azumarill", great);
    const pool = buildRecommendationCandidatePool({ formatId: "ultra-league", anchors: [{ inventoryId: inventory[0]!.inventoryId, position: "lead" }], resultCount: 1, buildStatusScope: "all", partnerScope: "owned-only" }, [...inventory, foreign], ultra);
    expect(JSON.stringify(pool)).not.toContain(foreign.inventoryId);
  });
});
