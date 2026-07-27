import {
  OPEN_GREAT_LEAGUE_SIMULATION_FORMAT,
  type ExactSimulationBuild,
  type ShieldCount,
} from "@/domain/simulation/contracts";

export interface PvpokeLinkOptions {
  readonly baseUrl: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("A PvPoke site URL is required.");
  }

  return normalized;
}

function moveString(build: ExactSimulationBuild): string {
  return [
    build.fastMoveId,
    build.chargedMoveIds[0],
    build.chargedMoveIds[1] ?? "0",
  ].join("-");
}

function pokemonString(build: ExactSimulationBuild): string {
  const shadowSuffix =
    build.isShadow && !build.speciesId.endsWith("_shadow") ? "-shadow" : "";

  return [
    build.speciesId,
    build.level,
    build.ivs.attack,
    build.ivs.defense,
    build.ivs.hp,
    4,
    4,
    1,
    1,
  ].join("-") + shadowSuffix;
}

function teamBuilderPokemonString(build: ExactSimulationBuild): string {
  return `${pokemonString(build)}-m-${moveString(build)}`;
}

export function createPvpokeTeamBuilderLink(
  builds: readonly ExactSimulationBuild[],
  options: PvpokeLinkOptions,
): string {
  if (builds.length === 0) {
    throw new Error("A PvPoke Team Builder link requires at least one build.");
  }

  const team = builds.map(teamBuilderPokemonString).join(",");

  return `${normalizeBaseUrl(options.baseUrl)}/team-builder/${OPEN_GREAT_LEAGUE_SIMULATION_FORMAT.cup}/${OPEN_GREAT_LEAGUE_SIMULATION_FORMAT.cpCap}/${encodeURIComponent(team)}`;
}

export function createPvpokeBattleLink(
  first: ExactSimulationBuild,
  second: ExactSimulationBuild,
  shields: readonly [ShieldCount, ShieldCount],
  options: PvpokeLinkOptions,
): string {
  return [
    normalizeBaseUrl(options.baseUrl),
    "battle",
    OPEN_GREAT_LEAGUE_SIMULATION_FORMAT.cpCap,
    pokemonString(first),
    pokemonString(second),
    `${shields[0]}${shields[1]}`,
    moveString(first),
    moveString(second),
    "",
  ].join("/");
}
