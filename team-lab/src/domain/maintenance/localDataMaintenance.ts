export interface LocalDataMutationResult {
  readonly removedInventoryCount: number;
  readonly removedSavedTeamCount: number;
}

export interface LocalDataMaintenanceRepository {
  clearSavedTeams(): Promise<LocalDataMutationResult>;
  clearInventory(): Promise<LocalDataMutationResult>;
  resetAll(): Promise<LocalDataMutationResult>;
}

export class InventoryClearBlockedBySavedTeamsError extends Error {
  readonly savedTeamCount: number;

  constructor(savedTeamCount: number) {
    super(
      `Inventory cannot be cleared while ${savedTeamCount} saved ${savedTeamCount === 1 ? "team references" : "teams reference"} it. Clear saved teams first or reset all TeamLab data.`,
    );
    this.name = "InventoryClearBlockedBySavedTeamsError";
    this.savedTeamCount = savedTeamCount;
  }
}
