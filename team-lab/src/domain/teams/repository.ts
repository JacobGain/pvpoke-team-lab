import type { SavedTeam } from "@/domain/teams/schemas";

export interface SavedTeamRepository {
  list(): Promise<readonly SavedTeam[]>;
  get(teamId: string): Promise<SavedTeam | undefined>;
  create(team: SavedTeam): Promise<void>;
  update(team: SavedTeam): Promise<void>;
  delete(teamId: string): Promise<void>;
  count(): Promise<number>;
}

export class SavedTeamAlreadyExistsError extends Error {
  constructor(teamId: string) {
    super(`Saved team ${teamId} already exists.`);
    this.name = "SavedTeamAlreadyExistsError";
  }
}

export class SavedTeamNotFoundError extends Error {
  constructor(teamId: string) {
    super(`Saved team ${teamId} does not exist.`);
    this.name = "SavedTeamNotFoundError";
  }
}

export class InvalidStoredSavedTeamError extends Error {
  readonly teamId: string;
  override readonly cause: unknown;

  constructor(teamId: string, cause: unknown) {
    super(`Stored saved team ${teamId} does not match a supported schema.`);
    this.name = "InvalidStoredSavedTeamError";
    this.teamId = teamId;
    this.cause = cause;
  }
}
