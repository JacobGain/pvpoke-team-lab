import type { League } from "@/domain/leagues";
import { useLeague } from "@/features/leagues/leagueStore";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  gameMasterQueryOptions,
  leagueMetaQueryOptions,
  leagueRankingQueryOptions,
} from "@/features/meta/pvpokeDataQueries";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";

export function usePokemonCatalog(overrideLeague?: League) {
  const activeLeague = useLeague();
  const league = overrideLeague ?? activeLeague;
  const results = useQueries({
    queries: [
      gameMasterQueryOptions,
      leagueRankingQueryOptions(league),
      leagueMetaQueryOptions(league),
    ],
  });

  const [gameMasterResult, rankingResult, metaResult] = results;
  const queryError =
    gameMasterResult.error ?? rankingResult.error ?? metaResult.error;

  const catalogResult = useMemo(() => {
    if (
      !gameMasterResult.data ||
      !rankingResult.data ||
      !metaResult.data
    ) {
      return {};
    }

    try {
      return {
        data: buildPokemonCatalog(
          gameMasterResult.data,
          rankingResult.data,
          metaResult.data,
          league.cp,
        ),
      };
    } catch (error) {
      return { error };
    }
  }, [gameMasterResult.data, rankingResult.data, metaResult.data, league.cp]);

  return {
    data: catalogResult.data,
    error: queryError ?? catalogResult.error,
    isLoading: results.some((result) => result.isPending),
  };
}
