# Phase 2 — Inventory Domain and Persistence

> **Status:** Complete for MVP
> **Project-plan phase:** Phase 2: inventory domain and persistence  
> **Last reviewed:** 2026-07-25

## Objective

Give TeamLab a durable, versioned representation of an owned Pokémon that can
be validated against the stable catalog and stored locally without coupling
the domain to Dexie, React, or raw PvPoke records.

## Implemented scope

- version-one Zod inventory record schemas
- distinct current and planned record variants
- explicit user-entered and assumed-rank-one IV profiles
- structural moveset, CP, IV, timestamp, and metadata validation
- catalog-aware species and movepool validation
- PvPoke-compatible CP calculation and level inference through level 51
- exact CP/IV/species legal-build and direct-evolution validation
- record factory with injectable ID and clock dependencies
- repository contract and stable persistence errors
- Dexie database version one and inventory table
- validated create, read, update, delete, list, count, and clear operations
- TanStack Query hooks
- complete manual create and edit routes
- searchable current/planned inventory dashboard and confirmed deletion
- favorite filters and useful sort modes
- species filtering, save-and-add-another, and safe duplication
- versioned JSON backup export and complete import inspection
- atomic merge/replace restore and confirmed clear-inventory workflow
- Vitest and fake IndexedDB test foundation

## Out of scope

- exact IV rank calculation
- multi-stage evolution planning
- acquisition-method legality beyond upstream level floors
- database migrations beyond the initial version
- saved teams, analysis, and recommendations

## Implementation records

- [Inventory domain model](inventory-domain-model.md)
- [IndexedDB and repositories](indexeddb-and-repositories.md)
- [Inventory validation](inventory-validation.md)
- [Combat power and level inference](combat-power-and-level-inference.md)
- [Manual inventory entry and editing](manual-entry-workflow.md)
- [Inventory dashboard](inventory-dashboard.md)
- [Inventory backup and restore](backup-and-restore.md)
- [Superseded CRUD verification](crud-verification.md)

## Important decisions

- An exact catalog `speciesId` is the persisted species/form/Shadow reference.
  Redundant `formId` and `shadowState` fields are not stored.
- Assumed rank-one IVs are materialized as explicit values and retain their
  `assumed-rank-1` provenance.
- Structural Zod validation and catalog-aware validation remain separate.
- Derived catalog and analysis values are not persisted.
- Database and record schemas are versioned independently.
- Reads validate stored records and surface corruption; they never silently
  delete or rewrite unsupported data.
- The repository exposes explicit `create` and `update`, avoiding ambiguous
  upsert behavior.
- Backup inspection is all-or-nothing and restore is transactional.
- Merge preserves unrelated local records and lets the selected backup win
  matching IDs; replace makes the backup authoritative.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Automated coverage verifies record creation/update, rank-one materialization,
invalid move and impossible CP rejection, CP/level characterization, the
complete repository CRUD path, stable errors, and invalid-data preservation.

## Known limitations

- Planned evolution follows one direct upstream edge; multi-stage skipping is
  not supported.
- Ambiguous low-CP matches expose every possible level rather than inventing
  one.
- Catalog drift is detected through stored `sourceDataVersion`, but migration
  and user-facing repair flows are not implemented.
- Cards still use move IDs and omit sprites/polished type presentation.
- Backup version one contains inventory only; teams/settings are added when
  those persisted domains exist.

## Exit criteria

- [x] Inventory record schema is versioned.
- [x] Current/planned and IV-assumption semantics are explicit.
- [x] Stable catalog IDs and moves are validated.
- [x] Dexie CRUD persists across reloads.
- [x] Persistence is behind a domain repository contract.
- [x] Foundational persistence tests run without a browser.
- [x] Manual-entry workflow supports all required fields.
- [x] CP/IV/species combinations receive exact level/legal-build validation.
- [x] Inventory cards, filters, and full edit workflow are implemented.
- [x] JSON backup/import is implemented.

## Next phase dependencies

Later analysis and team phases can rely on stable
inventory identity, explicit build intent, IV provenance, source-data
provenance, exact build legality, atomic persistence, and recoverable local
data APIs that are not tied to components.

## Relevant commits

Not yet committed. Add the implementing commit after this slice is committed.
