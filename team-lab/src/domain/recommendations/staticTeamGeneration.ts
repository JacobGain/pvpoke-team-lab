import type { CatalogRoleScores } from "@/domain/pokemon/catalog";
import type {
  RecommendationAnchorCandidate,
  RecommendationCandidate,
  RecommendationCandidatePool,
} from "@/domain/recommendations/candidatePool";

export const RECOMMENDATION_STATIC_POLICY_VERSION =
  "recommendation-static-policy-v1";
export const RECOMMENDATION_STATIC_SCORE_VERSION =
  "recommendation-static-score-v1";
export const STATIC_MATCHUP_NEUTRAL_RATING = 500;

export type RecommendationTeamPosition = "lead" | "switch" | "closer";

export interface RecommendationStaticPolicy {
  readonly version: typeof RECOMMENDATION_STATIC_POLICY_VERSION;
  readonly maxOverallRank: number;
  readonly minRelevantRoleScore: number;
  readonly maxEligiblePartners: number;
  readonly maxGeneratedTeams: number;
  readonly finalistMultiplier: number;
  readonly minimumFinalists: number;
  readonly maximumFinalists: number;
  readonly maxOptionalCoreRepeats: number;
  readonly scoreWeights: {
    readonly complementarity: number;
    readonly roleSuitability: number;
    readonly metaStrength: number;
    readonly readiness: number;
  };
}

export const DEFAULT_RECOMMENDATION_STATIC_POLICY: RecommendationStaticPolicy =
  Object.freeze({
    version: RECOMMENDATION_STATIC_POLICY_VERSION,
    maxOverallRank: 250,
    minRelevantRoleScore: 50,
    maxEligiblePartners: 40,
    maxGeneratedTeams: 250,
    finalistMultiplier: 3,
    minimumFinalists: 6,
    maximumFinalists: 15,
    maxOptionalCoreRepeats: 2,
    scoreWeights: Object.freeze({
      complementarity: 0.4,
      roleSuitability: 0.3,
      metaStrength: 0.2,
      readiness: 0.1,
    }),
  });

export type RecommendationEligibilityExclusionCode =
  | "ranking-unavailable"
  | "overall-rank-threshold"
  | "role-score-threshold";

export interface RecommendationEligibilityExclusion {
  readonly inventoryId: string;
  readonly speciesId: string;
  readonly code: RecommendationEligibilityExclusionCode;
  readonly message: string;
}

export interface OrderedRecommendationMembers {
  readonly lead: RecommendationCandidate;
  readonly switch: RecommendationCandidate;
  readonly closer: RecommendationCandidate;
}

export interface RecommendationScoreDimension {
  readonly score: number;
  readonly evidenceCount: number;
  readonly evidenceTotal: number;
  readonly method: string;
}

export interface RecommendationComplementarityScore
  extends RecommendationScoreDimension {
  readonly knownThreats: number;
  readonly answeredThreats: number;
  readonly sharedThreats: number;
  readonly threatCoveragePercentage: number;
  readonly sharedWeaknessAvoidancePercentage: number;
}

export interface RecommendationStaticPreScore {
  readonly version: typeof RECOMMENDATION_STATIC_SCORE_VERSION;
  readonly score: number;
  readonly complementarity: RecommendationComplementarityScore;
  readonly roleSuitability: RecommendationScoreDimension;
  readonly metaStrength: RecommendationScoreDimension;
  readonly readiness: RecommendationScoreDimension;
  readonly assumptions: readonly string[];
}

export interface StaticRecommendationTeam {
  readonly teamKey: string;
  readonly speciesKey: string;
  readonly orderedMembers: OrderedRecommendationMembers;
  readonly anchorInventoryIds: readonly string[];
  readonly preScore: RecommendationStaticPreScore;
}

