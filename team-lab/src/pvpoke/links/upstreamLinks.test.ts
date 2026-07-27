import { describe, expect, it } from "vitest";

import type { ExactSimulationBuild } from "@/domain/simulation/contracts";
import {
  createPvpokeBattleLink,
  createPvpokeTeamBuilderLink,
} from "@/pvpoke/links/upstreamLinks";

const azumarill: ExactSimulationBuild = {
  speciesId: "azumarill",
  speciesName: "Azumarill",
  level: 45.5,
  cp: 1499,
  ivs: { attack: 0, defense: 15, hp: 15 },
  fastMoveId: "BUBBLE",
  chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
  isShadow: false,
  source: "inventory-current",
};

const shadowWhiscash: ExactSimulationBuild = {
  speciesId: "whiscash_shadow",
  speciesName: "Whiscash (Shadow)",
  level: 27,
  cp: 1498,
  ivs: { attack: 4, defense: 15, hp: 15 },
  fastMoveId: "MUD_SHOT",
  chargedMoveIds: ["SCALD"],
  isShadow: true,
  source: "meta-default",
};

describe("PvPoke upstream links", () => {
  it("serializes exact custom builds into the current Team Builder format", () => {
    expect(
      createPvpokeTeamBuilderLink([azumarill, shadowWhiscash], {
        baseUrl: "/pvpoke/src/",
      }),
    ).toBe(
      "/pvpoke/src/team-builder/all/1500/azumarill-45.5-0-15-15-4-4-1-1-m-BUBBLE-ICE_BEAM-PLAY_ROUGH%2Cwhiscash_shadow-27-4-15-15-4-4-1-1-m-MUD_SHOT-SCALD-0",
    );
  });

  it("preserves exact builds, hard move IDs, and shields in battle links", () => {
    expect(
      createPvpokeBattleLink(azumarill, shadowWhiscash, [2, 1], {
        baseUrl: "https://pvpoke.example/root/",
      }),
    ).toBe(
      "https://pvpoke.example/root/battle/1500/azumarill-45.5-0-15-15-4-4-1-1/whiscash_shadow-27-4-15-15-4-4-1-1/21/BUBBLE-ICE_BEAM-PLAY_ROUGH/MUD_SHOT-SCALD-0/",
    );
  });

  it("rejects an empty team and an empty site URL", () => {
    expect(() =>
      createPvpokeTeamBuilderLink([], { baseUrl: "/pvpoke/src" }),
    ).toThrow("at least one build");
    expect(() =>
      createPvpokeTeamBuilderLink([azumarill], { baseUrl: "  " }),
    ).toThrow("site URL");
  });
});
