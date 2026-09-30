import { describe, expect, it } from "vitest";

import { analyzeInventoryBuild } from "@/domain/analysis/buildAnalysis";
import {
  createMatchupPlanBaseline,
  createMatchupPlanBuild,
  listMatchupPlanThreats,
  simulateMatchupBuildPlan,
  type MatchupPlanSimulationInput,
} from "@/domain/analysis/matchupBuildPlanning";
import { createInventoryPokemon } from "@/domain/inventory/factory";
import { inventoryTestCatalog } from "@/domain/inventory/inventoryTestFixtures";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import type {
  OneOnOneSimulationAdapter,
  OneOnOneSimulationRequest,
  OneOnOneSimulationResult,
} from "@/domain/simulation/contracts";

function createAnalysis(catalog = inventoryTestCatalog) {
  const record = createInventoryPokemon(
    {
      buildStatus: "current",
      speciesId: "azumarill",
      currentBuild: {
        cp: 1499,
        ivProfile: { source: "assumed-rank-1" },
        moveset: {
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM"],
        },
      },
    },
    {
      catalog,
      createId: () => "78ce2157-a008-49a1-bbcc-563998b76800",
      now: () => new Date("2026-09-30T12:00:00.000Z"),
    },
  );

  return analyzeInventoryBuild(record, catalog);
}

function createCandidate(id = "candidate") {
  const profile = createAnalysis().current;
  const pokemon = inventoryTestCatalog.entries.find(
    (entry) => entry.speciesId === profile.speciesId,
  )!;

  return createMatchupPlanBuild({
    id,
    label: "Higher-Attack custom build",
    profile,
    pokemon,
    cpCap: 1500,
    sourceLevel: profile.levels[0]!.level,
    ivSelection: {
      kind: "custom",
      ivs: { attack: 15, defense: 0, hp: 0 },
    },
    movesSelection: {
      kind: "custom",
      moveset: {
        fastMoveId: "BUBBLE",
        chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
      },
    },
  });
}

function createBaseline() {
  const profile = createAnalysis().current;
  const pokemon = inventoryTestCatalog.entries.find(
    (entry) => entry.speciesId === profile.speciesId,
  )!;

  return createMatchupPlanBaseline({
    label: "Azumarill current build",
    profile,
    pokemon,
    level: profile.levels[0]!.level,
  });
}

function resultFor(request: OneOnOneSimulationRequest): OneOnOneSimulationResult {
  return {
    winner: 0,
    combatants: [
      {
        index: 0,
        speciesId: request.combatants[0].build.speciesId,
        battleRating: 600,
        remainingHp: 20,
        maximumHp: 100,
        remainingEnergy: 15,
        remainingShields: request.combatants[0].shields,
      },
      {
        index: 1,
        speciesId: request.combatants[1].build.speciesId,
        battleRating: 400,
        remainingHp: 0,
        maximumHp: 100,
        remainingEnergy: 30,
        remainingShields: request.combatants[1].shields,
      },
    ],
    turnsToWin: [25, 0],
    dataVersion: request.dataVersion,
    engine: "pvpoke-upstream",
    assumptions: [],
  };
}

