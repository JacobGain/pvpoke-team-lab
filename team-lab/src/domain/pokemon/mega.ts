import type { PokemonCatalogEntry } from "./catalog";

export type MegaLevel = 1 | 2 | 3 | 4;

export function ownedLevelForBattleLevel(level: number, megaLevel?: number): number {
  return Math.max(1, level - (megaLevel === 4 ? 2 : 0));
}

export function isMega(pokemon: PokemonCatalogEntry): boolean {
  return pokemon.tags.includes("mega");
}

export function defaultMegaLevel(pokemon: PokemonCatalogEntry): MegaLevel | undefined {
  return isMega(pokemon) ? pokemon.tags.includes("supermega") ? 4 : 3 : undefined;
}

/** Effective battle cap, not the level of a purchasable power-up. */
export function megaBattleLevelCap(pokemon: PokemonCatalogEntry, megaLevel = defaultMegaLevel(pokemon)): number {
  return isMega(pokemon) && megaLevel === 4 ? 52 : pokemon.levelCap;
}

export function validateMegaSettings(
  pokemon: PokemonCatalogEntry,
  megaLevel: MegaLevel | undefined,
  extraChargedMoveId: string | undefined,
): readonly string[] {
  const issues: string[] = [];
  if (megaLevel !== undefined && !isMega(pokemon)) issues.push("Mega level requires a Mega or Primal form.");
  if (extraChargedMoveId && (!isMega(pokemon) || !pokemon.extraChargedMoves?.some(move => move.id === extraChargedMoveId))) {
    issues.push(`${extraChargedMoveId} is not an extra charged attack for ${pokemon.speciesName}.`);
  }
  return issues;
}
