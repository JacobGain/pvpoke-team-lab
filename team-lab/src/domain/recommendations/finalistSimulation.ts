import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import type {
  StaticRecommendationGeneration,
  StaticRecommendationTeam,
} from "@/domain/recommendations/staticTeamGeneration";
import type {
  ShieldCount,
  TeamRankerAdapter,
} from "@/domain/simulation/contracts";
import {
  prepareTeamRankerRequest,
  TeamRankingService,
  type MetaTargetLimit,
  type OrderedExactTeamBuilds,
  type TeamRankerRun,
} from "@/domain/simulation/teamRanker";
import {
  deriveTeamAlternatives,
  type TeamAlternativesAnalysis,
} from "@/domain/teamAnalysis/alternatives";
import {
  analyzeTeamRankerMatrix,
  type TeamRankerAnalysis,
} from "@/domain/teamAnalysis/teamAnalysis";

export const RECOMMENDATION_FINAL_SCORE_VERSION =
  "recommendation-final-score-v2";

export const RECOMMENDATION_FINAL_SCORE_WEIGHTS = Object.freeze({
  coverage: 0.25,
  bulk: 0.15,
  safety: 0.2,
  consistency: 0.1,
  staticPreScore: 0.3,
});

export interface RecommendationFinalistSimulationOptions {
  readonly targetLimit: MetaTargetLimit;
  readonly teamShields: ShieldCount;
  readonly targetShields: ShieldCount;
}

export interface RecommendationFinalistProgress {
  readonly completedFinalists: number;
  readonly totalFinalists: number;
  readonly currentTeamKey?: string;
  readonly status: "starting" | "completed" | "failed" | "cancelled";
}

export interface RecommendationFinalistSimulationControls {
  readonly signal?: AbortSignal;
  readonly onProgress?: (
    progress: RecommendationFinalistProgress,
  ) => void;
  readonly yieldBetweenFinalists?: () => Promise<void>;
}

export interface RecommendationFinalScore {
  readonly version: typeof RECOMMENDATION_FINAL_SCORE_VERSION;
  readonly score: number;
  readonly weights: typeof RECOMMENDATION_FINAL_SCORE_WEIGHTS;
  readonly inputs: {
    readonly coverage: number;
    readonly bulk: number;
    readonly safety: number;
    readonly consistency: number;
    readonly staticPreScore: number;
  };
  readonly method: string;
}

export interface SimulatedRecommendationFinalist {
  readonly staticTeam: StaticRecommendationTeam;
  readonly run: TeamRankerRun;
  readonly analysis: TeamRankerAnalysis;
  readonly alternatives: TeamAlternativesAnalysis;
  readonly finalScore: RecommendationFinalScore;
}

export interface RecommendationFinalistFailure {
  readonly teamKey: string;
  readonly speciesKey: string;
  readonly message: string;
}

export interface RecommendationFinalistSimulation {
  readonly staticGeneration: StaticRecommendationGeneration;
  readonly options: RecommendationFinalistSimulationOptions;
  readonly completed: readonly SimulatedRecommendationFinalist[];
  readonly failures: readonly RecommendationFinalistFailure[];
  readonly selected: readonly SimulatedRecommendationFinalist[];
  readonly requestedResultCount: number;
  readonly selectionShortfall: number;
  readonly selectionDiversityRelaxed: boolean;
  readonly attemptedFinalistCount: number;
  readonly cancelled: boolean;
  readonly dataVersion: string;
  readonly assumptions: readonly string[];
}

export class RecommendationFinalistDataVersionError extends Error {
  constructor(
    readonly generationDataVersion: string,
    readonly catalogDataVersion: string,
  ) {
    super(
      `Static finalists use data ${generationDataVersion}, but the current catalog is ${catalogDataVersion}.`,
    );
    this.name = "RecommendationFinalistDataVersionError";
  }
}

function exactTeamBuilds(
  team: StaticRecommendationTeam,
): OrderedExactTeamBuilds {
  return [
    team.orderedMembers.lead.exactBuild,
    team.orderedMembers.switch.exactBuild,
    team.orderedMembers.closer.exactBuild,
  ];
}

