import { z } from "zod";

import { TEAM_LAB_BACKUP_SCHEMA_VERSION } from "@/domain/schemaVersions";
import {
  inventoryPokemonSchema,
  type InventoryPokemon,
} from "@/domain/inventory/schemas";
import {
  validateInventoryPokemonAgainstCatalog,
  type InventoryValidationIssue,
} from "@/domain/inventory/validation";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import {
  savedTeamSchema,
  type SavedTeam,
} from "@/domain/teams/schemas";
import {
  validateSavedTeamLegality,
  type SavedTeamValidationIssue,
} from "@/domain/teams/validation";

export const TEAM_LAB_BACKUP_FORMAT = "teamlab-backup" as const;
export { TEAM_LAB_BACKUP_SCHEMA_VERSION } from "@/domain/schemaVersions";
export const LEGACY_INVENTORY_BACKUP_SCHEMA_VERSION = 1 as const;

const backupMetadataSchema = z.object({
  format: z.literal(TEAM_LAB_BACKUP_FORMAT),
  exportedAt: z.iso.datetime(),
});

const backupEnvelopeV1Schema = backupMetadataSchema.extend({
  schemaVersion: z.literal(LEGACY_INVENTORY_BACKUP_SCHEMA_VERSION),
  inventory: z.array(z.unknown()),
});

const backupEnvelopeV2Schema = backupMetadataSchema.extend({
  schemaVersion: z.literal(TEAM_LAB_BACKUP_SCHEMA_VERSION),
  inventory: z.array(z.unknown()),
  savedTeams: z.array(z.unknown()),
});

const supportedBackupEnvelopeSchema = z.discriminatedUnion("schemaVersion", [
  backupEnvelopeV1Schema,
  backupEnvelopeV2Schema,
]);

export interface TeamLabBackup {
  readonly format: typeof TEAM_LAB_BACKUP_FORMAT;
  readonly schemaVersion: typeof TEAM_LAB_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly inventory: readonly InventoryPokemon[];
  readonly savedTeams: readonly SavedTeam[];
}

export interface TeamLabRestoreData {
  readonly sourceSchemaVersion:
    | typeof LEGACY_INVENTORY_BACKUP_SCHEMA_VERSION
    | typeof TEAM_LAB_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly inventory: readonly InventoryPokemon[];
  readonly savedTeams: readonly SavedTeam[];
}

export type TeamLabBackupIssueKind =
  | "record-schema"
  | "catalog-reference"
  | "duplicate-id"
  | "saved-team-legality";

export interface TeamLabBackupIssue {
  readonly collection: "inventory" | "savedTeams";
  readonly index: number;
  readonly recordId?: string;
  readonly kind: TeamLabBackupIssueKind;
  readonly message: string;
  readonly inventoryIssues?: readonly InventoryValidationIssue[];
  readonly teamIssues?: readonly SavedTeamValidationIssue[];
}

export type TeamLabBackupInspection =
  | {
      readonly success: true;
      readonly backup: TeamLabRestoreData;
    }
  | {
      readonly success: false;
      readonly envelopeError?: string;
      readonly exportedAt?: string;
      readonly sourceSchemaVersion?: 1 | 2;
      readonly inventoryCount?: number;
      readonly savedTeamCount?: number;
      readonly issues: readonly TeamLabBackupIssue[];
    };

export type TeamLabRestoreMode = "merge" | "replace";

export interface TeamLabCollectionRestoreResult {
  readonly incoming: number;
  readonly inserted: number;
  readonly updated: number;
  readonly removed: number;
  readonly finalCount: number;
}

export interface TeamLabRestoreResult {
  readonly mode: TeamLabRestoreMode;
  readonly sourceSchemaVersion: 1 | 2;
  readonly inventory: TeamLabCollectionRestoreResult;
  readonly savedTeams: TeamLabCollectionRestoreResult;
}

export interface TeamLabBackupRepository {
  restore(
    backup: TeamLabRestoreData,
    mode: TeamLabRestoreMode,
    catalog: PokemonCatalog,
  ): Promise<TeamLabRestoreResult>;
}

export class TeamLabRestoreValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join(" "));
    this.name = "TeamLabRestoreValidationError";
    this.issues = issues;
  }
}

