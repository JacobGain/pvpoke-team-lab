import type {
  AnalyzedPokemonBuild,
} from "@/domain/analysis/buildAnalysis";
import {
  findHighestLegalLevel,
} from "@/domain/analysis/ivRankings";
import type {
  InventoryIvs,
  InventoryMoveset,
} from "@/domain/inventory/schemas";
import { leagueForCatalog } from "@/domain/leagues";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import { calculateCombatPower } from "@/domain/pokemon/combatPower";
import {
  createMetaDefaultBuild,
} from "@/domain/simulation/teamRanker";
import type {
  ExactSimulationBuild,
  OneOnOneSimulationAdapter,
  OneOnOneSimulationResult,
  ShieldCount,
} from "@/domain/simulation/contracts";
import {
  serializeAnalyzedBuildForSimulation,
} from "@/domain/simulation/buildSerialization";

export const MAX_MATCHUP_PLAN_CANDIDATES = 3;
export const MAX_MATCHUP_PLAN_THREATS = 3;

export interface MatchupPlanBuild {
  readonly id: string;
  readonly label: string;
  readonly build: ExactSimulationBuild;
}

export interface MatchupPlanThreat {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly build: ExactSimulationBuild;
}

export type MatchupPlanIvSelection =
  | { readonly kind: "source" }
  | { readonly kind: "rank-one" }
  | { readonly kind: "highest-attack" }
  | { readonly kind: "highest-defense" }
  | { readonly kind: "custom"; readonly ivs: InventoryIvs };

export type MatchupPlanMovesSelection =
  | { readonly kind: "source" }
  | { readonly kind: "recommended" }
  | { readonly kind: "custom"; readonly moveset: InventoryMoveset };

export interface MatchupPlanScenario {
  readonly playerShields: ShieldCount;
  readonly threatShields: ShieldCount;
}

export interface MatchupPlanSimulationInput {
  readonly catalog: PokemonCatalog;
  readonly baseline: MatchupPlanBuild;
  readonly candidates: readonly MatchupPlanBuild[];
  readonly threats: readonly MatchupPlanThreat[];
  readonly scenario: MatchupPlanScenario;
}

export interface MatchupPlanSimulationProgress {
  readonly completed: number;
  readonly total: number;
  readonly buildLabel: string;
  readonly threatName: string;
}

export interface MatchupPlanSimulationObservation {
  readonly buildId: string;
  readonly buildLabel: string;
  readonly threatSpeciesId: string;
  readonly threatName: string;
  readonly result?: OneOnOneSimulationResult;
  readonly error?: string;
}

export interface MatchupPlanSimulationReport {
  readonly dataVersion: string;
  readonly scenario: MatchupPlanScenario;
  readonly observations: readonly MatchupPlanSimulationObservation[];
  readonly completedCount: number;
  readonly failureCount: number;
  readonly cancelled: boolean;
}

export interface MatchupPlanSimulationOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: MatchupPlanSimulationProgress) => void;
  readonly yieldBetweenBattles?: () => Promise<void>;
}

function ivsForSelection(
  profile: AnalyzedPokemonBuild,
  selection: MatchupPlanIvSelection,
): InventoryIvs {
  switch (selection.kind) {
    case "source":
      return profile.ivs;
    case "rank-one":
      return profile.ivRanking.rankOne.ivs;
    case "highest-attack":
      return profile.ivRanking.highestAttack.ivs;
    case "highest-defense":
      return profile.ivRanking.highestDefense.ivs;
    case "custom":
      return selection.ivs;
  }
}

function movesForSelection(
  profile: AnalyzedPokemonBuild,
  selection: MatchupPlanMovesSelection,
): InventoryMoveset {
  switch (selection.kind) {
    case "source":
      return {
        fastMoveId: profile.moves.enteredFastMoveId,
        chargedMoveIds: [...profile.moves.enteredChargedMoveIds],
      };
    case "recommended": {
      const fastMoveId = profile.moves.recommendedFastMoveId;
      const chargedMoveIds = [...profile.moves.recommendedChargedMoveIds.slice(0, 2)];
      if (!fastMoveId || chargedMoveIds.length === 0) {
        throw new Error(
          `${profile.speciesName} does not have a complete published recommended moveset.`,
        );
      }
      return { fastMoveId, chargedMoveIds };
    }
    case "custom":
      return selection.moveset;
  }
}

function validateMoveset(
  pokemon: PokemonCatalogEntry,
  moveset: InventoryMoveset,
): void {
  if (!pokemon.fastMoves.some((move) => move.id === moveset.fastMoveId)) {
    throw new Error(`${moveset.fastMoveId} is not a legal fast move for ${pokemon.speciesName}.`);
  }
  if (moveset.chargedMoveIds.length < 1 || moveset.chargedMoveIds.length > 2) {
    throw new Error("Choose one or two charged moves.");
  }
  if (new Set(moveset.chargedMoveIds).size !== moveset.chargedMoveIds.length) {
    throw new Error("Choose different charged moves.");
  }
  for (const moveId of moveset.chargedMoveIds) {
    if (!pokemon.chargedMoves.some((move) => move.id === moveId)) {
      throw new Error(`${moveId} is not a legal charged move for ${pokemon.speciesName}.`);
    }
  }
}

