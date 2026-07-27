import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  TeamLabRestoreValidationError,
  type TeamLabRestoreData,
} from "@/domain/backup/teamLabBackup";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { createSavedTeam } from "@/domain/teams/factory";
import type { SavedTeam } from "@/domain/teams/schemas";
import { DexieTeamLabBackupRepository } from "@/infrastructure/backup/DexieTeamLabBackupRepository";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  extra: "64db44ca-aa7f-46ad-8880-9292a0140e92",
  team: "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
  extraTeam: "2f444983-5d03-4e33-97ba-bd80f0b126f8",
};

const builds = {
  azumarill: {
    cp: 1499,
    fastMoveId: "BUBBLE",
    chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
  },
  altaria: {
    cp: 1497,
    fastMoveId: "DRAGON_BREATH",
    chargedMoveIds: ["SKY_ATTACK", "MOONBLAST"],
  },
  whiscash: {
    cp: 1495,
    fastMoveId: "MUD_SHOT",
    chargedMoveIds: ["SCALD", "BLIZZARD"],
  },
} as const;

let database: TeamLabDatabase;
let repository: DexieTeamLabBackupRepository;

function inventory(): readonly InventoryPokemon[] {
  return (
    Object.entries(builds) as readonly [
      keyof typeof builds,
      (typeof builds)[keyof typeof builds],
    ][]
  ).map(([speciesId, build]) =>
    createInventoryPokemon(
      {
        buildStatus: "current",
        speciesId,
        currentBuild: {
          cp: build.cp,
          ivProfile: { source: "assumed-rank-1" },
          moveset: {
            fastMoveId: build.fastMoveId,
            chargedMoveIds: [...build.chargedMoveIds],
          },
        },
      },
      {
        catalog: inventoryTestCatalog,
        createId: () => ids[speciesId],
        now: () => new Date("2026-07-25T12:00:00.000Z"),
      },
    ),
  );
}

function team(
  records: readonly InventoryPokemon[],
  teamId = ids.team,
): SavedTeam {
  return createSavedTeam(
    {
      name: "Restore team",
      members: {
        leadInventoryId: ids.azumarill,
        switchInventoryId: ids.altaria,
        closerInventoryId: ids.whiscash,
      },
    },
    {
      inventory: records,
      catalog: inventoryTestCatalog,
      createId: () => teamId,
      now: () => new Date("2026-07-25T13:00:00.000Z"),
    },
  );
}

function restoreData(
  records: readonly InventoryPokemon[],
  savedTeams: readonly SavedTeam[],
  sourceSchemaVersion: 1 | 2 = 2,
): TeamLabRestoreData {
  return {
    sourceSchemaVersion,
    exportedAt: "2026-07-25T14:00:00.000Z",
    inventory: records,
    savedTeams,
  };
}

beforeEach(() => {
  database = new TeamLabDatabase(`team-lab-backup-${crypto.randomUUID()}`, {
    indexedDB,
    IDBKeyRange,
  });
  repository = new DexieTeamLabBackupRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe("DexieTeamLabBackupRepository", () => {
  it("atomically merges both collections with incoming IDs winning", async () => {
    const records = inventory();
    const existingTeam = team(records);
    await database.inventory.bulkAdd(records);
    await database.savedTeams.add(existingTeam);
    const updatedAzumarill = { ...records[0]!, favorite: true };
    const updatedTeam = { ...existingTeam, name: "Incoming name" };

    await expect(
      repository.restore(
        restoreData([updatedAzumarill], [updatedTeam]),
        "merge",
        inventoryTestCatalog,
      ),
    ).resolves.toEqual({
      mode: "merge",
      sourceSchemaVersion: 2,
      inventory: {
        incoming: 1,
        inserted: 0,
        updated: 1,
        removed: 0,
        finalCount: 3,
      },
      savedTeams: {
        incoming: 1,
        inserted: 0,
        updated: 1,
        removed: 0,
        finalCount: 1,
      },
    });
    expect(await database.inventory.get(ids.azumarill)).toEqual(
      updatedAzumarill,
    );
    expect(await database.savedTeams.get(ids.team)).toEqual(updatedTeam);
  });

  it("replaces both collections and removes data absent from the backup", async () => {
    const records = inventory();
    const extraRecord = { ...records[0]!, inventoryId: ids.extra };
    await database.inventory.bulkAdd([...records, extraRecord]);
    await database.savedTeams.bulkAdd([
      team(records),
      team(records, ids.extraTeam),
    ]);

    const result = await repository.restore(
      restoreData(records, [team(records)]),
      "replace",
      inventoryTestCatalog,
    );

    expect(result.inventory).toMatchObject({
      incoming: 3,
      updated: 3,
      removed: 1,
      finalCount: 3,
    });
    expect(result.savedTeams).toMatchObject({
      incoming: 1,
      updated: 1,
      removed: 1,
      finalCount: 1,
    });
    expect(await database.inventory.get(ids.extra)).toBeUndefined();
    expect(await database.savedTeams.get(ids.extraTeam)).toBeUndefined();
  });

  it("rolls back both collections when a merge would invalidate a team", async () => {
    const records = inventory();
    const existingTeam = team(records);
    await database.inventory.bulkAdd(records);
    await database.savedTeams.add(existingTeam);
    const conflictingAltaria = {
      ...records[0]!,
      inventoryId: ids.altaria,
    };

    await expect(
      repository.restore(
        restoreData([conflictingAltaria], []),
        "merge",
        inventoryTestCatalog,
      ),
    ).rejects.toBeInstanceOf(TeamLabRestoreValidationError);
    expect(await database.inventory.get(ids.altaria)).toEqual(records[1]);
    expect(await database.savedTeams.toArray()).toEqual([existingTeam]);
  });

  it("treats legacy replace as an inventory-only authoritative snapshot", async () => {
    const records = inventory();
    await database.inventory.bulkAdd(records);
    await database.savedTeams.add(team(records));

    const result = await repository.restore(
      restoreData([records[0]!], [], 1),
      "replace",
      inventoryTestCatalog,
    );

    expect(result.sourceSchemaVersion).toBe(1);
    expect(result.inventory.finalCount).toBe(1);
    expect(result.savedTeams).toMatchObject({
      incoming: 0,
      removed: 1,
      finalCount: 0,
    });
    expect(await database.savedTeams.count()).toBe(0);
  });
});
