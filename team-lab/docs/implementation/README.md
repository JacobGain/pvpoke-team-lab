# TeamLab Implementation Records

## Purpose

This directory is the living record of TeamLab’s actual implementation.

The project plan defines what TeamLab intends to build. These records explain
what has actually been built, why it was built that way, which files own the
behavior, how it was validated, which limitations remain, and what work should
follow.

The documentation hierarchy is:

```text
PROJECT-PLAN.md
    Product direction, scope, phases, and acceptance criteria

Fork-Structure-Breakdown.md
    Repository ownership and architectural boundaries

implementation/
    Actual implementation decisions and progress
```

Future contributors should be able to use this directory to understand the
current application without reconstructing every decision from Git history or
chat transcripts.

## Index

### Phase 0 — Application foundation

Status: **Complete**

- [Phase overview](phase-00-foundation/README.md)
- [Frontend and UI foundation](phase-00-foundation/frontend-and-ui-foundation.md)

Implemented:

- React and TypeScript application scaffold
- Vite build and development server
- routing and providers
- strict TypeScript and ESLint configuration
- initial global styling
- foundational application dependencies

Primary commit:

```text
3dcc89fa5  mega commit: react 19, ts6, vite 8, zod, dexie, etc.
```

### Phase 1 — Upstream data boundary

Status: **Complete for the initial Great League slice**

- [Phase overview](phase-01-upstream-data/README.md)
- [PvPoke data connection](phase-01-upstream-data/data-connection.md)
- [Great League Pokémon catalog](phase-01-upstream-data/pokemon-catalog.md)

Implemented:

- environment-controlled upstream data path
- local Vite-to-Apache proxy
- Zod validation of external PvPoke data
- typed repository contracts
- HTTP repository implementations
- TanStack Query integration
- connection-status UI
- immutable TeamLab catalog models
- catalog normalization and integrity diagnostics
- searchable Open Great League catalog
- real-data CLI validation

Primary commits:

```text
603e67996  data connection pt.1: schemas
ecd7b3a92  data connection pt.2: repositories
31d63c739  data connection pt.3: features, scripts, routes, etc.
1f65152cf  create catalog for validation and normalization
61ce18623  validation script
```

### Phase 2 — Inventory domain and persistence

Status: **In progress — persistence foundation complete**

- [Phase overview](phase-02-inventory/README.md)
- [Inventory domain model](phase-02-inventory/inventory-domain-model.md)
- [IndexedDB and repositories](phase-02-inventory/indexeddb-and-repositories.md)
- [Inventory validation](phase-02-inventory/inventory-validation.md)
- [CRUD verification](phase-02-inventory/crud-verification.md)

Implemented:

- versioned current/planned inventory schemas
- explicit user-entered/rank-one IV provenance
- structural and catalog-aware validation
- Dexie database and repository contract
- validated CRUD persistence
- TanStack Query integration
- engineering verification route
- Vitest and fake IndexedDB foundation

Remaining:

- exact CP/level legality
- full manual-entry and edit workflows
- inventory dashboard/cards/filters
- JSON backup and import

## Updating these records

Documentation is part of the definition of done for an implementation slice.

For every meaningful slice:

1. Create or update the owning phase overview.
2. Create a focused record if the work introduces a distinct subsystem,
   workflow, or architectural boundary.
3. Record the outcome rather than only the intended plan.
4. List important files and their responsibilities.
5. Record decisions and alternatives.
6. Record external contracts and data shapes.
7. Record validation commands and observed results.
8. Record known limitations and deferred work.
9. Link relevant commits when available.
10. Update this index.

Read [DOCUMENTATION-GUIDE.md](DOCUMENTATION-GUIDE.md) for the full convention.

## Current implementation boundary

At this point, TeamLab can:

```text
Start React application
    ↓
Load upstream PvPoke JSON over HTTP
    ↓
Validate raw external data with Zod
    ↓
Cache through TanStack Query
    ↓
Normalize into immutable TeamLab catalog records
    ↓
Search and inspect Open Great League Pokémon
    ↓
Create a versioned, catalog-validated inventory record
    ↓
Persist and retrieve it through a repository-backed IndexedDB database
```

TeamLab cannot yet:

- provide the finished inventory-entry/dashboard experience;
- calculate an entered specimen’s exact level or IV rank;
- create or save teams;
- run the upstream battle engine;
- generate team recommendations.

Those capabilities belong to later phases in `PROJECT-PLAN.md`.
