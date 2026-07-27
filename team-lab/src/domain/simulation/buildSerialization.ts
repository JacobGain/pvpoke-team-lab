import type { AnalyzedPokemonBuild } from "@/domain/analysis/buildAnalysis";
import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";
import type { ExactSimulationBuild } from "@/domain/simulation/contracts";

export class AmbiguousSimulationLevelError extends Error {
  readonly levels: readonly number[];

  constructor(levels: readonly number[]) {
    super(
      `Exact simulation requires one level; this CP and IV spread can be level ${levels.join(" or ")}.`,
    );
    this.name = "AmbiguousSimulationLevelError";
    this.levels = levels;
  }
}

export function serializeAnalyzedBuildForSimulation(
  build: AnalyzedPokemonBuild,
  pokemon: PokemonCatalogEntry,
  selectedLevel?: number,
): ExactSimulationBuild {
  const level =
    selectedLevel === undefined
      ? build.levels.length === 1
        ? build.levels[0]
        : undefined
      : build.levels.find((candidate) => candidate.level === selectedLevel);

  if (!level) {
    if (selectedLevel !== undefined) {
      throw new RangeError(
        `Level ${selectedLevel} is not valid for ${build.speciesName} CP ${build.cp}.`,
      );
    }

    throw new AmbiguousSimulationLevelError(
      build.levels.map((candidate) => candidate.level),
    );
  }

  if (build.moves.enteredChargedMoveIds.length === 0) {
    throw new Error(`${build.speciesName} needs at least one charged move.`);
  }

  const chargedMoveIds =
    build.moves.enteredChargedMoveIds.length === 1
      ? ([build.moves.enteredChargedMoveIds[0]!] as const)
      : ([
          build.moves.enteredChargedMoveIds[0]!,
          build.moves.enteredChargedMoveIds[1]!,
        ] as const);

  return {
    speciesId: build.speciesId,
    speciesName: build.speciesName,
    level: level.level,
    cp: build.cp,
    ivs: build.ivs,
    fastMoveId: build.moves.enteredFastMoveId,
    chargedMoveIds,
    isShadow: pokemon.isShadow,
    source:
      build.context === "planned"
        ? "inventory-planned"
        : "inventory-current",
  };
}
