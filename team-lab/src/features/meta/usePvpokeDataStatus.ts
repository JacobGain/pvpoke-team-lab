import { useLeague } from "@/features/leagues/leagueStore";
import { useQueries } from "@tanstack/react-query";

import {
  gameMasterQueryOptions,
  leagueMetaQueryOptions,
  leagueRankingQueryOptions,
} from "@/features/meta/pvpokeDataQueries";
import {
  type PvpokeDataStatus,
} from "@/pvpoke/types/models";

export function usePvpokeDataStatus() {
  const league = useLeague();
  const results = useQueries({
    queries: [
      gameMasterQueryOptions,
      leagueRankingQueryOptions(league),
      leagueMetaQueryOptions(league),
    ],
  });

  const [gameMasterResult, rankingResult, metaResult] = results;
  const error =
    gameMasterResult.error ?? rankingResult.error ?? metaResult.error;

  let data: PvpokeDataStatus | undefined;

  if (gameMasterResult.data && rankingResult.data && metaResult.data) {
    const cupAvailable = gameMasterResult.data.cups.some(
      (cup) => cup.name === league.cup,
    );

    data = {
      gameMasterId: gameMasterResult.data.id,
      gameMasterTitle: gameMasterResult.data.title,
      gameMasterTimestamp: gameMasterResult.data.timestamp,
      pokemonCount: gameMasterResult.data.pokemon.length,
      moveCount: gameMasterResult.data.moves.length,
      formatTitle: league.title,
      cupAvailable,
      rankingCount: rankingResult.data.length,
      metaEntryCount: metaResult.data.length,
    };
  }

  return {
    data,
    error,
    isLoading: results.some((result) => result.isPending),
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}
