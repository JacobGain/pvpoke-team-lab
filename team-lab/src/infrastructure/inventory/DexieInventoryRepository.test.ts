import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInventoryPokemon, touchInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import {
  InvalidStoredInventoryRecordError,
  InventoryRecordAlreadyExistsError,
  InventoryRecordNotFoundError,
} from "@/domain/inventory/repository";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieInventoryRepository } from "@/infrastructure/inventory/DexieInventoryRepository";

const inventoryId = "78ce2157-a008-49a1-bbcc-563998b76800";
let database: TeamLabDatabase;
let repository: DexieInventoryRepository;

function createRecord() {
  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId: "azumarill",
      currentBuild: {
        cp: 1499,
        ivProfile: {
          source: "user-entered",
          ivs: { attack: 0, defense: 15, hp: 15 },
        },
        moveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => inventoryId,
      now: () => new Date("2026-07-24T12:00:00.000Z"),
    },
  );
}

beforeEach(() => {
  database = new TeamLabDatabase(`team-lab-test-${crypto.randomUUID()}`, {
    indexedDB,
    IDBKeyRange,
  });
  repository = new DexieInventoryRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe("DexieInventoryRepository", () => {
  it("creates, reads, updates, lists, counts, and deletes a record", async () => {
    const record = createRecord();
    await repository.create(record);

    expect(await repository.count()).toBe(1);
    expect(await repository.get(inventoryId)).toEqual(record);
    expect(await repository.list()).toEqual([record]);

    const updated = touchInventoryPokemon(
      { ...record, favorite: true },
      () => new Date("2026-07-24T13:00:00.000Z"),
    );
    await repository.update(updated);
    expect(await repository.get(inventoryId)).toEqual(updated);

    await repository.delete(inventoryId);
    expect(await repository.count()).toBe(0);
  });

  it("distinguishes duplicate creates and missing mutations", async () => {
    const record = createRecord();
    await repository.create(record);

    await expect(repository.create(record)).rejects.toBeInstanceOf(
      InventoryRecordAlreadyExistsError,
    );
    await expect(
      repository.update({ ...record, inventoryId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
    await expect(
      repository.delete(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
  });

  it("surfaces unsupported stored data without deleting it", async () => {
    await database.inventory.put({
      ...createRecord(),
      schemaVersion: 999,
    } as never);

    await expect(repository.get(inventoryId)).rejects.toBeInstanceOf(
      InvalidStoredInventoryRecordError,
    );
    expect(await database.inventory.count()).toBe(1);
  });
});
