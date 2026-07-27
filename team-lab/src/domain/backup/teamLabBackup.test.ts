import { describe, expect, it } from "vitest";

import {
  createTeamLabBackup,
  inspectTeamLabBackup,
  serializeTeamLabBackup,
} from "@/domain/backup/teamLabBackup";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { createSavedTeam } from "@/domain/teams/factory";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  team: "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
  secondTeam: "2f444983-5d03-4e33-97ba-bd80f0b126f8",
  missing: "64db44ca-aa7f-46ad-8880-9292a0140e92",
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

function savedTeam(records = inventory()) {
  return createSavedTeam(
    {
      name: "Full backup team",
      members: {
        leadInventoryId: ids.azumarill,
        switchInventoryId: ids.altaria,
        closerInventoryId: ids.whiscash,
      },
    },
    {
      inventory: records,
      catalog: inventoryTestCatalog,
      createId: () => ids.team,
      now: () => new Date("2026-07-25T13:00:00.000Z"),
    },
  );
}

describe("TeamLab full-data backup", () => {
  it("round-trips inventory and saved teams through schema version two", () => {
    const records = inventory();
    const team = savedTeam(records);
    const backup = createTeamLabBackup(
      records,
      [team],
      inventoryTestCatalog,
      () => new Date("2026-07-25T14:00:00.000Z"),
    );
    const inspection = inspectTeamLabBackup(
      serializeTeamLabBackup(backup),
      inventoryTestCatalog,
    );

    expect(inspection).toEqual({
      success: true,
      backup: {
        sourceSchemaVersion: 2,
        exportedAt: "2026-07-25T14:00:00.000Z",
        inventory: records,
        savedTeams: [team],
      },
    });
  });

  it("refuses to create a backup with an unrestorable saved team", () => {
    const records = inventory();
    const team = savedTeam(records);

    expect(() =>
      createTeamLabBackup(
        records.slice(0, 2),
        [team],
        inventoryTestCatalog,
      ),
    ).toThrow("does not exist");
  });

  it("accepts legacy version-one inventory backups without inventing teams", () => {
    const records = inventory();
    const inspection = inspectTeamLabBackup(
      JSON.stringify({
        format: "teamlab-backup",
        schemaVersion: 1,
        exportedAt: "2026-07-25T14:00:00.000Z",
        inventory: records,
      }),
      inventoryTestCatalog,
    );

    expect(inspection).toMatchObject({
      success: true,
      backup: {
        sourceSchemaVersion: 1,
        inventory: records,
        savedTeams: [],
      },
    });
  });

  it("collects team schema, duplicate-ID, and legality failures", () => {
    const records = inventory();
    const team = savedTeam(records);
    const inspection = inspectTeamLabBackup(
      JSON.stringify({
        format: "teamlab-backup",
        schemaVersion: 2,
        exportedAt: "2026-07-25T14:00:00.000Z",
        inventory: records,
        savedTeams: [
          team,
          { ...team, teamId: "not-a-uuid" },
          team,
          {
            ...team,
            teamId: ids.secondTeam,
            members: {
              ...team.members,
              closerInventoryId: ids.missing,
            },
          },
        ],
      }),
      inventoryTestCatalog,
    );

    expect(inspection.success).toBe(false);
    if (!inspection.success) {
      expect(inspection.issues.map((issue) => issue.kind)).toEqual([
        "record-schema",
        "duplicate-id",
        "saved-team-legality",
      ]);
      expect(inspection.inventoryCount).toBe(3);
      expect(inspection.savedTeamCount).toBe(4);
    }
  });
});
