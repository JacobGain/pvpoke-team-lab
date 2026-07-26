import type { SimulatedRecommendationFinalist } from "@/domain/recommendations/finalistSimulation";

export interface RecommendationExplanation {
  readonly headline: string;
  readonly reasons: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly scope: string;
}

function rounded(value: number): string {
  return value.toFixed(1);
}

export function explainRecommendation(
  finalist: SimulatedRecommendationFinalist,
): RecommendationExplanation {
  const { analysis, finalScore, staticTeam } = finalist;
  const members = [
    staticTeam.orderedMembers.lead,
    staticTeam.orderedMembers.switch,
    staticTeam.orderedMembers.closer,
  ];
  const readyCount = members.filter(
    (member) => member.readiness === "ready-now",
  ).length;
  const plannedRequirements = members.flatMap((member) =>
    member.readiness === "planned" ? member.buildRequirements : [],
  );
  const rankedDefaultCount = members.filter(
    (member) => member.source === "ranked-default-build",
  ).length;
  const topThreat = analysis.majorThreats[0];
  const reasons = [
    `${analysis.coverage.coveredTargets} of ${analysis.coverage.totalTargets} selected meta targets have at least one exact favorable matchup.`,
    `The ordered roles average ${rounded(staticTeam.preScore.roleSuitability.score)} from published Lead, Switch, and Closer evidence.`,
    `${readyCount} of 3 members are ready-now current builds.`,
  ];
  const tradeoffs: string[] = [];

  if (topThreat) {
    tradeoffs.push(
      `${topThreat.speciesName} is the highest-priority ${topThreat.threatLevel.replaceAll("-", " ")} and is favored against ${topThreat.targetWins} members.`,
    );
  }

  if (analysis.safety.score < 60) {
    tradeoffs.push(
      `Safety scores ${rounded(analysis.safety.score)} because answer redundancy or safe-switch coverage is limited in this scope.`,
    );
  }

  if (plannedRequirements.length > 0) {
    tradeoffs.push(
      `${plannedRequirements.length} qualitative build requirement${plannedRequirements.length === 1 ? "" : "s"} remain across planned members.`,
    );
  }

  if (rankedDefaultCount > 0) {
    tradeoffs.push(
      `${rankedDefaultCount} ranked ${rankedDefaultCount === 1 ? "teammate is" : "teammates are"} simulated with PvPoke defaults and must be added to inventory before this team can be saved.`,
    );
  }

  if (
    analysis.consistency.evidenceCount <
    analysis.consistency.evidenceTotal
  ) {
    tradeoffs.push(
      `Published consistency evidence covers ${analysis.consistency.evidenceCount} of ${analysis.consistency.evidenceTotal} members.`,
    );
  }

  if (tradeoffs.length === 0) {
    tradeoffs.push(
      "No major limitation was detected inside this selected target and shield scope; other scopes can produce different results.",
    );
  }

  return {
    headline: `${staticTeam.orderedMembers.lead.speciesName} / ${staticTeam.orderedMembers.switch.speciesName} / ${staticTeam.orderedMembers.closer.speciesName} scores ${rounded(finalScore.score)} under the current TeamLab formula.`,
    reasons,
    tradeoffs,
    scope: `${analysis.scope.selectedTargetCount} targets · ${analysis.shieldScenario} shields · data ${analysis.dataVersion}`,
  };
}
