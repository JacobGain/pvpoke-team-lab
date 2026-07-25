import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieTeamLabBackupRepository } from "@/infrastructure/backup/DexieTeamLabBackupRepository";

export const teamLabBackupRepository =
  new DexieTeamLabBackupRepository(teamLabDatabase);

export { DexieTeamLabBackupRepository };
