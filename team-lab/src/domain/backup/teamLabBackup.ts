import { z } from "zod";
import { LEAGUES } from "@/domain/leagues";

import { TEAM_LAB_BACKUP_SCHEMA_VERSION } from "@/domain/schemaVersions";
import {
  MAX_RECOMMENDATION_HISTORY_RECORDS,
  recommendationHistoryRecordSchema,
  type RecommendationHistoryRecord,
} from "@/domain/recommendations/history";
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
export const MAX_TEAM_LAB_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_TEAM_LAB_BACKUP_INVENTORY_RECORDS = 20_000;
export const MAX_TEAM_LAB_BACKUP_SAVED_TEAMS = 5_000;

const backupMetadataSchema = z.object({
  format: z.literal(TEAM_LAB_BACKUP_FORMAT),
  exportedAt: z.iso.datetime(),
});

const backupEnvelopeV1Schema = backupMetadataSchema.extend({
  schemaVersion: z.literal(LEGACY_INVENTORY_BACKUP_SCHEMA_VERSION),
  inventory: z.array(z.unknown()).max(MAX_TEAM_LAB_BACKUP_INVENTORY_RECORDS),
});

const backupEnvelopeV2Schema = backupMetadataSchema.extend({
  schemaVersion: z.literal(2),
  inventory: z.array(z.unknown()).max(MAX_TEAM_LAB_BACKUP_INVENTORY_RECORDS),
  savedTeams: z.array(z.unknown()).max(MAX_TEAM_LAB_BACKUP_SAVED_TEAMS),
});

const backupEnvelopeV3Schema = backupMetadataSchema.extend({
  schemaVersion: z.literal(TEAM_LAB_BACKUP_SCHEMA_VERSION),
  inventory: z.array(z.unknown()).max(MAX_TEAM_LAB_BACKUP_INVENTORY_RECORDS),
  savedTeams: z.array(z.unknown()).max(MAX_TEAM_LAB_BACKUP_SAVED_TEAMS),
  recommendationHistory: z.array(z.unknown()).max(MAX_RECOMMENDATION_HISTORY_RECORDS),
});

const supportedBackupEnvelopeSchema = z.discriminatedUnion("schemaVersion", [
  backupEnvelopeV1Schema,
  backupEnvelopeV2Schema,
  backupEnvelopeV3Schema,
]);

export interface TeamLabBackup {
  readonly format: typeof TEAM_LAB_BACKUP_FORMAT;
  readonly schemaVersion: typeof TEAM_LAB_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly inventory: readonly InventoryPokemon[];
  readonly savedTeams: readonly SavedTeam[];
  readonly recommendationHistory: readonly RecommendationHistoryRecord[];
}

export interface TeamLabRestoreData {
  readonly sourceSchemaVersion:
    | typeof LEGACY_INVENTORY_BACKUP_SCHEMA_VERSION
    | 2
    | typeof TEAM_LAB_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly inventory: readonly InventoryPokemon[];
  readonly savedTeams: readonly SavedTeam[];
  readonly recommendationHistory: readonly RecommendationHistoryRecord[];
}

export type TeamLabBackupIssueKind =
  | "record-schema"
  | "catalog-reference"
  | "duplicate-id"
  | "saved-team-legality"
  | "history-schema"
  | "duplicate-history-id";

