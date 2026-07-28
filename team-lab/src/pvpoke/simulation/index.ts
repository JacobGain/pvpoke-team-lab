import { bundledPvpokeBaseUrl } from "@/pvpoke/config";
import { PvpokeOneOnOneAdapter } from "@/pvpoke/simulation/PvpokeOneOnOneAdapter";
import { BrowserPvpokeRuntime } from "@/pvpoke/simulation/BrowserPvpokeRuntime";
import { PvpokeTeamRankerAdapter } from "@/pvpoke/simulation/PvpokeTeamRankerAdapter";

export function createPvpokeOneOnOneAdapter(dataVersion: string) {
  return new PvpokeOneOnOneAdapter(
    new BrowserPvpokeRuntime({
      baseUrl: bundledPvpokeBaseUrl,
      dataVersion,
    }),
  );
}

export function createPvpokeTeamRankerAdapter(dataVersion: string) {
  return new PvpokeTeamRankerAdapter(
    new BrowserPvpokeRuntime({
      baseUrl: bundledPvpokeBaseUrl,
      dataVersion,
    }),
  );
}

export {
  BrowserPvpokeRuntime,
  PvpokeOneOnOneAdapter,
  PvpokeTeamRankerAdapter,
};
