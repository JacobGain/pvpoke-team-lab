import { useQueries } from "@tanstack/react-query";

import {
  gameMasterQueryOptions,
  openGreatLeagueMetaQueryOptions,
  openGreatLeagueRankingQueryOptions,
} from "@/features/meta/pvpokeDataQueries";
import {
  OPEN_GREAT_LEAGUE,
  type PvpokeDataStatus,
} from "@/pvpoke/types/models";

export function usePvpokeDataStatus() {
  const results = useQueries({
    queries: [
      gameMasterQueryOptions,
      openGreatLeagueRankingQueryOptions,
      openGreatLeagueMetaQueryOptions,
    ],
  });

  const [gameMasterResult, rankingResult, metaResult] = results;
  const error =
    gameMasterResult.error ?? rankingResult.error ?? metaResult.error;

  let data: PvpokeDataStatus | undefined;

  if (gameMasterResult.data && rankingResult.data && metaResult.data) {
    const cupAvailable = gameMasterResult.data.cups.some(
      (cup) => cup.name === OPEN_GREAT_LEAGUE.cup,
    );

    data = {
      gameMasterId: gameMasterResult.data.id,
      gameMasterTitle: gameMasterResult.data.title,
      gameMasterTimestamp: gameMasterResult.data.timestamp,
      pokemonCount: gameMasterResult.data.pokemon.length,
      moveCount: gameMasterResult.data.moves.length,
      formatTitle: OPEN_GREAT_LEAGUE.title,
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
