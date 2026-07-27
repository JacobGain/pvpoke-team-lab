import {
  InventoryClearBlockedBySavedTeamsError,
  type LocalDataMaintenanceRepository,
  type LocalDataMutationResult,
} from "@/domain/maintenance/localDataMaintenance";
import type { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

export class DexieLocalDataMaintenanceRepository
  implements LocalDataMaintenanceRepository
{
  constructor(private readonly database: TeamLabDatabase) {}

  clearSavedTeams(): Promise<LocalDataMutationResult> {
    return this.database.transaction(
      "rw",
      this.database.savedTeams,
      async () => {
        const removedSavedTeamCount =
          await this.database.savedTeams.count();
        await this.database.savedTeams.clear();

        return {
          removedInventoryCount: 0,
          removedSavedTeamCount,
        };
      },
    );
  }

  clearInventory(): Promise<LocalDataMutationResult> {
    return this.database.transaction(
      "rw",
      this.database.inventory,
      this.database.savedTeams,
      async () => {
        const savedTeamCount = await this.database.savedTeams.count();

        if (savedTeamCount > 0) {
          throw new InventoryClearBlockedBySavedTeamsError(savedTeamCount);
        }

        const removedInventoryCount =
          await this.database.inventory.count();
        await this.database.inventory.clear();

        return {
          removedInventoryCount,
          removedSavedTeamCount: 0,
        };
      },
    );
  }

  resetAll(): Promise<LocalDataMutationResult> {
    return this.database.transaction(
      "rw",
      this.database.inventory,
      this.database.savedTeams,
      async () => {
        const [removedInventoryCount, removedSavedTeamCount] =
          await Promise.all([
            this.database.inventory.count(),
            this.database.savedTeams.count(),
          ]);

        await this.database.savedTeams.clear();
        await this.database.inventory.clear();

        return {
          removedInventoryCount,
          removedSavedTeamCount,
        };
      },
    );
  }
}
