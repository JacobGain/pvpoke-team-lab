# TeamLab Implementation Records

## Purpose

This directory is the living record of TeamLab’s actual implementation.

The project plan defines what TeamLab intends to build. These records explain
what has actually been built, why it was built that way, which files own the
behavior, how it was validated, which limitations remain, and what work should
follow.

Local setup and product operation are documented separately in the
[TeamLab Local User Guide](../USER-GUIDE.md).

The documentation hierarchy is:

```text
PROJECT-PLAN.md
    Product direction, scope, phases, and acceptance criteria

Fork-Structure-Breakdown.md
    Repository ownership and architectural boundaries

implementation/
    Actual implementation decisions and progress

RELEASES.md and RELEASE-X.Y.Z.md
    Release history shown on the site's Release notes page
```

Future contributors should be able to use this directory to understand the
current application without reconstructing every decision from Git history or
chat transcripts.

## Current capabilities

TeamLab supports six open/Mega formats with shared inventory, current/planned
build analysis, TeamLab CSV import, saved-team matrices and what-if changes,
configurable battle replay, full-inventory or anchored recommendations,
recommendation history, and roster update review. Current persistence uses
IndexedDB version four and full-data backup envelope version three; older
phase validation counts and schema milestones describe their original slices.

For maintenance, follow the [complete upstream refresh runbook](../PVPOKE-DATA.md).
For hosted previews, see [deployment and stack selection](../DEPLOYMENT-BUILDS.md).

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

Status: **Complete for six supported open/Mega formats**

- [Phase overview](phase-01-upstream-data/README.md)
- [PvPoke data connection](phase-01-upstream-data/data-connection.md)
- [Initial Pokémon catalog](phase-01-upstream-data/pokemon-catalog.md)
- [Shared leagues and Mega inventory](phase-01-upstream-data/shared-leagues-and-mega-inventory.md)
- [Pinned upstream refresh runbook](../PVPOKE-DATA.md)

Implemented:

- self-contained, manifest-tracked PvPoke data bundle
- deterministic and overwriteable upstream sync command
- Zod validation before bundling and at runtime
- typed repository contracts
- HTTP repository implementations
- TanStack Query integration
- bundled-data health UI
- immutable TeamLab catalog models
- catalog normalization and integrity diagnostics
- searchable format-specific catalog for all six open/Mega formats
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
- [TeamLab CSV inventory import](phase-02-inventory/csv-import.md)
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
- TeamLab CSV template import with exact-build preview and duplicate review
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
- exhaustive league-specific IV ranking
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
- temporary, bounded matchup-backed comparison of alternate IV/move builds
  against selected threats using exact one-on-one simulations and shield
  scenarios

Remaining beyond the initial phase:

- custom opponent builds
- saving alternate build plans or matchup comparisons
- charged-move threshold analysis

The first matchup-planning slice uses a single explicit shield scenario per run;
it does not aggregate scenarios into a competitive score.

### Phase 4 — Saved teams

Status: **Complete for MVP**

- [Phase overview](phase-04-saved-teams/README.md)
- [Saved-team domain and persistence](phase-04-saved-teams/saved-team-domain-and-persistence.md)
- [Saved-team query and editor workflow](phase-04-saved-teams/saved-team-workflow.md)

Implemented:

- versioned saved-team schema with explicit six-format identity
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

Team backup/restore is delivered through the version-three full-data backup.
Inventory usage counts remain a separate enhancement.

### Phase 5 — PvPoke simulation adapter

Status: **Complete for MVP**

- [Phase overview](phase-05-simulation-adapter/README.md)
- [Engine bootstrap and exact one-on-one adapter](phase-05-simulation-adapter/engine-bootstrap-and-one-on-one-adapter.md)
- [Real-engine browser characterization](phase-05-simulation-adapter/real-engine-characterization.md)
- [TeamRanker adapter](phase-05-simulation-adapter/team-ranker-adapter.md)
- [Saved-team meta matrix service](phase-05-simulation-adapter/saved-team-meta-matrix.md)
- [Configurable Battle and engine-observed replay](phase-05-simulation-adapter/battle-replay.md)

Implemented:

- engine-independent exact-build request/result contracts
- exact Phase 3 build serialization
- explicit ambiguous-level handling
- isolated bundled classic-script and Game Master bootstrap
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
- measured saved-team TeamRanker service and matrix/scorecard route
- configurable six-format duel editor and engine-observed turn replay

