import Dexie, { type EntityTable } from "dexie";

import { inventoryPokemonSchema, type InventoryPokemon } from "@/domain/inventory/schemas";
import { TEAM_LAB_DATABASE_VERSION } from "@/domain/schemaVersions";
import { savedTeamSchema, type SavedTeam } from "@/domain/teams/schemas";
import type { RecommendationHistoryRecord } from "@/domain/recommendations/history";

export const TEAM_LAB_DATABASE_NAME = "team-lab";
export { TEAM_LAB_DATABASE_VERSION } from "@/domain/schemaVersions";

export class TeamLabDatabase extends Dexie {
  inventory!: EntityTable<InventoryPokemon, "inventoryId">;
  savedTeams!: EntityTable<SavedTeam, "teamId">;
  recommendationHistory!: EntityTable<RecommendationHistoryRecord, "historyId">;

  constructor(
    databaseName = TEAM_LAB_DATABASE_NAME,
    options?: {
      readonly indexedDB: IDBFactory;
      readonly IDBKeyRange: typeof IDBKeyRange;
    },
  ) {
    super(databaseName, options);

    this.version(1).stores({
      inventory:
        "&inventoryId, buildStatus, speciesId, favorite, createdAt, updatedAt",
    });

    this.version(4).stores({
      inventory: "&inventoryId, updatedAt",
      savedTeams: "&teamId, updatedAt",
      recommendationHistory: "&historyId, createdAt, formatId, dataVersion",
    });
    this.version(TEAM_LAB_DATABASE_VERSION).stores({
      inventory: "&inventoryId, updatedAt",
      savedTeams: "&teamId, updatedAt",
      recommendationHistory: "&historyId, createdAt, formatId, dataVersion",
    }).upgrade(async transaction => {
      await transaction.table("inventory").toCollection().modify((record: Record<string, unknown>) => {
        Object.assign(record, inventoryPokemonSchema.parse(record));
      });
      await transaction.table("savedTeams").toCollection().modify((record: Record<string, unknown>) => {
        Object.assign(record, savedTeamSchema.parse(record));
      });
    });
  }
}

export const teamLabDatabase = new TeamLabDatabase();
