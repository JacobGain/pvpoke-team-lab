import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { SavedTeam } from "@/domain/teams/schemas";
import { savedTeamRepository } from "@/infrastructure/teams";

export const savedTeamQueryKeys = {
  all: ["saved-teams"] as const,
  list: () => [...savedTeamQueryKeys.all, "list"] as const,
  detail: (teamId: string) =>
    [...savedTeamQueryKeys.all, "detail", teamId] as const,
};

export const savedTeamListQueryOptions = queryOptions({
  queryKey: savedTeamQueryKeys.list(),
  queryFn: () => savedTeamRepository.list(),
});

export function useSavedTeamList() {
  return useQuery(savedTeamListQueryOptions);
}

export function useSavedTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: savedTeamQueryKeys.detail(teamId ?? ""),
    queryFn: () => savedTeamRepository.get(teamId!),
    enabled: teamId !== undefined,
  });
}

export function useCreateSavedTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (team: SavedTeam) => savedTeamRepository.create(team),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: savedTeamQueryKeys.all,
      });
    },
  });
}

export function useUpdateSavedTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (team: SavedTeam) => savedTeamRepository.update(team),
    onSuccess: async (_, team) => {
      queryClient.setQueryData(savedTeamQueryKeys.detail(team.teamId), team);
      await queryClient.invalidateQueries({
        queryKey: savedTeamQueryKeys.all,
      });
    },
  });
}

export function useDeleteSavedTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => savedTeamRepository.delete(teamId),
    onSuccess: async (_, teamId) => {
      queryClient.removeQueries({
        queryKey: savedTeamQueryKeys.detail(teamId),
      });
      await queryClient.invalidateQueries({
        queryKey: savedTeamQueryKeys.all,
      });
    },
  });
}
