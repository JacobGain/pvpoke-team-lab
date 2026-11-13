import {
  baseLeagueId,
  leagueForCatalog,
  type BaseLeagueId,
} from "@/domain/leagues";
import { defaultMegaLevel } from "@/domain/pokemon/mega";
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
  const selectedSpecies = record.buildStatus === "planned" ? record.plannedBuild.targetSpeciesId : record.speciesId;
  if (league.cup !== "mega" && catalog.entries.find(entry => entry.speciesId === selectedSpecies)?.tags.includes("mega")) return undefined;
  let projected = record;
  // The stored extra attack belongs to the selected Mega form, not its base.
  // Project a normal-league build without changing the owned record.
  if (league.cup !== "mega" && record.megaSpeciesId && !base.tags.includes("mega")) {
    projected = { ...record, currentBuild: { ...record.currentBuild, moveset: { ...record.currentBuild.moveset } } };
    delete projected.currentBuild.megaLevel;
    delete projected.currentBuild.moveset.extraChargedMoveId;
  }
  if (
    league.cup === "mega" &&
    record.megaSpeciesId &&
    !base.tags.includes("mega") &&
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
    const megaLevel = record.currentBuild.megaLevel ?? defaultMegaLevel(mega);
    const bonusLevels = megaLevel === 4 ? 2 : 0;
    const maximumBattleLevel = megaLevel === 4 ? 52 : Math.min(mega.levelCap + 1, 51);
    const megaCpOptions = [
      ...new Set(
        levels.map((match) =>
          calculateCombatPower(
            mega.baseStats,
            record.currentBuild.ivProfile.ivs,
            Math.min(match.level + bonusLevels, maximumBattleLevel),
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
        currentBuild: { ...record.currentBuild, cp: megaCp, megaLevel },
      };
    } else return undefined;
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
