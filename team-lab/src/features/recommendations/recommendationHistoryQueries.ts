import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { recommendationHistoryRepository } from "@/infrastructure/recommendations";
import type { RecommendationHistoryRecord } from "@/domain/recommendations/history";

export const recommendationHistoryQueryKeys = {
  all: ["recommendation-history"] as const,
  list: () => [...recommendationHistoryQueryKeys.all, "list"] as const,
  detail: (historyId: string) =>
    [...recommendationHistoryQueryKeys.all, "detail", historyId] as const,
};

export function useRecommendationHistoryList() {
  return useQuery({
    queryKey: recommendationHistoryQueryKeys.list(),
    queryFn: () => recommendationHistoryRepository.list(),
  });
}

export function useRecommendationHistoryRecord(historyId: string | undefined) {
  return useQuery({
    queryKey: recommendationHistoryQueryKeys.detail(historyId ?? ""),
    queryFn: () => recommendationHistoryRepository.get(historyId!),
    enabled: historyId !== undefined,
  });
}

export function useCreateRecommendationHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (record: RecommendationHistoryRecord) =>
      recommendationHistoryRepository.create(record),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: recommendationHistoryQueryKeys.all,
      });
    },
  });
}

export function useDeleteRecommendationHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (historyId: string) =>
      recommendationHistoryRepository.delete(historyId),
    onSuccess: async (_, historyId) => {
      queryClient.removeQueries({
        queryKey: recommendationHistoryQueryKeys.detail(historyId),
      });
      await queryClient.invalidateQueries({
        queryKey: recommendationHistoryQueryKeys.all,
      });
    },
  });
}

export function useClearRecommendationHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => recommendationHistoryRepository.clear(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: recommendationHistoryQueryKeys.all,
      });
    },
  });
}
