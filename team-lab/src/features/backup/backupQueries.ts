import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  TeamLabRestoreData,
  TeamLabRestoreMode,
} from "@/domain/backup/teamLabBackup";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { inventoryQueryKeys } from "@/features/inventory/inventoryQueries";
import { savedTeamQueryKeys } from "@/features/teams/savedTeamQueries";
import { teamLabBackupRepository } from "@/infrastructure/backup";

export function useRestoreTeamLabBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      backup,
      mode,
      catalog,
    }: {
      readonly backup: TeamLabRestoreData;
      readonly mode: TeamLabRestoreMode;
      readonly catalog: PokemonCatalog;
    }) => teamLabBackupRepository.restore(backup, mode, catalog),
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
