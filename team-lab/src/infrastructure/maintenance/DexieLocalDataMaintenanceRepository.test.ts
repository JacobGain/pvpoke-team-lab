import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { InventoryClearBlockedBySavedTeamsError } from "@/domain/maintenance/localDataMaintenance";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  savedTeamSchema,
} from "@/domain/teams/schemas";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieLocalDataMaintenanceRepository } from "@/infrastructure/maintenance/DexieLocalDataMaintenanceRepository";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  team: "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
};

let database: TeamLabDatabase;
let repository: DexieLocalDataMaintenanceRepository;

const inventoryRecord = createInventoryPokemon(
  {
    buildStatus: "current",
    speciesId: "azumarill",
    currentBuild: {
      cp: 1499,
      ivProfile: { source: "assumed-rank-1" },
      moveset: {
        fastMoveId: "BUBBLE",
        chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
      },
    },
  },
  {
    catalog: inventoryTestCatalog,
    createId: () => ids.azumarill,
    now: () => new Date("2026-07-25T12:00:00.000Z"),
  },
);

const savedTeam = savedTeamSchema.parse({
  schemaVersion: SAVED_TEAM_SCHEMA_VERSION,
  teamId: ids.team,
  name: "Local team",
  formatId: "great-league",
  members: {
    leadInventoryId: ids.azumarill,
    switchInventoryId: ids.altaria,
    closerInventoryId: ids.whiscash,
  },
  notes: "",
  createdAt: "2026-07-25T13:00:00.000Z",
  updatedAt: "2026-07-25T13:00:00.000Z",
});

beforeEach(() => {
  database = new TeamLabDatabase(
    `team-lab-maintenance-${crypto.randomUUID()}`,
    {
      indexedDB,
      IDBKeyRange,
    },
  );
  repository = new DexieLocalDataMaintenanceRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe("DexieLocalDataMaintenanceRepository", () => {
  it("clears saved teams without changing inventory", async () => {
    await database.inventory.add(inventoryRecord);
    await database.savedTeams.add(savedTeam);

    await expect(repository.clearSavedTeams()).resolves.toEqual({
      removedInventoryCount: 0,
      removedSavedTeamCount: 1,
    });
    expect(await database.inventory.toArray()).toEqual([inventoryRecord]);
    expect(await database.savedTeams.count()).toBe(0);
  });

  it("clears inventory when no saved team can be orphaned", async () => {
    await database.inventory.add(inventoryRecord);

    await expect(repository.clearInventory()).resolves.toEqual({
      removedInventoryCount: 1,
      removedSavedTeamCount: 0,
    });
    expect(await database.inventory.count()).toBe(0);
  });

  it("blocks inventory clearing while saved teams exist", async () => {
    await database.inventory.add(inventoryRecord);
    await database.savedTeams.add(savedTeam);

    await expect(repository.clearInventory()).rejects.toBeInstanceOf(
      InventoryClearBlockedBySavedTeamsError,
    );
    expect(await database.inventory.toArray()).toEqual([inventoryRecord]);
    expect(await database.savedTeams.toArray()).toEqual([savedTeam]);
  });

  it("atomically resets inventory and saved teams together", async () => {
    await database.inventory.add(inventoryRecord);
    await database.savedTeams.add(savedTeam);

    await expect(repository.resetAll()).resolves.toEqual({
      removedInventoryCount: 1,
      removedSavedTeamCount: 1,
    });
    expect(await database.inventory.count()).toBe(0);
    expect(await database.savedTeams.count()).toBe(0);
  });
});
