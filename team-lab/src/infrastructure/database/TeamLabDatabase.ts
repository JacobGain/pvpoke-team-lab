import Dexie, { type EntityTable } from "dexie";

import type { InventoryPokemon } from "@/domain/inventory/schemas";

export const TEAM_LAB_DATABASE_NAME = "team-lab";
export const TEAM_LAB_DATABASE_VERSION = 1;

export class TeamLabDatabase extends Dexie {
  inventory!: EntityTable<InventoryPokemon, "inventoryId">;

  constructor(
    databaseName = TEAM_LAB_DATABASE_NAME,
    options?: {
      readonly indexedDB: IDBFactory;
      readonly IDBKeyRange: typeof IDBKeyRange;
    },
  ) {
    super(databaseName, options);

    this.version(TEAM_LAB_DATABASE_VERSION).stores({
      inventory:
        "&inventoryId, buildStatus, speciesId, favorite, createdAt, updatedAt",
    });
  }
}

export const teamLabDatabase = new TeamLabDatabase();
