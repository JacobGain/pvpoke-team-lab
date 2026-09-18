import { ChevronDown } from "lucide-react";

import { LEAGUES, type LeagueId } from "@/domain/leagues";
import { useLeague, useLeagueStore } from "./leagueStore";

export function LeagueSelector({ onSelect }: { readonly onSelect?: () => void }) {
  const { leagueId, setLeague } = useLeagueStore();

  return (
    <label className="league-selector">
      <span className="league-selector__label">Battle league</span>
      <span className="league-selector__control">
        <select
          aria-label="Active league"
          value={leagueId}
          onChange={(event) => {
            setLeague(event.target.value as LeagueId);
            onSelect?.();
          }}
        >
          {Object.values(LEAGUES).map((league) => (
            <option key={league.id} value={league.id}>
              {league.shortTitle.replace(" League", "")} · {league.cp === 10000 ? "No CP limit" : `${league.cp.toLocaleString()} CP`}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" size={17} strokeWidth={2.2} />
      </span>
    </label>
  );
}

export function LeagueName({ open = false }: { readonly open?: boolean }) {
  const league = useLeague();
  return <>{open ? league.title : league.shortTitle}</>;
}
