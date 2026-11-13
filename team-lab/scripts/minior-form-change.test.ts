import { describe, expect, it } from "vitest";
import { createPinnedEngineHarness } from "./pvpoke-engine-harness.ts";
import { calculateCombatPower } from "../src/domain/pokemon/combatPower.ts";

describe("tracked upstream Minior form-level concern", () => {
  it("reproduces the capped whole-level decrement and the skipped legal half level", () => {
    const engine = createPinnedEngineHarness();
    const battle = engine.runtime.createBattle();
    battle.setCP(1500);
    battle.setCup("all");
    const core = engine.createPokemon("minior_core", 0, battle);
    core.setIV("atk", 15);
    core.setIV("def", 15);
    core.setIV("hp", 15);
    core.setLevel(20);
    expect(core.cp).toBe(1310);
    // changeForm assigns the target activeFormId before calling getFormStats.
    core.activeFormId = "minior_meteor";
    const observed = core.getFormStats("minior_meteor");
    expect(observed.level).toBe(37.5);
    const meteor = { attack: 116, defense: 194, hp: 155 };
    const ivs = { attack: 15, defense: 15, hp: 15 };
    expect(calculateCombatPower(meteor, ivs, 38.5)).toBeGreaterThan(1500);
    expect(calculateCombatPower(meteor, ivs, 38)).toBe(1498);
    expect(calculateCombatPower(meteor, ivs, observed.level)).toBe(1487);
    expect(observed.atk).toBe(core.getCPMByLevel(37.5) * (meteor.attack + 15));
    // This records upstream behavior. It does not endorse the calculation or
    // patch the pinned engine to claim independently verified game mechanics.
    expect(engine.provenance.upstreamCommit).toBe("a9dfd500421cacf2842d54d8adcb15830c1eef2b");
  });
});
