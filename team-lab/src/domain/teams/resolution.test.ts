import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { createSavedTeam } from "@/domain/teams/factory";
import { resolveSavedTeam } from "@/domain/teams/resolution";

const ids = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
};

function createInventory() {
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

describe("saved-team resolution", () => {
  it("preserves order while resolving live inventory and catalog records", () => {
    const inventory = createInventory();
    const team = createSavedTeam(
      {
        name: "Resolved",
        members: {
          leadInventoryId: ids.whiscash,
          switchInventoryId: ids.azumarill,
          closerInventoryId: ids.altaria,
        },
      },
      {
        inventory,
        catalog: inventoryTestCatalog,
        createId: () => "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
      },
    );
    const resolved = resolveSavedTeam(
      team,
      inventory,
      inventoryTestCatalog.entries,
    );

    expect(resolved.isComplete).toBe(true);
    expect(
      resolved.members.map((member) =>
        member.status === "resolved"
          ? [member.position, member.pokemon.speciesId]
          : [member.position, member.status],
      ),
    ).toEqual([
      ["lead", "whiscash"],
      ["switch", "azumarill"],
      ["closer", "altaria"],
    ]);
  });

  it("retains a missing-member recovery state after inventory deletion", () => {
    const inventory = createInventory();
    const team = createSavedTeam(
      {
        name: "Missing",
        members: {
          leadInventoryId: ids.azumarill,
          switchInventoryId: ids.altaria,
          closerInventoryId: ids.whiscash,
        },
      },
      {
        inventory,
        catalog: inventoryTestCatalog,
        createId: () => "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
      },
    );
    const resolved = resolveSavedTeam(
      team,
      inventory.filter((record) => record.inventoryId !== ids.altaria),
      inventoryTestCatalog.entries,
    );

    expect(resolved.isComplete).toBe(false);
    expect(resolved.members[1]).toEqual({
      position: "switch",
      inventoryId: ids.altaria,
      status: "missing-inventory",
    });
  });
});