describe("matchup-backed build planning", () => {
  it("fits alternate IVs to the league cap and validates chosen moves", () => {
    const candidate = createCandidate();

    expect(candidate.build).toMatchObject({
      ivs: { attack: 15, defense: 0, hp: 0 },
      fastMoveId: "BUBBLE",
      chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
      source: "build-plan",
    });
    expect(candidate.build.cp).toBeLessThanOrEqual(1500);

    const profile = createAnalysis().current;
    const pokemon = inventoryTestCatalog.entries.find(
      (entry) => entry.speciesId === profile.speciesId,
    )!;
    expect(() =>
      createMatchupPlanBuild({
        id: "bad-moves",
        label: "Invalid moves",
        profile,
        pokemon,
        cpCap: 1500,
        sourceLevel: profile.levels[0]!.level,
        ivSelection: { kind: "source" },
        movesSelection: {
          kind: "custom",
          moveset: { fastMoveId: "NOT_A_MOVE", chargedMoveIds: ["ICE_BEAM"] },
        },
      }),
    ).toThrow("not a legal fast move");
  });

  it("lists only simulation-ready ranked meta threats in rank order", () => {
    expect(listMatchupPlanThreats(inventoryTestCatalog).map((threat) => [
      threat.speciesId,
      threat.build.source,
    ])).toEqual([
      ["azumarill", "meta-default"],
      ["altaria", "meta-default"],
    ]);
  });

  it("keeps PvPoke's recommended charged-move order for default threat builds", () => {
    const catalogWithReorderedMoves = {
      ...inventoryTestCatalog,
      entries: inventoryTestCatalog.entries.map((entry) =>
        entry.speciesId === "azumarill"
          ? { ...entry, chargedMoves: [...entry.chargedMoves].reverse() }
          : entry,
      ),
    };
    const azumarill = listMatchupPlanThreats(catalogWithReorderedMoves)
      .find((threat) => threat.speciesId === "azumarill");

    expect(azumarill?.build.chargedMoveIds).toEqual(["ICE_BEAM", "PLAY_ROUGH"]);
  });

  it("keeps PvPoke's recommended charged-move order in build candidates", () => {
    const catalogWithReorderedMoves = {
      ...inventoryTestCatalog,
      entries: inventoryTestCatalog.entries.map((entry) =>
        entry.speciesId === "azumarill"
          ? { ...entry, chargedMoves: [...entry.chargedMoves].reverse() }
          : entry,
      ),
    };
    const profile = createAnalysis(catalogWithReorderedMoves).current;
    const pokemon = catalogWithReorderedMoves.entries.find(
      (entry) => entry.speciesId === profile.speciesId,
    )!;
    const candidate = createMatchupPlanBuild({
      id: "recommended-moves",
      label: "Recommended moves",
      profile,
      pokemon,
      cpCap: 1500,
      sourceLevel: profile.levels[0]!.level,
      ivSelection: { kind: "source" },
      movesSelection: { kind: "recommended" },
    });

    expect(candidate.build.chargedMoveIds).toEqual(["ICE_BEAM", "PLAY_ROUGH"]);
  });

  it("simulates each exact baseline and candidate against every threat with the selected shields", async () => {
    const requests: OneOnOneSimulationRequest[] = [];
    const progress: number[] = [];
    const adapter: OneOnOneSimulationAdapter = {
      simulate(request) {
        requests.push(request);
        return Promise.resolve(resultFor(request));
      },
    };
    const threats = listMatchupPlanThreats(inventoryTestCatalog);

    const report = await simulateMatchupBuildPlan(
      {
        catalog: inventoryTestCatalog,
        baseline: createBaseline(),
        candidates: [createCandidate()],
        threats,
        scenario: { playerShields: 0, threatShields: 2 },
      },
      adapter,
      { onProgress: ({ completed }) => progress.push(completed) },
    );

    expect(requests).toHaveLength(4);
    expect(requests[0]).toMatchObject({
      format: {
        id: "great-league",
        cpCap: 1500,
        levelCap: 50,
        cup: "all",
      },
      combatants: [
        { build: { source: "inventory-current" }, shields: 0 },
        { build: { source: "meta-default" }, shields: 2 },
      ],
      dataVersion: "test-data-v1",
    });
    expect(requests.at(2)?.combatants[0]?.build).toMatchObject({
      source: "build-plan",
      ivs: { attack: 15, defense: 0, hp: 0 },
    });
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(report).toMatchObject({
      dataVersion: "test-data-v1",
      completedCount: 4,
      failureCount: 0,
      cancelled: false,
      scenario: { playerShields: 0, threatShields: 2 },
    });
  });

  it("uses the active Ultra or Master league rules for candidate fitting and simulation", async () => {
    for (const format of [
      { formatId: "ultra-league" as const, cpCap: 2500 },
      { formatId: "master-league" as const, cpCap: 10000 },
    ]) {
      const catalog: PokemonCatalog = {
        ...inventoryTestCatalog,
        ...format,
        entries: inventoryTestCatalog.entries.map((entry) => ({
          ...entry,
          cpCap: format.cpCap,
        })),
      };
      const profile = createAnalysis(catalog).current;
      const pokemon = catalog.entries.find(
        (entry) => entry.speciesId === profile.speciesId,
      )!;
      const baseline = createMatchupPlanBaseline({
        label: "Active league baseline",
        profile,
        pokemon,
        level: profile.levels[0]!.level,
      });
      const candidate = createMatchupPlanBuild({
        id: format.formatId,
        label: "Alternate IV build",
        profile,
        pokemon,
        cpCap: format.cpCap,
        sourceLevel: profile.levels[0]!.level,
        ivSelection: {
          kind: "custom",
          ivs: { attack: 15, defense: 0, hp: 0 },
        },
        movesSelection: { kind: "source" },
      });
      const requests: OneOnOneSimulationRequest[] = [];
      const adapter: OneOnOneSimulationAdapter = {
        simulate(request) {
          requests.push(request);
          return Promise.resolve(resultFor(request));
        },
      };

      await simulateMatchupBuildPlan(
        {
          catalog,
          baseline,
          candidates: [candidate],
          threats: listMatchupPlanThreats(catalog).slice(0, 1),
          scenario: { playerShields: 1, threatShields: 1 },
        },
        adapter,
      );

      expect(candidate.build.level).toBe(50);
      expect(candidate.build.cp).toBeLessThanOrEqual(format.cpCap);
      expect(requests[0]?.format).toMatchObject({
        id: format.formatId,
        cpCap: format.cpCap,
        levelCap: 50,
        cup: "all",
      });
    }
  });

  it("keeps successful matchups when an individual simulation fails", async () => {
    let calls = 0;
    const adapter: OneOnOneSimulationAdapter = {
      simulate(request) {
        calls += 1;
        if (calls === 1) return Promise.resolve({ ...resultFor(request), dataVersion: "older-data" });
        if (calls === 2) return Promise.reject(new Error("engine timed out"));
        return Promise.resolve(resultFor(request));
      },
    };

    const report = await simulateMatchupBuildPlan(
      {
        catalog: inventoryTestCatalog,
        baseline: createBaseline(),
        candidates: [createCandidate()],
        threats: listMatchupPlanThreats(inventoryTestCatalog),
        scenario: { playerShields: 1, threatShields: 1 },
      },
      adapter,
    );

    expect(report.completedCount).toBe(4);
    expect(report.failureCount).toBe(2);
    expect(report.observations[0]).toMatchObject({
      error: "Simulation returned data version older-data; expected test-data-v1.",
    });
    expect(report.observations[1]).toMatchObject({
      error: "engine timed out",
      threatName: "Altaria",
    });
  });

  it("cancels between matchups and enforces the candidate bound", async () => {
    const controller = new AbortController();
    let calls = 0;
    const adapter: OneOnOneSimulationAdapter = {
      simulate(request) {
        calls += 1;
        return Promise.resolve(resultFor(request));
      },
    };
    const input: MatchupPlanSimulationInput = {
      catalog: inventoryTestCatalog,
      baseline: createBaseline(),
      candidates: [createCandidate()],
      threats: listMatchupPlanThreats(inventoryTestCatalog),
      scenario: { playerShields: 1, threatShields: 1 },
    };
    const report = await simulateMatchupBuildPlan(input, adapter, {
      signal: controller.signal,
      yieldBetweenBattles: () => {
        controller.abort();
        return Promise.resolve();
      },
    });

    expect(report).toMatchObject({ completedCount: 1, cancelled: true });
    expect(calls).toBe(1);
    await expect(
      simulateMatchupBuildPlan(
        {
          ...input,
          candidates: [
            createCandidate("candidate-1"),
            createCandidate("candidate-2"),
            createCandidate("candidate-3"),
            createCandidate("candidate-4"),
          ],
        },
        adapter,
      ),
    ).rejects.toThrow("Choose between one and 3 build candidates");
  });
});
