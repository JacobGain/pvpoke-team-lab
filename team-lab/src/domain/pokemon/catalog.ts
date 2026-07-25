export type MoveKind = "fast" | "charged";

export interface CatalogMove {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly kind: MoveKind;
  readonly isLegacy: boolean;
  readonly isElite: boolean;
}

export interface CatalogRanking {
  readonly rank: number;
  readonly score: number;
  readonly rating: number;
  readonly recommendedMoveIds: readonly string[];
  readonly roleScores: CatalogRoleScores;
}

export interface CatalogRoleScores {
  readonly lead: number;
  readonly closer: number;
  readonly switch: number;
  readonly charger: number;
  readonly attacker: number;
  readonly consistency: number;
}

export interface CatalogIvSpread {
  readonly level: number;
  readonly attack: number;
  readonly defense: number;
  readonly hp: number;
}

export interface CatalogBaseStats {
  readonly attack: number;
  readonly defense: number;
  readonly hp: number;
}

export interface PokemonCatalogEntry {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly dex: number;
  readonly types: readonly string[];
  readonly tags: readonly string[];
  readonly isReleased: boolean;
  readonly isShadow: boolean;
  readonly isShadowEligible: boolean;
  readonly baseStats: CatalogBaseStats;
  readonly levelFloor: number;
  readonly levelCap: number;
  readonly evolutionIds: readonly string[];
  readonly fastMoves: readonly CatalogMove[];
  readonly chargedMoves: readonly CatalogMove[];
  readonly defaultGreatLeagueIvs?: CatalogIvSpread;
  readonly ranking?: CatalogRanking;
  readonly isMeta: boolean;
}

export interface PokemonCatalogDiagnostics {
  readonly duplicatePokemonIds: readonly string[];
  readonly duplicateMoveIds: readonly string[];
  readonly duplicateRankingIds: readonly string[];
  readonly danglingPokemonMoveIds: readonly string[];
  readonly rankingSpeciesNotInGameMaster: readonly string[];
  readonly rankingMoveIdsNotInGameMaster: readonly string[];
  readonly metaSpeciesNotInGameMaster: readonly string[];
  readonly metaMoveIdsNotInGameMaster: readonly string[];
}

export interface PokemonCatalog {
  readonly dataVersion: string;
  readonly entries: readonly PokemonCatalogEntry[];
  readonly diagnostics: PokemonCatalogDiagnostics;
}

export function countCatalogDiagnostics(
  diagnostics: PokemonCatalogDiagnostics,
): number {
  return (
    diagnostics.duplicatePokemonIds.length +
    diagnostics.duplicateMoveIds.length +
    diagnostics.duplicateRankingIds.length +
    diagnostics.danglingPokemonMoveIds.length +
    diagnostics.rankingSpeciesNotInGameMaster.length +
    diagnostics.rankingMoveIdsNotInGameMaster.length +
    diagnostics.metaSpeciesNotInGameMaster.length +
    diagnostics.metaMoveIdsNotInGameMaster.length
  );
}
