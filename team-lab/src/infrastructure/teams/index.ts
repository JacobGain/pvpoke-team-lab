import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieSavedTeamRepository } from "@/infrastructure/teams/DexieSavedTeamRepository";

export const savedTeamRepository = new DexieSavedTeamRepository(
  teamLabDatabase,
);

export { DexieSavedTeamRepository };
