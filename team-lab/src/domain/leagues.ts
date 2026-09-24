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
  "master-league": {
    id: "master-league",
    title: "Open Master League",
    shortTitle: "Master League",
    // PvPoke's sentinel for the uncapped league.
    cp: 10000,
    cup: "all",
    rankingCategory: "overall",
    metaGroup: "master",
    bulkGoal: 35_000,
  },
  "mega-great-league": {
    id: "mega-great-league",
    title: "Mega Great League",
    shortTitle: "Mega Great League",
    cp: 1500,
    cup: "mega",
    rankingCategory: "overall",
    metaGroup: "megagreat",
    bulkGoal: 22_000,
  },
  "mega-ultra-league": {
    id: "mega-ultra-league",
    title: "Mega Ultra League",
    shortTitle: "Mega Ultra League",
    cp: 2500,
    cup: "mega",
    rankingCategory: "overall",
    metaGroup: "megaultra",
    bulkGoal: 35_000,
  },
  "mega-master-league": {
    id: "mega-master-league",
    title: "Mega Master League",
    shortTitle: "Mega Master League",
    cp: 10000,
    cup: "mega",
    rankingCategory: "overall",
    metaGroup: "mega",
    bulkGoal: 35_000,
  },
} as const;

export type LeagueId = keyof typeof LEAGUES;
export type League = (typeof LEAGUES)[LeagueId];
export const LEAGUE_IDS = ["great-league", "ultra-league", "master-league", "mega-great-league", "mega-ultra-league", "mega-master-league"] as const;
export type BaseLeagueId = "great-league" | "ultra-league" | "master-league";
export const BASE_LEAGUE_IDS: readonly BaseLeagueId[] = ["great-league", "ultra-league", "master-league"];
export function baseLeagueId(id: LeagueId): BaseLeagueId {
  return id.replace(/^mega-/, "") as BaseLeagueId;
}
export function leagueIdFor(base: BaseLeagueId, mega: boolean): LeagueId {
  return mega ? `mega-${base}` : base;
}
export function leagueForCp(cp: number | undefined): League {
  if (cp === 10000) return LEAGUES["master-league"];
  return cp === 2500 ? LEAGUES["ultra-league"] : LEAGUES["great-league"];
}
export function leagueForCatalog(catalog: { readonly cpCap?: number; readonly formatId?: LeagueId }): League {
  return catalog.formatId ? LEAGUES[catalog.formatId] : leagueForCp(catalog.cpCap);
}
