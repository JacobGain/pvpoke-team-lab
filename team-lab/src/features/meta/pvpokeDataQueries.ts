import { queryOptions } from "@tanstack/react-query";

import { pvpokeRepositories } from "@/pvpoke/repositories";
import { OPEN_GREAT_LEAGUE } from "@/pvpoke/types/models";

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

export const openGreatLeagueRankingQueryOptions = queryOptions({
  queryKey: pvpokeDataQueryKeys.rankings(
    OPEN_GREAT_LEAGUE.cup,
    OPEN_GREAT_LEAGUE.rankingCategory,
    OPEN_GREAT_LEAGUE.cp,
  ),
  queryFn: () =>
    pvpokeRepositories.rankings.load({
      cup: OPEN_GREAT_LEAGUE.cup,
      category: OPEN_GREAT_LEAGUE.rankingCategory,
      cp: OPEN_GREAT_LEAGUE.cp,
    }),
  staleTime: Number.POSITIVE_INFINITY,
});

export const openGreatLeagueMetaQueryOptions = queryOptions({
  queryKey: pvpokeDataQueryKeys.metaGroup(OPEN_GREAT_LEAGUE.metaGroup),
  queryFn: () =>
    pvpokeRepositories.metaGroups.load(OPEN_GREAT_LEAGUE.metaGroup),
  staleTime: Number.POSITIVE_INFINITY,
});
