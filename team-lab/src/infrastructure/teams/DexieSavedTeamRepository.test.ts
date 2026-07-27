import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InvalidStoredSavedTeamError,
  SavedTeamAlreadyExistsError,
  SavedTeamNotFoundError,
} from "@/domain/teams/repository";
import {
  SAVED_TEAM_SCHEMA_VERSION,
  savedTeamSchema,
  type SavedTeam,
} from "@/domain/teams/schemas";
import { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieSavedTeamRepository } from "@/infrastructure/teams/DexieSavedTeamRepository";

const teamId = "75a53aca-f3d7-476b-a14e-5559c8a7c4bb";
let database: TeamLabDatabase;
let repository: DexieSavedTeamRepository;

function createTeam(): SavedTeam {
  return savedTeamSchema.parse({
    schemaVersion: SAVED_TEAM_SCHEMA_VERSION,
    teamId,
    name: "Waterline",
    formatId: "great-league",
    members: {
      leadInventoryId: "78ce2157-a008-49a1-bbcc-563998b76800",
      switchInventoryId: "fd17fe2f-1d87-4879-8850-d95476cd9070",
      closerInventoryId: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
    },
    notes: "",
    createdAt: "2026-07-25T14:00:00.000Z",
    updatedAt: "2026-07-25T14:00:00.000Z",
  });
}

beforeEach(() => {
  database = new TeamLabDatabase(`team-lab-team-test-${crypto.randomUUID()}`, {
    indexedDB,
    IDBKeyRange,
  });
  repository = new DexieSavedTeamRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe("DexieSavedTeamRepository", () => {
  it("creates, reads, updates, lists, counts, and deletes a team", async () => {
    const team = createTeam();
    await repository.create(team);

    expect(await repository.count()).toBe(1);
    expect(await repository.get(teamId)).toEqual(team);
    expect(await repository.list()).toEqual([team]);

    const updated = savedTeamSchema.parse({
      ...team,
      name: "Updated",
      updatedAt: "2026-07-25T15:00:00.000Z",
    });
    await repository.update(updated);
    expect(await repository.get(teamId)).toEqual(updated);

    await repository.delete(teamId);
    expect(await repository.count()).toBe(0);
  });

  it("distinguishes duplicate creates and missing mutations", async () => {
    const team = createTeam();
    await repository.create(team);

    await expect(repository.create(team)).rejects.toBeInstanceOf(
      SavedTeamAlreadyExistsError,
    );
    await expect(
      repository.update({ ...team, teamId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(SavedTeamNotFoundError);
    await expect(
      repository.delete(crypto.randomUUID()),
    ).rejects.toBeInstanceOf(SavedTeamNotFoundError);
  });

  it("reports invalid stored teams without deleting them", async () => {
    await database.savedTeams.put({
      ...createTeam(),
      schemaVersion: 999,
    } as never);

    await expect(repository.get(teamId)).rejects.toBeInstanceOf(
      InvalidStoredSavedTeamError,
    );
    expect(await database.savedTeams.count()).toBe(1);
  });
});
