import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
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

  it("formats timestamps as calendar dates without exposing a time", () => {
    expect(formatCalendarDate("2026-09-07 22:36:29")).toBe("Sep 7, 2026");
    expect(formatCalendarDate("2026-07-25T23:30:00.000Z")).toBe(
      "Jul 25, 2026",
    );
  });
});
