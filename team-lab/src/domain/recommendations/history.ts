import { z } from "zod";

import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { LEAGUE_IDS } from "@/domain/leagues";
import { projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import {
  type RecommendationFinalistSimulation,
  type SimulatedRecommendationFinalist,
} from "@/domain/recommendations/finalistSimulation";
import { recommendationRequestSchema } from "@/domain/recommendations/contracts";
import { explainRecommendation } from "@/domain/recommendations/explanations";
import {
  type StaticRecommendationGeneration,
} from "@/domain/recommendations/staticTeamGeneration";
import type { RecommendationFinalistSimulationOptions } from "@/domain/recommendations/finalistSimulation";
import type { RecommendationCandidate } from "@/domain/recommendations/candidatePool";

export const RECOMMENDATION_HISTORY_SCHEMA_VERSION = 1 as const;
export const MAX_RECOMMENDATION_HISTORY_RECORDS = 5_000;

const buildRequirementSchema = z.object({
  code: z.enum([
    "evolve",
    "mega-evolve",
    "power-up",
    "change-fast-move",
    "change-charged-move",
    "unlock-second-charged-move",
    "remove-frustration",
    "elite-move",
  ]),
  message: z.string(),
});

const exactBuildSchema = z.object({
  speciesId: z.string().min(1),
  speciesName: z.string().min(1),
  level: z.number().finite(),
  cp: z.number().int().min(10),
  ivs: z.object({
    attack: z.number().int().min(0).max(15),
    defense: z.number().int().min(0).max(15),
    hp: z.number().int().min(0).max(15),
  }),
  fastMoveId: z.string().min(1),
  chargedMoveIds: z.union([
    z.tuple([z.string().min(1)]),
    z.tuple([z.string().min(1), z.string().min(1)]),
  ]),
  isShadow: z.boolean(),
  source: z.enum(["inventory-current", "inventory-planned", "meta-default", "build-plan"]),
});

const recommendationMemberSchema = z.object({
  inventoryId: z.string().min(1),
  source: z.enum(["owned-exact-build", "ranked-default-build"]),
  speciesId: z.string().min(1),
  speciesName: z.string().min(1),
  dex: z.number().int().positive(),
  buildStatus: z.enum(["current", "planned"]),
  readiness: z.enum(["ready-now", "planned", "ranked-default"]),
  favorite: z.boolean(),
  exactBuild: exactBuildSchema,
  buildRequirements: z.array(buildRequirementSchema),
  recommendedRequirements: z.array(buildRequirementSchema),
});

const threatAlternativeSchema = z.object({
  threatSpeciesId: z.string().min(1),
  threatSpeciesName: z.string().min(1),
  threatLevel: z.string().min(1),
  owned: z.array(z.object({
    source: z.literal("owned-exact-build"),
    inventoryId: z.string().min(1),
    speciesId: z.string().min(1),
    speciesName: z.string().min(1),
    buildStatus: z.enum(["current", "planned"]),
    cp: z.number().int().optional(),
    counterRating: z.number().finite(),
    alternativeRating: z.number().finite(),
  })),
  unowned: z.array(z.object({
    source: z.literal("unowned-pvpoke-default"),
    speciesId: z.string().min(1),
    speciesName: z.string().min(1),
    counterRating: z.number().finite(),
    alternativeRating: z.number().finite(),
    recommendedMoveIds: z.array(z.string()),
    defaultIvs: z.object({
      level: z.number().finite(),
      attack: z.number().int().min(0).max(15),
      defense: z.number().int().min(0).max(15),
      hp: z.number().int().min(0).max(15),
    }),
  })),
});

const scoreDimensionSchema = z.object({
  grade: z.enum(["A", "B", "C", "D", "F"]),
  score: z.number().finite(),
});

const metaTargetLimitSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(20),
  z.literal(48),
  z.literal(100),
  z.literal(250),
]);

