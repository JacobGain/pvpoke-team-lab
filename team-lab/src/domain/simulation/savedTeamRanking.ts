import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import { serializeAnalyzedBuildForSimulation } from "@/domain/simulation/buildSerialization";
import type {
  ExactSimulationBuild,
  ShieldCount,
  TeamRankerAdapter,
  TeamRankerRequest,
  TeamRankerResult,
} from "@/domain/simulation/contracts";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import { resolveSavedTeam } from "@/domain/teams/resolution";
import type { SavedTeam } from "@/domain/teams/schemas";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  calculateEffectiveStats,
  type EffectiveStats,
} from "@/domain/analysis/ivRankings";
import type { CatalogRoleScores } from "@/domain/pokemon/catalog";

export const META_TARGET_LIMITS = [5, 10, 20, 48] as const;
export type MetaTargetLimit = (typeof META_TARGET_LIMITS)[number];

export interface SavedTeamRankerScope {
  readonly teamId: string;
  readonly teamName: string;
  readonly targetLimit: MetaTargetLimit;
  readonly selectedTargetCount: number;
  readonly availableTargetCount: number;
  readonly teamShields: ShieldCount;
  readonly targetShields: ShieldCount;
  readonly targetSpeciesIds: readonly string[];
}

export interface SavedTeamRankerPreparedRequest {
  readonly request: TeamRankerRequest;
  readonly scope: SavedTeamRankerScope;
  readonly evidence: SavedTeamScoreEvidence;
}

export interface SavedTeamMemberScoreEvidence {
  readonly position: "lead" | "switch" | "closer";
  readonly speciesId: string;
  readonly stats: EffectiveStats;
  readonly roleScores?: CatalogRoleScores;
}

export interface SavedTeamTargetScoreEvidence {
  readonly speciesId: string;
  readonly stats: EffectiveStats;
}

export interface SavedTeamScoreEvidence {
  readonly members: readonly SavedTeamMemberScoreEvidence[];
  readonly targets: readonly SavedTeamTargetScoreEvidence[];
}

export interface SavedTeamRankerRun {
  readonly scope: SavedTeamRankerScope;
  readonly request?: TeamRankerRequest;
  readonly result: TeamRankerResult;
  readonly evidence: SavedTeamScoreEvidence;
  readonly durationMs: number;
  readonly performance:
    | "within-interactive-budget"
    | "slow"
    | "very-slow";
}

export class SavedTeamSimulationPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedTeamSimulationPreparationError";
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

export function prepareSavedTeamRankerRequest(
  team: SavedTeam,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
  options: {
    readonly targetLimit: MetaTargetLimit;
    readonly teamShields: ShieldCount;
    readonly targetShields: ShieldCount;
  },
): SavedTeamRankerPreparedRequest {
  const resolved = resolveSavedTeam(team, inventory, catalog.entries);

  if (!resolved.isComplete) {
    throw new SavedTeamSimulationPreparationError(
      "Every saved-team member must resolve before simulation.",
    );
  }

  const teamBuilds = resolved.members.map((member) => {
    if (member.status !== "resolved") {
      throw new SavedTeamSimulationPreparationError(
        `${member.position} could not be resolved.`,
      );
    }

    const analysis = analyzeInventoryBuild(member.inventory, catalog);
    const build =
      member.inventory.buildStatus === "planned"
        ? analysis.planned
        : analysis.current;

    if (!build) {
      throw new SavedTeamSimulationPreparationError(
        `${member.pokemon.speciesName} has no analyzable selected build.`,
      );
    }

    return serializeAnalyzedBuildForSimulation(build, member.pokemon);
  });
  const availableTargets = catalog.entries.flatMap((pokemon) => {
    if (!pokemon.isMeta) {
      return [];
    }
    const build = metaDefaultBuild(pokemon);
    return build ? [build] : [];
  });
  const targets = availableTargets.slice(0, options.targetLimit);

  if (targets.length === 0) {
    throw new SavedTeamSimulationPreparationError(
      "The current catalog has no simulation-ready meta targets.",
    );
  }

  return {
    request: {
      team: teamBuilds,
      targets,
      teamShields: options.teamShields,
      targetShields: options.targetShields,
      dataVersion: catalog.dataVersion,
    },
    scope: {
      teamId: team.teamId,
      teamName: team.name,
      targetLimit: options.targetLimit,
      selectedTargetCount: targets.length,
      availableTargetCount: availableTargets.length,
      teamShields: options.teamShields,
      targetShields: options.targetShields,
      targetSpeciesIds: targets.map((target) => target.speciesId),
    },
    evidence: {
      members: teamBuilds.map((build, index) => {
        const pokemon = catalog.entries.find(
          (entry) => entry.speciesId === build.speciesId,
        )!;

        return {
          position: (["lead", "switch", "closer"] as const)[index]!,
          speciesId: build.speciesId,
          stats: calculateEffectiveStats(pokemon, build.ivs, build.level),
          roleScores: pokemon.ranking?.roleScores,
        };
      }),
      targets: targets.map((build) => {
        const pokemon = catalog.entries.find(
          (entry) => entry.speciesId === build.speciesId,
        )!;

        return {
          speciesId: build.speciesId,
          stats: calculateEffectiveStats(pokemon, build.ivs, build.level),
        };
      }),
    },
  };
}

export class SavedTeamRankingService {
  constructor(
    private readonly adapter: TeamRankerAdapter,
    private readonly now: () => number = () => performance.now(),
  ) {}

  async rank(
    prepared: SavedTeamRankerPreparedRequest,
  ): Promise<SavedTeamRankerRun> {
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
