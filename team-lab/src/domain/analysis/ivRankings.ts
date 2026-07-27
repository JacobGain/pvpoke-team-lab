import type { InventoryIvs } from "@/domain/inventory/schemas";
import {
  calculateCombatPower,
  getCpMultiplier,
} from "@/domain/pokemon/combatPower";
import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";

export const GREAT_LEAGUE_CP_CAP = 1500;
export const GREAT_LEAGUE_RANKING_LEVEL_CAP = 50;
export const GENERAL_IV_FLOOR = 0;

export interface EffectiveStats {
  readonly attack: number;
  readonly defense: number;
  readonly hp: number;
  readonly statProduct: number;
}

export interface IvRankedCombination {
  readonly rank: number;
  readonly level: number;
  readonly cp: number;
  readonly ivs: InventoryIvs;
  readonly stats: EffectiveStats;
}

export interface IvRankingSummary {
  readonly rank: number;
  readonly count: number;
  readonly percentile: number;
  readonly combination: IvRankedCombination;
  readonly rankOne: IvRankedCombination;
  readonly highestAttack: IvRankedCombination;
  readonly highestDefense: IvRankedCombination;
  readonly attackPercentile: number;
  readonly statProductPercentage: number;
}

const rankingCache = new Map<string, readonly IvRankedCombination[]>();

function ivKey(ivs: InventoryIvs): string {
  return `${ivs.attack}/${ivs.defense}/${ivs.hp}`;
}

function rankingCacheKey(
  pokemon: PokemonCatalogEntry,
  cpCap: number,
  levelCap: number,
): string {
  return [
    pokemon.speciesId,
    pokemon.baseStats.attack,
    pokemon.baseStats.defense,
    pokemon.baseStats.hp,
    pokemon.levelFloor,
    cpCap,
    levelCap,
  ].join(":");
}

export function calculateEffectiveStats(
  pokemon: PokemonCatalogEntry,
  ivs: InventoryIvs,
  level: number,
): EffectiveStats {
  const multiplier = getCpMultiplier(level);

  if (multiplier === undefined) {
    throw new RangeError(`Unsupported Pokémon level ${level}.`);
  }

  const attack = multiplier * (pokemon.baseStats.attack + ivs.attack);
  const defense = multiplier * (pokemon.baseStats.defense + ivs.defense);
  const hp = Math.max(
    Math.floor(multiplier * (pokemon.baseStats.hp + ivs.hp)),
    10,
  );

  return {
    attack,
    defense,
    hp,
    statProduct: attack * defense * hp,
  };
}

export function findHighestLegalLevel(
  pokemon: PokemonCatalogEntry,
  ivs: InventoryIvs,
  cpCap = GREAT_LEAGUE_CP_CAP,
  levelCap = GREAT_LEAGUE_RANKING_LEVEL_CAP,
): { readonly level: number; readonly cp: number } | undefined {
  const maximumLevel = Math.min(levelCap, pokemon.levelCap);

  for (
    let level = maximumLevel;
    level >= pokemon.levelFloor;
    level -= 0.5
  ) {
    const cp = calculateCombatPower(pokemon.baseStats, ivs, level);

    if (cp <= cpCap) {
      return { level, cp };
    }
  }

  return undefined;
}

export function generateIvRankingTable(
  pokemon: PokemonCatalogEntry,
  cpCap = GREAT_LEAGUE_CP_CAP,
  levelCap = GREAT_LEAGUE_RANKING_LEVEL_CAP,
): readonly IvRankedCombination[] {
  const cacheKey = rankingCacheKey(pokemon, cpCap, levelCap);
  const cached = rankingCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const combinations: Omit<IvRankedCombination, "rank">[] = [];

  // This iteration order matches PvPoke's stable tie order before sorting.
  for (let hp = 15; hp >= GENERAL_IV_FLOOR; hp -= 1) {
    for (let defense = 15; defense >= GENERAL_IV_FLOOR; defense -= 1) {
      for (let attack = 15; attack >= GENERAL_IV_FLOOR; attack -= 1) {
        const ivs = { attack, defense, hp };
        const legalLevel = findHighestLegalLevel(
          pokemon,
          ivs,
          cpCap,
          levelCap,
        );

        if (!legalLevel) {
          continue;
        }

        combinations.push({
          level: legalLevel.level,
          cp: legalLevel.cp,
          ivs,
          stats: calculateEffectiveStats(pokemon, ivs, legalLevel.level),
        });
      }
    }
  }

  combinations.sort(
    (left, right) => right.stats.statProduct - left.stats.statProduct,
  );
  const ranked = Object.freeze(
    combinations.map((combination, index) =>
      Object.freeze({ ...combination, rank: index + 1 }),
    ),
  );

  rankingCache.set(cacheKey, ranked);
  return ranked;
}

export function analyzeIvRanking(
  pokemon: PokemonCatalogEntry,
  ivs: InventoryIvs,
): IvRankingSummary {
  const table = generateIvRankingTable(pokemon);
  const combination = table.find(
    (candidate) => ivKey(candidate.ivs) === ivKey(ivs),
  );
  const rankOne = table[0];

  if (!combination || !rankOne) {
    throw new Error(
      `${pokemon.speciesName} has no valid Open Great League IV ranking for ${ivKey(ivs)}.`,
    );
  }
  const highestAttack = table.reduce((highest, candidate) =>
    candidate.stats.attack > highest.stats.attack ? candidate : highest,
  );
  const highestDefense = table.reduce((highest, candidate) =>
    candidate.stats.defense > highest.stats.defense ? candidate : highest,
  );

  return {
    rank: combination.rank,
    count: table.length,
    percentile:
      table.length === 1
        ? 100
        : ((table.length - combination.rank) / (table.length - 1)) * 100,
    combination,
    rankOne,
    highestAttack,
    highestDefense,
    attackPercentile:
      (table.filter(
        (candidate) =>
          candidate.stats.attack <= combination.stats.attack,
      ).length /
        table.length) *
      100,
    statProductPercentage:
      (combination.stats.statProduct / rankOne.stats.statProduct) * 100,
  };
}

export function clearIvRankingCache(): void {
  rankingCache.clear();
}
