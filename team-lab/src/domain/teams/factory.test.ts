import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  createSavedTeam,
  updateSavedTeam,
} from "@/domain/teams/factory";
import { SavedTeamLegalityError } from "@/domain/teams/validation";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
  duplicate: "64db44ca-aa7f-46ad-8880-9292a0140e92",
  team: "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
};

function inventory(): readonly InventoryPokemon[] {
  const azumarill = createInventoryPokemon(
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

  return [
    azumarill,
    { ...azumarill, inventoryId: ids.altaria, speciesId: "altaria" },
    { ...azumarill, inventoryId: ids.whiscash, speciesId: "whiscash" },
  ];
}

describe("saved-team factory and legality", () => {
  it("creates an ordered Great League team from three inventory references", () => {
    const team = createSavedTeam(
      {
        name: "  Waterline  ",
        members: {
          leadInventoryId: ids.azumarill,
          switchInventoryId: ids.altaria,
          closerInventoryId: ids.whiscash,
        },
        notes: "First legal team",
      },
      {
        inventory: inventory(),
        catalog: inventoryTestCatalog,
        createId: () => ids.team,
        now: () => new Date("2026-07-25T14:00:00.000Z"),
      },
    );

    expect(team).toMatchObject({
      schemaVersion: 1,
      teamId: ids.team,
      name: "Waterline",
      formatId: "great-league",
      members: {
        leadInventoryId: ids.azumarill,
        switchInventoryId: ids.altaria,
        closerInventoryId: ids.whiscash,
      },
      notes: "First legal team",
      createdAt: "2026-07-25T14:00:00.000Z",
      updatedAt: "2026-07-25T14:00:00.000Z",
    });
  });

  it("rejects missing inventory references", () => {
    expect(() =>
      createSavedTeam(
        {
          name: "Missing member",
          members: {
            leadInventoryId: ids.azumarill,
            switchInventoryId: ids.altaria,
            closerInventoryId: ids.duplicate,
          },
        },
        {
          inventory: inventory(),
          catalog: inventoryTestCatalog,
          createId: () => ids.team,
        },
      ),
    ).toThrow(SavedTeamLegalityError);
  });

  it("enforces species clause across separate owned specimens", () => {
    const records = [
      ...inventory(),
      { ...inventory()[0]!, inventoryId: ids.duplicate },
    ];

    expect(() =>
      createSavedTeam(
        {
          name: "Duplicate Azumarill",
          members: {
            leadInventoryId: ids.azumarill,
            switchInventoryId: ids.duplicate,
            closerInventoryId: ids.whiscash,
          },
        },
        {
          inventory: records,
          catalog: inventoryTestCatalog,
          createId: () => ids.team,
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            code: "species-clause",
            path: "members.switchInventoryId",
          }),
        ],
      }),
    );
  });

  it("preserves identity and clears stale analysis on update", () => {
    const records = inventory();
    const original = createSavedTeam(
      {
        name: "Original",
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
        now: () => new Date("2026-07-25T14:00:00.000Z"),
      },
    );
    const updated = updateSavedTeam(
      { ...original, lastAnalyzedDataVersion: "old-data" },
      {
        name: "Reordered",
        members: {
          leadInventoryId: ids.whiscash,
          switchInventoryId: ids.altaria,
          closerInventoryId: ids.azumarill,
        },
      },
      {
        inventory: records,
        catalog: inventoryTestCatalog,
        now: () => new Date("2026-07-25T15:00:00.000Z"),
      },
    );

    expect(updated.teamId).toBe(original.teamId);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe("2026-07-25T15:00:00.000Z");
    expect(updated.lastAnalyzedDataVersion).toBeUndefined();
  });
});
