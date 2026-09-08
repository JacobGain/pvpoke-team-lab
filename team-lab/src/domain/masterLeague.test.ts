import ultraRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-2500.json";
import ultraMeta from "../../public/vendor/pvpoke/data/groups/ultra.json";
import gmData from "../../public/vendor/pvpoke/data/gamemaster.min.json";
import greatRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import masterRanks from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-10000.json";
import greatMeta from "../../public/vendor/pvpoke/data/groups/great.json";
import masterMeta from "../../public/vendor/pvpoke/data/groups/master.json";
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
const master = buildPokemonCatalog(gm, rankingCollectionSchema.parse(masterRanks), metaGroupSchema.parse(masterMeta), 10000);
const ultra = buildPokemonCatalog(gm, rankingCollectionSchema.parse(ultraRanks), metaGroupSchema.parse(ultraMeta), 2500);
function record(speciesId: string, data = master) {
  const pokemon = data.entries.find((entry) => entry.speciesId === speciesId)!;
  const build = createMetaDefaultBuild(pokemon)!;
  return createInventoryPokemon({ buildStatus: "current", speciesId, currentBuild: {
    cp: build.cp, ivProfile: { source: "assumed-rank-1" },
    moveset: { fastMoveId: build.fastMoveId, chargedMoveIds: [...build.chargedMoveIds] },
  } }, { catalog: data });
}
function team(data: PokemonCatalog) {
  const inventory = ["dragonite", "giratina_altered", "mewtwo"].map((id) => record(id, data));
  const saved = createSavedTeam({ name: "Master test", members: {
    leadInventoryId: inventory[0]!.inventoryId, switchInventoryId: inventory[1]!.inventoryId, closerInventoryId: inventory[2]!.inventoryId,
  } }, { catalog: data, inventory });
  return { inventory, saved };
}

describe("Master League", () => {
  it("uses perfect level-50 defaults and computes uncapped IV rankings", () => {
    const owned = record("dragonite");
    const analysis = analyzeInventoryBuild(owned, master);
    expect(owned.formatId).toBe("master-league");
    expect(owned.currentBuild.ivProfile.ivs).toEqual({ attack: 15, defense: 15, hp: 15 });
    expect(analysis.current.ivRanking.rank).toBe(1);
    expect(analysis.current.ivRanking.rankOne.level).toBe(50);
    expect(owned.currentBuild.cp).toBeGreaterThan(1500);
    expect(analysis.current.ivRanking.rankOne.cp).toBeLessThanOrEqual(10000);
    expect(analysis.current.ivRanking.rankOne.cp).toBeGreaterThan(3000);
    expect(master.entries.find((p) => p.speciesId === "dragonite")!.defaultLeagueIvs).not.toEqual(great.entries.find((p) => p.speciesId === "dragonite")!.defaultLeagueIvs);
    expect(() => analyzeInventoryBuild(owned, great)).toThrow("league");
    expect(inventoryPokemonSchema.safeParse({ ...owned, formatId: "great-league" }).success).toBe(false);
    expect(inventoryPokemonSchema.safeParse({ ...owned, currentBuild: { ...owned.currentBuild, cp: 10001 } }).success).toBe(false);
  });

  it("derives planned builds at the level cap and rejects invalid target CP", () => {
    const owned = record("dragonite");
    const planned = inventoryPokemonSchema.parse({
      ...owned,
      buildStatus: "planned",
      plannedBuild: { targetSpeciesId: owned.speciesId, desiredMoveset: owned.currentBuild.moveset },
    });
    const analysis = analyzeInventoryBuild(planned, master);
    expect(analysis.planned?.cp).toBeGreaterThan(3000);
    expect(analysis.planned?.cp).toBeLessThanOrEqual(10000);
    expect(inventoryPokemonSchema.safeParse({
      ...planned,
      plannedBuild: { targetSpeciesId: owned.speciesId, desiredMoveset: owned.currentBuild.moveset, targetCp: 10001 },
    }).success).toBe(false);
  });

  it("keeps legacy Great League records and all three leagues in portable backups", () => {
    const { inventory, saved } = team(master);
    const legacy = { ...record("azumarill", great), formatId: undefined };
    const backup = createTeamLabBackup([legacy, record("giratina_altered", ultra), ...inventory], [saved], master);
    for (const data of [great, ultra, master]) {
      const result = inspectTeamLabBackup(JSON.stringify(backup), data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.backup.inventory).toHaveLength(5);
        expect(result.backup.savedTeams[0]!.formatId).toBe("master-league");
      }
    }
    expect(inventoryPokemonSchema.parse(legacy).formatId).toBeUndefined();
  });

  it("prepares Master League targets and rejects mixed-league teams", () => {
    const { inventory, saved } = team(master);
    const prepared = prepareSavedTeamRankerRequest(saved, inventory, master, { targetLimit: 5, teamShields: 1, targetShields: 1 });
    expect(prepared.request.cpCap).toBe(10000);
    expect(prepared.request.targets).toHaveLength(5);
    expect(prepared.request.targets.every((p) => p.cp <= 10000)).toBe(true);
    expect(prepared.request.targets.some((p) => p.cp > 1500)).toBe(true);
    expect(() => createSavedTeam({ name: "Mixed", members: saved.members }, { inventory: [ { ...inventory[0]!, formatId: "great-league" }, ...inventory.slice(1) ], catalog: master })).toThrow("different league");
    expect(() => prepareSavedTeamRankerRequest(saved, inventory, great, { targetLimit: 5, teamShields: 1, targetShields: 1 })).toThrow("league");
  });

  it("excludes Great League inventory from Master League recommendations", () => {
    const { inventory } = team(master);
    const foreign = record("azumarill", great);
    const pool = buildRecommendationCandidatePool({ formatId: "master-league", anchors: [{ inventoryId: inventory[0]!.inventoryId, position: "lead" }], resultCount: 1, buildStatusScope: "all", partnerScope: "owned-only" }, [...inventory, foreign], master);
    expect(JSON.stringify(pool)).not.toContain(foreign.inventoryId);
  });
});
