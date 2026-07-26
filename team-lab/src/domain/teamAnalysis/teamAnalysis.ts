import type {
  TeamRankerRun,
  TeamRankerScope,
} from "@/domain/simulation/teamRanker";

export const TARGET_FAVORED_RATING = 501;
export const TEAM_MEMBER_FAVORED_RATING = 499;

export type CoverageGrade = "A" | "B" | "C" | "D" | "F";
export type ThreatLevel = "team-wall" | "core-breaker" | "threat" | "covered";

export interface TeamMemberCoverage {
  readonly position: "lead" | "switch" | "closer";
  readonly speciesId: string;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly positiveMatchupPercentage: number;
  readonly averageMemberRating: number;
}

export interface TeamThreatEvidence {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly targetAverageRating: number;
  readonly targetWins: number;
  readonly targetLosses: number;
  readonly ties: number;
  readonly threatLevel: ThreatLevel;
  readonly hasTeamAnswer: boolean;
  readonly matchupRatings: readonly {
    readonly teamSpeciesId: string;
    readonly targetRating: number;
    readonly teamMemberRating: number;
  }[];
}

export interface TeamCoverageScore {
  readonly grade: CoverageGrade;
  readonly score: number;
  readonly pvpokeValue: number;
  readonly pvpokeGoal: number;
  readonly method: string;
  readonly coveredTargets: number;
  readonly totalTargets: number;
  readonly coveredTargetPercentage: number;
  readonly positiveMatchups: number;
  readonly totalMatchups: number;
  readonly positiveMatchupPercentage: number;
}

export interface TeamScoreDimension {
  readonly grade: CoverageGrade;
  readonly score: number;
  readonly pvpokeValue: number;
  readonly pvpokeGoal: number;
  readonly evidenceSource:
    | "exact-effective-stats"
    | "simulated-matchup-distribution"
    | "pvpoke-static-role-scores"
    | "pvpoke-exact-moveset";
  readonly method: string;
  readonly evidenceCount: number;
  readonly evidenceTotal: number;
}

export interface TeamRankerAnalysis {
  readonly coverage: TeamCoverageScore;
  readonly bulk: TeamScoreDimension;
  readonly safety: TeamScoreDimension;
  readonly consistency: TeamScoreDimension;
  readonly members: readonly TeamMemberCoverage[];
  readonly threats: readonly TeamThreatEvidence[];
  readonly majorThreats: readonly TeamThreatEvidence[];
  readonly coreBreakers: readonly TeamThreatEvidence[];
  readonly teamWalls: readonly TeamThreatEvidence[];
  readonly scope: TeamRankerScope;
  readonly dataVersion: string;
  readonly shieldScenario: string;
  readonly assumptions: readonly string[];
  readonly generatedAt: string;
}

export type SavedTeamAnalysis = TeamRankerAnalysis;

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

const PVPOKE_GREAT_LEAGUE_GOALS = Object.freeze({
  coverage: 680,
  bulk: 22_000,
  safety: 98,
  consistency: 98,
});

function pvpokeGrade(value: number, goal: number): CoverageGrade {
  const percentageOfGoal = value / goal;

  if (percentageOfGoal >= 0.9) return "A";
  if (percentageOfGoal >= 0.8) return "B";
  if (percentageOfGoal >= 0.7) return "C";
  if (percentageOfGoal >= 0.6) return "D";
  return "F";
}

function goalPercentage(value: number, goal: number): number {
  return Math.min(Math.max((value / goal) * 100, 0), 100);
}

function classifyThreat(
  wins: number,
  teamSize: number,
): ThreatLevel {
  if (wins === teamSize) return "team-wall";
  if (wins >= 2) return "core-breaker";
  if (wins === 1) return "threat";
  return "covered";
}

