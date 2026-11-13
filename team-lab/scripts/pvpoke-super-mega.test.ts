import { directBattle } from "./pvpoke-direct-oracle.ts";
import { describe, expect, it } from "vitest";
import { createPinnedEngineHarness } from "./pvpoke-engine-harness.ts";
import { configurePvpokePokemon, PvpokeOneOnOneAdapter } from "../src/pvpoke/simulation/PvpokeOneOnOneAdapter.ts";
import { PvpokeTeamRankerAdapter } from "../src/pvpoke/simulation/PvpokeTeamRankerAdapter.ts";
import type { ExactSimulationBuild, OneOnOneSimulationRequest, ShieldCount } from "../src/domain/simulation/contracts.ts";
import { calculateCombatPower } from "../src/domain/pokemon/combatPower.ts";
import { buildPokemonCatalog } from "../src/pvpoke/adapters/buildPokemonCatalog.ts";
import { gameMasterSchema } from "../src/pvpoke/types/schemas.ts";
import gameMaster from "../public/vendor/pvpoke/data/gamemaster.min.json";
import manifest from "../public/vendor/pvpoke/manifest.json";
import recordedFixtures from "./fixtures/super-mega-parity.json";

const catalog = buildPokemonCatalog(gameMasterSchema.parse(gameMaster), [], [], 10000);

function exact(id: string, level: number, megaLevel?: 1 | 2 | 3 | 4): ExactSimulationBuild {
  const pokemon = catalog.entries.find(entry => entry.speciesId === id)!;
  const ivs = { attack: 15, defense: 15, hp: 15 };
  return {
    speciesId: id, speciesName: pokemon.speciesName, level, ivs,
    cp: calculateCombatPower(pokemon.baseStats, ivs, level), megaLevel,
    fastMoveId: pokemon.fastMoves[0].id,
    chargedMoveIds: [pokemon.chargedMoves[0].id],
    extraChargedMoveId: pokemon.extraChargedMoves?.[0]?.id,
    isShadow: false, source: "meta-default",
  };
}


describe("pinned upstream Mega behavior (independent of TeamLab adapters)", () => {
  it("retains the source identity and per-script hashes", () => {
    const { provenance } = createPinnedEngineHarness();
    expect(provenance.upstreamCommit).toBe("a9dfd500421cacf2842d54d8adcb15830c1eef2b");
    expect(provenance.scripts).toHaveLength(9);
    expect(provenance.scripts.every(script => /^[a-f0-9]{64}$/.test(script.sha256))).toBe(true);
    const pinned = manifest.files as Record<string, { sha256: string }>;
    expect(provenance.gameMasterSha256).toBe(pinned["data/gamemaster.json"].sha256);
    for (const script of provenance.scripts) expect(script.sha256).toBe(pinned[script.path].sha256);
    expect(provenance).toEqual(recordedFixtures.provenance);
  });

  it.each([1500, 2500, 10000])("characterizes defaults and level transitions at %i CP", cp => {
    const engine = createPinnedEngineHarness();
    const battle = engine.runtime.createBattle();
    battle.setCP(cp);
    battle.setCup("mega");
    for (const [id, defaultMegaLevel, thirdSlot] of [
      ["sableye_mega", 4, true], ["chandelure_mega", 4, true],
      ["venusaur_mega", 3, true], ["kyogre_primal", 3, true],
      ["azumarill", 3, false],
    ] as const) {
      const pokemon = engine.createPokemon(id, 0, battle);
      expect(pokemon.megaLevel, id).toBe(defaultMegaLevel);
      expect(pokemon.hasThirdChargedMove(), id).toBe(thirdSlot);
      pokemon.initialize(cp);
      expect(Number.isFinite(pokemon.cp), id).toBe(true);
      if (thirdSlot) {
        pokemon.setMegaLevel(3);
        pokemon.setMegaLevel(4);
        expect(pokemon.megaLevel).toBe(4);
        if (cp === 10000) expect(pokemon.level).toBe(52);
        expect(pokemon.getCPMByLevel(52)).toBe(0.850300014019012);
        pokemon.setMegaLevel(2);
        if (cp === 10000) expect(pokemon.level).toBe(50);
      }
    }
  });

  it("keeps extra attacks in their own pool and slot, including an empty ordinary slot", () => {
    const engine = createPinnedEngineHarness();
    const battle = engine.runtime.createBattle();
    battle.setCP(1500);
    battle.setCup("mega");
    const pokemon = engine.createPokemon("sableye_mega", 0, battle);
    pokemon.initialize(1500);
    // The runtime type gains the extra-charged API in the contract implementation.
    const select = pokemon.selectMove.bind(pokemon) as (type: string, id: string, index: number) => boolean;
    select("extra-charged", "NIGHT_SHADE_PLUS", 2);
    pokemon.selectMove("charged", "none", 1);
    expect(pokemon.chargedMoves[1]).toBeNull();
    expect(pokemon.chargedMoves[2]).toMatchObject({ moveId: "NIGHT_SHADE_PLUS", isMegaMove: true });
    select("extra-charged", "none", 2);
    expect(pokemon.chargedMoves[2]).toBeNull();
  });
});

