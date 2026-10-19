import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";
import { useLeague } from "@/features/leagues/leagueStore";
import { baseLeagueId } from "@/domain/leagues";
import { updateReviewQueryOptions } from "./updateReviewQueries";
import { reviewReminderKey, useReviewReminderStore } from "./reviewReminderStore";
import "./roster-review.css";

export function RosterUpdateNotice() {
  const inventory = useInventoryList();
  const teams = useSavedTeamList();
  const league = useLeague();
  const comparison = useQuery({ ...updateReviewQueryOptions,
    enabled: (inventory.data?.length ?? 0) > 0 || (teams.data?.length ?? 0) > 0,
  });
  const reviewed = useReviewReminderStore(state => state.reviewed);
  const data = comparison.data;
  if (!data || inventory.isError || teams.isError) return null;
  const key = reviewReminderKey(data.fromCommit, data.toCommit ?? data.toVersion, league.id);
  const olderRecords = inventory.data?.some(record =>
    baseLeagueId(record.formatId ?? "great-league") === baseLeagueId(league.id) &&
    record.sourceDataVersion !== data.toVersion,
  );
  const olderTeams = teams.data?.some(team => team.lastAnalyzedDataVersion &&
    (team.lastAnalyzedDataVersion !== data.toVersion || team.lastAnalyzedUpstreamCommit !== data.toCommit));
  if (reviewed.includes(key) || (!olderRecords && !olderTeams)) return null;
  return (
    <aside className="roster-update-notice" aria-label="Roster data update">
      <div><strong>Battle data updated — review your roster</strong>
        <p>Check {league.shortTitle} ranking shifts, move changes, and teams that need fresh analysis.</p></div>
      <Link className="secondary-link" to="/updates">Review roster updates</Link>
    </aside>
  );
}
