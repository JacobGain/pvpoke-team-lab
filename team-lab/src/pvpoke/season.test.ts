import { describe, expect, it } from "vitest";
import gameMaster from "../../public/vendor/pvpoke/data/gamemaster.min.json";
import manifest from "../../public/vendor/pvpoke/manifest.json";
import great from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-1500.json";
import ultra from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-2500.json";
import master from "../../public/vendor/pvpoke/data/rankings/all/overall/rankings-10000.json";
import { ACTIVE_SEASON } from "./season";

describe("active Season 28 bundle", () => {
  it("identifies the pinned Twilight Trails revision", () => {
    expect(manifest.season).toEqual(ACTIVE_SEASON);
    expect(gameMaster.timestamp).toBe("2026-10-17 03:10:24");
    expect(manifest.dataVersion).toBe(gameMaster.timestamp);
  });

  it("uses the season rebalance rather than the outgoing move stats", () => {
    const moves = new Map(gameMaster.moves.map((move) => [move.moveId, move]));
    expect(moves.get("BITE")).toMatchObject({ power: 2, energyGain: 4 });
    expect(moves.get("BODY_SLAM")).toMatchObject({ power: 65, energy: 40 });
    expect(moves.get("BULLDOZE")).toMatchObject({ power: 80, energy: 55 });
    expect(moves.get("MOONBLAST")).toMatchObject({ power: 90, energy: 50 });
    expect(moves.get("MIRROR_COAT")).toMatchObject({ energy: 45 });
    expect(moves.get("SHADOW_FORCE")).toMatchObject({ energy: 65 });
  });

  it("includes the October species, releases, and Zoroark move update", () => {
    const pokemon = new Map(gameMaster.pokemon.map((entry) => [entry.speciesId, entry]));
    for (const speciesId of [
      "zekrom_shadow", "pancham_shadow", "pangoro_shadow", "fomantis_shadow",
      "lurantis_shadow", "wimpod_shadow", "golisopod_shadow", "sandygast_shadow",
      "palossand_shadow", "sliggoo_hisuian", "goodra_hisuian",
    ]) {
      expect(pokemon.has(speciesId), speciesId).toBe(true);
    }
    for (const speciesId of ["bramblin", "brambleghast", "camerupt_mega"]) {
      expect(pokemon.get(speciesId)?.released, speciesId).toBe(true);
    }
    expect(pokemon.get("zoroark")?.fastMoves).toContain("SUCKER_PUNCH");
    expect(pokemon.get("zoroark")?.eliteMoves).toContain("SUCKER_PUNCH");
  });

  it("ships the matching rankings for every supported league", () => {
    expect(great[0]?.speciesId).toBe("melmetal");
    expect(ultra[0]?.speciesId).toBe("tinkaton");
    expect(master[0]?.speciesId).toBe("palkia_origin");
    expect(master.find((entry) => entry.speciesId === "metagross")?.moveset).toContain("SHADOW_CLAW");
    expect(gameMaster.pokemon.find((entry) => entry.speciesId === "staraptor_mega")).toBeDefined();
  });
});
