import type {
  AnalyzedPokemonBuild,
  AnalyzedLevel,
} from "@/domain/analysis/buildAnalysis";
import { calculateEffectiveStats } from "@/domain/analysis/ivRankings";
import type {
  CatalogMove,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

const BATTLE_BONUS = 1.2999999523162842;
const STAB = 1.2000000476837158;
const SUPER_EFFECTIVE = 1.600000023841858;
const RESISTED = 0.625;
const DOUBLE_RESISTED = 0.390625;
const SHADOW_ATTACK = 1.2;
const SHADOW_DEFENSE = 0.83333331;

const TYPE_TRAITS: Readonly<
  Record<string, { weak: readonly string[]; resist: readonly string[]; immune: readonly string[] }>
> = {
  normal: { weak: ["fighting"], resist: [], immune: ["ghost"] },
  fighting: { weak: ["flying", "psychic", "fairy"], resist: ["rock", "bug", "dark"], immune: [] },
  flying: { weak: ["rock", "electric", "ice"], resist: ["fighting", "bug", "grass"], immune: ["ground"] },
  poison: { weak: ["ground", "psychic"], resist: ["fighting", "poison", "bug", "fairy", "grass"], immune: [] },
  ground: { weak: ["water", "grass", "ice"], resist: ["poison", "rock"], immune: ["electric"] },
  rock: { weak: ["fighting", "ground", "steel", "water", "grass"], resist: ["normal", "flying", "poison", "fire"], immune: [] },
  bug: { weak: ["flying", "rock", "fire"], resist: ["fighting", "ground", "grass"], immune: [] },
  ghost: { weak: ["ghost", "dark"], resist: ["poison", "bug"], immune: ["normal", "fighting"] },
  steel: { weak: ["fighting", "ground", "fire"], resist: ["normal", "flying", "rock", "bug", "steel", "grass", "psychic", "ice", "dragon", "fairy"], immune: ["poison"] },
  fire: { weak: ["ground", "rock", "water"], resist: ["bug", "steel", "fire", "grass", "ice", "fairy"], immune: [] },
  water: { weak: ["grass", "electric"], resist: ["steel", "fire", "water", "ice"], immune: [] },
  grass: { weak: ["flying", "poison", "bug", "fire", "ice"], resist: ["ground", "water", "grass", "electric"], immune: [] },
  electric: { weak: ["ground"], resist: ["flying", "steel", "electric"], immune: [] },
  psychic: { weak: ["bug", "ghost", "dark"], resist: ["fighting", "psychic"], immune: [] },
  ice: { weak: ["fighting", "rock", "steel", "fire"], resist: ["ice"], immune: [] },
  dragon: { weak: ["ice", "dragon", "fairy"], resist: ["fire", "water", "grass", "electric"], immune: [] },
  dark: { weak: ["fighting", "bug", "fairy"], resist: ["ghost", "dark"], immune: ["psychic"] },
  fairy: { weak: ["poison", "steel"], resist: ["fighting", "bug", "dark"], immune: ["dragon"] },
};

export interface ThresholdBuild {
  readonly pokemon: PokemonCatalogEntry;
  readonly level: AnalyzedLevel;
}

export interface DamageThreshold {
  readonly move: CatalogMove;
  readonly damage: number;
  readonly effectiveness: number;
  readonly stab: boolean;
  readonly turns: number;
}

export interface OffensiveBreakpoint extends DamageThreshold {
  readonly nextDamage: number;
  readonly attackRequiredForNextDamage: number;
  readonly attackShortfall: number;
  readonly achievableWithinGeneralIvSpace: boolean;
}

export interface DefensiveBulkpoint extends DamageThreshold {
  readonly reducedDamage: number | undefined;
  readonly defenseRequiredForReducedDamage: number | undefined;
  readonly defenseShortfall: number | undefined;
  readonly achievableWithinGeneralIvSpace: boolean;
}

export interface NamedOpponentLevelAnalysis {
  readonly level: number;
  readonly cmp: "win" | "tie" | "loss";
  readonly attackDifference: number;
  readonly outgoing: OffensiveBreakpoint;
  readonly incoming: DefensiveBulkpoint;
}

export interface NamedOpponentAnalysis {
  readonly opponent: PokemonCatalogEntry;
  readonly opponentLevel: number;
  readonly opponentIvs: { readonly attack: number; readonly defense: number; readonly hp: number };
  readonly opponentFastMove: CatalogMove;
  readonly levels: readonly NamedOpponentLevelAnalysis[];
  readonly dataVersion: string;
  readonly matchupImpact: "not-simulated";
}

export function getTypeEffectiveness(
  moveType: string,
  defenderTypes: readonly string[],
): number {
  return defenderTypes.reduce((effectiveness, defenderType) => {
    const traits = TYPE_TRAITS[defenderType];

    if (!traits) {
      throw new Error(`Unsupported Pokémon type ${defenderType}.`);
    }
    if (traits.weak.includes(moveType)) return effectiveness * SUPER_EFFECTIVE;
    if (traits.resist.includes(moveType)) return effectiveness * RESISTED;
    if (traits.immune.includes(moveType)) return effectiveness * DOUBLE_RESISTED;
    return effectiveness;
  }, 1);
}

function moveMultiplier(
  move: CatalogMove,
  attacker: PokemonCatalogEntry,
  defender: PokemonCatalogEntry,
): { readonly value: number; readonly effectiveness: number; readonly stab: boolean } {
  const stab = attacker.types.includes(move.type);
  const effectiveness = getTypeEffectiveness(move.type, defender.types);

  return {
    value:
      move.power *
      (stab ? STAB : 1) *
      effectiveness *
      0.5 *
      BATTLE_BONUS,
    effectiveness,
    stab,
  };
}

function calculateDamage(
  move: CatalogMove,
  attacker: ThresholdBuild,
  defender: ThresholdBuild,
): DamageThreshold {
  const multiplier = moveMultiplier(move, attacker.pokemon, defender.pokemon);
  const attack =
    attacker.level.stats.attack *
    (attacker.pokemon.isShadow ? SHADOW_ATTACK : 1);
  const defense =
    defender.level.stats.defense *
    (defender.pokemon.isShadow ? SHADOW_DEFENSE : 1);

  return {
    move,
    damage: Math.floor(multiplier.value * (attack / defense)) + 1,
    effectiveness: multiplier.effectiveness,
    stab: multiplier.stab,
    turns: move.turns,
  };
}

function recommendedFastMove(pokemon: PokemonCatalogEntry): CatalogMove {
  const move = pokemon.fastMoves.find((candidate) =>
    pokemon.ranking?.recommendedMoveIds.includes(candidate.id),
  );

  if (!move) {
    throw new Error(
      `${pokemon.speciesName} has no resolvable PvPoke-recommended fast move.`,
    );
  }

  return move;
}

export function analyzeNamedOpponent(
  build: AnalyzedPokemonBuild,
  pokemon: PokemonCatalogEntry,
  opponent: PokemonCatalogEntry,
): NamedOpponentAnalysis {
  const opponentIvs = opponent.defaultGreatLeagueIvs;

  if (!opponentIvs) {
    throw new Error(`${opponent.speciesName} has no default Great League build.`);
  }

  const opponentStats = calculateEffectiveStats(
    opponent,
    opponentIvs,
    opponentIvs.level,
  );
  const opponentLevel: AnalyzedLevel = {
    level: opponentIvs.level,
    isBestBuddy: opponentIvs.level > opponent.levelCap,
    stats: opponentStats,
  };
  const userFastMove = pokemon.fastMoves.find(
    (move) => move.id === build.moves.enteredFastMoveId,
  );

  if (!userFastMove) {
    throw new Error(`${pokemon.speciesName}'s entered fast move is unavailable.`);
  }

  const opponentFastMove = recommendedFastMove(opponent);
  const opponentBuild = { pokemon: opponent, level: opponentLevel };

  return {
    opponent,
    opponentLevel: opponentLevel.level,
    opponentIvs: {
      attack: opponentIvs.attack,
      defense: opponentIvs.defense,
      hp: opponentIvs.hp,
    },
    opponentFastMove,
    levels: build.levels.map((level) => {
      const userBuild = { pokemon, level };
      const outgoingDamage = calculateDamage(
        userFastMove,
        userBuild,
        opponentBuild,
      );
      const outgoingMultiplier = moveMultiplier(
        userFastMove,
        pokemon,
        opponent,
      );
      const opponentDefense =
        opponentStats.defense *
        (opponent.isShadow ? SHADOW_DEFENSE : 1);
      const attackRequiredForNextDamage =
        (outgoingDamage.damage * opponentDefense) /
        (outgoingMultiplier.value *
          (pokemon.isShadow ? SHADOW_ATTACK : 1));
      const incomingDamage = calculateDamage(
        opponentFastMove,
        opponentBuild,
        userBuild,
      );
      const incomingMultiplier = moveMultiplier(
        opponentFastMove,
        opponent,
        pokemon,
      );
      const reducedDamage =
        incomingDamage.damage > 1 ? incomingDamage.damage - 1 : undefined;
      const defenseRequiredForReducedDamage =
        reducedDamage === undefined
          ? undefined
          : (incomingMultiplier.value *
              opponentStats.attack *
              (opponent.isShadow ? SHADOW_ATTACK : 1)) /
            reducedDamage /
            (pokemon.isShadow ? SHADOW_DEFENSE : 1);
      const attackDifference = level.stats.attack - opponentStats.attack;

      return {
        level: level.level,
        cmp:
          Math.abs(attackDifference) < 1e-9
            ? "tie"
            : attackDifference > 0
              ? "win"
              : "loss",
        attackDifference,
        outgoing: {
          ...outgoingDamage,
          nextDamage: outgoingDamage.damage + 1,
          attackRequiredForNextDamage,
          attackShortfall: Math.max(
            attackRequiredForNextDamage - level.stats.attack,
            0,
          ),
          achievableWithinGeneralIvSpace:
            build.ivRanking.highestAttack.stats.attack >=
            attackRequiredForNextDamage,
        },
        incoming: {
          ...incomingDamage,
          reducedDamage,
          defenseRequiredForReducedDamage,
          defenseShortfall:
            defenseRequiredForReducedDamage === undefined
              ? undefined
              : Math.max(
                  defenseRequiredForReducedDamage - level.stats.defense,
                  0,
                ),
          achievableWithinGeneralIvSpace:
            defenseRequiredForReducedDamage !== undefined &&
            build.ivRanking.highestDefense.stats.defense >=
              defenseRequiredForReducedDamage,
        },
      };
    }),
    dataVersion: build.dataVersion,
    matchupImpact: "not-simulated",
  };
}
