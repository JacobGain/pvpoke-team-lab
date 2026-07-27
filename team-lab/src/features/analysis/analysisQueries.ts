import { useQuery } from "@tanstack/react-query";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

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
    queryKey: analysisQueryKeys.inventoryBuild(
      record?.inventoryId ?? "",
      record?.updatedAt ?? "",
      catalog?.dataVersion ?? "",
    ),
    queryFn: () => analyzeInventoryBuild(record!, catalog!),
    enabled: record !== undefined && catalog !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
