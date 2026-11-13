import { useQuery } from "@tanstack/react-query";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { ACTIVE_SEASON } from "@/pvpoke/season";

export const analysisQueryKeys = {
  inventoryBuild: (
    inventoryId: string,
    updatedAt: string,
    dataVersion: string,
  ) => ["analysis", "inventory-build", inventoryId, updatedAt, dataVersion],
};

export function useInventoryBuildAnalysis(
  record: InventoryPokemon | undefined,
  catalog: PokemonCatalog | undefined,
) {
  return useQuery({
    queryKey: [...analysisQueryKeys.inventoryBuild(
      record?.inventoryId ?? "",
      record?.updatedAt ?? "",
      `${catalog?.dataVersion ?? ""}:${catalog?.cpCap ?? 1500}`,
    ), catalog?.formatId, ACTIVE_SEASON.upstreamCommit, record?.megaSpeciesId,
      record?.currentBuild, record?.buildStatus === "planned" ? record.plannedBuild : null],
    queryFn: () => analyzeInventoryBuild(record!, catalog!),
    enabled: record !== undefined && catalog !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
