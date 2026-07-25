import {
  calculateEffectiveStats,
  type EffectiveStats,
} from "@/domain/analysis/ivRankings";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import type {
  CatalogRoleScores,
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import type {
  ExactSimulationBuild,
  ShieldCount,
  TeamRankerAdapter,
  TeamRankerRequest,
  TeamRankerResult,
} from "@/domain/simulation/contracts";

export const META_TARGET_LIMITS = [5, 10, 20, 48] as const;
export type MetaTargetLimit = (typeof META_TARGET_LIMITS)[number];

export type OrderedExactTeamBuilds = readonly [
  ExactSimulationBuild,
  ExactSimulationBuild,
  ExactSimulationBuild,
];

export interface TeamRankerContext {
  readonly kind: "saved-team" | "recommendation";
  readonly id: string;
  readonly name: string;
}

export interface TeamRankerScope {
  readonly context: TeamRankerContext;
  readonly targetLimit: MetaTargetLimit;
  readonly selectedTargetCount: number;
  readonly availableTargetCount: number;
  readonly teamShields: ShieldCount;
  readonly targetShields: ShieldCount;
  readonly targetSpeciesIds: readonly string[];
}

export interface TeamMemberScoreEvidence {
  readonly position: "lead" | "switch" | "closer";
  readonly speciesId: string;
  readonly stats: EffectiveStats;
  readonly roleScores?: CatalogRoleScores;
}

export interface TeamTargetScoreEvidence {
  readonly speciesId: string;
  readonly stats: EffectiveStats;
}

export interface TeamScoreEvidence {
  readonly members: readonly TeamMemberScoreEvidence[];
  readonly targets: readonly TeamTargetScoreEvidence[];
}

export interface TeamRankerPreparedRequest {
  readonly request: TeamRankerRequest;
  readonly scope: TeamRankerScope;
  readonly evidence: TeamScoreEvidence;
}

export interface TeamRankerRun {
  readonly scope: TeamRankerScope;
  readonly request?: TeamRankerRequest;
  readonly result: TeamRankerResult;
  readonly evidence: TeamScoreEvidence;
  readonly durationMs: number;
  readonly performance:
    | "within-interactive-budget"
    | "slow"
    | "very-slow";
}

export class TeamRankerPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamRankerPreparationError";
  }
}

function metaDefaultBuild(
  pokemon: PokemonCatalogEntry,
): ExactSimulationBuild | undefined {
  const ivs = pokemon.defaultGreatLeagueIvs;
  const recommendedMoveIds = pokemon.ranking?.recommendedMoveIds;

  if (!ivs || !recommendedMoveIds) {
    return undefined;
  }

  const fastMove = pokemon.fastMoves.find((move) =>
    recommendedMoveIds.includes(move.id),
  );
  const chargedMoves = pokemon.chargedMoves
    .filter((move) => recommendedMoveIds.includes(move.id))
    .slice(0, 2);

  if (!fastMove || chargedMoves.length === 0) {
    return undefined;
  }

  const chargedMoveIds =
    chargedMoves.length === 1
      ? ([chargedMoves[0]!.id] as const)
      : ([chargedMoves[0]!.id, chargedMoves[1]!.id] as const);

  return {
    speciesId: pokemon.speciesId,
    speciesName: pokemon.speciesName,
    level: ivs.level,
    cp: calculateCombatPower(pokemon.baseStats, ivs, ivs.level),
    ivs: {
      attack: ivs.attack,
      defense: ivs.defense,
      hp: ivs.hp,
    },
    fastMoveId: fastMove.id,
    chargedMoveIds,
    isShadow: pokemon.isShadow,
    source: "meta-default",
  };
}

export function prepareTeamRankerRequest(
  team: OrderedExactTeamBuilds,
  catalog: PokemonCatalog,
  options: {
    readonly context: TeamRankerContext;
    readonly targetLimit: MetaTargetLimit;
    readonly teamShields: ShieldCount;
    readonly targetShields: ShieldCount;
  },
): TeamRankerPreparedRequest {
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const teamPokemon = team.map((build) => {
    const pokemon = catalogById.get(build.speciesId);

    if (!pokemon) {
      throw new TeamRankerPreparationError(
        `${build.speciesId} is missing from catalog ${catalog.dataVersion}.`,
      );
    }
    return pokemon;
  });
  const teamDex = teamPokemon.map((pokemon) => pokemon.dex);

  if (new Set(teamDex).size !== teamDex.length) {
    throw new TeamRankerPreparationError(
      "An exact TeamRanker team must satisfy species clause.",
    );
  }

  const availableTargets = catalog.entries.flatMap((pokemon) => {
    if (!pokemon.isMeta) return [];
    const build = metaDefaultBuild(pokemon);
    return build ? [build] : [];
  });
  const targets = availableTargets.slice(0, options.targetLimit);

  if (targets.length === 0) {
    throw new TeamRankerPreparationError(
      "The current catalog has no simulation-ready meta targets.",
    );
  }

  return {
    request: {
      team,
      targets,
      teamShields: options.teamShields,
      targetShields: options.targetShields,
      dataVersion: catalog.dataVersion,
    },
    scope: {
      context: options.context,
      targetLimit: options.targetLimit,
      selectedTargetCount: targets.length,
      availableTargetCount: availableTargets.length,
      teamShields: options.teamShields,
      targetShields: options.targetShields,
      targetSpeciesIds: targets.map((target) => target.speciesId),
    },
    evidence: {
      members: team.map((build, index) => {
        const pokemon = teamPokemon[index]!;

        return {
          position: (["lead", "switch", "closer"] as const)[index]!,
          speciesId: build.speciesId,
          stats: calculateEffectiveStats(pokemon, build.ivs, build.level),
          roleScores: pokemon.ranking?.roleScores,
        };
      }),
      targets: targets.map((build) => {
        const pokemon = catalogById.get(build.speciesId)!;

        return {
          speciesId: build.speciesId,
          stats: calculateEffectiveStats(pokemon, build.ivs, build.level),
        };
      }),
    },
  };
}

export class TeamRankingService {
  constructor(
    private readonly adapter: TeamRankerAdapter,
    private readonly now: () => number = () => performance.now(),
  ) {}

  async rank(prepared: TeamRankerPreparedRequest): Promise<TeamRankerRun> {
    const startedAt = this.now();
    const result = await this.adapter.rank(prepared.request);
    const durationMs = this.now() - startedAt;

    return {
      scope: prepared.scope,
      request: prepared.request,
      result,
      evidence: prepared.evidence,
      durationMs,
      performance:
        durationMs <= 2_000
          ? "within-interactive-budget"
          : durationMs <= 10_000
            ? "slow"
            : "very-slow",
    };
  }
}

