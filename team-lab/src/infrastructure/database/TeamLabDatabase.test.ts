import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

const databaseNames: string[] = [];

afterEach(async () => {
  for (const databaseName of databaseNames.splice(0)) {
    const database = new TeamLabDatabase(databaseName, {
      indexedDB,
      IDBKeyRange,
    });
    await database.delete();
  }
});

describe("TeamLabDatabase migrations", () => {
  it("adds saved teams without changing version-one inventory", async () => {
    const databaseName = `team-lab-migration-test-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const legacyDatabase = new Dexie(databaseName, {
      indexedDB,
      IDBKeyRange,
    });
    legacyDatabase.version(1).stores({
      inventory:
        "&inventoryId, buildStatus, speciesId, favorite, createdAt, updatedAt",
    });
    const record = createInventoryPokemon(
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
        createId: () => "78ce2157-a008-49a1-bbcc-563998b76800",
        now: () => new Date("2026-07-25T12:00:00.000Z"),
      },
    );

    await legacyDatabase.table("inventory").add(record);
    legacyDatabase.close();

    const upgradedDatabase = new TeamLabDatabase(databaseName, {
      indexedDB,
      IDBKeyRange,
    });
    await upgradedDatabase.open();

    expect(await upgradedDatabase.inventory.toArray()).toEqual([record]);
    expect(await upgradedDatabase.savedTeams.count()).toBe(0);
    upgradedDatabase.close();
  });
});
