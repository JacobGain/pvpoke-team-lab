import { baseLeagueId, leagueForCatalog } from "@/domain/leagues";
import { isPreferredInLeague, projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { validateInventoryPokemonAgainstCatalog } from "@/domain/inventory/validation";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { getSavedTeamInventoryIds, type SavedTeam } from "@/domain/teams/schemas";
import { validateSavedTeamLegality } from "@/domain/teams/validation";
import type { PvpokeUpdateReview } from "@/pvpoke/types/updateReview";

export function reviewRoster(
  inventory: readonly InventoryPokemon[],
  teams: readonly SavedTeam[],
  catalog: PokemonCatalog,
  comparison: PvpokeUpdateReview,
) {
  if (comparison.toVersion !== catalog.dataVersion) throw new Error("Update comparison is for a different data version. Reload to get the latest review.");
  const league = leagueForCatalog(catalog);
  const selectedTeams = teams.filter(t => t.formatId === league.id);
  const referenced = new Set(selectedTeams.flatMap(t => getSavedTeamInventoryIds(t.members)));
  const entries = new Map(catalog.entries.map(p => [p.speciesId, p]));
  const records = inventory.filter(record =>
    referenced.has(record.inventoryId) || isPreferredInLeague(record, catalog) ||
    (!entries.has(record.speciesId) && baseLeagueId(record.formatId ?? "great-league") === baseLeagueId(league.id)),
  ).map(record => {
    const projected = projectInventoryForCatalog(record, catalog) ?? record;
    // Include owned, planned, and selected Mega identities without duplicating details.
    const speciesIds = [...new Set([
      record.speciesId, projected.speciesId,
      ...(record.buildStatus === "planned" ? [record.plannedBuild.targetSpeciesId] : []),
    ])];
    const selectedId = projected.buildStatus === "planned" ? projected.plannedBuild.targetSpeciesId : projected.speciesId;
    const details = speciesIds.flatMap(id => (comparison.species[id]?.details ?? []).map(message => ({
      speciesId: id,
      name: entries.get(id)?.speciesName ?? comparison.species[id]!.name,
      message,
    })));
    const rank = comparison.species[selectedId]?.rankings[league.id];
    const recommendedChanged = !!rank && rank.before !== null && rank.after !== null &&
      JSON.stringify(rank.recommendedBefore) !== JSON.stringify(rank.recommendedAfter);
    const issues = validateInventoryPokemonAgainstCatalog(record, catalog).map(issue => issue.message);
    const majorRankChange = !!rank && (rank.before === null || rank.after === null || Math.abs(rank.before - rank.after) >= 10);
    return {
      record, speciesId: selectedId,
      ownedName: entries.get(record.speciesId)?.speciesName ?? comparison.species[record.speciesId]?.name ?? record.speciesId,
      cp: projected.buildStatus === "planned" ? projected.plannedBuild.targetCp : projected.currentBuild.cp,
      name: entries.get(selectedId)?.speciesName ?? comparison.species[selectedId]?.name ?? selectedId,
      details, rank, recommendedChanged, issues,
      significant: issues.length > 0 || details.length > 0 || majorRankChange || recommendedChanged,
      changed: issues.length > 0 || details.length > 0 || !!rank,
    };
  });
  const byId = new Map(records.map(r => [r.record.inventoryId, r]));
  const inventoryById = new Map(inventory.map(r => [r.inventoryId, r]));
  const reviewedTeams = selectedTeams.map(team => {
    const ids = getSavedTeamInventoryIds(team.members);
    const issues = [
      ...validateSavedTeamLegality(team, inventory, catalog).map(issue => issue.message),
      ...ids.flatMap(id => byId.get(id)?.issues ?? []),
    ];
    const changedMembers = ids.filter(id => byId.get(id)?.changed);
    const membersEdited = ids.some(id => (inventoryById.get(id)?.updatedAt ?? "") > team.updatedAt);
    const status = issues.length ? "repair" : !team.lastAnalyzedDataVersion ? "not-analyzed" :
      team.lastAnalyzedDataVersion !== catalog.dataVersion ||
        team.lastAnalyzedUpstreamCommit !== comparison.toCommit || membersEdited ? "outdated" : "current";
    return { team, issues: [...new Set(issues)], changedMembers, membersEdited, status };
  });
  return { records, teams: reviewedTeams };
}

export type RosterReview = ReturnType<typeof reviewRoster>;
