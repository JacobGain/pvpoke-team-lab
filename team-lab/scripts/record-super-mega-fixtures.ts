import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPinnedEngineHarness } from "./pvpoke-engine-harness.ts";
import { directBattle } from "./pvpoke-direct-oracle.ts";
import type { ExactSimulationBuild, OneOnOneSimulationRequest } from "../src/domain/simulation/contracts.ts";

// Regenerate explicitly after reviewing an upstream pin change. This script
// uses raw published movesets and upstream Pokémon defaults, not TeamLab's
// catalog, serializers, configuration helper, or default-build implementation.
const root = new URL("../public/vendor/pvpoke/", import.meta.url);
const engine = createPinnedEngineHarness();
const fixtures: { id: string; request: OneOnOneSimulationRequest; expected: ReturnType<typeof directBattle> }[] = [];
const data = JSON.parse(readFileSync(new URL("data/gamemaster.json", root), "utf8")) as { timestamp: string };

for (const cpCap of [1500, 2500, 10000] as const) {
  const rankings = JSON.parse(readFileSync(new URL(`data/rankings/mega/overall/rankings-${cpCap}.json`, root), "utf8")) as { speciesId: string; moveset: string[] }[];
  const battle = engine.runtime.createBattle();
  battle.setCP(cpCap);
  battle.setCup("mega");
  const build = (id: string, moveset: readonly string[], megaLevel?: 1 | 2 | 3 | 4): ExactSimulationBuild => {
    const pokemon = engine.createPokemon(id, 0, battle);
    pokemon.initialize(cpCap);
    if (megaLevel !== undefined) pokemon.setMegaLevel(megaLevel);
    const ordinary = moveset.slice(1, 3).filter(id => id !== "none");
    return {
      speciesId: id, speciesName: pokemon.speciesName, level: pokemon.level, cp: pokemon.cp,
      ivs: { attack: pokemon.ivs.atk, defense: pokemon.ivs.def, hp: pokemon.ivs.hp },
      megaLevel, fastMoveId: moveset[0],
      chargedMoveIds: ordinary.length === 1 ? [ordinary[0]] : [ordinary[0], ordinary[1]],
      extraChargedMoveId: moveset[3] && moveset[3] !== "none" ? moveset[3] : undefined,
      isShadow: false, source: "meta-default",
    };
  };
  const target = build("azumarill", ["BUBBLE", "ICE_BEAM", "PLAY_ROUGH"]);
  for (const species of ["sableye_mega", "chandelure_mega"]) {
    const published = rankings.find(entry => entry.speciesId === species);
    if (!published) throw new Error(`Missing published fixture source: ${species} at ${cpCap}.`);
    for (const megaLevel of [1, 2, 3, 4] as const) {
      const request: OneOnOneSimulationRequest = {
        format: { id: cpCap === 1500 ? "mega-great-league" : cpCap === 2500 ? "mega-ultra-league" : "mega-master-league", cpCap, cup: "mega", levelCap: 50 },
        combatants: [{ build: build(species, published.moveset, megaLevel), shields: 1 }, { build: target, shields: 1 }],
        dataVersion: data.timestamp,
      };
      fixtures.push({ id: `${species}-${cpCap}-mega-${megaLevel}`, request, expected: directBattle(request) });
    }
  }
}
const directory = new URL("fixtures/", import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL("super-mega-parity.json", directory), `${JSON.stringify({ fixtureVersion: 1, provenance: engine.provenance, fixtures }, null, 2)}\n`);
console.log(`Recorded ${fixtures.length} direct pinned-engine fixtures.`);
