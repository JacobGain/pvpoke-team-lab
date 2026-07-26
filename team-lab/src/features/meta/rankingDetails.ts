import { calculateEffectiveStats } from "@/domain/analysis/ivRankings";
import { getTypeEffectiveness } from "@/domain/analysis/matchupThresholds";
import type {
  CatalogMove,
  CatalogRankingStats,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export const POKEMON_TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
  "fairy",
] as const;

export interface DefensiveType {
  readonly type: string;
  readonly multiplier: number;
}

export interface DefensiveProfile {
  readonly weaknesses: readonly DefensiveType[];
  readonly resistances: readonly DefensiveType[];
}

export function buildDefensiveProfile(
  defenderTypes: readonly string[],
): DefensiveProfile {
  const effectiveness = POKEMON_TYPES.map((type) => ({
    type,
    multiplier: getTypeEffectiveness(type, defenderTypes),
  }));

  return {
    weaknesses: effectiveness
      .filter(({ multiplier }) => multiplier > 1)
      .sort(
        (left, right) =>
          right.multiplier - left.multiplier ||
          left.type.localeCompare(right.type),
      ),
    resistances: effectiveness
      .filter(({ multiplier }) => multiplier < 1)
      .sort(
        (left, right) =>
          left.multiplier - right.multiplier ||
          left.type.localeCompare(right.type),
      ),
  };
}

export function getRankingStats(
  pokemon: PokemonCatalogEntry,
): CatalogRankingStats | undefined {
  if (pokemon.ranking?.stats) {
    return pokemon.ranking.stats;
  }

  const ivs = pokemon.defaultGreatLeagueIvs;

  if (!ivs) {
    return undefined;
  }

  const stats = calculateEffectiveStats(pokemon, ivs, ivs.level);

  return {
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.hp,
    statProduct: stats.statProduct / 1_000,
  };
}

export function getMoveUsagePercent(
  pokemon: PokemonCatalogEntry,
  move: CatalogMove,
): number | undefined {
  const usage =
    move.kind === "fast"
      ? pokemon.ranking?.moveUsage?.fastMoves
      : pokemon.ranking?.moveUsage?.chargedMoves;
  const total = usage?.reduce(
    (sum, candidate) => sum + (candidate.uses ?? 0),
    0,
  );
  const uses = usage?.find(
    (candidate) => candidate.moveId === move.id,
  )?.uses;

  if (uses === undefined || total === undefined || total <= 0) {
    return undefined;
  }

  return (uses / total) * 100;
}

export function formatEffectiveness(multiplier: number): string {
  if (multiplier > 2) return "2.56×";
  if (multiplier > 1) return "1.6×";
  if (multiplier < 0.5) return "0.39×";
  return "0.63×";
}
