import type {
  SavedTeamRankerRun,
  SavedTeamRankerScope,
} from "@/domain/simulation/savedTeamRanking";

export const TARGET_FAVORED_RATING = 501;
export const TEAM_MEMBER_FAVORED_RATING = 499;

export type CoverageGrade = "S" | "A" | "B" | "C" | "D";
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
  readonly coveredTargets: number;
  readonly totalTargets: number;
  readonly coveredTargetPercentage: number;
  readonly positiveMatchups: number;
  readonly totalMatchups: number;
  readonly positiveMatchupPercentage: number;
}

export interface SavedTeamAnalysis {
  readonly coverage: TeamCoverageScore;
  readonly members: readonly TeamMemberCoverage[];
  readonly threats: readonly TeamThreatEvidence[];
  readonly majorThreats: readonly TeamThreatEvidence[];
  readonly coreBreakers: readonly TeamThreatEvidence[];
  readonly teamWalls: readonly TeamThreatEvidence[];
  readonly scope: SavedTeamRankerScope;
  readonly dataVersion: string;
  readonly shieldScenario: string;
  readonly assumptions: readonly string[];
  readonly generatedAt: string;
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

function coverageGrade(score: number): CoverageGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
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

export function analyzeSavedTeamMatrix(
  run: SavedTeamRankerRun,
  now: () => Date = () => new Date(),
): SavedTeamAnalysis {
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

  return {
    coverage: {
      grade: coverageGrade(coveredTargetPercentage),
      score: coveredTargetPercentage,
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
      "Coverage grade is a TeamLab heuristic over the selected unweighted target scope",
    ],
    generatedAt: now().toISOString(),
  };
}
