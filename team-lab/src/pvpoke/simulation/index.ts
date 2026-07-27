import { PvpokeOneOnOneAdapter } from "@/pvpoke/simulation/PvpokeOneOnOneAdapter";
import { BrowserPvpokeRuntime } from "@/pvpoke/simulation/BrowserPvpokeRuntime";
import { PvpokeTeamRankerAdapter } from "@/pvpoke/simulation/PvpokeTeamRankerAdapter";

const pvpokeBaseUrl =
  import.meta.env.VITE_PVPOKE_BASE_URL?.trim() || "/pvpoke/src";

export function createPvpokeOneOnOneAdapter(dataVersion: string) {
  return new PvpokeOneOnOneAdapter(
    new BrowserPvpokeRuntime({
      baseUrl: pvpokeBaseUrl,
      dataVersion,
    }),
  );
}

export function createPvpokeTeamRankerAdapter(dataVersion: string) {
  return new PvpokeTeamRankerAdapter(
    new BrowserPvpokeRuntime({
      baseUrl: pvpokeBaseUrl,
      dataVersion,
    }),
  );
}

export {
  BrowserPvpokeRuntime,
  PvpokeOneOnOneAdapter,
  PvpokeTeamRankerAdapter,
};
