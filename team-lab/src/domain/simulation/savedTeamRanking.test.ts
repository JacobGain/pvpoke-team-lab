import { describe, expect, it } from "vitest";

import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  prepareSavedTeamRankerRequest,
  SavedTeamRankingService,
} from "@/domain/simulation/savedTeamRanking";
import type {
  TeamRankerAdapter,
  TeamRankerRequest,
  TeamRankerResult,
} from "@/domain/simulation/contracts";
import { createSavedTeam } from "@/domain/teams/factory";

const inventoryIds = {
  azumarill: "78ce2157-a008-49a1-bbcc-563998b76800",
  altaria: "fd17fe2f-1d87-4879-8850-d95476cd9070",
  whiscash: "34d7265f-a0ba-4ee6-b94a-bf83390e1217",
};

function inventoryRecord(
  speciesId: "azumarill" | "altaria" | "whiscash",
): InventoryPokemon {
  const settings = {
    azumarill: {
      cp: 1499,
      fastMoveId: "BUBBLE",
      chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
    },
    altaria: {
      cp: 1497,
      fastMoveId: "DRAGON_BREATH",
      chargedMoveIds: ["SKY_ATTACK", "MOONBLAST"],
    },
    whiscash: {
      cp: 1495,
      fastMoveId: "MUD_SHOT",
      chargedMoveIds: ["SCALD", "BLIZZARD"],
    },
  }[speciesId];

  return createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId,
      currentBuild: {
        cp: settings.cp,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: settings.fastMoveId,
          chargedMoveIds: settings.chargedMoveIds,
        },
      },
    },
    {
      catalog: inventoryTestCatalog,
      createId: () => inventoryIds[speciesId],
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    },
  );
}

function setup() {
  const inventory = [
    inventoryRecord("azumarill"),
    inventoryRecord("altaria"),
    inventoryRecord("whiscash"),
  ];
  const team = createSavedTeam(
    {
      name: "Exact trio",
      members: {
        leadInventoryId: inventoryIds.whiscash,
        switchInventoryId: inventoryIds.azumarill,
        closerInventoryId: inventoryIds.altaria,
      },
    },
    {
      inventory,
      catalog: inventoryTestCatalog,
      createId: () => "75a53aca-f3d7-476b-a14e-5559c8a7c4bb",
    },
  );

  return { inventory, team };
}

class MeasuredAdapter implements TeamRankerAdapter {
  request?: TeamRankerRequest;

  rank(request: TeamRankerRequest): Promise<TeamRankerResult> {
    this.request = request;
    return Promise.resolve({
      rankings: [],
      teamRatings: [[], [], []],
      battleCount: request.team.length * request.targets.length,
      dataVersion: request.dataVersion,
      engine: "pvpoke-team-ranker",
      assumptions: [],
    });
  }
}

describe("saved-team ranking preparation", () => {
  it("preserves saved order and derives explicit ranked meta targets", () => {
    const { inventory, team } = setup();
    const prepared = prepareSavedTeamRankerRequest(
      team,
      inventory,
      inventoryTestCatalog,
      { targetLimit: 5, teamShields: 1, targetShields: 0 },
    );

    expect(prepared.request.team.map((build) => build.speciesId)).toEqual([
      "whiscash",
      "azumarill",
      "altaria",
    ]);
    expect(prepared.request.team.map((build) => build.source)).toEqual([
      "inventory-current",
      "inventory-current",
      "inventory-current",
    ]);
    expect(prepared.request.targets.map((build) => build.speciesId)).toEqual([
      "azumarill",
      "altaria",
    ]);
    expect(prepared.request.targets[0]).toMatchObject({
      level: 45.5,
      cp: 1499,
      source: "meta-default",
      fastMoveId: "BUBBLE",
    });
    expect(prepared.scope).toMatchObject({
      selectedTargetCount: 2,
      availableTargetCount: 2,
      teamShields: 1,
      targetShields: 0,
    });
  });

  it("measures execution and labels a slow synchronous run", async () => {
    const { inventory, team } = setup();
    const prepared = prepareSavedTeamRankerRequest(
      team,
      inventory,
      inventoryTestCatalog,
      { targetLimit: 5, teamShields: 1, targetShields: 1 },
    );
    const adapter = new MeasuredAdapter();
    const times = [100, 6_100];
    const service = new SavedTeamRankingService(adapter, () => times.shift()!);
    const run = await service.rank(prepared);

    expect(adapter.request).toBe(prepared.request);
    expect(run.durationMs).toBe(6_000);
    expect(run.performance).toBe("slow");
    expect(run.result.battleCount).toBe(6);
  });
});