const recommendationHistoryResultSchema = z.object({
  staticTeam: z.object({
    teamKey: z.string().min(1),
    speciesKey: z.string().min(1),
    orderedMembers: z.object({
      lead: recommendationMemberSchema,
      switch: recommendationMemberSchema,
      closer: recommendationMemberSchema,
    }),
    anchorInventoryIds: z.array(z.string().min(1)),
    preScore: z.object({
      version: z.string().min(1),
      score: z.number().finite(),
      roleSuitability: z.object({ score: z.number().finite() }),
      assumptions: z.array(z.string()),
    }),
  }),
  analysis: z.object({
    coverage: z.object({
      grade: z.enum(["A", "B", "C", "D", "F"]),
      score: z.number().finite(),
      coveredTargets: z.number().int().nonnegative(),
      totalTargets: z.number().int().nonnegative(),
    }),
    bulk: scoreDimensionSchema,
    safety: scoreDimensionSchema,
    consistency: scoreDimensionSchema,
    majorThreats: z.array(z.object({
      speciesId: z.string().min(1),
      speciesName: z.string().min(1),
      threatLevel: z.enum(["team-wall", "core-breaker", "threat", "covered"]),
      targetWins: z.number().int().nonnegative(),
    })),
    scope: z.object({
      context: z.object({
        kind: z.enum(["saved-team", "recommendation"]),
        id: z.string().min(1),
        name: z.string().min(1),
      }),
      targetLimit: metaTargetLimitSchema,
      selectedTargetCount: z.number().int().nonnegative(),
      availableTargetCount: z.number().int().nonnegative(),
      teamShields: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      targetShields: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      targetSpeciesIds: z.array(z.string().min(1)),
    }),
    dataVersion: z.string().min(1).max(200),
    shieldScenario: z.string().min(1),
    assumptions: z.array(z.string()),
    generatedAt: z.iso.datetime(),
  }),
  alternatives: z.object({
    threats: z.array(threatAlternativeSchema),
    consideredThreats: z.number().int().nonnegative(),
    counterEvidenceSource: z.literal("pvpoke-overall-ranking-counters"),
    dataVersion: z.string().min(1).max(200),
  }),
  finalScore: z.object({
    version: z.string().min(1),
    score: z.number().finite(),
    weights: z.object({
      coverage: z.number().finite(),
      bulk: z.number().finite(),
      safety: z.number().finite(),
      consistency: z.number().finite(),
      staticPreScore: z.number().finite(),
    }),
    inputs: z.object({
      coverage: z.number().finite(),
      bulk: z.number().finite(),
      safety: z.number().finite(),
      consistency: z.number().finite(),
      staticPreScore: z.number().finite(),
    }),
    method: z.string().min(1),
  }),
  explanation: z.object({
    headline: z.string().min(1),
    reasons: z.array(z.string()),
    tradeoffs: z.array(z.string()),
    scope: z.string().min(1),
  }),
});

