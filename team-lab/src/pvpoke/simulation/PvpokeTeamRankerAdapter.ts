import type {
  ExactSimulationBuild,
  TeamRankerAdapter,
  TeamRankerRequest,
  TeamRankerResult,
} from "@/domain/simulation/contracts";
import { configurePvpokePokemon } from "@/pvpoke/simulation/PvpokeOneOnOneAdapter";
import type {
  PvpokeBattle,
  PvpokeBattleRuntime,
  PvpokePokemon,
  PvpokeTeamRankerSettings,
} from "@/pvpoke/simulation/runtime";

function settings(shields: number): PvpokeTeamRankerSettings {
  return {
    shields,
    ivs: "original",
    bait: 1,
    levelCap: 50,
    startHp: 1,
    startEnergy: 0,
    startCooldown: 0,
    optimizeMoveTiming: true,
    startStatBuffs: [0, 0],
  };
}

function configureBuilds(
  runtime: PvpokeBattleRuntime,
  battle: PvpokeBattle,
  builds: readonly ExactSimulationBuild[],
  shields: number,
): readonly PvpokePokemon[] {
  return builds.map((build, index) =>
    configurePvpokePokemon(
      runtime,
      battle,
      build,
      (index % 2) as 0 | 1,
      shields,
    ),
  );
}

function validateRequest(request: TeamRankerRequest): void {
  if (request.team.length < 1 || request.team.length > 3) {
    throw new RangeError("TeamRanker requires one to three team builds.");
  }
  if (request.targets.length < 1) {
    throw new RangeError("TeamRanker requires at least one explicit target.");
  }
}

export class PvpokeTeamRankerAdapter implements TeamRankerAdapter {
  private static queue: Promise<void> = Promise.resolve();

  constructor(private readonly runtime: PvpokeBattleRuntime) {}

  rank(request: TeamRankerRequest): Promise<TeamRankerResult> {
    const result = PvpokeTeamRankerAdapter.queue.then(() =>
      this.rankNow(request),
    );
    PvpokeTeamRankerAdapter.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async rankNow(
    request: TeamRankerRequest,
  ): Promise<TeamRankerResult> {
    validateRequest(request);
    await this.runtime.ready();
    const stagingBattle = this.runtime.createBattle();
    stagingBattle.setLevelCap(50);
    stagingBattle.setCP(1500);
    stagingBattle.setCup("all");
    const team = configureBuilds(
      this.runtime,
      stagingBattle,
      request.team,
      request.teamShields,
    );
    const targets = configureBuilds(
      this.runtime,
      stagingBattle,
      request.targets,
      request.targetShields,
    );
    const ranker = this.runtime.getTeamRanker();

    ranker.setShieldMode("single");
    ranker.applySettings(settings(request.teamShields), 0);
    ranker.applySettings(settings(request.targetShields), 1);
    ranker.setRecommendMoveUsage(false);
    ranker.setPrioritizeMeta(false);
    ranker.setTargets(targets);

    try {
      const result = ranker.rank(
        team,
        1500,
        { name: "all", include: [], exclude: [] },
        [],
        "matrix",
      );

      return {
        rankings: result.rankings.map((ranking) => ({
          speciesId: ranking.speciesId,
          speciesName: ranking.speciesName,
          averageRating: ranking.rating,
          score: ranking.score,
          matchups: ranking.matchups.map((matchup) => ({
            opponentSpeciesId: matchup.opponent.speciesId,
            rating: matchup.rating,
            score: matchup.score,
            durationMs: matchup.time,
            fastMoveDamage: matchup.breakpoint ?? 0,
            incomingFastMoveDamage: matchup.bulkpoint ?? 0,
            attackDifferential: matchup.atkDifferential ?? 0,
          })),
        })),
        teamRatings: result.teamRatings.map((ratings) => [...ratings]),
        battleCount: request.team.length * request.targets.length,
        dataVersion: request.dataVersion,
        engine: "pvpoke-team-ranker",
        assumptions: [
          "Explicit target list; no generated candidate pool",
          "Exact entered moves, IVs, levels, and Shadow states",
          "Single configured shield scenario",
          "PvPoke default bait and optimized move timing",
          "Matrix context with no meta-priority score adjustment",
        ],
      };
    } finally {
      ranker.setTargets([]);
    }
  }
}
