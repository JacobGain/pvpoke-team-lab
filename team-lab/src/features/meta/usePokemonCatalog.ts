import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  gameMasterQueryOptions,
  openGreatLeagueMetaQueryOptions,
  openGreatLeagueRankingQueryOptions,
} from "@/features/meta/pvpokeDataQueries";
import { buildPokemonCatalog } from "@/pvpoke/adapters/buildPokemonCatalog";

export function usePokemonCatalog() {
  const results = useQueries({
    queries: [
      gameMasterQueryOptions,
      openGreatLeagueRankingQueryOptions,
      openGreatLeagueMetaQueryOptions,
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
        ),
      };
    } catch (error) {
      return { error };
    }
  }, [gameMasterResult.data, rankingResult.data, metaResult.data]);

  return {
    data: catalogResult.data,
    error: queryError ?? catalogResult.error,
    isLoading: results.some((result) => result.isPending),
  };
}