export interface StaticRecommendationGeneration {
  readonly policy: RecommendationStaticPolicy;
  readonly dataVersion: string;
  readonly requestedResultCount: number;
  readonly eligiblePartnerCount: number;
  readonly consideredPartnerCount: number;
  readonly omittedEligiblePartnerCount: number;
  readonly eligibilityExclusions: readonly RecommendationEligibilityExclusion[];
  readonly generatedTeamCount: number;
  readonly uniqueTeamCount: number;
  readonly retainedTeamCount: number;
  readonly teams: readonly StaticRecommendationTeam[];
  readonly finalistTarget: number;
  readonly finalists: readonly StaticRecommendationTeam[];
  readonly assumptions: readonly string[];
}

const positions: readonly RecommendationTeamPosition[] = [
  "lead",
  "switch",
  "closer",
];

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function roleScore(
  candidate: RecommendationCandidate,
  position: RecommendationTeamPosition,
): number | undefined {
  const roles = candidate.staticEvidence.roleScores;

  if (!roles) return undefined;
  if (position === "lead") return roles.lead;
  if (position === "switch") return roles.switch;
  return roles.closer;
}

function relevantRoleScores(roles: CatalogRoleScores): readonly number[] {
  return [roles.lead, roles.switch, roles.closer];
}

function evaluateEligibility(
  candidate: RecommendationCandidate,
  policy: RecommendationStaticPolicy,
): RecommendationEligibilityExclusion | undefined {
  const rank = candidate.staticEvidence.overallRank;
  const roles = candidate.staticEvidence.roleScores;

  if (rank === undefined || roles === undefined) {
    return {
      inventoryId: candidate.inventoryId,
      speciesId: candidate.speciesId,
      code: "ranking-unavailable",
      message: `${candidate.speciesName} has no published overall and role evidence.`,
    };
  }

  if (rank > policy.maxOverallRank) {
    return {
      inventoryId: candidate.inventoryId,
      speciesId: candidate.speciesId,
      code: "overall-rank-threshold",
      message: `${candidate.speciesName} rank ${rank} is outside the top ${policy.maxOverallRank}.`,
    };
  }

  if (
    Math.max(...relevantRoleScores(roles)) < policy.minRelevantRoleScore
  ) {
    return {
      inventoryId: candidate.inventoryId,
      speciesId: candidate.speciesId,
      code: "role-score-threshold",
      message: `${candidate.speciesName} has no lead, switch, or closer score at or above ${policy.minRelevantRoleScore}.`,
    };
  }

  return undefined;
}

function choosePartners(
  partners: readonly RecommendationCandidate[],
  requiredCount: 1 | 2,
): readonly (readonly RecommendationCandidate[])[] {
  if (requiredCount === 1) {
    return partners.map((partner) => [partner]);
  }

  const pairs: RecommendationCandidate[][] = [];

  for (let leftIndex = 0; leftIndex < partners.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < partners.length;
      rightIndex += 1
    ) {
      const left = partners[leftIndex]!;
      const right = partners[rightIndex]!;

      if (left.dex !== right.dex) {
        pairs.push([left, right]);
      }
    }
  }

  return pairs;
}

function permutations(
  candidates: readonly RecommendationCandidate[],
): readonly (readonly RecommendationCandidate[])[] {
  if (candidates.length === 1) return [[candidates[0]!]];

  return candidates.flatMap((candidate, index) =>
    permutations(candidates.filter((_, candidateIndex) => candidateIndex !== index))
      .map((remaining) => [candidate, ...remaining]),
  );
}

function honorsAnchorPositions(
  ordered: readonly RecommendationCandidate[],
  anchors: readonly RecommendationAnchorCandidate[],
): boolean {
  return anchors.every((anchor) => {
    if (anchor.position === "flex") return true;
    const positionIndex = positions.indexOf(anchor.position);
    return ordered[positionIndex]?.inventoryId === anchor.candidate.inventoryId;
  });
}

function assignmentRoleScore(
  ordered: readonly RecommendationCandidate[],
): number {
  return ordered.reduce(
    (sum, candidate, index) =>
      sum + (roleScore(candidate, positions[index]!) ?? 0),
    0,
  );
}

