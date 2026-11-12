import { describe, expect, it } from "vitest";
import gameMaster from "../../../public/vendor/pvpoke/data/gamemaster.min.json";
import rankings from "../../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-10000.json";
import greatRankings from "../../../public/vendor/pvpoke/data/rankings/mega/overall/rankings-1500.json";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";
import { gameMasterSchema, rankingCollectionSchema } from "@/pvpoke/types/schemas";
import { createInventoryPokemon } from "./factory";
import { inventoryPokemonSchema } from "./schemas";
import { LEGACY_MEGA_LEVELS } from "./legacyMegaLevels";
import { createTeamLabBackup, inspectTeamLabBackup, serializeTeamLabBackup } from "@/domain/backup/teamLabBackup";
import { calculateCombatPower, inferCombatPowerLevel } from "@/domain/pokemon/combatPower";
import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { serializeAnalyzedBuildForSimulation } from "@/domain/simulation/buildSerialization";
import { createMetaDefaultBuild } from "@/domain/simulation/teamRanker";

const catalog = buildPokemonCatalog(gameMasterSchema.parse(gameMaster), rankingCollectionSchema.parse(rankings), [], 10000, "mega-master-league");
const sableye = catalog.entries.find(entry => entry.speciesId === "sableye_mega")!;
const ivs = { attack: 15, defense: 15, hp: 15 };
const input = {
  buildStatus: "current" as const, speciesId: sableye.speciesId,
  currentBuild: {
    megaLevel: 4 as const, cp: calculateCombatPower(sableye.baseStats, ivs, 52),
    ivProfile: { source: "user-entered" as const, ivs },
    moveset: { fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["FOUL_PLAY"], extraChargedMoveId: "NIGHT_SHADE_PLUS" },
  },
};

