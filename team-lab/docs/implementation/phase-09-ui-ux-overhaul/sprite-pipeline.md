# Local Pokémon Sprite Pipeline

## Source and pinning

TeamLab uses the PokeAPI sprite repository approved for this project. The sync
script pins a full Git revision rather than downloading a moving branch, so a
fresh sync is reproducible and cannot silently change shipped artwork.

The generated attribution file records the revision, source terms, manifest
hash, and every form that fell back to base National Dex artwork.

## Mapping rules

PvPoke species IDs are normalized independently of display names:

- `_shadow` shares the non-Shadow artwork;
- regional suffixes map to PokeAPI form conventions;
- punctuation-heavy species use explicit aliases;
- exact PokeAPI form IDs are preferred;
- unresolved or unavailable form artwork falls back to the species National
  Dex ID while TeamLab preserves the exact form label.

This keeps artwork presentation separate from battle identity. A fallback
image never changes the catalog species ID used for validation or simulation.

## Runtime contract

`PokemonSprite` reads only the generated manifest and local public assets. It
does not fetch third-party resources in the browser. Missing manifest entries
or failed image loads degrade to a local flask icon so artwork can never block
a workflow.

## Updating

Run:

```bash
npm run sync:sprites
```

Review:

- the terminal’s exact/fallback totals;
- `public/assets/pokemon/ATTRIBUTION.md`;
- changes to `src/generated/pokemonSprites.ts`;
- several exact, regional, Shadow, and fallback forms in the UI.

Only change the pinned revision intentionally and include that revision change
in review notes.