const recommendationHistoryOptionsSchema = z.object({
  targetLimit: metaTargetLimitSchema,
  teamShields: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  targetShields: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export const recommendationHistoryRecordSchema = z.object({
  schemaVersion: z.literal(RECOMMENDATION_HISTORY_SCHEMA_VERSION),
  historyId: z.string().uuid(),
  createdAt: z.iso.datetime(),
  formatId: z.enum(LEAGUE_IDS),
  request: recommendationRequestSchema,
  options: recommendationHistoryOptionsSchema,
  dataVersion: z.string().trim().min(1).max(200),
  policyVersions: z.object({
    staticPolicy: z.string().min(1),
    staticScore: z.string().min(1),
    finalScore: z.string().min(1),
  }),
  anchorSnapshots: z.array(z.object({
    inventoryId: z.string().uuid(),
    position: z.enum(["lead", "switch", "closer", "flex"]),
    speciesId: z.string().min(1),
    speciesName: z.string().min(1),
  })).max(2),
  generation: z.object({
    eligiblePartnerCount: z.number().int().nonnegative(),
    consideredPartnerCount: z.number().int().nonnegative(),
    omittedEligiblePartnerCount: z.number().int().nonnegative(),
    generatedTeamCount: z.number().int().nonnegative(),
    uniqueTeamCount: z.number().int().nonnegative(),
    retainedTeamCount: z.number().int().nonnegative(),
    finalistTarget: z.number().int().nonnegative(),
  }),
  summary: z.object({
    attemptedFinalistCount: z.number().int().nonnegative(),
    completedFinalistCount: z.number().int().nonnegative(),
    failedFinalistCount: z.number().int().nonnegative(),
    selectedResultCount: z.number().int().nonnegative(),
    selectionShortfall: z.number().int().nonnegative(),
    selectionDiversityRelaxed: z.boolean(),
    cancelled: z.boolean(),
  }),
  failures: z.array(z.object({
    teamKey: z.string().min(1),
    speciesKey: z.string().min(1),
    message: z.string(),
  })),
  results: z.array(recommendationHistoryResultSchema).max(10),
}).superRefine((record, context) => {
  if (record.formatId !== record.request.formatId) {
    context.addIssue({
      code: "custom",
      message: "Recommendation history format must match its saved request.",
      path: ["formatId"],
    });
  }
  if (record.summary.selectedResultCount !== record.results.length) {
    context.addIssue({
      code: "custom",
      message: "Recommendation history result count must match the saved results.",
      path: ["summary", "selectedResultCount"],
    });
  }
  if (record.results.length > record.request.resultCount) {
    context.addIssue({
      code: "custom",
      message: "A recommendation run cannot store more results than it requested.",
      path: ["results"],
    });
  }
  if (record.anchorSnapshots.length !== record.request.anchors.length ||
    record.anchorSnapshots.some((snapshot, index) => {
      const anchor = record.request.anchors[index];
      return !anchor || snapshot.inventoryId !== anchor.inventoryId || snapshot.position !== anchor.position;
    })) {
    context.addIssue({
      code: "custom",
      message: "Recommendation history anchor snapshots must match the saved request.",
      path: ["anchorSnapshots"],
    });
  }
  for (const [index, result] of record.results.entries()) {
    if (result.analysis.dataVersion !== record.dataVersion || result.alternatives.dataVersion !== record.dataVersion) {
      context.addIssue({
        code: "custom",
        message: "Archived result data versions must match the recommendation run.",
        path: ["results", index, "analysis", "dataVersion"],
      });
    }
    if (result.finalScore.version !== record.policyVersions.finalScore ||
      result.staticTeam.preScore.version !== record.policyVersions.staticScore) {
      context.addIssue({
        code: "custom",
        message: "Archived result formula versions must match the recommendation run.",
        path: ["results", index, "finalScore", "version"],
      });
    }
    if (result.analysis.scope.targetLimit !== record.options.targetLimit ||
      result.analysis.scope.teamShields !== record.options.teamShields ||
      result.analysis.scope.targetShields !== record.options.targetShields) {
      context.addIssue({
        code: "custom",
        message: "Archived result scope must match the saved simulation settings.",
        path: ["results", index, "analysis", "scope"],
      });
    }
  }
});

export type RecommendationHistoryResult = z.infer<typeof recommendationHistoryResultSchema>;
export type RecommendationHistoryRecord = z.infer<typeof recommendationHistoryRecordSchema>;

function snapshotCandidate(candidate: RecommendationCandidate) {
  return {
    inventoryId: candidate.inventoryId,
    source: candidate.source,
    speciesId: candidate.speciesId,
    speciesName: candidate.speciesName,
    dex: candidate.dex,
    buildStatus: candidate.buildStatus,
    readiness: candidate.readiness,
    favorite: candidate.favorite,
    exactBuild: candidate.exactBuild,
    buildRequirements: candidate.buildRequirements,
    recommendedRequirements: candidate.recommendedRequirements,
  };
}

export function snapshotRecommendationFinalist(
  finalist: SimulatedRecommendationFinalist,
): RecommendationHistoryResult {
  const explanation = explainRecommendation(finalist);
  const { orderedMembers } = finalist.staticTeam;

  return recommendationHistoryResultSchema.parse({
    staticTeam: {
      teamKey: finalist.staticTeam.teamKey,
      speciesKey: finalist.staticTeam.speciesKey,
      orderedMembers: {
        lead: snapshotCandidate(orderedMembers.lead),
        switch: snapshotCandidate(orderedMembers.switch),
        closer: snapshotCandidate(orderedMembers.closer),
      },
      anchorInventoryIds: finalist.staticTeam.anchorInventoryIds,
      preScore: {
        version: finalist.staticTeam.preScore.version,
        score: finalist.staticTeam.preScore.score,
        roleSuitability: {
          score: finalist.staticTeam.preScore.roleSuitability.score,
        },
        assumptions: finalist.staticTeam.preScore.assumptions,
      },
    },
    analysis: {
      coverage: {
        grade: finalist.analysis.coverage.grade,
        score: finalist.analysis.coverage.score,
        coveredTargets: finalist.analysis.coverage.coveredTargets,
        totalTargets: finalist.analysis.coverage.totalTargets,
      },
      bulk: {
        grade: finalist.analysis.bulk.grade,
        score: finalist.analysis.bulk.score,
      },
      safety: {
        grade: finalist.analysis.safety.grade,
        score: finalist.analysis.safety.score,
      },
      consistency: {
        grade: finalist.analysis.consistency.grade,
        score: finalist.analysis.consistency.score,
      },
      majorThreats: finalist.analysis.majorThreats.slice(0, 3).map((threat) => ({
        speciesId: threat.speciesId,
        speciesName: threat.speciesName,
        threatLevel: threat.threatLevel,
        targetWins: threat.targetWins,
      })),
      scope: finalist.analysis.scope,
      dataVersion: finalist.analysis.dataVersion,
      shieldScenario: finalist.analysis.shieldScenario,
      assumptions: finalist.analysis.assumptions,
      generatedAt: finalist.analysis.generatedAt,
    },
    alternatives: {
      threats: finalist.alternatives.threats.slice(0, 3),
      consideredThreats: finalist.alternatives.consideredThreats,
      counterEvidenceSource: finalist.alternatives.counterEvidenceSource,
      dataVersion: finalist.alternatives.dataVersion,
    },
    finalScore: finalist.finalScore,
    explanation,
  });
}

function selectedSpeciesId(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

export function createRecommendationHistoryRecord(input: {
  readonly request: RecommendationHistoryRecord["request"];
  readonly options: RecommendationFinalistSimulationOptions;
  readonly generation: StaticRecommendationGeneration;
  readonly simulation: RecommendationFinalistSimulation;
  readonly inventory: readonly InventoryPokemon[];
  readonly catalog: PokemonCatalog;
  readonly now?: () => Date;
  readonly createId?: () => string;
}): RecommendationHistoryRecord {
  if (input.simulation.selected.length === 0) {
    throw new Error("Recommendation history can only archive runs with at least one result.");
  }

  const inventoryById = new Map(
    input.inventory.map((record) => [record.inventoryId, record]),
  );
  const catalogById = new Map(
    input.catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const anchorSnapshots = input.request.anchors.map((anchor) => {
    const record = inventoryById.get(anchor.inventoryId);
    const projected = record
      ? projectInventoryForCatalog(record, input.catalog) ?? record
      : undefined;
    const speciesId = projected ? selectedSpeciesId(projected) : anchor.inventoryId;

    return {
      inventoryId: anchor.inventoryId,
      position: anchor.position,
      speciesId,
      speciesName: catalogById.get(speciesId)?.speciesName ?? speciesId,
    };
  });

  return recommendationHistoryRecordSchema.parse({
    schemaVersion: RECOMMENDATION_HISTORY_SCHEMA_VERSION,
    historyId: input.createId?.() ?? crypto.randomUUID(),
    createdAt: (input.now?.() ?? new Date()).toISOString(),
    formatId: input.request.formatId,
    request: input.request,
    options: input.options,
    dataVersion: input.simulation.dataVersion,
    policyVersions: {
      staticPolicy: input.generation.policy.version,
      staticScore: input.simulation.selected[0]!.staticTeam.preScore.version,
      finalScore: input.simulation.selected[0]!.finalScore.version,
    },
    anchorSnapshots,
    generation: {
      eligiblePartnerCount: input.generation.eligiblePartnerCount,
      consideredPartnerCount: input.generation.consideredPartnerCount,
      omittedEligiblePartnerCount: input.generation.omittedEligiblePartnerCount,
      generatedTeamCount: input.generation.generatedTeamCount,
      uniqueTeamCount: input.generation.uniqueTeamCount,
      retainedTeamCount: input.generation.retainedTeamCount,
      finalistTarget: input.generation.finalistTarget,
    },
    summary: {
      attemptedFinalistCount: input.simulation.attemptedFinalistCount,
      completedFinalistCount: input.simulation.completed.length,
      failedFinalistCount: input.simulation.failures.length,
      selectedResultCount: input.simulation.selected.length,
      selectionShortfall: input.simulation.selectionShortfall,
      selectionDiversityRelaxed: input.simulation.selectionDiversityRelaxed,
      cancelled: input.simulation.cancelled,
    },
    failures: input.simulation.failures,
    results: input.simulation.selected.map(snapshotRecommendationFinalist),
  });
}
