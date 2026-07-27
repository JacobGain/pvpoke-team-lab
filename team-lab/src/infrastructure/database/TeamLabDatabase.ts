import Dexie, { type EntityTable } from "dexie";

import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { SavedTeam } from "@/domain/teams/schemas";

export const TEAM_LAB_DATABASE_NAME = "team-lab";
export const TEAM_LAB_DATABASE_VERSION = 2;

export class TeamLabDatabase extends Dexie {
  inventory!: EntityTable<InventoryPokemon, "inventoryId">;
  savedTeams!: EntityTable<SavedTeam, "teamId">;

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

    this.version(TEAM_LAB_DATABASE_VERSION).stores({
      inventory:
        "&inventoryId, buildStatus, speciesId, favorite, createdAt, updatedAt",
      savedTeams: "&teamId, formatId, name, createdAt, updatedAt",
    });
  }
}

export const teamLabDatabase = new TeamLabDatabase();
