import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { reviewRoster } from "@/domain/updates/rosterReview";
import { bundledPvpokeBaseUrl } from "@/pvpoke/config";
import { fetchValidatedJson } from "@/pvpoke/repositories/http";
import { ACTIVE_SEASON, UPSTREAM_COMPARISON_COMMIT } from "@/pvpoke/season";
import { updateReviewSchema } from "@/pvpoke/types/updateReview";
import manifest from "../../../public/vendor/pvpoke/manifest.json";

const comparisonHash = manifest.files["data/update-review.json"].sha256;

export const updateReviewQueryOptions = queryOptions({
  queryKey: ["pvpoke-data", "update-review", comparisonHash],
  queryFn: async () => {
    const review = await fetchValidatedJson(
      `${bundledPvpokeBaseUrl}/data/update-review.json?v=${comparisonHash}`,
      updateReviewSchema,
    );
    if (review.fromCommit !== UPSTREAM_COMPARISON_COMMIT ||
      (review.toCommit !== null && review.toCommit !== ACTIVE_SEASON.upstreamCommit)) {
      throw new Error("The roster comparison is from an older release. Reload to get the latest review.");
    }
    return review;
  },
  staleTime: Infinity,
});

export function useRosterReview() {
  const queryClient = useQueryClient();
  const inventory = useInventoryList();
  const teams = useSavedTeamList();
  const catalog = usePokemonCatalog();
  const comparison = useQuery(updateReviewQueryOptions);
  const result = useMemo(() => {
    if (!inventory.data || !teams.data || !catalog.data || !comparison.data) return {};
    try {
      return { data: reviewRoster(inventory.data, teams.data, catalog.data, comparison.data) };
    } catch (error) { return { error }; }
  }, [inventory.data, teams.data, catalog.data, comparison.data]);
  return {
    data: result.data, comparison: comparison.data,
    error: inventory.error ?? teams.error ?? catalog.error ?? comparison.error ?? result.error,
    isLoading: inventory.isPending || teams.isPending || catalog.isLoading || comparison.isPending,
    retry: () => {
      void inventory.refetch(); void teams.refetch();
      void queryClient.refetchQueries({ queryKey: ["pvpoke-data"] });
    },
  };
}
