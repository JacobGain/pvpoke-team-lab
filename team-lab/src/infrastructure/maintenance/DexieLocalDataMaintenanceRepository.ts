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
          removedRecommendationHistoryCount: 0,
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
          removedRecommendationHistoryCount: 0,
        };
      },
    );
  }

  resetAll(): Promise<LocalDataMutationResult> {
    return this.database.transaction(
      "rw",
      this.database.inventory,
      this.database.savedTeams,
      this.database.recommendationHistory,
      async () => {
        const [
          removedInventoryCount,
          removedSavedTeamCount,
          removedRecommendationHistoryCount,
        ] =
          await Promise.all([
            this.database.inventory.count(),
            this.database.savedTeams.count(),
            this.database.recommendationHistory.count(),
          ]);

        await this.database.recommendationHistory.clear();
        await this.database.savedTeams.clear();
        await this.database.inventory.clear();

        return {
          removedInventoryCount,
          removedSavedTeamCount,
          removedRecommendationHistoryCount,
        };
      },
    );
  }
}
