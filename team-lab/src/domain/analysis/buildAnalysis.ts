import type {
  InventoryIvs,
  InventoryMoveset,
  InventoryPokemon,
} from "@/domain/inventory/schemas";
import {
  calculateEffectiveStats,
  findHighestLegalLevel,
  analyzeIvRanking,
  type EffectiveStats,
  type IvRankingSummary,
} from "@/domain/analysis/ivRankings";
import { inferCombatPowerLevel } from "@/domain/pokemon/combatPower";
import type {
  CatalogRoleScores,
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export interface AnalyzedLevel {
  readonly level: number;
  readonly isBestBuddy: boolean;
  readonly stats: EffectiveStats;
}

export interface MoveAnalysis {
  readonly enteredFastMoveId: string;
  readonly enteredChargedMoveIds: readonly string[];
  readonly recommendedFastMoveId?: string;
  readonly recommendedChargedMoveIds: readonly string[];
  readonly fastMoveMatches: boolean;
  readonly missingRecommendedChargedMoveIds: readonly string[];
  readonly extraEnteredChargedMoveIds: readonly string[];
}

export interface MetaRankingAnalysis {
  readonly status: "ranked" | "unranked";
  readonly rank?: number;
  readonly score?: number;
  readonly rating?: number;
  readonly isMeta: boolean;
  readonly roles: readonly RoleRankingAnalysis[];
  readonly strongestRole?: RoleRankingAnalysis;
}

export type RoleName = keyof CatalogRoleScores;

export interface RoleRankingAnalysis {
  readonly role: RoleName;
  readonly score: number;
  readonly rank: number;
  readonly count: number;
}

export interface AnalyzedPokemonBuild {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly context: "current" | "planned";
  readonly cp: number;
  readonly cpSource: "recorded" | "derived-maximum";
  readonly ivs: InventoryIvs;
  readonly ivSource: "user-entered" | "assumed-rank-1";
  readonly levels: readonly AnalyzedLevel[];
  readonly ivRanking: IvRankingSummary;
  readonly moves: MoveAnalysis;
  readonly metaRanking: MetaRankingAnalysis;
  readonly dataVersion: string;
}

export interface BuildRequirement {
  readonly code:
    | "evolve"
    | "power-up"
    | "change-fast-move"
    | "change-charged-move"
    | "unlock-second-charged-move"
    | "remove-frustration"
    | "elite-move";
  readonly message: string;
}

export interface InventoryBuildAnalysis {
  readonly inventoryId: string;
  readonly current: AnalyzedPokemonBuild;
  readonly planned?: AnalyzedPokemonBuild;
  readonly requirements: readonly BuildRequirement[];
}

function analyzeMoves(
  pokemon: PokemonCatalogEntry,
  moveset: InventoryMoveset,
): MoveAnalysis {
  const recommendedMoveIds = pokemon.ranking?.recommendedMoveIds ?? [];
  const recommendedFastMoveId = pokemon.fastMoves.find((move) =>
    recommendedMoveIds.includes(move.id),
  )?.id;
  const recommendedChargedMoveIds = pokemon.chargedMoves
    .filter((move) => recommendedMoveIds.includes(move.id))
    .map((move) => move.id);
  const enteredChargedMoveIds = [...moveset.chargedMoveIds];

  return {
    enteredFastMoveId: moveset.fastMoveId,
    enteredChargedMoveIds,
    recommendedFastMoveId,
    recommendedChargedMoveIds,
    fastMoveMatches:
      recommendedFastMoveId === undefined ||
      recommendedFastMoveId === moveset.fastMoveId,
    missingRecommendedChargedMoveIds: recommendedChargedMoveIds.filter(
      (moveId) => !enteredChargedMoveIds.includes(moveId),
    ),
    extraEnteredChargedMoveIds: enteredChargedMoveIds.filter(
      (moveId) => !recommendedChargedMoveIds.includes(moveId),
    ),
  };
}

function analyzeBuild(
  pokemon: PokemonCatalogEntry,
  context: "current" | "planned",
  cp: number | undefined,
  cpSource: "recorded" | "derived-maximum",
  ivs: InventoryIvs,
  ivSource: "user-entered" | "assumed-rank-1",
  moveset: InventoryMoveset,
  dataVersion: string,
  catalog: PokemonCatalog,
): AnalyzedPokemonBuild {
  const resolvedBuild =
    cp === undefined
      ? findHighestLegalLevel(pokemon, ivs)
      : undefined;
  const resolvedCp = cp ?? resolvedBuild?.cp;

  if (resolvedCp === undefined) {
    throw new Error(
      `${pokemon.speciesName} cannot produce a Great League build with these IVs.`,
    );
  }

  const inference =
    resolvedBuild === undefined
      ? inferCombatPowerLevel(pokemon, ivs, resolvedCp)
      : {
          matches: [
            {
              level: resolvedBuild.level,
              isBestBuddy: resolvedBuild.level > pokemon.levelCap,
            },
          ],
        };

  if (inference.matches.length === 0) {
    throw new Error(
      `${pokemon.speciesName} CP ${resolvedCp} has no supported level.`,
    );
  }

  return {
    speciesId: pokemon.speciesId,
    speciesName: pokemon.speciesName,
    context,
    cp: resolvedCp,
    cpSource,
    ivs,
    ivSource,
    levels: inference.matches.map((match) => ({
      level: match.level,
      isBestBuddy: match.isBestBuddy,
      stats: calculateEffectiveStats(pokemon, ivs, match.level),
    })),
    ivRanking: analyzeIvRanking(pokemon, ivs),
    moves: analyzeMoves(pokemon, moveset),
    metaRanking: pokemon.ranking
      ? (() => {
          const roles = (
            Object.entries(pokemon.ranking.roleScores) as [
              RoleName,
              number,
            ][]
          ).map(([role, score]) => {
            const comparisonScores = catalog.entries.flatMap((entry) =>
              entry.ranking ? [entry.ranking.roleScores[role]] : [],
            );
            return {
              role,
              score,
              rank:
                comparisonScores.filter(
                  (comparisonScore) => comparisonScore > score,
                ).length + 1,
              count: comparisonScores.length,
            };
          });
          const strongestRole = roles.reduce((strongest, candidate) =>
            candidate.rank < strongest.rank ||
            (candidate.rank === strongest.rank &&
              candidate.score > strongest.score)
              ? candidate
              : strongest,
          );

          return {
          status: "ranked",
          rank: pokemon.ranking.rank,
          score: pokemon.ranking.score,
          rating: pokemon.ranking.rating,
          isMeta: pokemon.isMeta,
            roles,
            strongestRole,
          };
        })()
      : { status: "unranked", isMeta: pokemon.isMeta, roles: [] },
    dataVersion,
  };
}

function buildRequirements(
  catalog: PokemonCatalog,
  current: AnalyzedPokemonBuild,
  planned: AnalyzedPokemonBuild | undefined,
): readonly BuildRequirement[] {
  const target = planned ?? current;
  const targetPokemon = catalog.entries.find(
    (pokemon) => pokemon.speciesId === target.speciesId,
  );
  const requirements: BuildRequirement[] = [];

  if (!targetPokemon) {
    return requirements;
  }

  if (planned && planned.speciesId !== current.speciesId) {
    requirements.push({
      code: "evolve",
      message: `Evolve ${current.speciesName} into ${planned.speciesName}.`,
    });
  }

  if (planned && planned.cp > current.cp) {
    requirements.push({
      code: "power-up",
      message: `Power up from CP ${current.cp} to CP ${planned.cp}.`,
    });
  }

  if (
    planned &&
    planned.moves.enteredFastMoveId !== current.moves.enteredFastMoveId
  ) {
    requirements.push({
      code: "change-fast-move",
      message: `Change the fast move from ${current.moves.enteredFastMoveId} to ${planned.moves.enteredFastMoveId}.`,
    });
  }

  if (planned) {
    for (const moveId of planned.moves.enteredChargedMoveIds) {
      if (!current.moves.enteredChargedMoveIds.includes(moveId)) {
        requirements.push({
          code:
            current.moves.enteredChargedMoveIds.length < 2
              ? "unlock-second-charged-move"
              : "change-charged-move",
          message:
            current.moves.enteredChargedMoveIds.length < 2
              ? `Unlock a second charged move for ${moveId}.`
              : `Change a charged move to ${moveId}.`,
        });
      }
    }
  }

  if (!target.moves.fastMoveMatches && target.moves.recommendedFastMoveId) {
    requirements.push({
      code: "change-fast-move",
      message: `Change the fast move to ${target.moves.recommendedFastMoveId}.`,
    });
  }

  for (const moveId of target.moves.missingRecommendedChargedMoveIds) {
    requirements.push({
      code:
        target.moves.enteredChargedMoveIds.length < 2
          ? "unlock-second-charged-move"
          : "change-charged-move",
      message:
        target.moves.enteredChargedMoveIds.length < 2
          ? `Unlock a second charged move for ${moveId}.`
          : `Change a charged move to ${moveId}.`,
    });
  }

  if (
    target.moves.enteredChargedMoveIds.includes("FRUSTRATION") &&
    !target.moves.recommendedChargedMoveIds.includes("FRUSTRATION")
  ) {
    requirements.push({
      code: "remove-frustration",
      message: "Remove Frustration during an eligible Team GO Rocket event.",
    });
  }

  const targetMoveIds = [
    target.moves.recommendedFastMoveId,
    ...target.moves.recommendedChargedMoveIds,
  ].filter((moveId): moveId is string => moveId !== undefined);
  for (const moveId of targetMoveIds) {
    const move = [...targetPokemon.fastMoves, ...targetPokemon.chargedMoves]
      .find((candidate) => candidate.id === moveId);
    if (move?.isElite) {
      requirements.push({
        code: "elite-move",
        message: `${move.name} requires an Elite TM or eligible event.`,
      });
    }
  }

  return requirements.filter(
    (requirement, index) =>
      requirements.findIndex(
        (candidate) =>
          candidate.code === requirement.code &&
          candidate.message === requirement.message,
      ) === index,
  );
}

export function analyzeInventoryBuild(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): InventoryBuildAnalysis {
  const currentPokemon = catalog.entries.find(
    (pokemon) => pokemon.speciesId === record.speciesId,
  );

  if (!currentPokemon) {
    throw new Error(`${record.speciesId} is missing from the current catalog.`);
  }

  const current = analyzeBuild(
    currentPokemon,
    "current",
    record.currentBuild.cp,
    "recorded",
    record.currentBuild.ivProfile.ivs,
    record.currentBuild.ivProfile.source,
    record.currentBuild.moveset,
    catalog.dataVersion,
    catalog,
  );
  let planned: AnalyzedPokemonBuild | undefined;

  if (record.buildStatus === "planned") {
    const targetPokemon = catalog.entries.find(
      (pokemon) => pokemon.speciesId === record.plannedBuild.targetSpeciesId,
    );

    if (!targetPokemon) {
      throw new Error(
        `${record.plannedBuild.targetSpeciesId} is missing from the current catalog.`,
      );
    }

    planned = analyzeBuild(
      targetPokemon,
      "planned",
      record.plannedBuild.targetCp,
      record.plannedBuild.targetCp === undefined
        ? "derived-maximum"
        : "recorded",
      record.currentBuild.ivProfile.ivs,
      record.currentBuild.ivProfile.source,
      record.plannedBuild.desiredMoveset,
      catalog.dataVersion,
      catalog,
    );
  }

  return {
    inventoryId: record.inventoryId,
    current,
    planned,
    requirements: buildRequirements(catalog, current, planned),
  };
}
