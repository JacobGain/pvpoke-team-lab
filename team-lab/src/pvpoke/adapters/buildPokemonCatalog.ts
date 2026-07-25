import type {
  CatalogIvSpread,
  CatalogMove,
  CatalogRanking,
  PokemonCatalog,
  PokemonCatalogDiagnostics,
  PokemonCatalogEntry,
} from "../../domain/pokemon/catalog.ts";
import type {
  GameMasterData,
  MetaGroupEntry,
  MoveData,
  PokemonData,
  Ranking,
} from "../types/schemas.ts";

export class CatalogIdentityError extends Error {
  readonly diagnostics: PokemonCatalogDiagnostics;

  constructor(diagnostics: PokemonCatalogDiagnostics) {
    super(
      "PvPoke contains duplicate identity keys that TeamLab cannot safely normalize.",
    );
    this.name = "CatalogIdentityError";
    this.diagnostics = diagnostics;
  }
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates].sort();
}

function asSortedArray(values: ReadonlySet<string>): string[] {
  return [...values].sort();
}

function createMove(
  move: MoveData,
  kind: "fast" | "charged",
  pokemon: PokemonData,
): CatalogMove {
  return Object.freeze({
    id: move.moveId,
    name: move.name,
    type: move.type,
    kind,
    power: move.power,
    energy: move.energy,
    energyGain: move.energyGain,
    turns: move.turns ?? Math.max(move.cooldown / 500, 1),
    isLegacy: pokemon.legacyMoves?.includes(move.moveId) ?? false,
    isElite: pokemon.eliteMoves?.includes(move.moveId) ?? false,
  });
}

function createDefaultIvs(
  pokemon: PokemonData,
): CatalogIvSpread | undefined {
  const spread = pokemon.defaultIVs?.cp1500;

  if (!spread) {
    return undefined;
  }

  return Object.freeze({
    level: spread[0],
    attack: spread[1],
    defense: spread[2],
    hp: spread[3],
  });
}

function createRanking(
  ranking: Ranking | undefined,
  rank: number | undefined,
): CatalogRanking | undefined {
  if (!ranking || rank === undefined) {
    return undefined;
  }

  return Object.freeze({
    rank,
    score: ranking.score,
    rating: ranking.rating,
    recommendedMoveIds: Object.freeze([...ranking.moveset]),
    roleScores: Object.freeze({
      lead: ranking.scores[0] ?? 0,
      closer: ranking.scores[1] ?? 0,
      switch: ranking.scores[2] ?? 0,
      charger: ranking.scores[3] ?? 0,
      attacker: ranking.scores[4] ?? 0,
      consistency: ranking.scores[5] ?? 0,
    }),
  });
}

