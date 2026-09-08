export const LEAGUES = {
  "great-league": {
    id: "great-league",
    title: "Open Great League",
    shortTitle: "Great League",
    cp: 1500,
    cup: "all",
    rankingCategory: "overall",
    metaGroup: "great",
    bulkGoal: 22_000,
  },
  "ultra-league": {
    id: "ultra-league",
    title: "Open Ultra League",
    shortTitle: "Ultra League",
    cp: 2500,
    cup: "all",
    rankingCategory: "overall",
    metaGroup: "ultra",
    bulkGoal: 35_000,
  },
} as const;

export type LeagueId = keyof typeof LEAGUES;
export type League = (typeof LEAGUES)[LeagueId];
export function leagueForCp(cp: number | undefined): League {
  return cp === 2500 ? LEAGUES["ultra-league"] : LEAGUES["great-league"];
}