function orderedIdentity(
  ordered: readonly RecommendationCandidate[],
): string {
  return ordered.map((candidate) => candidate.inventoryId).join("|");
}

function bestOrdering(
  candidates: readonly RecommendationCandidate[],
  anchors: readonly RecommendationAnchorCandidate[],
): OrderedRecommendationMembers {
  const validOrders = permutations(candidates).filter((ordered) =>
    honorsAnchorPositions(ordered, anchors),
  );

  if (validOrders.length === 0) {
    throw new Error("No ordered team can satisfy the anchor positions.");
  }

  const ordered = [...validOrders].sort(
    (left, right) =>
      assignmentRoleScore(right) - assignmentRoleScore(left) ||
      compareText(orderedIdentity(left), orderedIdentity(right)),
  )[0]!;

  return {
    lead: ordered[0]!,
    switch: ordered[1]!,
    closer: ordered[2]!,
  };
}

function orderedCandidates(
  members: OrderedRecommendationMembers,
): readonly RecommendationCandidate[] {
  return [members.lead, members.switch, members.closer];
}

function complementarityScore(
  members: readonly RecommendationCandidate[],
): RecommendationComplementarityScore {
  const threatCounts = new Map<string, number>();

  for (const member of members) {
    const memberThreats = new Set(
      member.staticEvidence.counters
        .filter((counter) => counter.rating < STATIC_MATCHUP_NEUTRAL_RATING)
        .map((counter) => counter.speciesId),
    );

    for (const speciesId of memberThreats) {
      threatCounts.set(speciesId, (threatCounts.get(speciesId) ?? 0) + 1);
    }
  }

  const threats = [...threatCounts.keys()];
  const answeredThreats = threats.filter((threatSpeciesId) =>
    members.some((member) =>
      member.staticEvidence.matchups.some(
        (matchup) =>
          matchup.speciesId === threatSpeciesId &&
          matchup.rating > STATIC_MATCHUP_NEUTRAL_RATING,
      ),
    ),
  ).length;
  const sharedThreats = [...threatCounts.values()].filter(
    (count) => count >= 2,
  ).length;
  const threatCoveragePercentage = percentage(
    answeredThreats,
    threats.length,
  );
  const sharedWeaknessAvoidancePercentage =
    threats.length === 0
      ? 0
      : percentage(threats.length - sharedThreats, threats.length);
  const score =
    threatCoveragePercentage * 0.7 +
    sharedWeaknessAvoidancePercentage * 0.3;

  return {
    score,
    evidenceCount: answeredThreats,
    evidenceTotal: threats.length,
    method:
      "70% published counter threats answered by a team matchup + 30% avoidance of counters shared by multiple members",
    knownThreats: threats.length,
    answeredThreats,
    sharedThreats,
    threatCoveragePercentage,
    sharedWeaknessAvoidancePercentage,
  };
}

function preScore(
  members: OrderedRecommendationMembers,
  policy: RecommendationStaticPolicy,
): RecommendationStaticPreScore {
  const ordered = orderedCandidates(members);
  const complementarity = complementarityScore(ordered);
  const roleValues = ordered.flatMap((candidate, index) => {
    const score = roleScore(candidate, positions[index]!);
    return score === undefined ? [] : [score];
  });
  const metaValues = ordered.flatMap((candidate) => {
    const score = candidate.staticEvidence.overallScore;
    return score === undefined ? [] : [score];
  });
  const readyCount = ordered.filter(
    (candidate) => candidate.readiness === "ready-now",
  ).length;
  const roleSuitabilityScore = average(roleValues);
  const metaStrengthScore = average(metaValues);
  const readinessScore = percentage(readyCount, ordered.length);
  const score =
    complementarity.score * policy.scoreWeights.complementarity +
    roleSuitabilityScore * policy.scoreWeights.roleSuitability +
    metaStrengthScore * policy.scoreWeights.metaStrength +
    readinessScore * policy.scoreWeights.readiness;

  return {
    version: RECOMMENDATION_STATIC_SCORE_VERSION,
    score,
    complementarity,
    roleSuitability: {
      score: roleSuitabilityScore,
      evidenceCount: roleValues.length,
      evidenceTotal: ordered.length,
      method:
        "Average published PvPoke lead, switch, or closer score for each assigned position",
    },
    metaStrength: {
      score: metaStrengthScore,
      evidenceCount: metaValues.length,
      evidenceTotal: ordered.length,
      method: "Average published PvPoke overall score for ranked members",
    },
    readiness: {
      score: readinessScore,
      evidenceCount: readyCount,
      evidenceTotal: ordered.length,
      method: "Percentage of ordered members using current ready-now builds",
    },
    assumptions: [
      "Published matchup and counter ratings describe PvPoke default builds, not exact inventory builds",
      "Ratings above 500 are treated as favorable and ratings below 500 as unfavorable",
      "Static pre-score ranks finalists for exact simulation; it is not a final recommendation score",
    ],
  };
}