function finalScore(
  staticTeam: StaticRecommendationTeam,
  analysis: TeamRankerAnalysis,
): RecommendationFinalScore {
  const inputs = {
    coverage: analysis.coverage.score,
    bulk: analysis.bulk.score,
    safety: analysis.safety.score,
    consistency: analysis.consistency.score,
    staticPreScore: staticTeam.preScore.score,
  };
  const score =
    inputs.coverage * RECOMMENDATION_FINAL_SCORE_WEIGHTS.coverage +
    inputs.bulk * RECOMMENDATION_FINAL_SCORE_WEIGHTS.bulk +
    inputs.safety * RECOMMENDATION_FINAL_SCORE_WEIGHTS.safety +
    inputs.consistency * RECOMMENDATION_FINAL_SCORE_WEIGHTS.consistency +
    inputs.staticPreScore *
      RECOMMENDATION_FINAL_SCORE_WEIGHTS.staticPreScore;

  return {
    version: RECOMMENDATION_FINAL_SCORE_VERSION,
    score,
    weights: RECOMMENDATION_FINAL_SCORE_WEIGHTS,
    inputs,
    method:
      "25% PvPoke-formula coverage + 15% PvPoke bulk + 20% PvPoke safety + 10% exact-moveset PvPoke consistency + 30% static finalist pre-score",
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFinalists(
  left: SimulatedRecommendationFinalist,
  right: SimulatedRecommendationFinalist,
): number {
  return (
    right.finalScore.score - left.finalScore.score ||
    right.analysis.coverage.score - left.analysis.coverage.score ||
    right.analysis.safety.score - left.analysis.safety.score ||
    right.staticTeam.preScore.score - left.staticTeam.preScore.score ||
    compareText(left.staticTeam.teamKey, right.staticTeam.teamKey)
  );
}

function memberDex(
  finalist: SimulatedRecommendationFinalist,
): readonly [number, number, number] {
  return [
    finalist.staticTeam.orderedMembers.lead.dex,
    finalist.staticTeam.orderedMembers.switch.dex,
    finalist.staticTeam.orderedMembers.closer.dex,
  ];
}

function pairKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function optionalCoreKeys(
  finalist: SimulatedRecommendationFinalist,
  anchorDex: ReadonlySet<number>,
): readonly string[] {
  const dex = memberDex(finalist);
  return [
    [dex[0], dex[1]],
    [dex[0], dex[2]],
    [dex[1], dex[2]],
  ].flatMap(([left, right]) =>
    left !== undefined &&
    right !== undefined &&
    !(anchorDex.has(left) && anchorDex.has(right))
      ? [pairKey(left, right)]
      : [],
  );
}

function selectRequestedResults(
  completed: readonly SimulatedRecommendationFinalist[],
  requestedResultCount: number,
  anchorInventoryIds: ReadonlySet<string>,
): {
  readonly selected: readonly SimulatedRecommendationFinalist[];
  readonly diversityRelaxed: boolean;
} {
  const ordered = [...completed].sort(compareFinalists);
  const anchorDex = new Set<number>();

  for (const finalist of ordered) {
    for (const member of [
      finalist.staticTeam.orderedMembers.lead,
      finalist.staticTeam.orderedMembers.switch,
      finalist.staticTeam.orderedMembers.closer,
    ]) {
      if (anchorInventoryIds.has(member.inventoryId)) {
        anchorDex.add(member.dex);
      }
    }
  }

  const pairCounts = new Map<string, number>();
  const selected: SimulatedRecommendationFinalist[] = [];

  for (const finalist of ordered) {
    const cores = optionalCoreKeys(finalist, anchorDex);

    if (cores.some((core) => (pairCounts.get(core) ?? 0) >= 1)) {
      continue;
    }

    selected.push(finalist);
    for (const core of cores) {
      pairCounts.set(core, (pairCounts.get(core) ?? 0) + 1);
    }

    if (selected.length === requestedResultCount) {
      return { selected, diversityRelaxed: false };
    }
  }

  const strictlySelected = new Set(
    selected.map((finalist) => finalist.staticTeam.teamKey),
  );

  for (const finalist of ordered) {
    if (strictlySelected.has(finalist.staticTeam.teamKey)) continue;
    selected.push(finalist);
    if (selected.length === requestedResultCount) {
      return { selected, diversityRelaxed: true };
    }
  }

  return {
    selected,
    diversityRelaxed: false,
  };
}

export class RecommendationFinalistSimulationService {
  private readonly rankingService: TeamRankingService;

  constructor(
    adapter: TeamRankerAdapter,
    nowMilliseconds: () => number = () => performance.now(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.rankingService = new TeamRankingService(adapter, nowMilliseconds);
  }

  async simulate(
    staticGeneration: StaticRecommendationGeneration,
    inventory: readonly InventoryPokemon[],
    catalog: PokemonCatalog,
    options: RecommendationFinalistSimulationOptions,
    controls: RecommendationFinalistSimulationControls = {},
  ): Promise<RecommendationFinalistSimulation> {
    if (staticGeneration.dataVersion !== catalog.dataVersion) {
      throw new RecommendationFinalistDataVersionError(
        staticGeneration.dataVersion,
        catalog.dataVersion,
      );
    }

    const completed: SimulatedRecommendationFinalist[] = [];
    const failures: RecommendationFinalistFailure[] = [];
    let attemptedFinalistCount = 0;
    let cancelled = false;

    for (const staticTeam of staticGeneration.finalists) {
      if (controls.signal?.aborted) {
        cancelled = true;
        controls.onProgress?.({
          completedFinalists: attemptedFinalistCount,
          totalFinalists: staticGeneration.finalists.length,
          status: "cancelled",
        });
        break;
      }

      controls.onProgress?.({
        completedFinalists: attemptedFinalistCount,
        totalFinalists: staticGeneration.finalists.length,
        currentTeamKey: staticTeam.teamKey,
        status: "starting",
      });

      try {
        const prepared = prepareTeamRankerRequest(
          exactTeamBuilds(staticTeam),
          catalog,
          {
            context: {
              kind: "recommendation",
              id: staticTeam.teamKey,
              name: [
                staticTeam.orderedMembers.lead.speciesName,
                staticTeam.orderedMembers.switch.speciesName,
                staticTeam.orderedMembers.closer.speciesName,
              ].join(" / "),
            },
            targetLimit: options.targetLimit,
            teamShields: options.teamShields,
            targetShields: options.targetShields,
          },
        );
        const run = await this.rankingService.rank(prepared);
        const analysis = analyzeTeamRankerMatrix(run, this.now);

        completed.push({
          staticTeam,
          run,
          analysis,
          alternatives: deriveTeamAlternatives(
            analysis,
            inventory,
            catalog,
          ),
          finalScore: finalScore(staticTeam, analysis),
        });
        attemptedFinalistCount += 1;
        controls.onProgress?.({
          completedFinalists: attemptedFinalistCount,
          totalFinalists: staticGeneration.finalists.length,
          currentTeamKey: staticTeam.teamKey,
          status: "completed",
        });
      } catch (error) {
        attemptedFinalistCount += 1;
        failures.push({
          teamKey: staticTeam.teamKey,
          speciesKey: staticTeam.speciesKey,
          message:
            error instanceof Error
              ? error.message
              : "Finalist simulation failed.",
        });
        controls.onProgress?.({
          completedFinalists: attemptedFinalistCount,
          totalFinalists: staticGeneration.finalists.length,
          currentTeamKey: staticTeam.teamKey,
          status: "failed",
        });
      }

      await controls.yieldBetweenFinalists?.();
    }

    const anchorInventoryIds = new Set(
      staticGeneration.finalists[0]?.anchorInventoryIds ?? [],
    );
    const selection = selectRequestedResults(
      completed,
      staticGeneration.requestedResultCount,
      anchorInventoryIds,
    );
    const requestedResultCount = staticGeneration.requestedResultCount;

    return {
      staticGeneration,
      options,
      completed: [...completed].sort(compareFinalists),
      failures,
      selected: selection.selected,
      requestedResultCount,
      selectionShortfall: Math.max(
        requestedResultCount - selection.selected.length,
        0,
      ),
      selectionDiversityRelaxed: selection.diversityRelaxed,
      attemptedFinalistCount,
      cancelled,
      dataVersion: catalog.dataVersion,
      assumptions: [
        "Every finalist uses the same explicit meta target and shield scope",
        "Final selection combines Phase 6 evidence with the versioned static pre-score",
        "Final-result diversity limits optional two-Pokémon cores to one before relaxing only to fill the requested count",
        "Failed finalists are reported and do not discard successful exact results",
      ],
    };
  }
}
