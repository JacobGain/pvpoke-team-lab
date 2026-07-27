import { useMutation, useQueryClient } from "@tanstack/react-query";

import { inventoryQueryKeys } from "@/features/inventory/inventoryQueries";
import { savedTeamQueryKeys } from "@/features/teams/savedTeamQueries";
import { localDataMaintenanceRepository } from "@/infrastructure/maintenance";

function useLocalDataMutation(
  mutationFn: () => Promise<{
    readonly removedInventoryCount: number;
    readonly removedSavedTeamCount: number;
  }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: inventoryQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: savedTeamQueryKeys.all,
        }),
      ]);
    },
  });
}

export function useClearSavedTeams() {
  return useLocalDataMutation(() =>
    localDataMaintenanceRepository.clearSavedTeams(),
  );
}

export function useClearGuardedInventory() {
  return useLocalDataMutation(() =>
    localDataMaintenanceRepository.clearInventory(),
  );
}

export function useResetAllLocalData() {
  return useLocalDataMutation(() =>
    localDataMaintenanceRepository.resetAll(),
  );
}