function teamKey(members: readonly RecommendationCandidate[]): string {
  return [...members]
    .sort((left, right) => compareText(left.inventoryId, right.inventoryId))
    .map((member) => member.inventoryId)
    .join("|");
}

function speciesTeamKey(
  members: readonly RecommendationCandidate[],
): string {
  return [...members]
    .map((member) => member.dex)
    .sort((left, right) => left - right)
    .join("|");
}

function favoriteCount(team: StaticRecommendationTeam): number {
  return orderedCandidates(team.orderedMembers).filter(
    (member) => member.favorite,
  ).length;
}

function compareTeams(
  left: StaticRecommendationTeam,
  right: StaticRecommendationTeam,
): number {
  return (
    right.preScore.score - left.preScore.score ||
    right.preScore.complementarity.score -
      left.preScore.complementarity.score ||
    right.preScore.roleSuitability.score -
      left.preScore.roleSuitability.score ||
    favoriteCount(right) - favoriteCount(left) ||
    compareText(left.teamKey, right.teamKey)
  );
}

function memberPairs(
  team: StaticRecommendationTeam,
): readonly (readonly [number, number])[] {
  const members = orderedCandidates(team.orderedMembers);
  return [
    [members[0]!.dex, members[1]!.dex],
    [members[0]!.dex, members[2]!.dex],
    [members[1]!.dex, members[2]!.dex],
  ];
}

function pairKey(pair: readonly [number, number]): string {
  return pair[0] < pair[1] ? `${pair[0]}:${pair[1]}` : `${pair[1]}:${pair[0]}`;
}

function diverseFinalists(
  teams: readonly StaticRecommendationTeam[],
  anchors: readonly RecommendationAnchorCandidate[],
  target: number,
  policy: RecommendationStaticPolicy,
): readonly StaticRecommendationTeam[] {
  const anchorDex = new Set(anchors.map((anchor) => anchor.candidate.dex));
  const pairCounts = new Map<string, number>();
  const selected: StaticRecommendationTeam[] = [];

  for (const team of teams) {
    const limitedPairs = memberPairs(team)
      .filter(
        (pair) => !(anchorDex.has(pair[0]) && anchorDex.has(pair[1])),
      )
      .map(pairKey);

    if (
      limitedPairs.some(
        (key) =>
          (pairCounts.get(key) ?? 0) >= policy.maxOptionalCoreRepeats,
      )
    ) {
      continue;
    }

    selected.push(team);
    for (const key of limitedPairs) {
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }

    if (selected.length === target) break;
  }

  return selected;
}

