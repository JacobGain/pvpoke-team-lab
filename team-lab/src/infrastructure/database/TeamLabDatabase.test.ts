import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryPokemonSchema } from "@/domain/inventory/schemas";
import { savedTeamSchema } from "@/domain/teams/schemas";
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
  it.each([1, 2, 3, 4])("atomically upgrades real legacy inventory from database v%i and preserves references", async version => {
    const name = `super-mega-migration-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
    legacy.version(version).stores({
      inventory: "&inventoryId, updatedAt", savedTeams: "&teamId, updatedAt",
      recommendationHistory: "&historyId, createdAt, formatId, dataVersion",
    });
    const record = {
      schemaVersion: 1, inventoryId: crypto.randomUUID(), speciesId: "sableye_mega",
      buildStatus: "current", favorite: true, notes: "Keep my original CP",
      sourceDataVersion: "legacy", createdAt: "2026-11-09T12:00:00.000Z", updatedAt: "2026-11-10T12:00:00.000Z",
      currentBuild: { cp: 2400, ivProfile: { source: "user-entered", ivs: { attack: 15, defense: 15, hp: 15 } },
        moveset: { fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["FOUL_PLAY"] } },
    };
    const team = { schemaVersion: 1, teamId: crypto.randomUUID(), formatId: "mega-great-league", name: "Legacy team", notes: "Keep references",
      members: { leadInventoryId: record.inventoryId, switchInventoryId: crypto.randomUUID(), closerInventoryId: crypto.randomUUID() },
      createdAt: record.createdAt, updatedAt: record.updatedAt };
    await legacy.table("inventory").add(record);
    if (version > 1) await legacy.table("savedTeams").add(team);
    legacy.close();
    const upgraded = new TeamLabDatabase(name, { indexedDB, IDBKeyRange });
    await upgraded.open();
    expect(await upgraded.inventory.get(record.inventoryId)).toEqual(inventoryPokemonSchema.parse(record));
    expect(await upgraded.savedTeams.toArray()).toEqual(version > 1 ? [savedTeamSchema.parse(team)] : []);
    upgraded.close();
    const reopened = new TeamLabDatabase(name, { indexedDB, IDBKeyRange });
    expect(await reopened.inventory.get(record.inventoryId)).toEqual(inventoryPokemonSchema.parse(record));
    reopened.close();
    const olderApp = new Dexie(name, { indexedDB, IDBKeyRange });
    olderApp.version(4).stores({ inventory: "&inventoryId, updatedAt", savedTeams: "&teamId, updatedAt", recommendationHistory: "&historyId, createdAt, formatId, dataVersion" });
    await olderApp.open();
    // Dexie tolerates the older declaration because table/index shapes match;
    // it does not downgrade the native database or its new record schemas.
    expect(olderApp.backendDB().version).toBe(50);
    const stored = await olderApp.table<{ schemaVersion: number }>("inventory").get(record.inventoryId);
    expect(z.literal(1).safeParse(stored?.schemaVersion).success).toBe(false);
    olderApp.close();
    const recovered = new TeamLabDatabase(name, { indexedDB, IDBKeyRange });
    expect(await recovered.inventory.get(record.inventoryId)).toEqual(inventoryPokemonSchema.parse(record));
    recovered.close();
  });

  it("rolls back the complete upgrade if an unsupported inventory record is encountered", async () => {
    const name = `super-mega-rollback-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
    legacy.version(4).stores({ inventory: "&inventoryId, updatedAt", savedTeams: "&teamId, updatedAt", recommendationHistory: "&historyId, createdAt, formatId, dataVersion" });
    const records = [{ schemaVersion: 99, inventoryId: "future", updatedAt: "2026-11-10T12:00:00.000Z" }];
    await legacy.table("inventory").bulkAdd(records);
    legacy.close();
    const upgraded = new TeamLabDatabase(name, { indexedDB, IDBKeyRange });
    await expect(upgraded.open()).rejects.toThrow();
    upgraded.close();
    await legacy.open();
    expect(legacy.verno).toBe(4);
    expect(await legacy.table("inventory").toArray()).toEqual(records);
    legacy.close();
  });

  it("also rolls back already-normalized inventory when a saved-team migration fails", async () => {
    const name = `team-migration-rollback-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
    legacy.version(4).stores({ inventory: "&inventoryId, updatedAt", savedTeams: "&teamId, updatedAt", recommendationHistory: "&historyId, createdAt, formatId, dataVersion" });
    const current = createInventoryPokemon({ buildStatus: "current", speciesId: "azumarill", currentBuild: {
      cp: 1499, ivProfile: { source: "assumed-rank-1" }, moveset: { fastMoveId: "BUBBLE", chargedMoveIds: ["ICE_BEAM"] },
    } }, { catalog: inventoryTestCatalog });
    const record = { ...current, schemaVersion: 1 };
    const unsupported = { teamId: crypto.randomUUID(), schemaVersion: 99, updatedAt: current.updatedAt };
    await legacy.table("inventory").add(record);
    await legacy.table("savedTeams").add(unsupported);
    legacy.close();
    const upgrade = new TeamLabDatabase(name, { indexedDB, IDBKeyRange });
    await expect(upgrade.open()).rejects.toThrow();
    upgrade.close();
    await legacy.open();
    expect(legacy.backendDB().version).toBe(40);
    expect(await legacy.table("inventory").toArray()).toEqual([record]);
    expect(await legacy.table("savedTeams").toArray()).toEqual([unsupported]);
    legacy.close();
  });

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
    expect(
      upgradedDatabase.inventory.schema.indexes.map((index) => index.name),
    ).toEqual(["updatedAt"]);
    expect(
      upgradedDatabase.savedTeams.schema.indexes.map((index) => index.name),
    ).toEqual(["updatedAt"]);
    upgradedDatabase.close();
  });
});