export function createTeamLabBackup(
  inventory: readonly InventoryPokemon[],
  savedTeams: readonly SavedTeam[],
  catalog: PokemonCatalog,
  now: () => Date = () => new Date(),
): TeamLabBackup {
  const validatedInventory = inventory.map((record) =>
    inventoryPokemonSchema.parse(record),
  );
  const validatedTeams = savedTeams.map((team) =>
    savedTeamSchema.parse(team),
  );
  const issues: string[] = [];

  for (const record of validatedInventory) {
    const recordIssues = validateInventoryPokemonAgainstCatalog(
      record,
      catalog,
    );
    if (recordIssues.length > 0) {
      issues.push(
        `Inventory ${record.inventoryId}: ${recordIssues.map((issue) => issue.message).join(" ")}`,
      );
    }
  }

  for (const team of validatedTeams) {
    const teamIssues = validateSavedTeamLegality(
      team,
      validatedInventory,
      catalog,
    );
    if (teamIssues.length > 0) {
      issues.push(
        `Saved team ${team.teamId}: ${teamIssues.map((issue) => issue.message).join(" ")}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new TeamLabRestoreValidationError(issues);
  }

  return {
    format: TEAM_LAB_BACKUP_FORMAT,
    schemaVersion: TEAM_LAB_BACKUP_SCHEMA_VERSION,
    exportedAt: now().toISOString(),
    inventory: validatedInventory,
    savedTeams: validatedTeams,
  };
}

export function serializeTeamLabBackup(backup: TeamLabBackup): string {
  return JSON.stringify(backup, null, 2);
}

function candidateRecordId(
  candidate: unknown,
  key: "inventoryId" | "teamId",
): string | undefined {
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }

  const value = (candidate as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export function inspectTeamLabBackup(
  source: string,
  catalog: PokemonCatalog,
): TeamLabBackupInspection {
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

  const envelopeResult = supportedBackupEnvelopeSchema.safeParse(parsedJson);

  if (!envelopeResult.success) {
    return {
      success: false,
      envelopeError:
        "The file is not a supported TeamLab backup envelope or version.",
      issues: [],
    };
  }

  const envelope = envelopeResult.data;
  const rawTeams =
    envelope.schemaVersion === TEAM_LAB_BACKUP_SCHEMA_VERSION
      ? envelope.savedTeams
      : [];
  const issues: TeamLabBackupIssue[] = [];
  const inventory: InventoryPokemon[] = [];
  const firstInventoryIndexById = new Map<string, number>();

  for (const [index, candidate] of envelope.inventory.entries()) {
    const recordResult = inventoryPokemonSchema.safeParse(candidate);

    if (!recordResult.success) {
      issues.push({
        collection: "inventory",
        index,
        recordId: candidateRecordId(candidate, "inventoryId"),
        kind: "record-schema",
        message: recordResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      continue;
    }

    const record = recordResult.data;
    const firstIndex = firstInventoryIndexById.get(record.inventoryId);

    if (firstIndex !== undefined) {
      issues.push({
        collection: "inventory",
        index,
        recordId: record.inventoryId,
        kind: "duplicate-id",
        message: `Inventory ID duplicates inventory record ${firstIndex + 1}.`,
      });
      continue;
    }

    firstInventoryIndexById.set(record.inventoryId, index);
    const inventoryIssues = validateInventoryPokemonAgainstCatalog(
      record,
      catalog,
    );

    if (inventoryIssues.length > 0) {
      issues.push({
        collection: "inventory",
        index,
        recordId: record.inventoryId,
        kind: "catalog-reference",
        message: inventoryIssues.map((issue) => issue.message).join(" "),
        inventoryIssues,
      });
      continue;
    }

    inventory.push(record);
  }

  const savedTeams: SavedTeam[] = [];
  const firstTeamIndexById = new Map<string, number>();

  for (const [index, candidate] of rawTeams.entries()) {
    const teamResult = savedTeamSchema.safeParse(candidate);

    if (!teamResult.success) {
      issues.push({
        collection: "savedTeams",
        index,
        recordId: candidateRecordId(candidate, "teamId"),
        kind: "record-schema",
        message: teamResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      continue;
    }

    const team = teamResult.data;
    const firstIndex = firstTeamIndexById.get(team.teamId);

    if (firstIndex !== undefined) {
      issues.push({
        collection: "savedTeams",
        index,
        recordId: team.teamId,
        kind: "duplicate-id",
        message: `Team ID duplicates saved-team record ${firstIndex + 1}.`,
      });
      continue;
    }

    firstTeamIndexById.set(team.teamId, index);
    const teamIssues = validateSavedTeamLegality(team, inventory, catalog);

    if (teamIssues.length > 0) {
      issues.push({
        collection: "savedTeams",
        index,
        recordId: team.teamId,
        kind: "saved-team-legality",
        message: teamIssues.map((issue) => issue.message).join(" "),
        teamIssues,
      });
      continue;
    }

    savedTeams.push(team);
  }

  if (issues.length > 0) {
    return {
      success: false,
      exportedAt: envelope.exportedAt,
      sourceSchemaVersion: envelope.schemaVersion,
      inventoryCount: envelope.inventory.length,
      savedTeamCount: rawTeams.length,
      issues,
    };
  }

  return {
    success: true,
    backup: {
      sourceSchemaVersion: envelope.schemaVersion,
      exportedAt: envelope.exportedAt,
      inventory,
      savedTeams,
    },
  };
}
