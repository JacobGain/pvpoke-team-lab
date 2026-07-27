import { describe, expect, it } from "vitest";

import {
  createInventoryBackup,
  inspectInventoryBackup,
  serializeInventoryBackup,
} from "@/domain/inventory/backup";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";

function createRecord(inventoryId = "78ce2157-a008-49a1-bbcc-563998b76800") {
  return createInventoryPokemon(
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
      createId: () => inventoryId,
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

describe("inventory backup", () => {
  it("round-trips a versioned backup through JSON and catalog validation", () => {
    const record = createRecord();
    const backup = createInventoryBackup(
      [record],
      () => new Date("2026-07-25T13:00:00.000Z"),
    );
    const inspection = inspectInventoryBackup(
      serializeInventoryBackup(backup),
      inventoryTestCatalog,
    );

    expect(inspection).toEqual({
      success: true,
      backup: {
        format: "teamlab-backup",
        schemaVersion: 1,
        exportedAt: "2026-07-25T13:00:00.000Z",
        inventory: [record],
      },
    });
  });

  it("reports invalid JSON and unsupported envelopes without records", () => {
    expect(inspectInventoryBackup("{", inventoryTestCatalog)).toMatchObject({
      success: false,
      envelopeError: "The selected file is not valid JSON.",
      issues: [],
    });
    expect(
      inspectInventoryBackup(
        JSON.stringify({ format: "something-else" }),
        inventoryTestCatalog,
      ),
    ).toMatchObject({
      success: false,
      envelopeError:
        "The file is not a supported TeamLab backup envelope or version.",
      issues: [],
    });
  });

  it("reports every invalid record and duplicate ID without partial success", () => {
    const record = createRecord();
    const source = JSON.stringify({
      format: "teamlab-backup",
      schemaVersion: 1,
      exportedAt: "2026-07-25T13:00:00.000Z",
      inventory: [
        record,
        { ...record, inventoryId: "not-a-uuid" },
        record,
        { ...record, inventoryId: crypto.randomUUID(), speciesId: "missing" },
      ],
    });
    const inspection = inspectInventoryBackup(source, inventoryTestCatalog);

    expect(inspection.success).toBe(false);
    if (!inspection.success) {
      expect(inspection.issues.map((issue) => issue.kind)).toEqual([
        "record-schema",
        "duplicate-id",
        "catalog-reference",
      ]);
      expect(inspection.recordCount).toBe(4);
    }
  });
});
