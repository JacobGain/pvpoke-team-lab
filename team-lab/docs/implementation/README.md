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

Status: **Complete for MVP**

- [Phase overview](phase-02-inventory/README.md)
- [Inventory domain model](phase-02-inventory/inventory-domain-model.md)
- [IndexedDB and repositories](phase-02-inventory/indexeddb-and-repositories.md)
- [Inventory validation](phase-02-inventory/inventory-validation.md)
- [Combat power and level inference](phase-02-inventory/combat-power-and-level-inference.md)
- [Manual inventory entry and editing](phase-02-inventory/manual-entry-workflow.md)
- [Inventory dashboard](phase-02-inventory/inventory-dashboard.md)
- [Inventory backup and restore](phase-02-inventory/backup-and-restore.md)
- [Superseded CRUD verification](phase-02-inventory/crud-verification.md)

Implemented:

- versioned current/planned inventory schemas
- explicit user-entered/rank-one IV provenance
- structural and catalog-aware validation
- exact CP calculation, level inference, and direct evolution validation
- Dexie database and repository contract
- validated CRUD persistence
- TanStack Query integration
- current/planned create and edit workflow
- searchable inventory dashboard and confirmed deletion
- high-volume entry conveniences and duplication
- versioned JSON export and fully validated import
- atomic merge/replace restore and confirmed local clearing
- Vitest and fake IndexedDB foundation

The phase's MVP exit criteria are complete. Phase 3 progress follows below.

### Phase 3 — IV and build analysis

Status: **Complete for the initial analysis slice**

- [Phase overview](phase-03-build-analysis/README.md)
- [IV ranking and effective stats](phase-03-build-analysis/iv-ranking-and-effective-stats.md)
- [Build profile, roles, moves, and UI](phase-03-build-analysis/build-profile-and-ui.md)
- [Named-opponent CMP, breakpoints, and bulkpoints](phase-03-build-analysis/named-opponent-thresholds.md)

Implemented:

- exact effective stats and stat product
- exhaustive Open Great League IV ranking
- percentile, rank-one, and Attack/CMP context
- separate current and planned read models
- PvPoke overall and six-role ranking context
- recommended-move comparison
- qualitative build requirements
- cached per-record analysis route
- named meta-opponent selection with explicit build assumptions
- exact CMP comparison
- fast-move breakpoints and defensive bulkpoints
- general-IV-space threshold attainability

Remaining beyond the initial phase:

- simulated matchup impact
- custom opponent builds
- charged-move and shield-scenario analysis

### Phase 4 — Saved teams

Status: **Complete for MVP**

- [Phase overview](phase-04-saved-teams/README.md)
- [Saved-team domain and persistence](phase-04-saved-teams/saved-team-domain-and-persistence.md)
- [Saved-team query and editor workflow](phase-04-saved-teams/saved-team-workflow.md)

Implemented:

- versioned Great League saved-team schema
- ordered lead, switch, and closer inventory references
- missing-member and species-clause validation
- current/planned target-species resolution
- legal create/update factories
- repository contract and stable persistence errors
- additive IndexedDB version-two saved-team table
- validated Dexie CRUD
- TanStack Query integration
- live inventory/catalog team resolution
- saved-team list and ordered editor
- create, reopen, reorder, duplicate, repair, and delete workflows

Deferred enhancements:

- team backup/restore
- inventory usage counts

### Phase 5 — PvPoke simulation adapter

Status: **Complete for MVP**

- [Phase overview](phase-05-simulation-adapter/README.md)
- [Engine bootstrap and exact one-on-one adapter](phase-05-simulation-adapter/engine-bootstrap-and-one-on-one-adapter.md)
- [Real-engine browser characterization](phase-05-simulation-adapter/real-engine-characterization.md)
- [TeamRanker adapter](phase-05-simulation-adapter/team-ranker-adapter.md)
- [Saved-team meta matrix service](phase-05-simulation-adapter/saved-team-meta-matrix.md)

Implemented:

- engine-independent exact-build request/result contracts
- exact Phase 3 build serialization
- explicit ambiguous-level handling
- isolated upstream classic-script and Game Master bootstrap
- injectable PvPoke runtime facade
- exact one-on-one configuration and invocation
- immutable result translation
- adapter call-order and translation characterization tests
- real-browser diagnostics route
- known exact matchup cases and repeat-run determinism checks
- result invariant validation and downloadable fixture report
- exact explicit-target TeamRanker matrix adapter
- singleton-safe serialized ranking and target cleanup
- translated target/matchup results
- real-browser TeamRanker diagnostic
- ordered saved-team exact-build preparation
- catalog-derived top-meta targets
- measured saved-team TeamRanker service and raw matrix route

Deferred enhancements:

- verified real-browser golden output fixtures
- worker/chunking, cancellation, and progress reporting

### Phase 6 — Team analysis

Status: **In progress — coverage and threat evidence complete**

- [Phase overview](phase-06-team-analysis/README.md)
- [Coverage, threats, and core breakers](phase-06-team-analysis/coverage-threats-and-core-breakers.md)
- [Bulk, safety, and consistency scorecard](phase-06-team-analysis/bulk-safety-and-consistency.md)

Implemented:

- explicit TeamRanker rating-direction thresholds
- selected-scope target coverage
- individual positive matchup percentage
- per-member win/loss/tie evidence
- major-threat ordering
- core-breaker and full-team-wall classification
- provisional scope-aware coverage grade
- scorecard and threat evidence UI
- exact-stat bulk score
- simulated-distribution safety score
- static PvPoke consistency score
- evidence-source and formula disclosure

Remaining:

- owned and unowned alternatives
- upstream deep links

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
    ↓
Maintain current/planned builds with exact level validation
    ↓
Export or atomically restore a versioned local backup
    ↓
Derive exact stats, IV rank, roles, moves, and build requirements
```

TeamLab cannot yet:

- calculate opponent-specific breakpoints or matchup impact;
- create or save teams;
- run the upstream battle engine;
- generate team recommendations.

Those capabilities belong to later phases in `PROJECT-PLAN.md`.
