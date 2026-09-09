import { createInventoryPokemon } from "@/domain/inventory/factory";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export const MAX_BULK_INVENTORY_ENTRIES = 500;

export interface BulkInventoryMatch {
  readonly input: string;
  readonly pokemon: PokemonCatalogEntry;
}

export interface BulkInventoryIssue {
  readonly input: string;
  readonly message: string;
}

export interface BulkInventoryPreview {
  readonly matches: readonly BulkInventoryMatch[];
  readonly issues: readonly BulkInventoryIssue[];
  readonly truncated: boolean;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function defaultMoves(pokemon: PokemonCatalogEntry) {
  const recommended = pokemon.ranking?.recommendedMoveIds ?? [];
  const fastMoveId =
    recommended.find((moveId) =>
      pokemon.fastMoves.some((move) => move.id === moveId),
    ) ?? pokemon.fastMoves[0]?.id;
  const chargedMoveIds = recommended
    .filter((moveId) =>
      pokemon.chargedMoves.some((move) => move.id === moveId),
    )
    .slice(0, 2);

  if (!fastMoveId) return undefined;
  if (chargedMoveIds.length === 0 && pokemon.chargedMoves[0]) {
    chargedMoveIds.push(pokemon.chargedMoves[0].id);
  }

  return { fastMoveId, chargedMoveIds };
}

export function previewBulkInventory(
  source: string,
  catalog: PokemonCatalog,
): BulkInventoryPreview {
  const allInputs = source
    .split(/[\n,;]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const inputs = allInputs.slice(0, MAX_BULK_INVENTORY_ENTRIES);
  const available = catalog.entries.filter(
    (pokemon) =>
      pokemon.isReleased &&
      pokemon.defaultLeagueIvs !== undefined &&
      pokemon.fastMoves.length > 0 &&
      pokemon.chargedMoves.length > 0,
  );

  const matches: BulkInventoryMatch[] = [];
  const issues: BulkInventoryIssue[] = [];

  for (const input of inputs) {
    const key = normalize(input);
    const candidates = available.filter(
      (pokemon) =>
        normalize(pokemon.speciesId) === key ||
        normalize(pokemon.speciesName) === key,
    );

    if (candidates.length === 1) {
      matches.push({ input, pokemon: candidates[0]! });
    } else if (candidates.length > 1) {
      issues.push({
        input,
        message: "Multiple forms share that name. Use the exact form name or PvPoke ID.",
      });
    } else {
      issues.push({
        input,
        message: "No released Pokémon with PvPoke default IVs and moves matched.",
      });
    }
  }

  return {
    matches,
    issues,
    truncated: allInputs.length > MAX_BULK_INVENTORY_ENTRIES,
  };
}

export function createBulkInventoryRecords(
  matches: readonly BulkInventoryMatch[],
  catalog: PokemonCatalog,
): readonly InventoryPokemon[] {
  return matches.map(({ pokemon }) => {
    const ivs = pokemon.defaultLeagueIvs;
    const moveset = defaultMoves(pokemon);
    if (!ivs || !moveset) {
      throw new Error(`${pokemon.speciesName} has no complete PvPoke defaults.`);
    }

    return createInventoryPokemon(
      {
        speciesId: pokemon.speciesId,
        buildStatus: "current",
        currentBuild: {
          cp: calculateCombatPower(pokemon.baseStats, ivs, ivs.level),
          ivProfile: { source: "assumed-rank-1" },
          moveset,
        },
      },
      { catalog },
    );
  });
}
