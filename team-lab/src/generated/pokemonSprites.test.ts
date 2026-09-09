import { describe, expect, it } from "vitest";

import { pokemonSpriteManifest } from "./pokemonSprites";

describe("pokemon sprite manifest", () => {
  it.each([
    ["zacian_crowned_sword", "zacian_hero"],
    ["zamazenta_crowned_shield", "zamazenta_hero"],
    ["necrozma_dawn_wings", "necrozma"],
    ["necrozma_dusk_mane", "necrozma"],
    ["mewtwo_armored", "mewtwo"],
    ["cherrim_sunny", "cherrim_overcast"],
    ["burmy_sandy", "burmy_plant"],
    ["burmy_trash", "burmy_plant"],
    ["genesect_burn", "genesect"],
    ["genesect_chill", "genesect"],
    ["genesect_douse", "genesect"],
    ["genesect_shock", "genesect"],
  ])("keeps %s artwork distinct from %s", (formId, baseId) => {
    const form = pokemonSpriteManifest[formId];
    const base = pokemonSpriteManifest[baseId];

    expect(form?.match).toBe("exact");
    expect(form?.path).not.toBe(base?.path);
  });
});
