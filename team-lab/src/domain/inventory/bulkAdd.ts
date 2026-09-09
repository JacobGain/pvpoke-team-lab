import { createInventoryPokemon } from "@/domain/inventory/factory";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export const MAX_BULK_INVENTORY_ENTRIES = 500;
export const BULK_INVENTORY_SUGGESTION_LIMIT = 8;

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

function searchKey(value: string): string {
  return normalize(value)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function availablePokemon(catalog: PokemonCatalog) {
  return catalog.entries.filter(
    (pokemon) =>
      pokemon.isReleased &&
      pokemon.defaultLeagueIvs !== undefined &&
      pokemon.fastMoves.length > 0 &&
      pokemon.chargedMoves.length > 0,
  );
}

export interface BulkInventoryInputRange {
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

export function bulkInventoryInputRangeAt(
  source: string,
  caret: number,
): BulkInventoryInputRange {
  const position = Math.max(0, Math.min(caret, source.length));
  const separator = /[\n,;]/u;
  let start = position;
  let end = position;

  while (start > 0 && !separator.test(source[start - 1]!)) start -= 1;
  while (start < position && /\s/u.test(source[start]!)) start += 1;
  while (end < source.length && !separator.test(source[end]!)) end += 1;

  return {
    start,
    end,
    query: source.slice(start, end).trim(),
  };
}

export function completeBulkInventoryInput(
  source: string,
  range: BulkInventoryInputRange,
  value: string,
): { readonly source: string; readonly caret: number } {
  const suffix = source.slice(range.end);
  const separator = suffix === "" ? "\n" : "";
  const nextSource = `${source.slice(0, range.start)}${value}${separator}${suffix}`;
  return {
    source: nextSource,
    caret: range.start + value.length + separator.length,
  };
}

export function suggestBulkInventoryPokemon(
  query: string,
  catalog: PokemonCatalog,
): readonly PokemonCatalogEntry[] {
  const key = searchKey(query);
  if (key.length < 2) return [];

  return availablePokemon(catalog)
    .map((pokemon) => {
      const name = searchKey(pokemon.speciesName);
      const id = searchKey(pokemon.speciesId);
      const score =
        name === key || id === key
          ? 0
          : name.startsWith(key)
            ? 1
            : id.startsWith(key)
              ? 2
              : name.includes(key)
                ? 3
                : id.includes(key)
                  ? 4
                  : undefined;
      return { pokemon, score };
    })
    .filter(
      (candidate): candidate is { pokemon: PokemonCatalogEntry; score: number } =>
        candidate.score !== undefined,
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.pokemon.speciesName.localeCompare(right.pokemon.speciesName),
    )
    .slice(0, BULK_INVENTORY_SUGGESTION_LIMIT)
    .map(({ pokemon }) => pokemon);
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
  const available = availablePokemon(catalog);

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
