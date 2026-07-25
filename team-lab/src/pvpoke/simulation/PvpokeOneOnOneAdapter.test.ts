import { describe, expect, it } from "vitest";

import {
  OPEN_GREAT_LEAGUE_SIMULATION_FORMAT,
  type ExactSimulationBuild,
  type OneOnOneSimulationRequest,
} from "@/domain/simulation/contracts";
import { PvpokeOneOnOneAdapter } from "@/pvpoke/simulation/PvpokeOneOnOneAdapter";
import type {
  PvpokeBattle,
  PvpokeBattleRuntime,
  PvpokePokemon,
  PvpokeTeamRanker,
  PvpokeWinner,
} from "@/pvpoke/simulation/runtime";

class CharacterizationPokemon implements PvpokePokemon {
  readonly stats = { hp: 100 };
  hp = 100;
  energy = 0;
  shields = 0;
  readonly calls: string[] = [];

  constructor(readonly speciesId: string) {}

  setIV(stat: "atk" | "def" | "hp", value: number): void {
    this.calls.push(`iv:${stat}:${value}`);
  }

  setLevel(level: number, initialize = true): void {
    this.calls.push(`level:${level}:${initialize}`);
  }

  setShadowType(value: "normal" | "shadow"): void {
    this.calls.push(`shadow:${value}`);
  }

  selectMove(
    type: "fast" | "charged",
    moveId: string,
    index?: number,
  ): boolean {
    this.calls.push(`move:${type}:${moveId}:${String(index)}`);
    return true;
  }

  setShields(amount: number): void {
    this.shields = amount;
    this.calls.push(`shields:${amount}`);
  }
}

class CharacterizationBattle implements PvpokeBattle {
  readonly calls: string[] = [];
  readonly pokemon: CharacterizationPokemon[] = [];

  setCP(cp: number): void {
    this.calls.push(`cp:${cp}`);
  }

  setLevelCap(levelCap: number): void {
    this.calls.push(`level-cap:${levelCap}`);
  }

  setCup(cup: string): boolean {
    this.calls.push(`cup:${cup}`);
    return true;
  }

  setNewPokemon(pokemon: PvpokePokemon, index: number): void {
    this.pokemon[index] = pokemon as CharacterizationPokemon;
    this.calls.push(`pokemon:${index}:${pokemon.speciesId}`);
  }

  simulate(): readonly unknown[] {
    this.calls.push("simulate");
    this.pokemon[0]!.hp = 0;
    this.pokemon[0]!.energy = 24;
    this.pokemon[0]!.shields = 0;
    this.pokemon[1]!.hp = 38;
    this.pokemon[1]!.energy = 41;
    return [];
  }

  getPokemon(): readonly [PvpokePokemon, PvpokePokemon] {
    return [this.pokemon[0]!, this.pokemon[1]!];
  }

  getWinner(): PvpokeWinner {
    return { pokemon: this.pokemon[1]! };
  }

  getBattleRatings(): readonly [number, number] {
    return [320, 680];
  }

  getTurnsToWin(): readonly [number, number] {
    return [0, 31];
  }
}

class CharacterizationRuntime implements PvpokeBattleRuntime {
  readonly battle = new CharacterizationBattle();
  readyCalls = 0;

  ready(): Promise<void> {
    this.readyCalls += 1;
    return Promise.resolve();
  }

  createBattle(): PvpokeBattle {
    return this.battle;
  }

  createPokemon(
    speciesId: string,
    index: 0 | 1,
    battle: PvpokeBattle,
  ): PvpokePokemon {
    void index;
    void battle;
    return new CharacterizationPokemon(speciesId);
  }

  getTeamRanker(): PvpokeTeamRanker {
    throw new Error("TeamRanker is not used by this characterization.");
  }
}

function build(
  speciesId: string,
  overrides: Partial<ExactSimulationBuild> = {},
): ExactSimulationBuild {
  return {
    speciesId,
    speciesName: speciesId,
    level: 30,
    cp: 1500,
    ivs: { attack: 0, defense: 15, hp: 15 },
    fastMoveId: "FAST",
    chargedMoveIds: ["CHARGED_ONE", "CHARGED_TWO"],
    isShadow: false,
    source: "inventory-current",
    ...overrides,
  };
}

describe("PvPoke one-on-one adapter", () => {
  it("configures exact builds and translates mutable engine results", async () => {
    const runtime = new CharacterizationRuntime();
    const adapter = new PvpokeOneOnOneAdapter(runtime);
    const request: OneOnOneSimulationRequest = {
      format: OPEN_GREAT_LEAGUE_SIMULATION_FORMAT,
      combatants: [
        { build: build("azumarill"), shields: 1 },
        {
          build: build("altaria_shadow", {
            chargedMoveIds: ["CHARGED_ONE"],
            isShadow: true,
          }),
          shields: 1,
        },
      ],
      dataVersion: "test-data-v1",
    };

    const result = await adapter.simulate(request);

    expect(runtime.readyCalls).toBe(1);
    expect(runtime.battle.calls).toEqual([
      "level-cap:50",
      "cp:1500",
      "cup:all",
      "pokemon:0:azumarill",
      "pokemon:1:altaria_shadow",
      "simulate",
    ]);
    expect(runtime.battle.pokemon[0]!.calls).toEqual([
      "iv:atk:0",
      "iv:def:15",
      "iv:hp:15",
      "level:30:true",
      "shadow:normal",
      "move:fast:FAST:undefined",
      "move:charged:CHARGED_ONE:0",
      "move:charged:CHARGED_TWO:1",
      "shields:1",
    ]);
    expect(runtime.battle.pokemon[1]!.calls).toContain("shadow:shadow");
    expect(runtime.battle.pokemon[1]!.calls).toContain(
      "move:charged:none:1",
    );
    expect(result).toMatchObject({
      winner: 1,
      dataVersion: "test-data-v1",
      engine: "pvpoke-upstream",
      turnsToWin: [0, 31],
      combatants: [
        {
          index: 0,
          speciesId: "azumarill",
          battleRating: 320,
          remainingHp: 0,
          remainingEnergy: 24,
        },
        {
          index: 1,
          speciesId: "altaria_shadow",
          battleRating: 680,
          remainingHp: 38,
          remainingEnergy: 41,
        },
      ],
    });
  });
});