export function buildPokemonCatalog(
  gameMaster: GameMasterData,
  rankings: readonly Ranking[],
  metaGroup: readonly MetaGroupEntry[],
): PokemonCatalog {
  const duplicatePokemonIds = findDuplicates(
    gameMaster.pokemon.map((pokemon) => pokemon.speciesId),
  );
  const duplicateMoveIds = findDuplicates(
    gameMaster.moves.map((move) => move.moveId),
  );
  const duplicateRankingIds = findDuplicates(
    rankings.map((ranking) => ranking.speciesId),
  );

  const moveMap = new Map(
    gameMaster.moves.map((move) => [move.moveId, move]),
  );
  const pokemonIds = new Set(
    gameMaster.pokemon.map((pokemon) => pokemon.speciesId),
  );
  const rankingMap = new Map(
    rankings.map((ranking, index) => [
      ranking.speciesId,
      { ranking, rank: index + 1 },
    ]),
  );
  const metaIds = new Set(metaGroup.map((entry) => entry.speciesId));

  const danglingPokemonMoveIds = new Set<string>();
  const rankingSpeciesNotInGameMaster = new Set<string>();
  const rankingMoveIdsNotInGameMaster = new Set<string>();
  const metaSpeciesNotInGameMaster = new Set<string>();
  const metaMoveIdsNotInGameMaster = new Set<string>();

  for (const ranking of rankings) {
    if (!pokemonIds.has(ranking.speciesId)) {
      rankingSpeciesNotInGameMaster.add(ranking.speciesId);
    }

    for (const moveId of ranking.moveset) {
      if (!moveMap.has(moveId)) {
        rankingMoveIdsNotInGameMaster.add(moveId);
      }
    }
  }

  for (const metaEntry of metaGroup) {
    if (!pokemonIds.has(metaEntry.speciesId)) {
      metaSpeciesNotInGameMaster.add(metaEntry.speciesId);
    }

    const moveIds = [
      ...(metaEntry.fastMove ? [metaEntry.fastMove] : []),
      ...(metaEntry.chargedMoves ?? []),
    ];

    for (const moveId of moveIds) {
      if (!moveMap.has(moveId)) {
        metaMoveIdsNotInGameMaster.add(moveId);
      }
    }
  }

  const entries = gameMaster.pokemon.map((pokemon): PokemonCatalogEntry => {
    const fastMoves = pokemon.fastMoves.flatMap((moveId) => {
      const move = moveMap.get(moveId);

      if (!move) {
        danglingPokemonMoveIds.add(moveId);
        return [];
      }

      return [createMove(move, "fast", pokemon)];
    });

    const chargedMoves = pokemon.chargedMoves.flatMap((moveId) => {
      const move = moveMap.get(moveId);

      if (!move) {
        danglingPokemonMoveIds.add(moveId);
        return [];
      }

      return [createMove(move, "charged", pokemon)];
    });

    const rankingData = rankingMap.get(pokemon.speciesId);
    const tags = Object.freeze([...(pokemon.tags ?? [])]);
    const specialChargedMoveIds = [
      ...(tags.includes("shadoweligible") ? ["RETURN"] : []),
      ...(tags.includes("shadow") ? ["FRUSTRATION"] : []),
    ];

    for (const moveId of specialChargedMoveIds) {
      const move = moveMap.get(moveId);

      if (move && !chargedMoves.some((entry) => entry.id === moveId)) {
        chargedMoves.push(
          Object.freeze({
            ...createMove(move, "charged", pokemon),
            isLegacy: true,
          }),
        );
      }
    }

    return Object.freeze({
      speciesId: pokemon.speciesId,
      speciesName: pokemon.speciesName,
      dex: pokemon.dex,
      types: Object.freeze([...pokemon.types]),
      tags,
      isReleased: pokemon.released,
      isShadow:
        tags.includes("shadow") || pokemon.speciesId.endsWith("_shadow"),
      isShadowEligible: tags.includes("shadoweligible"),
      baseStats: Object.freeze({
        attack: pokemon.baseStats.atk,
        defense: pokemon.baseStats.def,
        hp: pokemon.baseStats.hp,
      }),
      levelFloor: pokemon.levelFloor ?? 1,
      levelCap: pokemon.levelCap ?? 50,
      evolutionIds: Object.freeze([...(pokemon.family?.evolutions ?? [])]),
      fastMoves: Object.freeze(fastMoves),
      chargedMoves: Object.freeze(chargedMoves),
      defaultGreatLeagueIvs: createDefaultIvs(pokemon),
      ranking: createRanking(
        rankingData?.ranking,
        rankingData?.rank,
      ),
      isMeta: metaIds.has(pokemon.speciesId),
    });
  });

  entries.sort((left, right) => {
    const leftRank = left.ranking?.rank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.ranking?.rank ?? Number.POSITIVE_INFINITY;

    return (
      leftRank - rightRank ||
      left.speciesName.localeCompare(right.speciesName)
    );
  });

  const diagnostics: PokemonCatalogDiagnostics = Object.freeze({
    duplicatePokemonIds: Object.freeze(duplicatePokemonIds),
    duplicateMoveIds: Object.freeze(duplicateMoveIds),
    duplicateRankingIds: Object.freeze(duplicateRankingIds),
    danglingPokemonMoveIds: Object.freeze(
      asSortedArray(danglingPokemonMoveIds),
    ),
    rankingSpeciesNotInGameMaster: Object.freeze(
      asSortedArray(rankingSpeciesNotInGameMaster),
    ),
    rankingMoveIdsNotInGameMaster: Object.freeze(
      asSortedArray(rankingMoveIdsNotInGameMaster),
    ),
    metaSpeciesNotInGameMaster: Object.freeze(
      asSortedArray(metaSpeciesNotInGameMaster),
    ),
    metaMoveIdsNotInGameMaster: Object.freeze(
      asSortedArray(metaMoveIdsNotInGameMaster),
    ),
  });

  if (
    duplicatePokemonIds.length > 0 ||
    duplicateMoveIds.length > 0 ||
    duplicateRankingIds.length > 0
  ) {
    throw new CatalogIdentityError(diagnostics);
  }

  return Object.freeze({
    dataVersion: gameMaster.timestamp,
    entries: Object.freeze(entries),
    diagnostics,
  });
}
