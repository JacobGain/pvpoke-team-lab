import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { filterAndSortInventory } from "@/features/inventory/inventoryView";

const fixedDate = new Date("2026-09-08T12:00:00.000Z");

function createRecord(
  inventoryId: string,
  source: "assumed-rank-1" | "user-entered",
) {
  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId: "azumarill",
      currentBuild: {
        cp: 1499,
        ivProfile:
          source === "assumed-rank-1"
            ? { source }
            : { source, ivs: { attack: 0, defense: 15, hp: 15 } },
        moveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => inventoryId,
      now: () => fixedDate,
    },
  );
}

describe("inventory view filters", () => {
  it("shows only records that use assumed rank-one IVs when requested", () => {
    const assumed = createRecord(
      "78ce2157-a008-49a1-bbcc-563998b76800",
      "assumed-rank-1",
    );
    const exact = createRecord(
      "78ce2157-a008-49a1-bbcc-563998b76801",
      "user-entered",
    );

    expect(
      filterAndSortInventory([exact, assumed], inventoryTestCatalog, {
        search: "",
        status: "all",
        favoriteOnly: false,
        assumedIvsOnly: true,
        sort: "updated",
      }),
    ).toEqual([assumed]);
  });
});