function assertStaticPolicy(policy: RecommendationStaticPolicy): void {
  const positiveIntegers = [
    policy.maxOverallRank,
    policy.maxEligiblePartners,
    policy.maxGeneratedTeams,
    policy.finalistMultiplier,
    policy.minimumFinalists,
    policy.maximumFinalists,
    policy.maxOptionalCoreRepeats,
  ];
  const weights = Object.values(policy.scoreWeights);

  if (
    policy.version !== RECOMMENDATION_STATIC_POLICY_VERSION ||
    positiveIntegers.some(
      (value) => !Number.isInteger(value) || value <= 0,
    ) ||
    !Number.isFinite(policy.minRelevantRoleScore) ||
    policy.minRelevantRoleScore < 0 ||
    policy.minRelevantRoleScore > 100 ||
    policy.minimumFinalists > policy.maximumFinalists
  ) {
    throw new RangeError("Recommendation static policy limits are invalid.");
  }

  if (
    weights.some((weight) => !Number.isFinite(weight) || weight < 0) ||
    Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) >
      Number.EPSILON * 10
  ) {
    throw new RangeError(
      "Recommendation static score weights must be non-negative and total 1.",
    );
  }
}

export function generateStaticRecommendationTeams(
  pool: RecommendationCandidatePool,
  policy: RecommendationStaticPolicy = DEFAULT_RECOMMENDATION_STATIC_POLICY,
): StaticRecommendationGeneration {
  assertStaticPolicy(policy);
  const eligibilityExclusions: RecommendationEligibilityExclusion[] = [];
  const eligiblePartners = pool.partners.filter((candidate) => {
    const exclusion = evaluateEligibility(candidate, policy);

    if (exclusion) {
      eligibilityExclusions.push(exclusion);
      return false;
    }
    return true;
  });
  const consideredPartners = eligiblePartners.slice(
    0,
    policy.maxEligiblePartners,
  );
  const partnerGroups = choosePartners(
    consideredPartners,
    pool.requiredPartnerCount,
  );
  const anchorCandidates = pool.anchors.map((anchor) => anchor.candidate);
  const generatedTeams = partnerGroups.map((partners) => {
    const candidates = [...anchorCandidates, ...partners];
    const orderedMembers = bestOrdering(candidates, pool.anchors);

    return {
      teamKey: teamKey(candidates),
      speciesKey: speciesTeamKey(candidates),
      orderedMembers,
      anchorInventoryIds: anchorCandidates.map(
        (candidate) => candidate.inventoryId,
      ),
      preScore: preScore(orderedMembers, policy),
    };
  });
  const sortedTeams = generatedTeams.sort(compareTeams);
  const seenSpeciesTeams = new Set<string>();
  const uniqueTeams = sortedTeams.filter((team) => {
    if (seenSpeciesTeams.has(team.speciesKey)) return false;
    seenSpeciesTeams.add(team.speciesKey);
    return true;
  });
  const teams = uniqueTeams.slice(0, policy.maxGeneratedTeams);
  const finalistTarget = Math.min(
    policy.maximumFinalists,
    Math.max(
      policy.minimumFinalists,
      pool.request.resultCount * policy.finalistMultiplier,
    ),
  );
  const finalists = diverseFinalists(
    teams,
    pool.anchors,
    finalistTarget,
    policy,
  );

  return {
    policy,
    dataVersion: pool.dataVersion,
    requestedResultCount: pool.request.resultCount,
    eligiblePartnerCount: eligiblePartners.length,
    consideredPartnerCount: consideredPartners.length,
    omittedEligiblePartnerCount:
      eligiblePartners.length - consideredPartners.length,
    eligibilityExclusions,
    generatedTeamCount: generatedTeams.length,
    uniqueTeamCount: uniqueTeams.length,
    retainedTeamCount: teams.length,
    teams,
    finalistTarget,
    finalists,
    assumptions: [
      "Anchors are user constraints and do not need to pass partner ranking thresholds",
      `Partners require overall rank ${policy.maxOverallRank} or better and a lead, switch, or closer score of at least ${policy.minRelevantRoleScore}`,
      `At most ${policy.maxEligiblePartners} partners and ${policy.maxGeneratedTeams} static teams are retained before finalist selection`,
      `Optional two-Pokémon cores may appear in at most ${policy.maxOptionalCoreRepeats} finalists`,
      "Exact TeamRanker simulation has not run yet",
    ],
  };
}
