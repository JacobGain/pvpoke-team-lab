import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieLocalDataMaintenanceRepository } from "@/infrastructure/maintenance/DexieLocalDataMaintenanceRepository";

export const localDataMaintenanceRepository =
  new DexieLocalDataMaintenanceRepository(teamLabDatabase);

export { DexieLocalDataMaintenanceRepository };
