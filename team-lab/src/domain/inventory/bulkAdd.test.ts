import { describe, expect, it } from "vitest";

import {
  bulkInventoryInputRangeAt,
  completeBulkInventoryInput,
  createBulkInventoryRecords,
  previewBulkInventory,
  suggestBulkInventoryPokemon,
} from "@/domain/inventory/bulkAdd";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

describe("bulk inventory", () => {
  it("suggests forms from partial friendly names and PvPoke IDs", () => {
    const zacianHero = {
      ...inventoryTestCatalog.entries[0]!,
      speciesId: "zacian_hero",
      speciesName: "Zacian (Hero)",
    };
    const catalog = {
      ...inventoryTestCatalog,
      entries: [...inventoryTestCatalog.entries, zacianHero],
    };

    expect(suggestBulkInventoryPokemon("zacian", catalog)[0]).toBe(zacianHero);
    expect(suggestBulkInventoryPokemon("zacian hero", catalog)[0]).toBe(
      zacianHero,
    );
    expect(suggestBulkInventoryPokemon("zacian_hero", catalog)[0]).toBe(
      zacianHero,
    );
  });

  it("completes only the entry around the caret", () => {
    const source = "Azumarill\nzacian he; Altaria";
    const range = bulkInventoryInputRangeAt(source, source.indexOf("he") + 2);

    expect(range.query).toBe("zacian he");
    expect(
      completeBulkInventoryInput(source, range, "Zacian (Hero)"),
    ).toEqual({
      source: "Azumarill\nZacian (Hero); Altaria",
      caret: 23,
    });
  });

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
