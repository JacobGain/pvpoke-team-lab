import {
  InvalidStoredSavedTeamError,
  SavedTeamAlreadyExistsError,
  SavedTeamNotFoundError,
  type SavedTeamRepository,
} from "@/domain/teams/repository";
import {
  savedTeamSchema,
  type SavedTeam,
} from "@/domain/teams/schemas";
import type { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

function parseStoredTeam(value: unknown): SavedTeam {
  const result = savedTeamSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const teamId =
    typeof value === "object" &&
    value !== null &&
    "teamId" in value &&
    typeof value.teamId === "string"
      ? value.teamId
      : "unknown";

  throw new InvalidStoredSavedTeamError(teamId, result.error);
}

function isConstraintError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "ConstraintError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ConstraintError")
  );
}

export class DexieSavedTeamRepository implements SavedTeamRepository {
  constructor(private readonly database: TeamLabDatabase) {}

  async list(): Promise<readonly SavedTeam[]> {
    const teams = await this.database.savedTeams
      .orderBy("updatedAt")
      .reverse()
      .toArray();

    return teams.map(parseStoredTeam);
  }

  async get(teamId: string): Promise<SavedTeam | undefined> {
    const team = await this.database.savedTeams.get(teamId);
    return team === undefined ? undefined : parseStoredTeam(team);
  }

  async create(team: SavedTeam): Promise<void> {
    const validatedTeam = savedTeamSchema.parse(team);

    try {
      await this.database.savedTeams.add(validatedTeam);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new SavedTeamAlreadyExistsError(team.teamId);
      }
      throw error;
    }
  }

  async update(team: SavedTeam): Promise<void> {
    const validatedTeam = savedTeamSchema.parse(team);
    const updatedCount = await this.database.savedTeams.update(
      team.teamId,
      validatedTeam,
    );

    if (updatedCount === 0) {
      throw new SavedTeamNotFoundError(team.teamId);
    }
  }

  async delete(teamId: string): Promise<void> {
    const existingTeam = await this.database.savedTeams.get(teamId);

    if (existingTeam === undefined) {
      throw new SavedTeamNotFoundError(teamId);
    }

    await this.database.savedTeams.delete(teamId);
  }

  count(): Promise<number> {
    return this.database.savedTeams.count();
  }
}
