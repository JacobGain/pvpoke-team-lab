# Inventory Domain Model

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for the persistence foundation  
> **Last reviewed:** 2026-07-24

## Summary

TeamLab inventory records represent unique owned specimens. Version-one
records are runtime-validated discriminated unions for current and planned
builds. They reference the catalog by stable IDs and contain only user-owned
state and persistence metadata.

## Problem being solved

Species data, an owned specimen, and analysis results have different
lifecycles. Persisting a raw PvPoke object would make the user database stale
on every upstream update. Persisting loosely typed UI form data would make
future analysis and migrations unsafe.

The domain model creates a narrow contract between data entry, persistence,
catalog lookup, and future simulation adapters.

## Record shape

```text
InventoryPokemon (schemaVersion: 1)
├── inventoryId
├── buildStatus: current | planned
├── speciesId
├── currentBuild
│   ├── cp
│   ├── ivProfile
│   │   ├── source: user-entered | assumed-rank-1
│   │   └── ivs: attack, defense, hp
│   └── moveset
│       ├── fastMoveId
│       └── chargedMoveIds (one or two, unique)
├── plannedBuild? (required only when planned)
│   ├── targetSpeciesId
│   ├── targetCp?
│   └── desiredMoveset
├── favorite
├── notes
├── sourceDataVersion
├── createdAt
└── updatedAt
```

`inventoryId` identifies the owned specimen. Multiple records may reference
the same `speciesId`.

## Exact catalog identity

PvPoke assigns distinct `speciesId` values to forms and Shadow variants. The
catalog preserves those exact values and exposes derived `isShadow` metadata.
Version one therefore stores one canonical `speciesId`, not separate
`speciesId`, `formId`, and `shadowState` fields that could contradict each
other.

Presentation joins the ID to the current catalog. A record does not copy
species name, types, sprite, ranking, meta membership, or movepool.

## IV provenance

Both IV modes store exact attack, defense, and HP values:

- `user-entered` means the user supplied the values.
- `assumed-rank-1` means the factory copied the upstream default Great League
  spread into the record.

Materializing assumed values makes calculations deterministic while retaining
the label needed to avoid presenting assumptions as measurements.

## Factory behavior

`createInventoryPokemon` owns:

- schema version;
- UUID creation;
- timestamps;
- default favorite and notes values;
- source catalog version;
- assumed-IV resolution;
- structural parsing;
- catalog-aware assertion.

ID, clock, and catalog are dependencies, making creation deterministic in
tests. `touchInventoryPokemon` updates `updatedAt` while revalidating the
record.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/domain/inventory/schemas.ts` | Zod schemas, version constant, and inferred domain types |
| `team-lab/src/domain/inventory/factory.ts` | Safe record creation, assumption resolution, and timestamp updates |
| `team-lab/src/domain/inventory/validation.ts` | Catalog-aware semantic validation |
| `team-lab/src/domain/inventory/repository.ts` | Persistence contract and domain-facing errors |

## Deferred derived values

Version one does not persist:

- inferred level;
- calculated stats or IV rank;
- eligibility;
- recommended moves;
- build costs;
- role/meta rank;
- display names or images.

These values depend on current logic/data and should be recalculated. Exact
level becomes part of the model only after upstream-compatible CP logic can
prove it reliably.

## Safe extension points

- Add a new record schema version and explicit migration rather than widening
  version one silently.
- Add derived analysis through separate read models.
- Add domain update functions that preserve identity/creation metadata.
- Extend catalog identity presentation without changing stored records.

## Validation

`factory.test.ts` proves explicit assumption materialization and catalog move
rejection. TypeScript derives record types from the runtime schemas to prevent
parallel handwritten contracts from drifting.

## Relevant commits

Not yet committed.
