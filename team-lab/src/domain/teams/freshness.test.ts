import { describe, expect, it } from "vitest";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { createSavedTeam } from "./factory";
import { savedTeamSchema } from "./schemas";
import { isSavedTeamAnalysisCurrent, savedTeamBuildFingerprint } from "./freshness";

function fixture() {
  const inventory = inventoryTestCatalog.entries.map(pokemon => createInventoryPokemon({
    buildStatus: "current", speciesId: pokemon.speciesId,
    currentBuild: { cp: pokemon.speciesId === "azumarill" ? 1499 : pokemon.speciesId === "altaria" ? 1497 : 1495,
      ivProfile: { source: "assumed-rank-1" },
      moveset: { fastMoveId: pokemon.fastMoves[0]!.id, chargedMoveIds: [pokemon.chargedMoves[0]!.id] } },
  }, { catalog: inventoryTestCatalog }));
  const initial = createSavedTeam({ name: "Fingerprint", members: {
    leadInventoryId: inventory[0]!.inventoryId, switchInventoryId: inventory[1]!.inventoryId, closerInventoryId: inventory[2]!.inventoryId,
  } }, { inventory, catalog: inventoryTestCatalog });
  const team = { ...initial, lastAnalyzedDataVersion: inventoryTestCatalog.dataVersion, lastAnalyzedUpstreamCommit: "a".repeat(40),
    lastAnalyzedBuildFingerprint: savedTeamBuildFingerprint(initial, inventory) };
  return { inventory, team };
}

describe("exact saved-team freshness", () => {
  it("detects changed Mega settings even when an imported record preserves its timestamp", () => {
    const { inventory, team } = fixture();
    expect(isSavedTeamAnalysisCurrent(team, inventory, inventoryTestCatalog.dataVersion, "a".repeat(40))).toBe(true);
    for (const changed of [
      { ...inventory[0]!, currentBuild: { ...inventory[0]!.currentBuild, megaLevel: 2 as const } },
      { ...inventory[0]!, currentBuild: { ...inventory[0]!.currentBuild, moveset: { ...inventory[0]!.currentBuild.moveset, extraChargedMoveId: "EXTRA" } } },
      { ...inventory[0]!, megaSpeciesId: "CHANGED_FORM" },
    ]) {
      expect(changed.updatedAt).toBe(inventory[0]!.updatedAt);
      expect(isSavedTeamAnalysisCurrent(team, [changed, ...inventory.slice(1)], inventoryTestCatalog.dataVersion, "a".repeat(40))).toBe(false);
    }
  });

  it("migrates legacy references without claiming their old analysis covers new behavior", () => {
    const { team, inventory } = fixture();
    const { lastAnalyzedBuildFingerprint: _fingerprint, ...legacy } = team;
    expect(_fingerprint).toBeTruthy();
    const migrated = savedTeamSchema.parse({ ...legacy, schemaVersion: 1 });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.members).toEqual(team.members);
    expect(isSavedTeamAnalysisCurrent(migrated, inventory, inventoryTestCatalog.dataVersion, "a".repeat(40))).toBe(false);
    expect(savedTeamSchema.safeParse({ ...legacy, schemaVersion: 99 }).success).toBe(false);
    expect(savedTeamSchema.safeParse({ ...team, schemaVersion: 1 }).success).toBe(false);
  });
});
