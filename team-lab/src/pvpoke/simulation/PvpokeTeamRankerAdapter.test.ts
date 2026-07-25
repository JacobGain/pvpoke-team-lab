import { describe, expect, it } from "vitest";

import type {
  ExactSimulationBuild,
  TeamRankerRequest,
} from "@/domain/simulation/contracts";
import { PvpokeTeamRankerAdapter } from "@/pvpoke/simulation/PvpokeTeamRankerAdapter";
import type {
  PvpokeBattle,
  PvpokeBattleRuntime,
  PvpokePokemon,
  PvpokeTeamRanker,
  PvpokeTeamRankerSettings,
  RawPvpokeTeamRankerResult,
} from "@/pvpoke/simulation/runtime";

class RankerPokemon implements PvpokePokemon {
  readonly stats = { hp: 100 };
  hp = 100;
  energy = 0;
  shields = 0;

  constructor(readonly speciesId: string) {}

  setIV(): void {}
  setLevel(): void {}
  setShadowType(): void {}
  selectMove(): void {}
  setShields(amount: number): void {
    this.shields = amount;
  }
}

class StagingBattle implements PvpokeBattle {
  setCP(): void {}
  setLevelCap(): void {}
  setCup(): void {}
  setNewPokemon(): void {}
  simulate(): readonly unknown[] {
    return [];
  }
  getPokemon(): readonly [PvpokePokemon, PvpokePokemon] {
    throw new Error("Not used.");
  }
  getWinner() {
    return { pokemon: false as const };
  }
  getBattleRatings(): readonly [number, number] {
    return [0, 0];
  }
  getTurnsToWin(): readonly [number, number] {
    return [0, 0];
  }
}

class CharacterizationRanker implements PvpokeTeamRanker {
  targets: readonly PvpokePokemon[] = [];
  targetHistory: number[] = [];
  settings: { index: 0 | 1; value: PvpokeTeamRankerSettings }[] = [];
  calls: string[] = [];

  setTargets(targets: readonly PvpokePokemon[]): void {
    this.targets = targets;
    this.targetHistory.push(targets.length);
  }

  setShieldMode(mode: "single"): void {
    this.calls.push(`shield-mode:${mode}`);
  }

  applySettings(value: PvpokeTeamRankerSettings, index: 0 | 1): void {
    this.settings.push({ index, value });
  }

  setRecommendMoveUsage(value: boolean): void {
    this.calls.push(`recommended:${value}`);
  }

  setPrioritizeMeta(value: boolean): void {
    this.calls.push(`prioritize-meta:${value}`);
  }

  rank(team: readonly PvpokePokemon[]): RawPvpokeTeamRankerResult {
    this.calls.push(`rank:${team.length}:${this.targets.length}`);
    const opponent = team[0]!;

    return {
      rankings: this.targets.map((target, index) => ({
        speciesId: target.speciesId,
        speciesName: target.speciesId,
        rating: 600 - index * 50,
        score: 700 - index * 25,
        matchups: [
          {
            opponent,
            rating: 610,
            score: 710,
            time: 42_000,
            breakpoint: 5,
            bulkpoint: 3,
            atkDifferential: 2.5,
          },
        ],
      })),
      teamRatings: team.map(() => this.targets.map(() => 390)),
    };
  }
}

class RankerRuntime implements PvpokeBattleRuntime {
  readonly ranker = new CharacterizationRanker();

  ready(): Promise<void> {
    return Promise.resolve();
  }

  createBattle(): PvpokeBattle {
    return new StagingBattle();
  }

  createPokemon(
    speciesId: string,
    index: 0 | 1,
    battle: PvpokeBattle,
  ): PvpokePokemon {
    void index;
    void battle;
    return new RankerPokemon(speciesId);
  }

  getTeamRanker(): PvpokeTeamRanker {
    return this.ranker;
  }
}

function build(speciesId: string): ExactSimulationBuild {
  return {
    speciesId,
    speciesName: speciesId,
    level: 30,
    cp: 1500,
    ivs: { attack: 0, defense: 15, hp: 15 },
    fastMoveId: "FAST",
    chargedMoveIds: ["CHARGED"],
    isShadow: false,
    source: "inventory-current",
  };
}

describe("PvPoke TeamRanker adapter", () => {
  it("ranks explicit targets against exact team builds and strips globals", async () => {
    const runtime = new RankerRuntime();
    const adapter = new PvpokeTeamRankerAdapter(runtime);
    const request: TeamRankerRequest = {
      team: [build("azumarill"), build("altaria")],
      targets: [build("whiscash"), build("registeel")],
      teamShields: 1,
      targetShields: 0,
      dataVersion: "test-data-v1",
    };

    const result = await adapter.rank(request);

    expect(runtime.ranker.calls).toEqual([
      "shield-mode:single",
      "recommended:false",
      "prioritize-meta:false",
      "rank:2:2",
    ]);
    expect(runtime.ranker.settings).toMatchObject([
      { index: 0, value: { shields: 1, ivs: "original" } },
      { index: 1, value: { shields: 0, ivs: "original" } },
    ]);
    expect(runtime.ranker.targetHistory).toEqual([2, 0]);
    expect(result).toMatchObject({
      engine: "pvpoke-team-ranker",
      dataVersion: "test-data-v1",
      battleCount: 4,
      teamRatings: [
        [390, 390],
        [390, 390],
      ],
      rankings: [
        {
          speciesId: "whiscash",
          averageRating: 600,
          score: 700,
          matchups: [
            {
              opponentSpeciesId: "azumarill",
              rating: 610,
              durationMs: 42000,
              fastMoveDamage: 5,
              incomingFastMoveDamage: 3,
              attackDifferential: 2.5,
            },
          ],
        },
        {
          speciesId: "registeel",
          averageRating: 550,
        },
      ],
    });
  });

  it("rejects an empty team before bootstrapping the runtime", async () => {
    const adapter = new PvpokeTeamRankerAdapter(new RankerRuntime());

    await expect(
      adapter.rank({
        team: [],
        targets: [build("altaria")],
        teamShields: 1,
        targetShields: 1,
        dataVersion: "test",
      }),
    ).rejects.toThrow("one to three");
  });
});
