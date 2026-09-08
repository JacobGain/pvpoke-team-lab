import { queryOptions } from "@tanstack/react-query";

import { pvpokeRepositories } from "@/pvpoke/repositories";
import { LEAGUES, type League } from "@/domain/leagues";

export const pvpokeDataQueryKeys = {
  all: ["pvpoke-data"] as const,
  gameMaster: () => [...pvpokeDataQueryKeys.all, "game-master"] as const,
  rankings: (cup: string, category: string, cp: number) =>
    [
      ...pvpokeDataQueryKeys.all,
      "rankings",
      cup,
      category,
      cp,
    ] as const,
  metaGroup: (groupId: string) =>
    [...pvpokeDataQueryKeys.all, "meta-group", groupId] as const,
};

export const gameMasterQueryOptions = queryOptions({
  queryKey: pvpokeDataQueryKeys.gameMaster(),
  queryFn: () => pvpokeRepositories.gameMaster.load(),
  staleTime: Number.POSITIVE_INFINITY,
});

export const leagueRankingQueryOptions = (league: League) => queryOptions({
  queryKey: pvpokeDataQueryKeys.rankings(
    league.cup,
    league.rankingCategory,
    league.cp,
  ),
  queryFn: () =>
    pvpokeRepositories.rankings.load({
      cup: league.cup,
      category: league.rankingCategory,
      cp: league.cp,
    }),
  staleTime: Number.POSITIVE_INFINITY,
});

export const leagueMetaQueryOptions = (league: League) => queryOptions({
  queryKey: pvpokeDataQueryKeys.metaGroup(league.metaGroup),
  queryFn: () =>
    pvpokeRepositories.metaGroups.load(league.metaGroup),
  staleTime: Number.POSITIVE_INFINITY,
});

export const openGreatLeagueRankingQueryOptions = leagueRankingQueryOptions(LEAGUES["great-league"]);
export const openGreatLeagueMetaQueryOptions = leagueMetaQueryOptions(LEAGUES["great-league"]);
