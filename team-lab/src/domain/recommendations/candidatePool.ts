import {
  analyzeInventoryBuild,
  type BuildRequirement,
} from "@/domain/analysis/buildAnalysis";
import { validateInventoryPokemonAgainstCatalog } from "@/domain/inventory/validation";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type {
  CatalogRankedOpponent,
  CatalogRoleScores,
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import {
  serializeAnalyzedBuildForSimulation,
} from "@/domain/simulation/buildSerialization";
import type { ExactSimulationBuild } from "@/domain/simulation/contracts";
import {
  recommendationRequestSchema,
  type RecommendationAnchorPosition,
  type RecommendationBuildStatusScope,
  type RecommendationRequest,
} from "@/domain/recommendations/contracts";

export interface RecommendationStaticEvidence {
  readonly overallRank?: number;
  readonly overallScore?: number;
  readonly overallRating?: number;
  readonly roleScores?: CatalogRoleScores;
  readonly matchups: readonly CatalogRankedOpponent[];
  readonly counters: readonly CatalogRankedOpponent[];
}

export interface RecommendationCandidate {
  readonly inventoryId: string;
  readonly speciesId: string;
  readonly speciesName: string;
  readonly dex: number;
  readonly buildStatus: "current" | "planned";
  readonly readiness: "ready-now" | "planned";
  readonly favorite: boolean;
  readonly exactBuild: ExactSimulationBuild;
  readonly buildRequirements: readonly BuildRequirement[];
  readonly staticEvidence: RecommendationStaticEvidence;
}

export interface RecommendationAnchorCandidate {
  readonly position: RecommendationAnchorPosition;
  readonly candidate: RecommendationCandidate;
}

export type RecommendationCandidateExclusionCode =
  | "build-status-scope"
  | "species-clause-with-anchor"
  | "catalog-validation"
  | "exact-build-unavailable";

export interface RecommendationCandidateExclusion {
  readonly inventoryId: string;
  readonly code: RecommendationCandidateExclusionCode;
  readonly message: string;
}

export interface RecommendationCandidatePool {
  readonly request: RecommendationRequest;
  readonly anchors: readonly RecommendationAnchorCandidate[];
  readonly requiredPartnerCount: 1 | 2;
  readonly partners: readonly RecommendationCandidate[];
  readonly exclusions: readonly RecommendationCandidateExclusion[];
  readonly dataVersion: string;
}

export type RecommendationAnchorIssueCode =
  | "anchor-not-found"
  | "anchor-outside-build-status-scope"
  | "anchor-catalog-validation"
  | "anchor-exact-build-unavailable"
  | "anchor-species-clause";

export interface RecommendationAnchorIssue {
  readonly inventoryId: string;
  readonly code: RecommendationAnchorIssueCode;
  readonly message: string;
}

export class RecommendationAnchorError extends Error {
  readonly issues: readonly RecommendationAnchorIssue[];

  constructor(issues: readonly RecommendationAnchorIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "RecommendationAnchorError";
    this.issues = issues;
  }
}

function selectedSpeciesId(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

function isWithinBuildStatusScope(
  record: InventoryPokemon,
  scope: RecommendationBuildStatusScope,
): boolean {
  if (scope === "all") return true;
  if (scope === "ready-now-only") return record.buildStatus === "current";
  return record.buildStatus === "planned";
}

function createCandidate(
  record: InventoryPokemon,
  pokemon: PokemonCatalogEntry,
  catalog: PokemonCatalog,
): RecommendationCandidate {
  const analysis = analyzeInventoryBuild(record, catalog);
  const selectedBuild =
    record.buildStatus === "planned" ? analysis.planned : analysis.current;

  if (!selectedBuild) {
    throw new Error(
      `${pokemon.speciesName} has no analyzable selected build.`,
    );
  }

  return {
    inventoryId: record.inventoryId,
    speciesId: pokemon.speciesId,
    speciesName: pokemon.speciesName,
    dex: pokemon.dex,
    buildStatus: record.buildStatus,
    readiness:
      record.buildStatus === "current" ? "ready-now" : "planned",
    favorite: record.favorite,
    exactBuild: serializeAnalyzedBuildForSimulation(selectedBuild, pokemon),
    buildRequirements: analysis.requirements,
    staticEvidence: {
      overallRank: pokemon.ranking?.rank,
      overallScore: pokemon.ranking?.score,
      overallRating: pokemon.ranking?.rating,
      roleScores: pokemon.ranking?.roleScores,
      matchups: pokemon.ranking?.matchups ?? [],
      counters: pokemon.ranking?.counters ?? [],
    },
  };
}

function compareCandidates(
  left: RecommendationCandidate,
  right: RecommendationCandidate,
): number {
  if (left.readiness !== right.readiness) {
    return left.readiness === "ready-now" ? -1 : 1;
  }
  if (left.favorite !== right.favorite) {
    return left.favorite ? -1 : 1;
  }

  const leftRank = left.staticEvidence.overallRank ?? Number.POSITIVE_INFINITY;
  const rightRank =
    right.staticEvidence.overallRank ?? Number.POSITIVE_INFINITY;
  const nameOrder =
    left.speciesName < right.speciesName
      ? -1
      : left.speciesName > right.speciesName
        ? 1
        : 0;
  const identityOrder =
    left.inventoryId < right.inventoryId
      ? -1
      : left.inventoryId > right.inventoryId
        ? 1
        : 0;

  return leftRank - rightRank || nameOrder || identityOrder;
}

function catalogValidationMessage(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): string | undefined {
  const issues = validateInventoryPokemonAgainstCatalog(record, catalog);
  return issues.length > 0
    ? issues.map((issue) => issue.message).join(" ")
    : undefined;
}

export function buildRecommendationCandidatePool(
  request: RecommendationRequest,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
): RecommendationCandidatePool {
  const validatedRequest = recommendationRequestSchema.parse(request);
  const inventoryById = new Map(
    inventory.map((record) => [record.inventoryId, record]),
  );
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const anchorIssues: RecommendationAnchorIssue[] = [];
  const anchors: RecommendationAnchorCandidate[] = [];

  for (const anchor of validatedRequest.anchors) {
    const record = inventoryById.get(anchor.inventoryId);

    if (!record) {
      anchorIssues.push({
        inventoryId: anchor.inventoryId,
        code: "anchor-not-found",
        message: `Anchor inventory record ${anchor.inventoryId} does not exist.`,
      });
      continue;
    }

    if (!isWithinBuildStatusScope(record, validatedRequest.buildStatusScope)) {
      anchorIssues.push({
        inventoryId: anchor.inventoryId,
        code: "anchor-outside-build-status-scope",
        message: `Anchor ${anchor.inventoryId} is outside the ${validatedRequest.buildStatusScope} candidate scope.`,
      });
      continue;
    }

    const catalogValidation = catalogValidationMessage(record, catalog);

    if (catalogValidation) {
      anchorIssues.push({
        inventoryId: anchor.inventoryId,
        code: "anchor-catalog-validation",
        message: catalogValidation,
      });
      continue;
    }

    const pokemon = catalogById.get(selectedSpeciesId(record));

    if (!pokemon) {
      anchorIssues.push({
        inventoryId: anchor.inventoryId,
        code: "anchor-catalog-validation",
        message: `${selectedSpeciesId(record)} does not exist in catalog ${catalog.dataVersion}.`,
      });
      continue;
    }

    try {
      anchors.push({
        position: anchor.position,
        candidate: createCandidate(record, pokemon, catalog),
      });
    } catch (error) {
      anchorIssues.push({
        inventoryId: anchor.inventoryId,
        code: "anchor-exact-build-unavailable",
        message:
          error instanceof Error
            ? error.message
            : `Anchor ${anchor.inventoryId} could not become an exact build.`,
      });
    }
  }

  const seenAnchorDex = new Map<number, RecommendationAnchorCandidate>();

  for (const anchor of anchors) {
    const conflict = seenAnchorDex.get(anchor.candidate.dex);

    if (conflict) {
      anchorIssues.push({
        inventoryId: anchor.candidate.inventoryId,
        code: "anchor-species-clause",
        message: `${anchor.candidate.speciesName} conflicts with anchor ${conflict.candidate.speciesName} under species clause.`,
      });
    } else {
      seenAnchorDex.set(anchor.candidate.dex, anchor);
    }
  }

  if (anchorIssues.length > 0) {
    throw new RecommendationAnchorError(anchorIssues);
  }

  const anchorInventoryIds = new Set(
    anchors.map((anchor) => anchor.candidate.inventoryId),
  );
  const anchorDex = new Set(
    anchors.map((anchor) => anchor.candidate.dex),
  );
  const partners: RecommendationCandidate[] = [];
  const exclusions: RecommendationCandidateExclusion[] = [];

  for (const record of inventory) {
    if (anchorInventoryIds.has(record.inventoryId)) {
      continue;
    }

    if (!isWithinBuildStatusScope(record, validatedRequest.buildStatusScope)) {
      exclusions.push({
        inventoryId: record.inventoryId,
        code: "build-status-scope",
        message: `Record is outside the ${validatedRequest.buildStatusScope} candidate scope.`,
      });
      continue;
    }

    const catalogValidation = catalogValidationMessage(record, catalog);

    if (catalogValidation) {
      exclusions.push({
        inventoryId: record.inventoryId,
        code: "catalog-validation",
        message: catalogValidation,
      });
      continue;
    }

    const pokemon = catalogById.get(selectedSpeciesId(record));

    if (!pokemon) {
      exclusions.push({
        inventoryId: record.inventoryId,
        code: "catalog-validation",
        message: `${selectedSpeciesId(record)} does not exist in catalog ${catalog.dataVersion}.`,
      });
      continue;
    }

    if (anchorDex.has(pokemon.dex)) {
      exclusions.push({
        inventoryId: record.inventoryId,
        code: "species-clause-with-anchor",
        message: `${pokemon.speciesName} conflicts with an anchor under species clause.`,
      });
      continue;
    }

    try {
      partners.push(createCandidate(record, pokemon, catalog));
    } catch (error) {
      exclusions.push({
        inventoryId: record.inventoryId,
        code: "exact-build-unavailable",
        message:
          error instanceof Error
            ? error.message
            : `Record ${record.inventoryId} could not become an exact build.`,
      });
    }
  }

  return {
    request: validatedRequest,
    anchors,
    requiredPartnerCount: anchors.length === 1 ? 2 : 1,
    partners: partners.sort(compareCandidates),
    exclusions,
    dataVersion: catalog.dataVersion,
  };
}
