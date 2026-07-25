import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { inventoryRepository } from "@/infrastructure/inventory";

export const inventoryQueryKeys = {
  all: ["inventory"] as const,
  list: () => [...inventoryQueryKeys.all, "list"] as const,
  detail: (inventoryId: string) =>
    [...inventoryQueryKeys.all, "detail", inventoryId] as const,
};

export const inventoryListQueryOptions = queryOptions({
  queryKey: inventoryQueryKeys.list(),
  queryFn: () => inventoryRepository.list(),
});

export function useInventoryList() {
  return useQuery(inventoryListQueryOptions);
}

export function useInventoryPokemon(inventoryId: string | undefined) {
  return useQuery({
    queryKey: inventoryQueryKeys.detail(inventoryId ?? ""),
    queryFn: () => inventoryRepository.get(inventoryId!),
    enabled: inventoryId !== undefined,
  });
}

export function useCreateInventoryPokemon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: InventoryPokemon) =>
      inventoryRepository.create(record),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all,
      });
    },
  });
}

export function useUpdateInventoryPokemon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: InventoryPokemon) =>
      inventoryRepository.update(record),
    onSuccess: async (_, record) => {
      queryClient.setQueryData(
        inventoryQueryKeys.detail(record.inventoryId),
        record,
      );
      await queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all,
      });
    },
  });
}

export function useDeleteInventoryPokemon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inventoryId: string) =>
      inventoryRepository.delete(inventoryId),
    onSuccess: async (_, inventoryId) => {
      queryClient.removeQueries({
        queryKey: inventoryQueryKeys.detail(inventoryId),
      });
      await queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all,
      });
    },
  });
}