describe("Super Mega build contracts", () => {
  it("does not label two Super Mega bonus levels as purchased power-ups", () => {
    const record = createInventoryPokemon({ ...input, buildStatus: "planned",
      currentBuild: { ...input.currentBuild, megaLevel: 3, cp: calculateCombatPower(sableye.baseStats, ivs, 50) },
      plannedBuild: { targetSpeciesId: sableye.speciesId, megaLevel: 4,
        targetCp: calculateCombatPower(sableye.baseStats, ivs, 52), desiredMoveset: input.currentBuild.moveset },
    }, { catalog });
    const requirements = analyzeInventoryBuild(record, catalog).transitionRequirements;
    expect(requirements.some(requirement => requirement.code === "change-mega-level")).toBe(true);
    expect(requirements.some(requirement => requirement.code === "power-up")).toBe(false);
  });
  it("preserves independent current/planned settings through analysis, serialization, and backup", () => {
    const record = createInventoryPokemon({ ...input, buildStatus: "planned", plannedBuild: {
      targetSpeciesId: sableye.speciesId, megaLevel: 2,
      targetCp: calculateCombatPower(sableye.baseStats, ivs, 50),
      desiredMoveset: { fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["POWER_GEM", "FOUL_PLAY"] },
    } }, { catalog });
    const analysis = analyzeInventoryBuild(record, catalog);
    const exact = serializeAnalyzedBuildForSimulation(analysis.current, sableye);
    expect(exact).toMatchObject({ megaLevel: 4, level: 52, chargedMoveIds: ["FOUL_PLAY"], extraChargedMoveId: "NIGHT_SHADE_PLUS" });
    expect(serializeAnalyzedBuildForSimulation(analysis.planned!, sableye)).toMatchObject({ megaLevel: 2, level: 50 });
    const backup = createTeamLabBackup([record], [], catalog);
    expect(backup.schemaVersion).toBe(4);
    const restored = inspectTeamLabBackup(serializeTeamLabBackup(backup), catalog);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.backup.inventory).toEqual([record]);
  });

  it("preserves the complete published Super Mega default build", () => {
    const greatCatalog = buildPokemonCatalog(gameMasterSchema.parse(gameMaster), rankingCollectionSchema.parse(greatRankings), [], 1500, "mega-great-league");
    const build = createMetaDefaultBuild(greatCatalog.entries.find(entry => entry.speciesId === sableye.speciesId)!)!;
    expect(build).toMatchObject({ megaLevel: 4, level: 29, extraChargedMoveId: "NIGHT_SHADE_PLUS" });
    expect(build.chargedMoveIds).toHaveLength(2);
    expect(greatCatalog.entries.find(entry => entry.speciesId === sableye.speciesId)?.ranking?.moveUsage?.extraChargedMoves).toContainEqual({ moveId: "NIGHT_SHADE_PLUS", uses: 29864 });
    expect(sableye.chargedMoves.some(move => move.id === build.extraChargedMoveId)).toBe(false);
    expect(sableye.extraChargedMoves?.[0]?.isMegaMove).toBe(true);
    expect(createMetaDefaultBuild(sableye)).toMatchObject({ level: 52, megaLevel: 4, extraChargedMoveId: undefined });
  });

  it("rejects an extra move in an ordinary slot, the wrong extra pool, and inapplicable Mega settings", () => {
    expect(() => createInventoryPokemon({ ...input, currentBuild: { ...input.currentBuild,
      moveset: { fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["NIGHT_SHADE_PLUS"] },
    } }, { catalog })).toThrow("not a charged move");
    expect(() => createInventoryPokemon({ ...input, currentBuild: { ...input.currentBuild,
      moveset: { ...input.currentBuild.moveset, extraChargedMoveId: "OMINOUS_WIND_PLUS" },
    } }, { catalog })).toThrow("not an extra charged attack");
    expect(() => createInventoryPokemon({ ...input, speciesId: "sableye" }, { catalog })).toThrow("Mega level requires");
  });

  it("migrates legacy records without inventing attacks, CP, IVs, or timestamps", () => {
    const current = createInventoryPokemon(input, { catalog });
    const legacy = { ...current, schemaVersion: 1,
      currentBuild: { cp: calculateCombatPower(sableye.baseStats, ivs, 50), ivProfile: current.currentBuild.ivProfile,
        moveset: { fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["FOUL_PLAY"] } },
    };
    const migrated = inventoryPokemonSchema.parse(legacy);
    expect(migrated).toEqual({ ...legacy, schemaVersion: 2, currentBuild: { ...legacy.currentBuild, megaLevel: 4 } });
    expect(inventoryPokemonSchema.parse(migrated)).toEqual(migrated);
    expect(inventoryPokemonSchema.safeParse({ ...legacy, schemaVersion: 99 }).success).toBe(false);
    expect(inventoryPokemonSchema.safeParse({ ...legacy, currentBuild: { ...legacy.currentBuild, megaLevel: 2 } }).success).toBe(false);
    for (const version of [1, 2, 3]) {
      const restored = inspectTeamLabBackup(JSON.stringify({ format: "teamlab-backup", schemaVersion: version,
        exportedAt: current.createdAt, inventory: [legacy], ...(version > 1 ? { savedTeams: [] } : {}),
        ...(version === 3 ? { recommendationHistory: [] } : {}),
      }), catalog);
      expect(restored.success, `backup v${version}`).toBe(true);
      if (restored.success) expect(restored.backup.inventory).toEqual([migrated]);
    }
  });

  it("keeps historical migration defaults pinned and caps non-Super builds independently", () => {
    expect(LEGACY_MEGA_LEVELS).toEqual(Object.fromEntries(gameMaster.pokemon
      .filter(pokemon => pokemon.tags?.includes("mega"))
      .map(pokemon => [pokemon.speciesId, pokemon.tags?.includes("supermega") ? 4 : 3])));
    const cp = calculateCombatPower(sableye.baseStats, ivs, 52);
    expect(inferCombatPowerLevel(sableye, ivs, cp, 4).matches.map(match => match.level)).toEqual([52]);
    expect(inferCombatPowerLevel(sableye, ivs, cp, 3).status).toBe("no-match");
  });
});
