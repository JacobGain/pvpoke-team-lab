import { create } from "zustand";

import { LEAGUES, LEAGUE_IDS, baseLeagueId, leagueIdFor, type LeagueId } from "@/domain/leagues";

const storageKey = "team-lab-league";

function initialLeague(): LeagueId {
  try {
    const saved = localStorage.getItem(storageKey);
    return LEAGUE_IDS.find((id) => id === saved) ?? "great-league";
  } catch {
    return "great-league";
  }
}

interface LeagueState {
  readonly leagueId: LeagueId;
  readonly setLeague: (id: LeagueId) => void;
  readonly setMega: (enabled: boolean) => void;
}

export const useLeagueStore = create<LeagueState>((set) => ({
  leagueId: initialLeague(),
  setLeague: (leagueId) => {
    try {
      localStorage.setItem(storageKey, leagueId);
    } catch {
      // Selection still works when browser storage is unavailable.
    }
    set({ leagueId });
  },
  setMega: (enabled) => {
    set((state) => {
      const leagueId = leagueIdFor(baseLeagueId(state.leagueId), enabled);
      try {
        localStorage.setItem(storageKey, leagueId);
      } catch {
        // Selection still works when browser storage is unavailable.
      }
      return { leagueId };
    });
  },
}));

export function useLeague() {
  return LEAGUES[useLeagueStore((state) => state.leagueId)];
}
