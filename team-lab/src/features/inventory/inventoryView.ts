import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

export type InventoryViewStatus = "all" | "current" | "planned";
export type InventoryViewSort = "updated" | "species" | "cp";

export interface InventoryViewOptions {
  readonly search: string;
  readonly status: InventoryViewStatus;
  readonly favoriteOnly: boolean;
  readonly sort: InventoryViewSort;
}

export function filterAndSortInventory(
  records: readonly InventoryPokemon[],
  catalog: PokemonCatalog | undefined,
  options: InventoryViewOptions,
): readonly InventoryPokemon[] {
  const normalizedSearch = options.search.trim().toLocaleLowerCase();
  const catalogById = new Map(
    catalog?.entries.map((entry) => [entry.speciesId, entry]) ?? [],
  );

  return [...records]
    .filter((record) => {
      const pokemon = catalogById.get(record.speciesId);

      return (
        (options.status === "all" ||
          record.buildStatus === options.status) &&
        (!options.favoriteOnly || record.favorite) &&
        (!normalizedSearch ||
          record.speciesId.toLocaleLowerCase().includes(normalizedSearch) ||
          pokemon?.speciesName
            .toLocaleLowerCase()
            .includes(normalizedSearch) ||
          record.notes.toLocaleLowerCase().includes(normalizedSearch))
      );
    })
    .sort((left, right) => {
      if (options.sort === "cp") {
        return right.currentBuild.cp - left.currentBuild.cp;
      }

      if (options.sort === "species") {
        const leftName =
          catalogById.get(left.speciesId)?.speciesName ?? left.speciesId;
        const rightName =
          catalogById.get(right.speciesId)?.speciesName ?? right.speciesId;
        return leftName.localeCompare(rightName);
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}