Deferred enhancements:

- verified real-browser golden output fixtures
- worker/chunking, cancellation, and progress reporting

### Phase 6 — Team analysis

Status: **Complete for MVP**

- [Phase overview](phase-06-team-analysis/README.md)
- [Coverage, threats, and core breakers](phase-06-team-analysis/coverage-threats-and-core-breakers.md)
- [Bulk, safety, and consistency scorecard](phase-06-team-analysis/bulk-safety-and-consistency.md)
- [Owned and unowned threat alternatives](phase-06-team-analysis/owned-and-unowned-alternatives.md)
- [Removed PvPoke Battle and Team Builder deep links](phase-06-team-analysis/upstream-deep-links.md)

Implemented:

- explicit TeamRanker rating-direction thresholds
- selected-scope target coverage
- individual positive matchup percentage
- per-member win/loss/tie evidence
- major-threat ordering
- core-breaker and full-team-wall classification
- selected-scope, meta-rank-weighted Coverage formula and A–F grade
- scorecard and threat evidence UI
- PvPoke exact-stat Bulk score
- published Switch-score Safety score
- upstream exact-moveset Consistency score
- evidence-source and formula disclosure
- normalized PvPoke matchup and counter evidence
- owned exact-record counter candidates
- unowned PvPoke-default counter candidates
- species-clause filtering and source disclosure
- exact one-slot owned-build what-if simulations with before-and-after scorecards
- completed-run data provenance without external deep links

Deferred enhancements:

- broader substitution search across multiple slots or unowned builds
- upstream meta weighting and role evidence
- persisted analysis cache

### Phase 7 — Anchor recommendations

Status: **Complete for MVP**

- [Phase overview](phase-07-anchor-recommendations/README.md)
- [Anchor request and candidate pool](phase-07-anchor-recommendations/anchor-request-and-candidate-pool.md)
- [Static candidate generation and pre-score](phase-07-anchor-recommendations/static-candidate-generation-and-pre-score.md)
- [Exact finalist simulation and selection](phase-07-anchor-recommendations/exact-finalist-simulation-and-selection.md)
- [Recommendation workflow and result presentation](phase-07-anchor-recommendations/recommendation-workflow-and-result-presentation.md)
- [Recommendation history and current-data comparison](phase-07-anchor-recommendations/recommendation-history.md)

Implemented:

- runtime-validated full-inventory or one/two-anchor requests
- fixed or flexible anchor positions
- configurable one-to-five or ten-result count
- ready-now-only, planned-only, and combined scopes
- exact current/planned owned-build preparation
- current-catalog and anchor legality validation
- anchor-safe partner candidate pool
- deterministic ready-now-first discovery ordering
- static rank, role, matchup, and counter evidence boundary
- explicit exclusion diagnostics
- versioned partner eligibility thresholds
- anchor-aware ordered team generation
- partner-to-partner species clause
- transparent versioned static pre-score
- species-team deduplication
- bounded and core-diverse finalist selection
- generic ordered-team TeamRanker preparation
- stale static-data rejection
- sequential exact finalist simulation
- Phase 6 scorecards and alternatives per finalist
- versioned final selection score
- exact result diversity, failure, and shortfall handling
- cooperative per-finalist progress and cancellation
- evidence-derived recommendation explanations
- complete `/recommend` workflow and responsive result presentation
- explicit selected-result conversion into saved teams
- automatically saved recommendation history with data/formula versions and
  current-data rerun comparison

Deferred enhancements:

- recommendation result caching and full-matrix persistence
- in-flight synchronous engine interruption
- worker or chunked finalist execution
- expanded individual exclusion diagnostics

### Phase 8 — Backup and MVP hardening

Status: **Complete for MVP**

- [Phase overview](phase-08-mvp-hardening/README.md)
- [Full-data backup and atomic restore](phase-08-mvp-hardening/full-data-backup-and-atomic-restore.md)
- [Destructive local-data controls](phase-08-mvp-hardening/destructive-local-data-controls.md)
- [Representative-scale characterization](phase-08-mvp-hardening/representative-scale-characterization.md)
- [Responsive and browser hardening](phase-08-mvp-hardening/responsive-and-browser-hardening.md)
- [Critical browser workflow coverage](phase-08-mvp-hardening/critical-browser-workflow-coverage.md)
- [Local user documentation](phase-08-mvp-hardening/local-user-documentation.md)

Implemented:

