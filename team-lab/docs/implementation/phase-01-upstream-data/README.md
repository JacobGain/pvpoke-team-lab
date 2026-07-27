# Phase 1 — Upstream Data Boundary

> **Status:** Complete for the initial Great League slice  
> **Project-plan phase:** Phase 1: upstream data boundary  
> **Last reviewed:** 2026-07-24

## Objective

Allow TeamLab to consume current PvPoke data without exposing raw JSON to
features or coupling feature code to upstream UI/global JavaScript. The
deployment inputs are now deterministic generated copies under
`public/vendor/pvpoke/`.

The phase must establish a stable progression:

```text
Raw upstream JSON
    ↓
Runtime validation
    ↓
Typed repositories
    ↓
Query caching
    ↓
TeamLab-owned normalized models
    ↓
Feature UI
```

## Implemented scope

- self-contained bundled data path
- validated, deterministic upstream sync command
- Game Master schema and loader
- Pokémon, move, cup, and format schemas
- overall-ranking schema and loader
- meta-group schema and loader
- structured HTTP/JSON/schema errors
- TanStack Query definitions
- bundled-data health UI
- Open Great League configuration
- immutable normalized Pokémon catalog
- catalog integrity diagnostics
- searchable catalog UI
- real checked-in data validation command

## Out of scope

- exact Open Great League eligibility calculation
- role ranking categories
- upstream JavaScript engine loading
- `Pokemon`, `Battle`, or `TeamRanker` adapters
- inventory
- exact IV rank calculation
- sprites and final type styling
- limited cups and other leagues

## Implementation records

- [PvPoke data connection](data-connection.md)
- [Great League Pokémon catalog](pokemon-catalog.md)

## Important decisions

### External data is untrusted

Even checked-in upstream JSON crosses an ownership boundary. It is validated at
runtime before TeamLab uses it.

### Raw and internal models are separate

Zod-inferred upstream records describe the external contract. The Pokémon
catalog describes TeamLab’s internal read model.

### Identity conflicts are fatal

Duplicate Pokémon, move, or ranking IDs would make `Map` normalization
ambiguous. Catalog building throws rather than silently allowing the last value
to win.

### Reference defects are diagnostic

Missing move/species references are collected as diagnostics. A feature can
still load when safe, but the defect is visible.

### Unranked does not mean ineligible

The catalog does not interpret ranking absence as proof that a Pokémon cannot
enter Great League. The UI hides unranked records by default for usefulness but
can include them.

### Overall rankings load first

Loading every ranking category would increase startup data and couple the
catalog to information it does not yet display. Role categories will be loaded
when role analysis is implemented.

## Validation

```bash
npm run validate:data
npm run typecheck
npm run lint
npm run build
```

Observed real-data result:

```text
Game Master: Default (2026-07-21 01:32:55)
Pokémon: 1736
Moves: 334
Open Great League rankings: 1143
Great League meta entries: 48
Normalized catalog entries: 1736
Non-fatal catalog diagnostics: 0
```

## Known limitations

- Ranking files determine “ranked,” not canonical eligibility.
- Released but unranked records may include Pokémon inappropriate for the
  initial inventory workflow.
- Schemas intentionally pass through upstream fields TeamLab does not yet use.
- The catalog displays recommended move IDs rather than polished move labels.
- Form grouping and family-level presentation are not implemented.
- The data connection does not yet use the upstream battle engine.

## Exit criteria

- [x] Game Master validates.
- [x] rankings validate.
- [x] meta group validates.
- [x] data paths are centralized.
- [x] features use repository/query boundaries.
- [x] normalized TeamLab catalog exists.
- [x] released/ranked Great League-oriented catalog is inspectable.
- [x] external inconsistencies are diagnosed.
- [x] upstream source remains untouched.

Canonical eligibility remains part of later exact-build/engine integration
rather than a reason to block the catalog foundation.

## Next phase dependencies

Inventory work can rely on:

- stable `speciesId` and move IDs;
- catalog search and display names;
- current movepools;
- normal/Shadow metadata;
- default Great League IV spreads;
- ranking/meta presence;
- Game Master timestamp for source-version tracking.

Inventory must continue to store IDs and source versions rather than copied raw
upstream objects.

## Relevant commits

```text
603e67996  data connection pt.1: schemas
ecd7b3a92  data connection pt.2: repositories
31d63c739  data connection pt.3: features, scripts, routes, etc.
1f65152cf  create catalog for validation and normalization
61ce18623  validation script
```
