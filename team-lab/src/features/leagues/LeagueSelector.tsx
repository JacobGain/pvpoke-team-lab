import { ChevronDown } from "lucide-react";

import {
  BASE_LEAGUE_IDS,
  LEAGUES,
  baseLeagueId,
  leagueIdFor,
} from "@/domain/leagues";
import { useLeague, useLeagueStore } from "./leagueStore";

export function LeagueSelector({ onSelect }: { readonly onSelect?: () => void }) {
  const { leagueId, setLeague, setMega } = useLeagueStore();
  const mega = leagueId.startsWith("mega-");

  return (
    <div className="league-selector">
      <label className="league-selector__primary">
        <span className="league-selector__label">Battle league</span>
        <span className="league-selector__control">
          <select
            aria-label="Active league"
            value={baseLeagueId(leagueId)}
            onChange={(event) => {
              setLeague(
                leagueIdFor(
                  event.target.value as (typeof BASE_LEAGUE_IDS)[number],
                  mega,
                ),
              );
              onSelect?.();
            }}
          >
            {BASE_LEAGUE_IDS.map((id) => LEAGUES[id]).map((option) => (
              <option key={option.id} value={option.id}>
                {option.shortTitle.replace(" League", "")} ·{" "}
                {option.cp === 10000
                  ? "No CP limit"
                  : `${option.cp.toLocaleString()} CP`}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={17} strokeWidth={2.2} />
        </span>
      </label>
      <label className="league-selector__mega">
        <input
          type="checkbox"
          checked={mega}
          onChange={(event) => {
            setMega(event.target.checked);
            onSelect?.();
          }}
        />
        <span>Mega League</span>
      </label>
    </div>
  );
}

export function LeagueName({ open = false }: { readonly open?: boolean }) {
  const league = useLeague();
  return <>{open ? league.title : league.shortTitle}</>;
}
