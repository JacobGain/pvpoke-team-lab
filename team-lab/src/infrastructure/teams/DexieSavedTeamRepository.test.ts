import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InvalidStoredSavedTeamError,
  SavedTeamAlreadyExistsError,
  SavedTeamNotFoundError,
} from "@/domain/teams/repository";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  savedTeamSchema,
  type SavedTeam,
} from "@/domain/teams/schemas";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieSavedTeamRepository } from "@/infrastructure/teams/DexieSavedTeamRepository";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { getSavedTeamInventoryIds } from "@/domain/teams/schemas";

const teamId = "75a53aca-f3d7-476b-a14e-5559c8a7c4bb";
let database: TeamLabDatabase;
let repository: DexieSavedTeamRepository;

function createTeam(): SavedTeam {
  return savedTeamSchema.parse({
    schemaVersion: SAVED_TEAM_SCHEMA_VERSION,
    teamId,
    name: "Waterline",
    formatId: "great-league",
    members: {
      leadInventoryId: "78ce2157-a008-49a1-bbcc-563998b76800",
      switchInventoryId: "fd17fe2f-1d87-4879-8850-d95476cd9070",
      closerInventoryId: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
    },
    notes: "",
    createdAt: "2026-07-25T14:00:00.000Z",
    updatedAt: "2026-07-25T14:00:00.000Z",
  });
}

beforeEach(() => {
  database = new TeamLabDatabase(`team-lab-team-test-${crypto.randomUUID()}`, {
    indexedDB,
    IDBKeyRange,
  });
  repository = new DexieSavedTeamRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe("DexieSavedTeamRepository", () => {
  it("records completed analysis only for an unchanged team and inventory snapshot", async () => {
    const team = createTeam();
    const inventory = getSavedTeamInventoryIds(team.members).map(inventoryId => createInventoryPokemon({
      buildStatus: "current", speciesId: "azumarill",
      currentBuild: { cp: 1499, ivProfile: { source: "assumed-rank-1" }, moveset: { fastMoveId: "BUBBLE", chargedMoveIds: ["ICE_BEAM"] } },
    }, { catalog: inventoryTestCatalog, createId: () => inventoryId, now: () => new Date(team.createdAt) }));
    await repository.create(team);
    await database.inventory.bulkAdd(inventory);
    await database.inventory.update(inventory[0]!.inventoryId, { notes: "Edited during simulation" });
    expect(await repository.recordAnalysis(team, inventory, "new-data", "a".repeat(40))).toBe(false);
    expect((await repository.get(teamId))?.lastAnalyzedDataVersion).toBeUndefined();
    await database.inventory.put(inventory[0]!);
    await repository.update({ ...team, name: "Edited during simulation" });
    expect(await repository.recordAnalysis(team, inventory, "new-data", "a".repeat(40))).toBe(false);
    await repository.update(team);
    expect(await repository.recordAnalysis(team, inventory, "new-data", "a".repeat(40))).toBe(true);
    expect((await repository.get(teamId))?.lastAnalyzedDataVersion).toBe("new-data");
    await repository.delete(teamId);
    expect(await repository.recordAnalysis(team, inventory, "new-data", "a".repeat(40))).toBe(false);
  });

  it("creates, reads, updates, lists, counts, and deletes a team", async () => {
    const team = createTeam();
    await repository.create(team);

    expect(await repository.count()).toBe(1);
    expect(await repository.get(teamId)).toEqual(team);
    expect(await repository.list()).toEqual([team]);

    const updated = savedTeamSchema.parse({
      ...team,
      name: "Updated",
      updatedAt: "2026-07-25T15:00:00.000Z",
    });
    await repository.update(updated);
    expect(await repository.get(teamId)).toEqual(updated);

    await repository.delete(teamId);
    expect(await repository.count()).toBe(0);
  });

  it("distinguishes duplicate creates and missing mutations", async () => {
    const team = createTeam();
    await repository.create(team);

    await expect(repository.create(team)).rejects.toBeInstanceOf(
      SavedTeamAlreadyExistsError,
    );
    await expect(
      repository.update({ ...team, teamId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(SavedTeamNotFoundError);
    await expect(
      repository.delete(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(SavedTeamNotFoundError);
  });

  it("reports invalid stored teams without deleting them", async () => {
    await database.savedTeams.put({
      ...createTeam(),
      schemaVersion: 999,
    } as never);

    await expect(repository.get(teamId)).rejects.toBeInstanceOf(
      InvalidStoredSavedTeamError,
    );
    expect(await database.savedTeams.count()).toBe(1);
  });
});
