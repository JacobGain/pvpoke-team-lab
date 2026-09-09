import { describe, expect, it } from "vitest";

import {
  createBulkInventoryRecords,
  previewBulkInventory,
} from "@/domain/inventory/bulkAdd";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

describe("bulk inventory", () => {
  it("matches names and PvPoke IDs while preserving duplicates", () => {
    const preview = previewBulkInventory(
      "Azumarill\naltaria; Azumarill\nMissingno",
      inventoryTestCatalog,
    );

    expect(preview.matches.map(({ pokemon }) => pokemon.speciesId)).toEqual([
      "azumarill",
      "altaria",
      "azumarill",
    ]);
    expect(preview.issues).toEqual([
      expect.objectContaining({ input: "Missingno" }),
    ]);
  });

  it("creates current builds from catalog IV and move defaults", () => {
    const preview = previewBulkInventory("Azumarill", inventoryTestCatalog);
    const [record] = createBulkInventoryRecords(
      preview.matches,
      inventoryTestCatalog,
    );

    expect(record).toMatchObject({
      speciesId: "azumarill",
      buildStatus: "current",
      currentBuild: {
        ivProfile: { source: "assumed-rank-1" },
      },
    });
    expect(record?.currentBuild.moveset.fastMoveId).toBeTruthy();
    expect(record?.currentBuild.moveset.chargedMoveIds.length).toBeGreaterThan(0);
  });
});
