import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";
import type { SavedTeam, SavedTeamPosition } from "@/domain/teams/schemas";

interface ResolvedSavedTeamMemberBase {
  readonly position: SavedTeamPosition;
  readonly inventoryId: string;
}

export type ResolvedSavedTeamMember =
  | (ResolvedSavedTeamMemberBase & {
      readonly status: "resolved";
      readonly inventory: InventoryPokemon;
      readonly pokemon: PokemonCatalogEntry;
    })
  | (ResolvedSavedTeamMemberBase & {
      readonly status: "missing-inventory";
    })
  | (ResolvedSavedTeamMemberBase & {
      readonly status: "missing-species";
      readonly inventory: InventoryPokemon;
    });

export interface ResolvedSavedTeam {
  readonly team: SavedTeam;
  readonly members: readonly ResolvedSavedTeamMember[];
  readonly isComplete: boolean;
}

export function resolveSavedTeam(
  team: SavedTeam,
  inventory: readonly InventoryPokemon[],
  catalogEntries: readonly PokemonCatalogEntry[],
): ResolvedSavedTeam {
  const inventoryById = new Map(
    inventory.map((record) => [record.inventoryId, record]),
  );
  const catalogById = new Map(
    catalogEntries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const references = [
    ["lead", team.members.leadInventoryId],
    ["switch", team.members.switchInventoryId],
    ["closer", team.members.closerInventoryId],
  ] as const;
  const members = references.map(([position, inventoryId]) => {
    const record = inventoryById.get(inventoryId);

    if (!record) {
      return {
        position,
        inventoryId,
        status: "missing-inventory" as const,
      };
    }

    const speciesId =
      record.buildStatus === "planned"
        ? record.plannedBuild.targetSpeciesId
        : record.speciesId;
    const pokemon = catalogById.get(speciesId);

    return pokemon
      ? {
          position,
          inventoryId,
          inventory: record,
          pokemon,
          status: "resolved" as const,
        }
      : {
          position,
          inventoryId,
          inventory: record,
          status: "missing-species" as const,
        };
  });

  return {
    team,
    members,
    isComplete: members.every((member) => member.status === "resolved"),
  };
}
