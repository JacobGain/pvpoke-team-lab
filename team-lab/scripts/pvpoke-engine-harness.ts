import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

import { PVPOKE_ENGINE_SCRIPT_PATHS } from "../src/pvpoke/assetPaths.ts";
import { ACTIVE_SEASON } from "../src/pvpoke/season.ts";
import type { PvpokeBattle, PvpokeBattleRuntime, PvpokePokemon, PvpokeTeamRanker } from "../src/pvpoke/simulation/runtime.ts";

export interface EnginePokemon extends PvpokePokemon {
  activeFormId: string;
  readonly megaLevel: number;
  readonly speciesName: string;
  readonly level: number;
  readonly cp: number;
  readonly levelCap: number;
  readonly baseLevelCap: number;
  readonly cpm: number;
  readonly ivs: { atk: number; def: number; hp: number };
  chargedMoves: ({ moveId: string; isMegaMove?: boolean } | null)[];
  readonly extraChargedMovePool: readonly { moveId: string }[];
  initialize(cp?: number | false): void;
  setMegaLevel(level: number): void;
  hasThirdChargedMove(): boolean;
  getCPMByLevel(level: number): number;
  getFormStats(formId: string): { level: number; atk: number; def: number; hp: number };
}

interface EngineGlobals {
  GameMaster: { getInstance(): { data: unknown; createSearchMaps(): void } };
  Battle: new () => PvpokeBattle;
  Pokemon: new (id: string, index: number, battle: PvpokeBattle) => EnginePokemon;
  RankerMaster: { getInstance(): PvpokeTeamRanker };
}

/** Runs the exact classic scripts in an isolated realm, with only the DOM-free
 * jQuery operations needed by the data layer. No battle logic is replaced. */
export function createPinnedEngineHarness() {
  const root = new URL("../public/vendor/pvpoke/", import.meta.url);
  const context = createContext({
    console: { log() {}, error() {} },
    setTimeout, clearTimeout,
    host: "localhost", webRoot: "/", siteVersion: "test",
    settings: { gamemaster: "gamemaster", defaultIVs: "gamemaster" },
    getDefaultMultiBattleSettings: () => ({
      shields: 1, ivs: "original", bait: 1, levelCap: 50,
      startHp: 1, startEnergy: 0, startCooldown: 0,
      optimizeMoveTiming: true, startStatBuffs: [0, 0],
    }),
    $: {
      ajax() {},
      each(values: readonly unknown[], callback: (index: number, value: unknown) => unknown) {
        for (const [index, value] of values.entries()) {
          if (callback(index, value) === false) break;
        }
      },
    },
  });
  const scripts = PVPOKE_ENGINE_SCRIPT_PATHS.filter(path => !path.includes("jquery"));
  const hashes = scripts.map(path => {
    const source = readFileSync(new URL(path, root), "utf8");
    runInContext(source, context, { filename: path });
    return { path, sha256: createHash("sha256").update(source).digest("hex") };
  });
  const globals = context as unknown as EngineGlobals;
  const chargedDamage = runInContext(`(attacker, defender, index) => {
    const move = attacker.chargedMoves[index];
    return DamageCalculator.damageByStats(attacker, defender, attacker.getEffectiveStat(0),
      defender.getEffectiveStat(1), defender.typeEffectiveness[move.type], move);
  }`, context) as (attacker: PvpokePokemon, defender: PvpokePokemon, index: number) => number;
  const gm = globals.GameMaster.getInstance();
  gm.data = JSON.parse(readFileSync(new URL("data/gamemaster.json", root), "utf8")) as unknown;
  gm.createSearchMaps();
  const runtime: PvpokeBattleRuntime = {
    ready: () => Promise.resolve(),
    createBattle: () => new globals.Battle(),
    createPokemon: (id, index, battle) => new globals.Pokemon(id, index, battle),
    getTeamRanker: () => globals.RankerMaster.getInstance(),
  };
  return {
    runtime,
    chargedDamage,
    createPokemon: (id: string, index: 0 | 1, battle: PvpokeBattle) => new globals.Pokemon(id, index, battle),
    provenance: { upstreamCommit: ACTIVE_SEASON.upstreamCommit, scripts: hashes,
      gameMasterSha256: createHash("sha256").update(readFileSync(fileURLToPath(new URL("data/gamemaster.json", root)))).digest("hex") },
  };
}