export function analyzeTeamRankerMatrix(
  run: TeamRankerRun,
  now: () => Date = () => new Date(),
): TeamRankerAnalysis {
  const positions = ["lead", "switch", "closer"] as const;
  const firstMatchups = run.result.rankings[0]?.matchups ?? [];
  const members = firstMatchups.map((matchup, index): TeamMemberCoverage => {
    const ratings = run.result.rankings.flatMap((ranking) => {
      const candidate = ranking.matchups[index];
      return candidate ? [candidate.rating] : [];
    });
    const wins = ratings.filter(
      (targetRating) => targetRating <= TEAM_MEMBER_FAVORED_RATING,
    ).length;
    const losses = ratings.filter(
      (targetRating) => targetRating >= TARGET_FAVORED_RATING,
    ).length;
    const ties = ratings.length - wins - losses;
    const averageTargetRating =
      ratings.reduce((sum, rating) => sum + rating, 0) /
      Math.max(ratings.length, 1);

    return {
      position: positions[index] ?? "closer",
      speciesId: matchup.opponentSpeciesId,
      wins,
      losses,
      ties,
      positiveMatchupPercentage: percentage(wins, ratings.length),
      averageMemberRating: 1000 - averageTargetRating,
    };
  });
  const threats = run.result.rankings
    .map((ranking): TeamThreatEvidence => {
      const matchupRatings = ranking.matchups.map((matchup) => ({
        teamSpeciesId: matchup.opponentSpeciesId,
        targetRating: matchup.rating,
        teamMemberRating: 1000 - matchup.rating,
      }));
      const targetWins = matchupRatings.filter(
        (matchup) => matchup.targetRating >= TARGET_FAVORED_RATING,
      ).length;
      const targetLosses = matchupRatings.filter(
        (matchup) => matchup.targetRating <= TEAM_MEMBER_FAVORED_RATING,
      ).length;
      const ties = matchupRatings.length - targetWins - targetLosses;

      return {
        speciesId: ranking.speciesId,
        speciesName: ranking.speciesName,
        targetAverageRating: ranking.averageRating,
        targetWins,
        targetLosses,
        ties,
        threatLevel: classifyThreat(targetWins, matchupRatings.length),
        hasTeamAnswer: targetLosses > 0,
        matchupRatings,
      };
    })
    .sort(
      (left, right) =>
        right.targetWins - left.targetWins ||
        right.targetAverageRating - left.targetAverageRating,
    );
  const coveredTargets = threats.filter((threat) => threat.hasTeamAnswer).length;
  const positiveMatchups = members.reduce(
    (sum, member) => sum + member.wins,
    0,
  );
  const totalMatchups = members.reduce(
    (sum, member) => sum + member.wins + member.losses + member.ties,
    0,
  );
  const coveredTargetPercentage = percentage(coveredTargets, threats.length);
  const gradeThreats = [...run.result.rankings]
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.averageRating - left.averageRating,
    )
    .slice(0, 6);
  const averageThreatScore =
    gradeThreats.reduce(
      (sum, threat) => sum + threat.averageRating,
      0,
    ) / Math.max(gradeThreats.length, 1);
  const coverageValue = 1_200 - averageThreatScore;
  const bulkValue =
    run.result.teamBulkValues.reduce((sum, value) => sum + value, 0) /
    Math.max(run.result.teamBulkValues.length, 1);
  const safetyScores = run.evidence.members.map(
    (member) => member.roleScores?.switch ?? 60,
  );
  const safetyValue =
    safetyScores.reduce((sum, value) => sum + value, 0) /
    Math.max(safetyScores.length, 1);
  const consistencyValue =
    run.result.teamConsistencyScores.reduce(
      (sum, value) => sum + value,
      0,
    ) / Math.max(run.result.teamConsistencyScores.length, 1);

  return {
    coverage: {
      grade: pvpokeGrade(
        coverageValue,
        PVPOKE_GREAT_LEAGUE_GOALS.coverage,
      ),
      score: goalPercentage(
        coverageValue,
        PVPOKE_GREAT_LEAGUE_GOALS.coverage,
      ),
      pvpokeValue: coverageValue,
      pvpokeGoal: PVPOKE_GREAT_LEAGUE_GOALS.coverage,
      method:
        "PvPoke threat-score formula over the six most difficult selected targets",
      coveredTargets,
      totalTargets: threats.length,
      coveredTargetPercentage,
      positiveMatchups,
      totalMatchups,
      positiveMatchupPercentage: percentage(
        positiveMatchups,
        totalMatchups,
      ),
    },
    bulk: {
      grade: pvpokeGrade(
        bulkValue,
        PVPOKE_GREAT_LEAGUE_GOALS.bulk,
      ),
      score: goalPercentage(
        bulkValue,
        PVPOKE_GREAT_LEAGUE_GOALS.bulk,
      ),
      pvpokeValue: bulkValue,
      pvpokeGoal: PVPOKE_GREAT_LEAGUE_GOALS.bulk,
      evidenceSource: "exact-effective-stats",
      method:
        "PvPoke average effective Defense × HP against the Great League 22,000 goal",
      evidenceCount: run.result.teamBulkValues.length,
      evidenceTotal: run.evidence.members.length,
    },
    safety: {
      grade: pvpokeGrade(
        safetyValue,
        PVPOKE_GREAT_LEAGUE_GOALS.safety,
      ),
      score: goalPercentage(
        safetyValue,
        PVPOKE_GREAT_LEAGUE_GOALS.safety,
      ),
      pvpokeValue: safetyValue,
      pvpokeGoal: PVPOKE_GREAT_LEAGUE_GOALS.safety,
      evidenceSource: "pvpoke-static-role-scores",
      method:
        "PvPoke average published switch score against the 98-point goal",
      evidenceCount: safetyScores.length,
      evidenceTotal: run.evidence.members.length,
    },
    consistency: {
      grade: pvpokeGrade(
        consistencyValue,
        PVPOKE_GREAT_LEAGUE_GOALS.consistency,
      ),
      score: goalPercentage(
        consistencyValue,
        PVPOKE_GREAT_LEAGUE_GOALS.consistency,
      ),
      pvpokeValue: consistencyValue,
      pvpokeGoal: PVPOKE_GREAT_LEAGUE_GOALS.consistency,
      evidenceSource: "pvpoke-exact-moveset",
      method:
        "PvPoke exact-moveset consistency average against the 98-point goal",
      evidenceCount: run.result.teamConsistencyScores.length,
      evidenceTotal: run.evidence.members.length,
    },
    members,
    threats,
    majorThreats: threats.filter(
      (threat) =>
        threat.targetWins >= 2 || threat.targetAverageRating > 500,
    ),
    coreBreakers: threats.filter((threat) => threat.targetWins >= 2),
    teamWalls: threats.filter(
      (threat) => threat.threatLevel === "team-wall",
    ),
    scope: run.scope,
    dataVersion: run.result.dataVersion,
    shieldScenario: `${run.scope.teamShields}-${run.scope.targetShields}`,
    assumptions: [
      ...run.result.assumptions,
      "Ratings above 500 favor the meta target; ratings below 500 favor the team member",
      "A target is covered when at least one team member has a rating advantage",
      "Letter grades use PvPoke's A–F thresholds and Open Great League goals",
      "Coverage uses PvPoke's threat-score formula over the selected simulation scope; select Greater Meta for the closest Team Builder comparison",
      "Bulk uses PvPoke's exact average Defense × HP formula, including Shadow modifiers",
      "Safety uses PvPoke's published switch-score average",
      "Consistency is calculated by the upstream engine from the exact entered movesets",
    ],
    generatedAt: now().toISOString(),
  };
}

export const analyzeSavedTeamMatrix = analyzeTeamRankerMatrix;
