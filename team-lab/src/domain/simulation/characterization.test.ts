import { describe, expect, it } from "vitest";

import {
  createOpenGreatLeagueCharacterizationCases,
  runSimulationCharacterizationSuite,
} from "@/domain/simulation/characterization";
import type {
  OneOnOneSimulationAdapter,
  OneOnOneSimulationRequest,
  OneOnOneSimulationResult,
} from "@/domain/simulation/contracts";

class DeterministicAdapter implements OneOnOneSimulationAdapter {
  calls = 0;

  simulate(
    request: OneOnOneSimulationRequest,
  ): Promise<OneOnOneSimulationResult> {
    this.calls += 1;
    return Promise.resolve({
      winner: 0,
      combatants: [
        {
          index: 0,
          speciesId: request.combatants[0].build.speciesId,
          battleRating: 600,
          remainingHp: 20,
          maximumHp: 100,
          remainingEnergy: 15,
          remainingShields: 0,
        },
        {
          index: 1,
          speciesId: request.combatants[1].build.speciesId,
          battleRating: 400,
          remainingHp: 0,
          maximumHp: 100,
          remainingEnergy: 30,
          remainingShields: 0,
        },
      ],
      turnsToWin: [25, 0],
      dataVersion: request.dataVersion,
      engine: "pvpoke-upstream",
      assumptions: [],
    });
  }
}

describe("real-engine characterization contracts", () => {
  it("defines reproducible exact Open Great League cases", () => {
    expect(createOpenGreatLeagueCharacterizationCases()).toMatchObject([
      {
        id: "azumarill-vs-altaria-1s",
        shields: [1, 1],
        builds: [
          {
            speciesId: "azumarill",
            level: 45.5,
            cp: 1499,
            ivs: { attack: 0, defense: 15, hp: 15 },
          },
          {
            speciesId: "altaria",
            level: 29,
            cp: 1497,
            ivs: { attack: 0, defense: 14, hp: 15 },
          },
        ],
      },
      {
        id: "whiscash-vs-altaria-0s",
        shields: [0, 0],
      },
    ]);
  });

  it("runs every case twice and produces an exportable passing report", async () => {
    const adapter = new DeterministicAdapter();
    const cases = createOpenGreatLeagueCharacterizationCases();
    const report = await runSimulationCharacterizationSuite(
      adapter,
      "test-data-v1",
      cases,
      () => new Date("2026-07-25T18:00:00.000Z"),
    );

    expect(adapter.calls).toBe(cases.length * 2);
    expect(report).toMatchObject({
      reportVersion: 1,
      generatedAt: "2026-07-25T18:00:00.000Z",
      dataVersion: "test-data-v1",
      passed: true,
      observations: [
        {
          caseId: "azumarill-vs-altaria-1s",
          deterministic: true,
          invariantFailures: [],
        },
        {
          caseId: "whiscash-vs-altaria-0s",
          deterministic: true,
          invariantFailures: [],
        },
      ],
    });
  });
});
