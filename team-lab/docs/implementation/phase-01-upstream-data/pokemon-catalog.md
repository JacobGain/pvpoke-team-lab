# Great League Pokémon Catalog

> **Phase:** Phase 1 — Upstream Data Boundary  
> **Status:** Complete for the initial catalog  
> **Route:** `/catalog`  
> **Last reviewed:** 2026-07-24

## Summary

The catalog joins validated Game Master Pokémon and moves with Open Great
League overall rankings and the current Great League meta group.

It produces immutable TeamLab-owned records and a searchable card interface.

## Problem being solved

Inventory entry cannot safely consume raw Game Master objects:

- raw records contain more data than the feature needs;
- move IDs require joining;
- rankings and meta membership are separate files;
- missing references need explicit handling;
- raw objects should not become persistent inventory records;
- ranking absence must not be confused with eligibility.

The catalog is the read model between upstream data and future inventory
features.

## Catalog data flow

```text
Validated Game Master
       +
Validated overall rankings
       +
Validated Great League meta group
       ↓
buildPokemonCatalog
       ↓
identity and reference checks
       ↓
immutable PokemonCatalog
       ↓
search/filter UI
```

## Internal model

Each `PokemonCatalogEntry` contains:

- species ID and name;
- Pokédex number;
- types and tags;
- released status;
- normal/Shadow indicators;
- Shadow eligibility;
- base stats and upstream level bounds;
- direct evolution IDs;
- resolved fast and charged movepools;
- legacy/Elite move flags;
- default Great League IV spread, where published;
- overall ranking, score, rating, and recommended move IDs;
- six PvPoke role scores from the overall ranking artifact;
- current Great League meta membership.

The model intentionally does not contain:

- mutable battle HP/energy state;
- exact owned IVs;
- inferred owned level;
- inventory identity;
- saved-team references;
- exact eligibility result;
- every upstream field.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/domain/pokemon/catalog.ts` | Immutable TeamLab catalog contracts and diagnostic count |
| `team-lab/src/pvpoke/adapters/buildPokemonCatalog.ts` | Upstream-to-TeamLab normalization and integrity checks |
| `team-lab/src/features/meta/usePokemonCatalog.ts` | Combines cached upstream query results |
| `team-lab/src/features/meta/PokemonCatalogPage.tsx` | Search, filtering, summary, and cards |
| `team-lab/src/app/router.tsx` | Registers `/catalog` |
| `team-lab/scripts/validate-pvpoke-data.ts` | Builds catalog against real files |

## Integrity rules

### Fatal identity conflicts

The builder throws `CatalogIdentityError` for:

- duplicate Pokémon species IDs;
- duplicate move IDs;
- duplicate ranking species IDs.

These conflicts are fatal because constructing a map would otherwise select a
record implicitly and make downstream behavior order-dependent.

### Non-fatal reference diagnostics

The builder records:

- Pokémon movepool IDs missing from moves;
- ranking species missing from the Game Master;
- ranking move IDs missing from moves;
- meta species missing from the Game Master;
- meta move IDs missing from moves.

The current dataset has zero such diagnostics.

### Immutable output

Catalog entries and nested arrays are frozen.

The goal is to prevent UI code from mutating the shared read model and
accidentally changing later inventory or recommendation behavior.

## Catalog sorting

Entries are sorted:

1. published overall rank;
2. species name for unranked/tied records.

The source Game Master’s array order is not treated as product presentation
order.

## Search behavior

Search matches:

- species name;
- species ID;
- type;
- fast-move name;
- charged-move name.

The default view requires:

- `released === true`;
- a published overall ranking.

The user can include released but unranked records.

This UI choice is not an eligibility rule.

## Rendering behavior

The page displays at most 120 cards at once.

If more records match, the page asks the user to refine search. This prevents
the initial catalog from rendering more than one thousand cards before list
virtualization is needed.

Cards currently display:

- species name and dex;
- overall rank or Unranked;
- type;
- Shadow;
- meta membership;
- recommended move IDs;
- movepool counts;
- published default Great League IV spread.

Phase 2 extended the non-visual catalog contract with base stats, level
bounds, and direct evolution edges for exact inventory validation. It also
adds Return to Shadow-eligible normal variants and Frustration to Shadow
variants, matching the relevant upstream `Pokemon` movepool behavior.

## Why exact eligibility is deferred

PvPoke eligibility includes:

- release state;
- stat-product thresholds;
- league-specific exclusions;
- cup filters;
- duplicate-form rules;
- low-level Shadow rules;
- special inclusion tags;
- level caps;
- custom overrides.

Reimplementing only part of that logic in the catalog would create a second
inconsistent eligibility engine.

For now:

- ranking presence means “published in this ranking artifact”;
- released means “marked released upstream”;
- neither alone is presented as canonical eligibility.

Exact eligibility should eventually come from a tested adapter around upstream
logic or a deliberately ported TeamLab eligibility service.

## Relationship to inventory

Future inventory records should save:

- `inventoryId`;
- `speciesId`;
- form/build input;
- source data version;
- user-entered state.

They should not save a complete `PokemonCatalogEntry`.

When displayed, inventory joins its stable IDs back to the current catalog.
This allows updated names, moves, rankings, and meta status to flow from a new
upstream dataset without rewriting the user’s inventory.

## Validation

```bash
npm run validate:data
npm run typecheck
npm run lint
npm run build
```

Observed:

```text
Normalized catalog entries: 1736
Non-fatal catalog diagnostics: 0
```

## Known limitations

- Recommended moves are displayed as upstream IDs.
- Sprites are not displayed.
- Role rankings are absent.
- Type pills use generic styling rather than final type colors.
- Search is a direct in-memory scan.
- Form grouping is absent.
- There is no pagination or virtualization.
- Eligibility is not canonical.
- The catalog has no detail route.

## Safe extension points

- Add display labels without changing stable move IDs.
- Load role rankings lazily and extend `CatalogRanking`.
- Add sprite resolution behind a TeamLab asset adapter.
- Add exact eligibility as a separate result.
- Add virtualization if catalog browsing expands.
- Add inventory-selection controls without persisting catalog objects.

## Follow-up work

Phase 2 should:

- define inventory schemas;
- persist only stable IDs and user state;
- use catalog entries for species/move selection;
- validate current/planned move choices;
- retain upstream data version;
- distinguish assumed rank-one IVs.

## Relevant commits

```text
1f65152cf  create catalog for validation and normalization
61ce18623  validation script
```