- version-three full-data JSON backup
- inventory, saved teams, and recommendation history in one portable artifact
- legacy version-one inventory and version-two inventory/team backup import
- complete inventory, catalog, team-reference, and species-clause inspection
- cross-collection merge and replace semantics
- final merged-state validation
- atomic three-table Dexie restore and rollback
- application-wide backup UI counts, diagnostics, and query invalidation
- clear-saved-teams with inventory preservation
- reference-guarded bulk inventory clearing
- atomic reset-all across persisted MVP tables
- explicit inline confirmations and typed reset intent
- deterministic 120-inventory/30-team scale fixture
- bounded recommendation-discovery and persistence regression budgets
- map-backed characterized inventory filtering and sorting
- measured no-worker/no-virtualization decision for characterized MVP paths
- complete 320 px responsive route audit and native file-control repair
- route-level feature code splitting and sub-500 kB production entry chunk
- bounded real-browser TeamRanker diagnostic timing
- self-contained real-Chrome critical workflow suite
- populated inventory, analysis, team, simulation, and recommendation coverage
- Top-20 matrix and Top-48 cancellation responsiveness measurements
- browser-level full-data download, reset, inspection, and restore
- measured no-worker decision for current MVP browser scopes
- complete local setup, operation, recovery, troubleshooting, and limitations
  guide

Hosted Cloudflare Pages deployment and immutable-artifact verification are
delivered; see the [deployment guide](../CLOUDFLARE-DEPLOYMENT.md). Update the
user guide alongside future format, import, or persistence changes.

### Phase 9 — Modern battle lab UI and UX

Status: **Complete for the current MVP**

- [Phase overview](phase-09-ui-ux-overhaul/README.md)
- [Local Pokémon sprite pipeline](phase-09-ui-ux-overhaul/sprite-pipeline.md)
- [Style architecture and visual regression](phase-09-ui-ux-overhaul/style-architecture.md)

Implemented:

- shared desktop and mobile application shell
- persistent primary navigation and grouped utility destinations
- state-aware dashboard and deterministic next-best-action guidance
- modern battle-lab design tokens, surfaces, hierarchy, and icon system
- reusable page-header and actionable empty-state patterns
- responsive local Pokémon artwork throughout all primary workflows
- revision-pinned PokeAPI sync, WebP optimization, manifest, and attribution
- three-step exact inventory workflow with actual IV entry as the default
- staged anchor recommendation request and result flow
- keyboard, focus, reduced-motion, and 320 px responsive hardening
- updated full-browser coverage for progressive step transitions
- feature-owned stylesheet modules with an explicit cascade contract
- checked-in desktop, tablet, and mobile visual-regression baselines

### Phase 10 — Roster update review

Status: **Complete for the current implementation**

- [Phase overview](phase-10-roster-updates/README.md)
- [Roster comparison, review, and analysis freshness](phase-10-roster-updates/roster-review-and-freshness.md)

Implemented:

- explicit outgoing/active Git pins and deterministic public change artifact;
- selected-format impact on owned, planned, and projected Mega builds;
- rank/move changes, current-reference validation, and repair actions;
- `/updates` and per-format dashboard reminders with local dismissal;
- team data/revision provenance, conservative edit detection, and atomic
  snapshot-checked analysis stamping;
- production/development Chrome workflows and two new visual scenes.

## Updating these records

Documentation is part of the definition of done for an implementation slice.
For versioned user-facing changes, follow the [release notes workflow](../RELEASES.md)
and add a structured note so the site's release archive stays current.

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

```text
Pinned upstream assets and outgoing/current comparison
    ↓ validate, cache, and normalize by open/Mega format
Shared exact inventory with current/planned targets and optional Mega choice
    ↓ derive legal CP, IV, move, and matchup evidence
Saved ordered teams / full-inventory or anchored recommendations
    ↓ run bounded exact simulations
Scorecards, threats, what-if substitutions, and configurable duel replay
    ↓ preserve selected recommendation evidence and data/formula provenance
Local recommendation history and current-data rerun comparison
    ↓ inspect impact when upstream data changes
Roster review, repair actions, and safe team analysis freshness
    ↓ protect portable browser-local state
Version-three inventory/team/history backups and atomic restore/reset
```

The original MVP phases and UI overhaul are delivered, with the post-MVP
extensions documented above. Limited cups, accounts/cloud synchronization,
resource-cost optimization, complete stored battle matrices, and full-team
battle prediction remain outside the implementation boundary.