function validateIvs(ivs: InventoryIvs): void {
  for (const [name, value] of Object.entries(ivs)) {
    if (!Number.isInteger(value) || value < 0 || value > 15) {
      throw new RangeError(`${name} IV must be a whole number from 0 to 15.`);
    }
  }
}

function isSameExactBuild(left: ExactSimulationBuild, right: ExactSimulationBuild): boolean {
  return left.speciesId === right.speciesId &&
    left.speciesName === right.speciesName &&
    left.level === right.level &&
    left.cp === right.cp &&
    left.ivs.attack === right.ivs.attack &&
    left.ivs.defense === right.ivs.defense &&
    left.ivs.hp === right.ivs.hp &&
    left.fastMoveId === right.fastMoveId &&
    left.chargedMoveIds.length === right.chargedMoveIds.length &&
    left.chargedMoveIds.every((moveId, index) => moveId === right.chargedMoveIds[index]) &&
    left.isShadow === right.isShadow &&
    left.source === right.source;
}

export function createMatchupPlanBuild(input: {
  readonly id: string;
  readonly label: string;
  readonly profile: AnalyzedPokemonBuild;
  readonly pokemon: PokemonCatalogEntry;
  readonly cpCap: number;
  readonly sourceLevel: number;
  readonly ivSelection: MatchupPlanIvSelection;
  readonly movesSelection: MatchupPlanMovesSelection;
}): MatchupPlanBuild {
  const ivs = ivsForSelection(input.profile, input.ivSelection);
  validateIvs(ivs);
  const moveset = movesForSelection(input.profile, input.movesSelection);
  validateMoveset(input.pokemon, moveset);

  let level: number;
  let cp: number;
  if (input.ivSelection.kind === "source") {
    const sourceBuild = serializeAnalyzedBuildForSimulation(
      input.profile,
      input.pokemon,
      input.sourceLevel,
    );
    level = sourceBuild.level;
    cp = sourceBuild.cp;
  } else {
    const fitted = findHighestLegalLevel(
      input.pokemon,
      ivs,
      input.cpCap,
      50,
    );
    if (!fitted) {
      throw new Error(`${input.profile.speciesName} has no legal build at this IV spread.`);
    }
    level = fitted.level;
    cp = fitted.cp;
  }

  return {
    id: input.id,
    label: input.label.trim() || "Build candidate",
    build: {
      speciesId: input.pokemon.speciesId,
      speciesName: input.pokemon.speciesName,
      level,
      cp,
      ivs,
      fastMoveId: moveset.fastMoveId,
      chargedMoveIds: moveset.chargedMoveIds.length === 1
        ? [moveset.chargedMoveIds[0]!] as const
        : [moveset.chargedMoveIds[0]!, moveset.chargedMoveIds[1]!] as const,
      isShadow: input.pokemon.isShadow,
      source: "build-plan",
    },
  };
}

export function createMatchupPlanBaseline(input: {
  readonly id?: string;
  readonly label: string;
  readonly profile: AnalyzedPokemonBuild;
  readonly pokemon: PokemonCatalogEntry;
  readonly level: number;
}): MatchupPlanBuild {
  return {
    id: input.id ?? "baseline",
    label: input.label,
    build: serializeAnalyzedBuildForSimulation(
      input.profile,
      input.pokemon,
      input.level,
    ),
  };
}

export function listMatchupPlanThreats(
  catalog: PokemonCatalog,
): readonly MatchupPlanThreat[] {
  return catalog.entries
    .filter((pokemon) => pokemon.isMeta && pokemon.ranking !== undefined)
    .sort((left, right) => (left.ranking?.rank ?? Infinity) - (right.ranking?.rank ?? Infinity))
    .flatMap((pokemon) => {
      const build = createMetaDefaultBuild(pokemon);
      return build
        ? [{ speciesId: pokemon.speciesId, speciesName: pokemon.speciesName, build }]
        : [];
    });
}

