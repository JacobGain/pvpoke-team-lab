import { create } from "zustand";

const storageKey = "team-lab-reviewed-updates";
function readReviewed(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === "string").slice(-24) : [];
  } catch { return []; }
}

export const useReviewReminderStore = create<{
  reviewed: string[];
  markReviewed: (key: string) => void;
}>((set) => ({
  reviewed: readReviewed(),
  markReviewed: key => set(state => {
    const reviewed = [...new Set([...state.reviewed, key])].slice(-24);
    try { localStorage.setItem(storageKey, JSON.stringify(reviewed)); } catch { /* Works for this session without storage. */ }
    return { reviewed };
  }),
}));

export function reviewReminderKey(from: string, to: string, league: string) {
  return `${from}/${to}/${league}`;
}
