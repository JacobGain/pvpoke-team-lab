import { describe, expect, it } from "vitest";

import {
  formatIdentifier,
  formatMoveList,
  formatMoveName,
  formatTeamPosition,
} from "@/utils/formatters";

describe("user-facing formatters", () => {
  it("converts internal move IDs to readable sentence case", () => {
    expect(formatMoveName("ICE_BEAM")).toBe("Ice beam");
    expect(formatMoveList(["ICE_BEAM", "PLAY_ROUGH"])).toBe(
      "Ice beam / Play rough",
    );
  });

  it("humanizes internal evidence and position labels", () => {
    expect(formatIdentifier("pvpoke-static-role-scores")).toBe(
      "PvPoke static role scores",
    );
    expect(formatTeamPosition("switch")).toBe("Safe switch");
  });
});
