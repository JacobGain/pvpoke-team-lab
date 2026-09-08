import { useNavigate } from "react-router";

import { LEAGUES, type LeagueId } from "@/domain/leagues";
import { useLeague, useLeagueStore } from "./leagueStore";

export function LeagueSelector({ onSelect }: { readonly onSelect?: () => void }) {
  const { leagueId, setLeague } = useLeagueStore();
  const navigate = useNavigate();

  return (
    <label className="league-selector">
      <span>Active league</span>
      <select
        aria-label="Active league"
        value={leagueId}
        onChange={(event) => {
          setLeague(event.target.value as LeagueId);
          onSelect?.();
          void navigate("/");
        }}
      >
        {Object.values(LEAGUES).map((league) => (
          <option key={league.id} value={league.id}>
            {league.shortTitle} · {league.cp === 10000 ? "No CP limit" : `${league.cp.toLocaleString()} CP`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LeagueName({ open = false }: { readonly open?: boolean }) {
  const league = useLeague();
  return <>{open ? league.title : league.shortTitle}</>;
}
