import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
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
  catalog?: PokemonCatalog,
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
    const original = inventoryById.get(inventoryId);
    const selected = original && catalog ? projectInventoryForCatalog(original, catalog) : original;

    if (!original || !selected) {
      return {
        position,
        inventoryId,
        status: "missing-inventory" as const,
      };
    }

    const speciesId =
      selected.buildStatus === "planned"
        ? selected.plannedBuild.targetSpeciesId
        : selected.speciesId;
    const pokemon = catalogById.get(speciesId);

    return pokemon
      ? {
          position,
          inventoryId,
          inventory: original,
          pokemon,
          status: "resolved" as const,
        }
      : {
          position,
          inventoryId,
          inventory: original,
          status: "missing-species" as const,
        };
  });

  return {
    team,
    members,
    isComplete: members.every((member) => member.status === "resolved"),
  };
}
