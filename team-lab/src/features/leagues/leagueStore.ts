import { create } from "zustand";

import { LEAGUES, type LeagueId } from "@/domain/leagues";

const storageKey = "team-lab-league";

function initialLeague(): LeagueId {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "ultra-league" || saved === "master-league"
      ? saved
      : "great-league";
  } catch {
    return "great-league";
  }
}

interface LeagueState {
  readonly leagueId: LeagueId;
  readonly setLeague: (id: LeagueId) => void;
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
}));

export function useLeague() {
  return LEAGUES[useLeagueStore((state) => state.leagueId)];
}
