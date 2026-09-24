import {
  baseLeagueId,
  leagueForCatalog,
  type BaseLeagueId,
} from "@/domain/leagues";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  calculateCombatPower,
  inferCombatPowerLevel,
} from "@/domain/pokemon/combatPower";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export function megaFormsForSpecies(
  speciesId: string,
  catalog: PokemonCatalog,
): readonly PokemonCatalogEntry[] {
  const base = catalog.entries.find(
    (entry) => entry.speciesId === speciesId,
  );
  if (!base || speciesId.includes("_mega") || speciesId.endsWith("_primal")) {
    return [];
  }
  return catalog.entries.filter(
    (entry) =>
      entry.dex === base.dex &&
      (entry.speciesId.startsWith(`${speciesId}_mega`) ||
        entry.speciesId === `${speciesId}_primal`) &&
      entry.isReleased &&
      entry.fastMoves.length > 0 &&
      entry.chargedMoves.length > 0,
  );
}

export function projectInventoryForCatalog(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): InventoryPokemon | undefined {
  const league = leagueForCatalog(catalog);
  const base = catalog.entries.find(
    (entry) => entry.speciesId === record.speciesId,
  );
  if (!base) return undefined;
  let projected = record;
  if (
    league.cup === "mega" &&
    record.megaSpeciesId &&
    record.buildStatus === "current"
  ) {
    const mega = megaFormsForSpecies(record.speciesId, catalog).find(
      (entry) => entry.speciesId === record.megaSpeciesId,
    );
    if (!mega) return undefined;
    const levels = inferCombatPowerLevel(
      base,
      record.currentBuild.ivProfile.ivs,
      record.currentBuild.cp,
    ).matches;
    const megaCpOptions = [
      ...new Set(
        levels.map((match) =>
          calculateCombatPower(
            mega.baseStats,
            record.currentBuild.ivProfile.ivs,
            match.level,
          ),
        ),
      ),
    ];
    const megaCp = megaCpOptions.length === 1 ? megaCpOptions[0]! : undefined;
    const movesCompatible =
      mega.fastMoves.some(
        (move) => move.id === record.currentBuild.moveset.fastMoveId,
      ) &&
      record.currentBuild.moveset.chargedMoveIds.every((id) =>
        mega.chargedMoves.some((move) => move.id === id),
      );
    if (megaCp !== undefined && megaCp <= league.cp && movesCompatible) {
      projected = {
        ...record,
        speciesId: mega.speciesId,
        currentBuild: { ...record.currentBuild, cp: megaCp },
      };
    }
  }
  const selectedCp =
    projected.buildStatus === "planned"
      ? (projected.plannedBuild.targetCp ?? projected.currentBuild.cp)
      : projected.currentBuild.cp;
  if (selectedCp > league.cp) return undefined;
  return projected;
}

function homeLeagueForCp(cp: number): BaseLeagueId {
  return cp <= 1500
    ? "great-league"
    : cp <= 2500
      ? "ultra-league"
      : "master-league";
}

export function isPreferredInLeague(
  record: InventoryPokemon,
  catalog: PokemonCatalog,
): boolean {
  const league = leagueForCatalog(catalog);
  const projected = projectInventoryForCatalog(record, catalog);
  if (!projected) return false;
  if (
    league.cup === "mega" &&
    projected.speciesId !== record.speciesId &&
    record.buildStatus === "current"
  ) {
    const megaHome = homeLeagueForCp(projected.currentBuild.cp);
    const normalHome = homeLeagueForCp(record.currentBuild.cp);
    const order: readonly BaseLeagueId[] = [
      "great-league",
      "ultra-league",
      "master-league",
    ];
    const preferred = order[
      Math.max(
        order.indexOf(megaHome),
        Math.min(order.indexOf(normalHome) + 1, 2),
      )
    ]!;
    return league.id === `mega-${preferred}`;
  }
  const cp =
    projected.buildStatus === "planned"
      ? (projected.plannedBuild.targetCp ?? projected.currentBuild.cp)
      : projected.currentBuild.cp;
  return baseLeagueId(league.id) === homeLeagueForCp(cp);
}
