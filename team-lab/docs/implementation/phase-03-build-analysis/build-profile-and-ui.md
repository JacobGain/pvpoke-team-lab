# Build Profile, Roles, Moves, and UI

> **Phase:** Phase 3 — IV and Build Analysis
> **Status:** Complete for the first analysis slice
> **Route:** `/inventory/:inventoryId/analysis`
> **Last reviewed:** 2026-07-25

## Summary

The inventory analysis route joins a persisted specimen to the current catalog
and produces separate current and planned competitive profiles.

## Read-model flow

```text
InventoryPokemon + current PokemonCatalog
    ↓
resolve current and optional target species
    ↓
resolve recorded or derived-maximum CP/levels
    ↓
calculate exact stats and IV ranking
    ↓
compare moves and ranking metadata
    ↓
derive qualitative requirements
    ↓
cache by inventory update + data version
    ↓
render analysis page
```

No analysis result is written into IndexedDB.

## Current and planned semantics

The current profile always uses:

- current exact species;
- entered current CP;
- entered or explicitly assumed IVs;
- current moves.

The planned profile uses:

- target species;
- the same specimen IVs;
- desired moves;
- entered target CP, or highest legal CP when target CP is absent.

The UI renders them as separate panels and labels derived target CP.

## PvPoke ranking context

The existing overall ranking artifact contains six score positions. TeamLab
maps them using upstream presentation order:

| Index | Role |
| --- | --- |
| 0 | Lead |
| 1 | Closer |
| 2 | Switch |
| 3 | Charger |
| 4 | Attacker |
| 5 | Consistency |

For each role, relative rank is the count of catalog scores strictly greater
than the selected score plus one. The strongest role favors the smallest rank,
then the higher score.

These scores/ranks describe PvPoke's published default simulation build. They
are context, not a simulation of the inventory specimen.

## Moveset comparison

The profile identifies:

- entered fast and charged moves;
- PvPoke-recommended fast and charged moves;
- whether the fast move matches;
- missing recommended charged moves;
- extra entered charged moves.

Recommendation absence is represented as missing upstream guidance, not an
invalid build.

## Build requirements

Current/planned state and recommended moves produce qualitative requirements:

- evolve;
- power up;
- change fast move;
- change charged move;
- unlock second charged move;
- remove Frustration;
- obtain an Elite move.

Duplicate requirement messages are removed. Exact resource costs are not
invented because resource tracking/cost calculation is outside this slice.

## UI contents

Each panel shows:

- CP and inferred level;
- IV rank and denominator;
- percentile and rank-one product percentage;
- overall PvPoke rank and strongest role;
- Attack percentile;
- effective Attack, Defense, HP, and product;
- entered spread and IV provenance;
- rank-one spread/level/CP;
- highest-Attack spread;
- entered versus recommended moves;
- all six role ranks/scores.

The page ends with requirements and an explicit scope warning.

## Error handling

The page reports:

- missing inventory records;
- catalog/query failures;
- missing current/target species;
- unsupported build analysis;
- ranking generation failure.

TanStack Query caches successful analysis indefinitely for its exact record
timestamp and data version. Editing the record or updating upstream data
creates a new cache key.

## Known limitations

- The page displays move IDs in comparison text.
- It analyzes one inventory record at a time.
- Role scores do not incorporate exact entered moves.
- Ambiguous low-CP builds display stats for the first possible level while
  stating all possibilities.
- Breakpoints, bulkpoints, and opponent CMP are deliberately absent.

## Relevant commits

Not yet committed.