describe("real-engine TeamLab Super Mega parity", () => {
  it("matches pinned integer damage rounding and applies the bonus only to the Mega attack", () => {
    const damage: number[] = [];
    const ordinaryDamage: number[] = [];
    for (const megaLevel of [1, 2, 3, 4] as const) {
      const engine = createPinnedEngineHarness();
      const battle = engine.runtime.createBattle();
      battle.setCP(10000); battle.setCup("mega");
      const build = { ...exact("sableye_mega", 50, megaLevel), chargedMoveIds: ["POWER_GEM"] as const };
      const player = configurePvpokePokemon(engine.runtime, battle, build, 0, 0);
      const opponent = configurePvpokePokemon(engine.runtime, battle, exact("azumarill", 50), 1, 0);
      damage.push(engine.chargedDamage(player, opponent, 2));
      ordinaryDamage.push(engine.chargedDamage(player, opponent, 0));
    }
    expect(damage).toEqual([43, 47, 52, 56]);
    expect(new Set(ordinaryDamage).size).toBe(1);
  });
  for (const fixture of recordedFixtures.fixtures) {
    it(`matches the frozen direct-engine fixture ${fixture.id}`, async () => {
      const request = fixture.request as unknown as OneOnOneSimulationRequest;
      const result = await new PvpokeOneOnOneAdapter(createPinnedEngineHarness().runtime).simulate(request);
      expect(result).toMatchObject(fixture.expected);
      expect(directBattle(request)).toEqual(fixture.expected);
    });
  }
  it("uses Chandelure's real extra attack in a capped battle", async () => {
    const fixture = recordedFixtures.fixtures.find(fixture => fixture.id === "chandelure_mega-1500-mega-4")!;
    const request = fixture.request as unknown as OneOnOneSimulationRequest;
    const result = await new PvpokeOneOnOneAdapter(createPinnedEngineHarness().runtime).simulate({ ...request, captureReplay: true,
      combatants: [
        { build: { ...request.combatants[0].build, chargedMoveIds: ["FLAME_CHARGE"] }, shields: 0 },
        { build: { ...exact("altaria", 29), cp: 1497, ivs: { attack: 0, defense: 14, hp: 15 } }, shields: 0 },
      ],
    });
    expect(result.replay?.flatMap(frame => frame.events).some(event => event.name === "Ominous Wind+")).toBe(true);
  });
  it("detects dropping the extra attack or applying the wrong Mega bonus", async () => {
    const engine = createPinnedEngineHarness();
    const adapter = new PvpokeOneOnOneAdapter(engine.runtime);
    const build = { ...exact("sableye_mega", 50, 4), fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["POWER_GEM"] as const };
    const target = { ...exact("azumarill", 50), fastMoveId: "BUBBLE", chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"] as const };
    const request: OneOnOneSimulationRequest = {
      format: { id: "mega-master-league", cpCap: 10000, cup: "mega", levelCap: 50 },
      combatants: [{ build, shields: 0 }, { build: target, shields: 0 }], dataVersion: gameMaster.timestamp,
      captureReplay: true,
    };
    const result = await adapter.simulate(request);
    expect(JSON.stringify([...new Set(result.replay?.flatMap(frame => frame.events).map(event => event.name))])).toContain("Night Shade+");
    for (const mutated of [{ ...build, extraChargedMoveId: undefined }, { ...build, megaLevel: 1 as const }]) {
      const changed = await adapter.simulate({ ...request, combatants: [{ build: mutated, shields: 0 }, request.combatants[1]] });
      expect(changed.combatants).not.toEqual(result.combatants);
    }
  });
  for (const cpCap of [1500, 2500, 10000] as const) {
    for (const megaLevel of [1, 2, 3, 4] as const) {
      for (const species of ["sableye_mega", "chandelure_mega", "venusaur_mega", "kyogre_primal"]) {
        it(`${species} Mega level ${megaLevel}, ${cpCap} CP, replay and direct oracle`, async () => {
          const level = cpCap === 1500 ? 5 : cpCap === 2500 ? 10 : megaLevel === 4 ? 52 : 50;
          const build = exact(species, level, megaLevel);
          const target = exact("azumarill", cpCap === 1500 ? 20 : 50);
          const shields = (megaLevel % 3) as ShieldCount;
          const request: OneOnOneSimulationRequest = {
            format: { id: cpCap === 1500 ? "mega-great-league" : cpCap === 2500 ? "mega-ultra-league" : "mega-master-league", cpCap, cup: "mega", levelCap: 50 },
            combatants: [{ build, shields }, { build: target, shields }], dataVersion: gameMaster.timestamp,
          };
          const oracle = directBattle(request);
          const engine = createPinnedEngineHarness();
          const adapter = new PvpokeOneOnOneAdapter(engine.runtime);
          const result = await adapter.simulate(request);
          expect(result).toMatchObject(oracle);
          const replay = await adapter.simulate({ ...request, captureReplay: true });
          expect(replay).toMatchObject(oracle);
          expect(replay.replay?.length).toBeGreaterThan(1);
          const matrix = await new PvpokeTeamRankerAdapter(engine.runtime).rank({
            team: [build], targets: [target], cpCap, cup: "mega", teamShields: shields,
            targetShields: shields, dataVersion: gameMaster.timestamp,
          });
          expect(matrix.teamRatings[0]?.[0]).toBe(oracle.combatants[0].battleRating);
        });
      }
    }
  }
});