export interface TeamLabBackupIssue {
  readonly collection: "inventory" | "savedTeams" | "recommendationHistory";
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
      readonly sourceSchemaVersion?: 1 | 2 | 3;
      readonly inventoryCount?: number;
      readonly savedTeamCount?: number;
      readonly recommendationHistoryCount?: number;
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
  readonly sourceSchemaVersion: 1 | 2 | 3;
  readonly inventory: TeamLabCollectionRestoreResult;
  readonly savedTeams: TeamLabCollectionRestoreResult;
  readonly recommendationHistory: TeamLabCollectionRestoreResult;
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
  historyOrNow: readonly RecommendationHistoryRecord[] | (() => Date) = [],
  now: () => Date = () => new Date(),
): TeamLabBackup {
  const history = typeof historyOrNow === "function" ? [] : historyOrNow;
  const clock = typeof historyOrNow === "function" ? historyOrNow : now;
  const validatedInventory = inventory.map((record) =>
    inventoryPokemonSchema.parse(record),
  );
  const validatedTeams = savedTeams.map((team) =>
    savedTeamSchema.parse(team),
  );
  const validatedHistory = history.map((record) =>
    recommendationHistoryRecordSchema.parse(record),
  );
  const issues: string[] = [];

  if (validatedHistory.length > MAX_RECOMMENDATION_HISTORY_RECORDS) {
    issues.push(
      `Recommendation history contains more than ${MAX_RECOMMENDATION_HISTORY_RECORDS} runs.`,
    );
  }
  const historyIds = new Set<string>();
  for (const record of validatedHistory) {
    if (historyIds.has(record.historyId)) {
      issues.push(`Recommendation history contains duplicate run ID ${record.historyId}.`);
    }
    historyIds.add(record.historyId);
  }

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
      { ...catalog, cpCap: LEAGUES[team.formatId].cp, formatId: team.formatId },
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
    exportedAt: clock().toISOString(),
    inventory: validatedInventory,
    savedTeams: validatedTeams,
    recommendationHistory: validatedHistory,
  };
}

export function serializeTeamLabBackup(backup: TeamLabBackup): string {
  const serialized = JSON.stringify(backup);
  if (new Blob([serialized]).size > MAX_TEAM_LAB_BACKUP_BYTES) {
    throw new Error("The complete backup is larger than the 10 MiB limit. Delete older recommendation-history runs and try again.");
  }
  return serialized;
}

function candidateRecordId(
  candidate: unknown,
  key: "inventoryId" | "teamId" | "historyId",
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
  if (new Blob([source]).size > MAX_TEAM_LAB_BACKUP_BYTES) {
    return {
      success: false,
      envelopeError: "The selected backup is larger than the 10 MiB limit.",
      issues: [],
    };
  }

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
  const rawTeams = "savedTeams" in envelope ? envelope.savedTeams : [];
  const rawHistory =
    envelope.schemaVersion === TEAM_LAB_BACKUP_SCHEMA_VERSION
      ? envelope.recommendationHistory
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
    const teamIssues = validateSavedTeamLegality(team, inventory, { ...catalog, cpCap: LEAGUES[team.formatId].cp, formatId: team.formatId });

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

  const recommendationHistory: RecommendationHistoryRecord[] = [];
  const firstHistoryIndexById = new Map<string, number>();

  for (const [index, candidate] of rawHistory.entries()) {
    const recordResult = recommendationHistoryRecordSchema.safeParse(candidate);

    if (!recordResult.success) {
      issues.push({
        collection: "recommendationHistory",
        index,
        recordId: candidateRecordId(candidate, "historyId"),
        kind: "history-schema",
        message: recordResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      continue;
    }

    const record = recordResult.data;
    const firstIndex = firstHistoryIndexById.get(record.historyId);

    if (firstIndex !== undefined) {
      issues.push({
        collection: "recommendationHistory",
        index,
        recordId: record.historyId,
        kind: "duplicate-history-id",
        message: `Recommendation run ID duplicates history record ${firstIndex + 1}.`,
      });
      continue;
    }

    firstHistoryIndexById.set(record.historyId, index);
    recommendationHistory.push(record);
  }

  if (issues.length > 0) {
    return {
      success: false,
      exportedAt: envelope.exportedAt,
      sourceSchemaVersion: envelope.schemaVersion,
      inventoryCount: envelope.inventory.length,
      savedTeamCount: rawTeams.length,
      recommendationHistoryCount: rawHistory.length,
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
      recommendationHistory,
    },
  };
}
