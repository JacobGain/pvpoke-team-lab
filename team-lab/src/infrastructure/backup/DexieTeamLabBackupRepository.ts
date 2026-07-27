import {
  TeamLabRestoreValidationError,
  type TeamLabBackupRepository,
  type TeamLabCollectionRestoreResult,
  type TeamLabRestoreData,
  type TeamLabRestoreMode,
  type TeamLabRestoreResult,
} from "@/domain/backup/teamLabBackup";
import {
  inventoryPokemonSchema,
  type InventoryPokemon,
} from "@/domain/inventory/schemas";
import { validateInventoryPokemonAgainstCatalog } from "@/domain/inventory/validation";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import {
  savedTeamSchema,
  type SavedTeam,
} from "@/domain/teams/schemas";
import { validateSavedTeamLegality } from "@/domain/teams/validation";
import type { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

function mergeById<T>(
  existing: readonly T[],
  incoming: readonly T[],
  identity: (value: T) => string,
): readonly T[] {
  const merged = new Map(existing.map((value) => [identity(value), value]));

  for (const value of incoming) {
    merged.set(identity(value), value);
  }

  return [...merged.values()];
}

function collectionResult<T>(
  existing: readonly T[],
  incoming: readonly T[],
  finalRecords: readonly T[],
  mode: TeamLabRestoreMode,
  identity: (value: T) => string,
): TeamLabCollectionRestoreResult {
  const existingIds = new Set(existing.map(identity));
  const incomingIds = new Set(incoming.map(identity));
  const updated = incoming.filter((value) =>
    existingIds.has(identity(value)),
  ).length;

  return {
    incoming: incoming.length,
    inserted: incoming.length - updated,
    updated,
    removed:
      mode === "replace"
        ? existing.filter((value) => !incomingIds.has(identity(value))).length
        : 0,
    finalCount: finalRecords.length,
  };
}

function duplicateIdentityIssues<T>(
  records: readonly T[],
  collection: string,
  identity: (value: T) => string,
): readonly string[] {
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const record of records) {
    const id = identity(record);
    if (seen.has(id)) {
      issues.push(`${collection} contains duplicate ID ${id}.`);
    }
    seen.add(id);
  }

  return issues;
}

function validateFinalState(
  inventory: readonly InventoryPokemon[],
  savedTeams: readonly SavedTeam[],
  catalog: PokemonCatalog,
): void {
  const issues = [
    ...duplicateIdentityIssues(
      inventory,
      "Inventory",
      (record) => record.inventoryId,
    ),
    ...duplicateIdentityIssues(
      savedTeams,
      "Saved teams",
      (team) => team.teamId,
    ),
  ];

  for (const record of inventory) {
    const recordIssues = validateInventoryPokemonAgainstCatalog(record, catalog);
    if (recordIssues.length > 0) {
      issues.push(
        `Inventory ${record.inventoryId}: ${recordIssues.map((issue) => issue.message).join(" ")}`,
      );
    }
  }

  for (const team of savedTeams) {
    const teamIssues = validateSavedTeamLegality(team, inventory, catalog);
    if (teamIssues.length > 0) {
      issues.push(
        `Saved team ${team.teamId}: ${teamIssues.map((issue) => issue.message).join(" ")}`,
      );
    }
  }

  if (issues.length > 0) {
    throw new TeamLabRestoreValidationError(issues);
  }
}

export class DexieTeamLabBackupRepository
  implements TeamLabBackupRepository
{
  constructor(private readonly database: TeamLabDatabase) {}

  async restore(
    backup: TeamLabRestoreData,
    mode: TeamLabRestoreMode,
    catalog: PokemonCatalog,
  ): Promise<TeamLabRestoreResult> {
    const incomingInventory = backup.inventory.map((record) =>
      inventoryPokemonSchema.parse(record),
    );
    const incomingTeams = backup.savedTeams.map((team) =>
      savedTeamSchema.parse(team),
    );

    return this.database.transaction(
      "rw",
      this.database.inventory,
      this.database.savedTeams,
      async () => {
        const existingInventory = (
          await this.database.inventory.toArray()
        ).map((record) => inventoryPokemonSchema.parse(record));
        const existingTeams = (await this.database.savedTeams.toArray()).map(
          (team) => savedTeamSchema.parse(team),
        );
        const finalInventory =
          mode === "replace"
            ? incomingInventory
            : mergeById(
                existingInventory,
                incomingInventory,
                (record) => record.inventoryId,
              );
        const finalTeams =
          mode === "replace"
            ? incomingTeams
            : mergeById(
                existingTeams,
                incomingTeams,
                (team) => team.teamId,
              );

        validateFinalState(finalInventory, finalTeams, catalog);

        if (mode === "replace") {
          await this.database.savedTeams.clear();
          await this.database.inventory.clear();
          await this.database.inventory.bulkAdd(incomingInventory);
          await this.database.savedTeams.bulkAdd(incomingTeams);
        } else {
          await this.database.inventory.bulkPut(incomingInventory);
          await this.database.savedTeams.bulkPut(incomingTeams);
        }

        return {
          mode,
          sourceSchemaVersion: backup.sourceSchemaVersion,
          inventory: collectionResult(
            existingInventory,
            incomingInventory,
            finalInventory,
            mode,
            (record) => record.inventoryId,
          ),
          savedTeams: collectionResult(
            existingTeams,
            incomingTeams,
            finalTeams,
            mode,
            (team) => team.teamId,
          ),
        };
      },
    );
  }
}