function validatePlan(input: MatchupPlanSimulationInput): void {
  if (input.candidates.length < 1 || input.candidates.length > MAX_MATCHUP_PLAN_CANDIDATES) {
    throw new RangeError(`Choose between one and ${MAX_MATCHUP_PLAN_CANDIDATES} build candidates.`);
  }
  if (input.threats.length < 1 || input.threats.length > MAX_MATCHUP_PLAN_THREATS) {
    throw new RangeError(`Choose between one and ${MAX_MATCHUP_PLAN_THREATS} threats.`);
  }
  if (new Set(input.threats.map((threat) => threat.speciesId)).size !== input.threats.length) {
    throw new Error("Choose each threat only once.");
  }
  const buildIds = [input.baseline.id, ...input.candidates.map((candidate) => candidate.id)];
  if (new Set(buildIds).size !== buildIds.length) {
    throw new Error("Build candidate IDs must be unique.");
  }
  const cpCap = leagueForCatalog(input.catalog).cp;
  const catalogById = new Map(
    input.catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  for (const { build, label } of [input.baseline, ...input.candidates]) {
    const pokemon = catalogById.get(build.speciesId);
    if (!pokemon) {
      throw new Error(`${build.speciesName} is not in the active league catalog.`);
    }
    if (build.speciesName !== pokemon.speciesName) {
      throw new Error(`${build.speciesId} does not match the active catalog name.`);
    }
    validateIvs(build.ivs);
    validateMoveset(pokemon, {
      fastMoveId: build.fastMoveId,
      chargedMoveIds: [...build.chargedMoveIds],
    });
    if (build.isShadow !== pokemon.isShadow) {
      throw new Error(`${build.speciesName} Shadow state does not match the active catalog.`);
    }
    if (
      !Number.isFinite(build.level) ||
      !Number.isFinite(build.cp) ||
      calculateCombatPower(pokemon.baseStats, build.ivs, build.level) !== build.cp
    ) {
      throw new Error(`${label} does not have a consistent exact level and CP.`);
    }
    if (build.cp > cpCap) {
      throw new RangeError(`${build.speciesName} CP ${build.cp} exceeds the ${cpCap} league limit.`);
    }
  }
  for (const threat of input.threats) {
    const pokemon = catalogById.get(threat.speciesId);
    if (!pokemon || !pokemon.isMeta || !pokemon.ranking) {
      throw new Error(`${threat.speciesName} is not a ranked meta threat in the active league.`);
    }
    const defaultBuild = createMetaDefaultBuild(pokemon);
    if (!defaultBuild || !isSameExactBuild(threat.build, defaultBuild)) {
      throw new Error(`${threat.speciesName} must use its published default threat build.`);
    }
    validateIvs(threat.build.ivs);
    validateMoveset(pokemon, {
      fastMoveId: threat.build.fastMoveId,
      chargedMoveIds: [...threat.build.chargedMoveIds],
    });
    if (threat.build.isShadow !== pokemon.isShadow) {
      throw new Error(`${threat.speciesName} Shadow state does not match the active catalog.`);
    }
    if (
      calculateCombatPower(pokemon.baseStats, threat.build.ivs, threat.build.level) !==
      threat.build.cp
    ) {
      throw new Error(`${threat.speciesName} default build has an inconsistent exact level and CP.`);
    }
    if (threat.build.cp > cpCap) {
      throw new RangeError(`${threat.speciesName} exceeds the ${cpCap} league limit.`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "PvPoke could not simulate this matchup.";
}

export async function simulateMatchupBuildPlan(
  input: MatchupPlanSimulationInput,
  adapter: OneOnOneSimulationAdapter,
  options: MatchupPlanSimulationOptions = {},
): Promise<MatchupPlanSimulationReport> {
  validatePlan(input);
  const league = leagueForCatalog(input.catalog);
  const variants = [input.baseline, ...input.candidates];
  const total = variants.length * input.threats.length;
  const observations: MatchupPlanSimulationObservation[] = [];
  let cancelled = false;

  for (const variant of variants) {
    for (const threat of input.threats) {
      if (options.signal?.aborted) {
        cancelled = true;
        break;
      }

      let result: OneOnOneSimulationResult | undefined;
      let error: string | undefined;
      try {
        result = await adapter.simulate({
          format: {
            id: league.id,
            cpCap: league.cp,
            levelCap: 50,
            cup: league.cup,
          },
          combatants: [
            { build: variant.build, shields: input.scenario.playerShields },
            { build: threat.build, shields: input.scenario.threatShields },
          ],
          dataVersion: input.catalog.dataVersion,
        });
        if (result.dataVersion !== input.catalog.dataVersion) {
          throw new Error(
            `Simulation returned data version ${result.dataVersion}; expected ${input.catalog.dataVersion}.`,
          );
        }
      } catch (simulationError) {
        error = errorMessage(simulationError);
      }

      observations.push({
        buildId: variant.id,
        buildLabel: variant.label,
        threatSpeciesId: threat.speciesId,
        threatName: threat.speciesName,
        ...(result ? { result } : {}),
        ...(error ? { error } : {}),
      });
      options.onProgress?.({
        completed: observations.length,
        total,
        buildLabel: variant.label,
        threatName: threat.speciesName,
      });

      await options.yieldBetweenBattles?.();
    }
    if (cancelled) break;
  }

  return {
    dataVersion: input.catalog.dataVersion,
    scenario: input.scenario,
    observations,
    completedCount: observations.length,
    failureCount: observations.filter((observation) => observation.error !== undefined).length,
    cancelled,
  };
}
