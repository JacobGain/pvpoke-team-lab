import { describe, expect, it } from "vitest";

import {
  createInventoryPokemon,
  updateInventoryPokemon,
} from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import { InventoryCatalogValidationError } from "@/domain/inventory/validation";

const fixedDate = new Date("2026-07-24T12:00:00.000Z");
const fixedId = "78ce2157-a008-49a1-bbcc-563998b76800";

describe("createInventoryPokemon", () => {
  it("materializes an explicit rank-one assumption from the catalog", () => {
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
        createId: () => fixedId,
        now: () => fixedDate,
      },
    );

    expect(record).toMatchObject({
      schemaVersion: 1,
      inventoryId: fixedId,
      buildStatus: "current",
      sourceDataVersion: "test-data-v1",
      createdAt: fixedDate.toISOString(),
      updatedAt: fixedDate.toISOString(),
      currentBuild: {
        ivProfile: {
          source: "assumed-rank-1",
          ivs: { attack: 0, defense: 15, hp: 15 },
        },
      },
    });
  });

  it("rejects a move that does not belong to the selected species", () => {
    expect(() =>
      createInventoryPokemon(
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
              fastMoveId: "COUNTER",
              chargedMoveIds: ["ICE_BEAM"],
            },
          },
        },
        {
          catalog: inventoryTestCatalog,
          createId: () => fixedId,
          now: () => fixedDate,
        },
      ),
    ).toThrow(InventoryCatalogValidationError);
  });

  it("rejects a CP that cannot be produced by the selected IV spread", () => {
    expect(() =>
      createInventoryPokemon(
        {
          buildStatus: "current",
          speciesId: "azumarill",
          currentBuild: {
            cp: 1498,
            ivProfile: {
              source: "user-entered",
              ivs: { attack: 0, defense: 15, hp: 15 },
            },
            moveset: {
              fastMoveId: "BUBBLE",
              chargedMoveIds: ["ICE_BEAM"],
            },
          },
        },
        {
          catalog: inventoryTestCatalog,
          createId: () => fixedId,
          now: () => fixedDate,
        },
      ),
    ).toThrow(/cannot be produced/);
  });

  it("updates user fields while preserving specimen identity and creation time", () => {
    const original = createInventoryPokemon(
      {
        buildStatus: "current",
        speciesId: "azumarill",
        currentBuild: {
          cp: 1499,
          ivProfile: { source: "assumed-rank-1" },
          moveset: {
            fastMoveId: "BUBBLE",
            chargedMoveIds: ["ICE_BEAM"],
          },
        },
      },
      {
        catalog: inventoryTestCatalog,
        createId: () => fixedId,
        now: () => fixedDate,
      },
    );
    const updated = updateInventoryPokemon(
      original,
      {
        buildStatus: "planned",
        speciesId: "azumarill",
        favorite: true,
        notes: "Build a second charged move.",
        currentBuild: {
          cp: 1499,
          ivProfile: { source: "assumed-rank-1" },
          moveset: {
            fastMoveId: "BUBBLE",
            chargedMoveIds: ["ICE_BEAM"],
          },
        },
        plannedBuild: {
          targetSpeciesId: "azumarill",
          targetCp: 1499,
          desiredMoveset: {
            fastMoveId: "BUBBLE",
            chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
          },
        },
      },
      {
        catalog: inventoryTestCatalog,
        now: () => new Date("2026-07-24T13:00:00.000Z"),
      },
    );

    expect(updated).toMatchObject({
      inventoryId: original.inventoryId,
      createdAt: original.createdAt,
      updatedAt: "2026-07-24T13:00:00.000Z",
      buildStatus: "planned",
      favorite: true,
    });
  });
});
