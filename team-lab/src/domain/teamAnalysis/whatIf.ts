import type {
  SavedTeamAnalysis,
  TeamThreatEvidence,
} from "@/domain/teamAnalysis/teamAnalysis";

export type WhatIfScoreId = "coverage" | "bulk" | "safety" | "consistency";

export interface WhatIfScoreChange {
  readonly id: WhatIfScoreId;
  readonly label: string;
  readonly beforeValue: number;
  readonly afterValue: number;
  readonly beforeScore: number;
  readonly afterScore: number;
  readonly delta: number;
  readonly goal: number;
  readonly beforeGrade: SavedTeamAnalysis[WhatIfScoreId]["grade"];
  readonly afterGrade: SavedTeamAnalysis[WhatIfScoreId]["grade"];
}

export interface WhatIfThreatChange {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly before: TeamThreatEvidence;
  readonly after: TeamThreatEvidence;
  readonly targetWinsDelta: number;
  readonly coverageChange: "gained" | "lost" | "unchanged";
}

export interface WhatIfAnalysisComparison {
  readonly scores: readonly WhatIfScoreChange[];
  readonly newlyCovered: readonly TeamThreatEvidence[];
  readonly noLongerCovered: readonly TeamThreatEvidence[];
  readonly threatChanges: readonly WhatIfThreatChange[];
  readonly coveredTargetsDelta: number;
}

function assertComparable(
  before: SavedTeamAnalysis,
  after: SavedTeamAnalysis,
): void {
  const sameTargets =
    before.scope.targetSpeciesIds.length ===
      after.scope.targetSpeciesIds.length &&
    before.scope.targetSpeciesIds.every(
      (speciesId, index) => speciesId === after.scope.targetSpeciesIds[index],
    );

  if (
    before.dataVersion !== after.dataVersion ||
    before.scope.targetLimit !== after.scope.targetLimit ||
    before.scope.teamShields !== after.scope.teamShields ||
    before.scope.targetShields !== after.scope.targetShields ||
    !sameTargets
  ) {
    throw new Error(
      "What-if comparisons require the same data, targets, and shield settings.",
    );
  }
}

export function compareTeamAnalyses(
  before: SavedTeamAnalysis,
  after: SavedTeamAnalysis,
): WhatIfAnalysisComparison {
  assertComparable(before, after);

  const scores: readonly WhatIfScoreChange[] = [
    {
      id: "coverage",
      label: "Coverage",
      beforeValue: before.coverage.pvpokeValue,
      afterValue: after.coverage.pvpokeValue,
      beforeScore: before.coverage.score,
      afterScore: after.coverage.score,
      delta: after.coverage.score - before.coverage.score,
      goal: before.coverage.pvpokeGoal,
      beforeGrade: before.coverage.grade,
      afterGrade: after.coverage.grade,
    },
    {
      id: "bulk",
      label: "Bulk",
      beforeValue: before.bulk.pvpokeValue,
      afterValue: after.bulk.pvpokeValue,
      beforeScore: before.bulk.score,
      afterScore: after.bulk.score,
      delta: after.bulk.score - before.bulk.score,
      goal: before.bulk.pvpokeGoal,
      beforeGrade: before.bulk.grade,
      afterGrade: after.bulk.grade,
    },
    {
      id: "safety",
      label: "Safety",
      beforeValue: before.safety.pvpokeValue,
      afterValue: after.safety.pvpokeValue,
      beforeScore: before.safety.score,
      afterScore: after.safety.score,
      delta: after.safety.score - before.safety.score,
      goal: before.safety.pvpokeGoal,
      beforeGrade: before.safety.grade,
      afterGrade: after.safety.grade,
    },
    {
      id: "consistency",
      label: "Consistency",
      beforeValue: before.consistency.pvpokeValue,
      afterValue: after.consistency.pvpokeValue,
      beforeScore: before.consistency.score,
      afterScore: after.consistency.score,
      delta: after.consistency.score - before.consistency.score,
      goal: before.consistency.pvpokeGoal,
      beforeGrade: before.consistency.grade,
      afterGrade: after.consistency.grade,
    },
  ];

  const beforeById = new Map(
    before.threats.map((threat) => [threat.speciesId, threat]),
  );
  const newlyCovered: TeamThreatEvidence[] = [];
  const noLongerCovered: TeamThreatEvidence[] = [];
  const threatChanges: WhatIfThreatChange[] = [];

  for (const threat of after.threats) {
    const previous = beforeById.get(threat.speciesId);
    if (!previous) continue;

    const coverageChange =
      !previous.hasTeamAnswer && threat.hasTeamAnswer
        ? "gained"
        : previous.hasTeamAnswer && !threat.hasTeamAnswer
          ? "lost"
          : "unchanged";

    if (coverageChange === "gained") newlyCovered.push(threat);
    if (coverageChange === "lost") noLongerCovered.push(threat);

    const targetWinsDelta = threat.targetWins - previous.targetWins;
    const targetLossesChanged = threat.targetLosses !== previous.targetLosses;
    const tiesChanged = threat.ties !== previous.ties;
    const ratingChanged =
      Math.abs(threat.targetAverageRating - previous.targetAverageRating) >
      Number.EPSILON;

    if (
      coverageChange !== "unchanged" ||
      targetWinsDelta !== 0 ||
      targetLossesChanged ||
      tiesChanged ||
      ratingChanged
    ) {
      threatChanges.push({
        speciesId: threat.speciesId,
        speciesName: threat.speciesName,
        before: previous,
        after: threat,
        targetWinsDelta,
        coverageChange,
      });
    }
  }

  const changePriority = (change: WhatIfThreatChange): number =>
    change.coverageChange === "gained"
      ? 0
      : change.coverageChange === "lost"
        ? 1
        : 2;

  threatChanges.sort(
    (left, right) =>
      changePriority(left) - changePriority(right) ||
      Math.abs(right.targetWinsDelta) - Math.abs(left.targetWinsDelta) ||
      Math.abs(
        right.after.targetAverageRating - right.before.targetAverageRating,
      ) -
        Math.abs(
          left.after.targetAverageRating - left.before.targetAverageRating,
        ),
  );

  return {
    scores,
    newlyCovered,
    noLongerCovered,
    threatChanges,
    coveredTargetsDelta:
      after.coverage.coveredTargets - before.coverage.coveredTargets,
  };
}
