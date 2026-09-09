import { queryOptions } from "@tanstack/react-query";

import { bundledPvpokeBaseUrl } from "../../pvpoke/config";
import { PvpokeDataError } from "../../pvpoke/repositories/http";
import { ACTIVE_SEASON } from "../../pvpoke/season";
import type { DashboardData } from "../../pvpoke/types/dashboard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!isRecord(value) || value.formatVersion !== 1) return false;
  if (typeof value.dataVersion !== "string" || !isRecord(value.speciesNames)) {
    return false;
  }
  if (!Object.values(value.speciesNames).every((name) => typeof name === "string")) {
    return false;
  }
  const leadersByLeague = value.leaders;
  if (!isRecord(leadersByLeague)) return false;

  return ["great-league", "ultra-league", "master-league"].every((leagueId) => {
    const leaders = leadersByLeague[leagueId];
    return Array.isArray(leaders) && leaders.length === 3 && leaders.every(
      (leader) =>
        isRecord(leader) &&
        typeof leader.rank === "number" &&
        typeof leader.speciesId === "string" &&
        typeof leader.speciesName === "string" &&
        Array.isArray(leader.types) &&
        leader.types.every((type) => typeof type === "string") &&
        Array.isArray(leader.recommendedMoveIds) &&
        leader.recommendedMoveIds.every((moveId) => typeof moveId === "string"),
    );
  });
}

async function loadDashboardData(): Promise<DashboardData> {
  const resource = `${bundledPvpokeBaseUrl}/data/dashboard.json?v=${ACTIVE_SEASON.upstreamCommit}`;
  let response: Response;
  try {
    response = await fetch(resource);
  } catch (cause) {
    throw new PvpokeDataError(
      "Could not load TeamLab's bundled dashboard data.",
      resource,
      { cause },
    );
  }
  if (!response.ok) {
    throw new PvpokeDataError(
      `TeamLab's bundled dashboard data returned ${String(response.status)}.`,
      resource,
    );
  }

  const data: unknown = await response.json();
  if (!isDashboardData(data)) {
    throw new PvpokeDataError(
      "Bundled dashboard data does not match TeamLab's expected format.",
      resource,
    );
  }
  return data;
}

export const dashboardDataQueryOptions = queryOptions({
  queryKey: ["pvpoke-data", "dashboard", ACTIVE_SEASON.upstreamCommit],
  queryFn: loadDashboardData,
  staleTime: Number.POSITIVE_INFINITY,
});
