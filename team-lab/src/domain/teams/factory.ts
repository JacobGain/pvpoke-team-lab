import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import {
  GREAT_LEAGUE_FORMAT_ID,
  SAVED_TEAM_SCHEMA_VERSION,
  savedTeamSchema,
  type SavedTeam,
  type SavedTeamMembers,
} from "@/domain/teams/schemas";
import { assertSavedTeamLegality } from "@/domain/teams/validation";

export interface SavedTeamInput {
  readonly name: string;
  readonly members: SavedTeamMembers;
  readonly notes?: string;
}

export interface SavedTeamFactoryDependencies {
  readonly inventory: readonly InventoryPokemon[];
  readonly catalog: PokemonCatalog;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

export function createSavedTeam(
  input: SavedTeamInput,
  dependencies: SavedTeamFactoryDependencies,
): SavedTeam {
  const timestamp = (dependencies.now ?? (() => new Date()))().toISOString();
  const team = savedTeamSchema.parse({
    schemaVersion: SAVED_TEAM_SCHEMA_VERSION,
    teamId: dependencies.createId?.() ?? globalThis.crypto.randomUUID(),
    name: input.name,
    formatId: GREAT_LEAGUE_FORMAT_ID,
    members: input.members,
    notes: input.notes ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assertSavedTeamLegality(team, dependencies.inventory, dependencies.catalog);
  return team;
}

export function updateSavedTeam(
  existingTeam: SavedTeam,
  input: SavedTeamInput,
  dependencies: SavedTeamFactoryDependencies,
): SavedTeam {
  const team = savedTeamSchema.parse({
    ...existingTeam,
    name: input.name,
    members: input.members,
    notes: input.notes ?? "",
    lastAnalyzedDataVersion: undefined,
    updatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
  });

  assertSavedTeamLegality(team, dependencies.inventory, dependencies.catalog);
  return team;
}
