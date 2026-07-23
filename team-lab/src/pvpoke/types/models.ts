export const OPEN_GREAT_LEAGUE = {
  id: "open-great-league",
  title: "Open Great League",
  cup: "all",
  cp: 1500,
  rankingCategory: "overall",
  metaGroup: "great",
} as const;

export interface PvpokeDataStatus {
  gameMasterId: string;
  gameMasterTitle: string;
  gameMasterTimestamp: string;
  pokemonCount: number;
  moveCount: number;
  formatTitle: string;
  cupAvailable: boolean;
  rankingCount: number;
  metaEntryCount: number;
}
