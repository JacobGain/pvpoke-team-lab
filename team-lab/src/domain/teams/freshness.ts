import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { getSavedTeamInventoryIds, type SavedTeam } from "./schemas";

/** Canonical battle inputs, excluding notes/favorites and object key order.
 * Preserved timestamps on imported builds cannot conceal changed Mega settings. */
export function savedTeamBuildFingerprint(team: SavedTeam, inventory: readonly InventoryPokemon[]): string {
  const byId = new Map(inventory.map(record => [record.inventoryId, record]));
  const moves = (value: InventoryPokemon["currentBuild"]["moveset"]) => [value.fastMoveId, value.chargedMoveIds, value.extraChargedMoveId ?? null];
  return JSON.stringify([team.formatId, getSavedTeamInventoryIds(team.members).map(id => {
    const record = byId.get(id);
    if (!record) return [id, "missing"];
    const current = record.currentBuild;
    const ivs = current.ivProfile.ivs;
    const planned = record.buildStatus === "planned" ? record.plannedBuild : undefined;
    return [id, record.speciesId, record.megaSpeciesId ?? null, record.buildStatus,
      current.cp, [ivs.attack, ivs.defense, ivs.hp], current.megaLevel ?? null, moves(current.moveset),
      planned ? [planned.targetSpeciesId, planned.targetCp ?? null, planned.megaLevel ?? null, moves(planned.desiredMoveset)] : null];
  })]);
}

export function isSavedTeamAnalysisCurrent(team: SavedTeam, inventory: readonly InventoryPokemon[], dataVersion: string, upstreamCommit: string | null): boolean {
  return team.lastAnalyzedDataVersion === dataVersion && team.lastAnalyzedUpstreamCommit === upstreamCommit &&
    team.lastAnalyzedBuildFingerprint === savedTeamBuildFingerprint(team, inventory);
}
