import { z } from "zod";

import {
  inventoryPokemonSchema,
  type InventoryPokemon,
} from "@/domain/inventory/schemas";
import {
  validateInventoryPokemonAgainstCatalog,
  type InventoryValidationIssue,
} from "@/domain/inventory/validation";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

export const TEAM_LAB_BACKUP_FORMAT = "teamlab-backup" as const;
export const TEAM_LAB_BACKUP_SCHEMA_VERSION = 1 as const;

const backupEnvelopeSchema = z.object({
  format: z.literal(TEAM_LAB_BACKUP_FORMAT),
  schemaVersion: z.literal(TEAM_LAB_BACKUP_SCHEMA_VERSION),
  exportedAt: z.iso.datetime(),
  inventory: z.array(z.unknown()),
});

export interface InventoryBackup {
  readonly format: typeof TEAM_LAB_BACKUP_FORMAT;
  readonly schemaVersion: typeof TEAM_LAB_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly inventory: readonly InventoryPokemon[];
}

export interface InventoryBackupRecordIssue {
  readonly index: number;
  readonly inventoryId?: string;
  readonly kind: "record-schema" | "catalog-reference" | "duplicate-id";
  readonly message: string;
  readonly catalogIssues?: readonly InventoryValidationIssue[];
}

export type InventoryBackupInspection =
  | {
      readonly success: true;
      readonly backup: InventoryBackup;
    }
  | {
      readonly success: false;
      readonly envelopeError?: string;
      readonly exportedAt?: string;
      readonly recordCount?: number;
      readonly issues: readonly InventoryBackupRecordIssue[];
    };

export function createInventoryBackup(
  records: readonly InventoryPokemon[],
  now: () => Date = () => new Date(),
): InventoryBackup {
  return {
    format: TEAM_LAB_BACKUP_FORMAT,
    schemaVersion: TEAM_LAB_BACKUP_SCHEMA_VERSION,
    exportedAt: now().toISOString(),
    inventory: records.map((record) => inventoryPokemonSchema.parse(record)),
  };
}

export function serializeInventoryBackup(backup: InventoryBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function inspectInventoryBackup(
  source: string,
  catalog: PokemonCatalog,
): InventoryBackupInspection {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(source);
  } catch {
    return {
      success: false,
      envelopeError: "The selected file is not valid JSON.",
      issues: [],
    };
  }

  const envelopeResult = backupEnvelopeSchema.safeParse(parsedJson);

  if (!envelopeResult.success) {
    return {
      success: false,
      envelopeError:
        "The file is not a supported TeamLab backup envelope or version.",
      issues: [],
    };
  }

  const issues: InventoryBackupRecordIssue[] = [];
  const records: InventoryPokemon[] = [];
  const firstIndexById = new Map<string, number>();

  for (const [index, candidate] of envelopeResult.data.inventory.entries()) {
    const recordResult = inventoryPokemonSchema.safeParse(candidate);

    if (!recordResult.success) {
      const inventoryId =
        typeof candidate === "object" &&
        candidate !== null &&
        "inventoryId" in candidate &&
        typeof candidate.inventoryId === "string"
          ? candidate.inventoryId
          : undefined;

      issues.push({
        index,
        inventoryId,
        kind: "record-schema",
        message: recordResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      continue;
    }

    const record = recordResult.data;
    const firstIndex = firstIndexById.get(record.inventoryId);

    if (firstIndex !== undefined) {
      issues.push({
        index,
        inventoryId: record.inventoryId,
        kind: "duplicate-id",
        message: `Inventory ID duplicates record ${firstIndex + 1}.`,
      });
      continue;
    }

    firstIndexById.set(record.inventoryId, index);
    const catalogIssues = validateInventoryPokemonAgainstCatalog(
      record,
      catalog,
    );

    if (catalogIssues.length > 0) {
      issues.push({
        index,
        inventoryId: record.inventoryId,
        kind: "catalog-reference",
        message: catalogIssues.map((issue) => issue.message).join(" "),
        catalogIssues,
      });
      continue;
    }

    records.push(record);
  }

  if (issues.length > 0) {
    return {
      success: false,
      exportedAt: envelopeResult.data.exportedAt,
      recordCount: envelopeResult.data.inventory.length,
      issues,
    };
  }

  return {
    success: true,
    backup: {
      format: TEAM_LAB_BACKUP_FORMAT,
      schemaVersion: TEAM_LAB_BACKUP_SCHEMA_VERSION,
      exportedAt: envelopeResult.data.exportedAt,
      inventory: records,
    },
  };
}
