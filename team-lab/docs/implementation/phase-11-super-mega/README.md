# Phase 11 — Super Mega builds

## Status

**In progress**. Implementation and local acceptance are complete. The feature
PR, final staging checks, protected release PR, and production verification are
still required. See [release evidence](release-validation-and-recovery.md).

## Objective

Deliver the full [1.4.0 plan](../../PLAN-1.4.0.md), preserving owned data and
reproducing identically configured pinned upstream battles.

## Implemented scope

- Separate ordinary/extra attack pools and per-build Mega levels 1–4.
- Effective level 52 support, owned-level costs, exact meta defaults.
- Inventory v2, saved teams v2, backup v4, atomic database v5 migrations.
- Shared exact engine configuration across duel, matrix, recommendations,
  what-if, and replay; build fingerprints invalidate stale team results.
- Inventory/current/planned, bulk, CSV, duel, and planner editors and summaries.
- Roster review for extra pools, Mega tags, and move capability markers.
- Independent engine oracle, frozen fixtures, migration/browser/visual coverage.
- Separate dependency maintenance: all ten inherited findings resolved in
  [PR #104](https://github.com/JacobGain/pvpoke-team-lab/pull/104).

## Out of scope

Limited cups and a local change to Minior's upstream algorithm. Exactly six
formats and the existing engine/data pin remain. The isolated Minior issue has
[a reproducer and disposition](../../UPSTREAM-CONCERNS.md).

## Implementation records

- [Build contracts and migration](build-contracts-and-migration.md)
- [Pinned engine behavior and parity](engine-configuration-and-parity.md)
- [Editing, imports, and analysis](editing-and-import-workflows.md)
- [Release validation and recovery](release-validation-and-recovery.md)

## Important decisions

Use `extraChargedMoveId` rather than fitting three IDs into two ordinary slots.
Keep effective battle level separate from Mega level and owned base CP. Freeze
legacy engine defaults for migration; never invent an extra attack. Preserve
vendor algorithms, including the documented TeamRanker compatibility boundary.

## Validation

Node 24.21.0 with npm 11: clean locked installation, 303 tests in 50 files,
TypeScript, lint, scale characterization, data/workflow validation, public and
maintainer builds pass. Full public-artifact and development browser workflows
and all 21 visual snapshots pass. The audit reports zero vulnerabilities.
Real-engine coverage includes 48 combinations plus 24 frozen fixtures.
See the evidence record for commands, metadata, and recovery observations.

## Known limitations

Published ranking positions can differ from exact user-configured simulations
because their inputs and scoring differ. Pinned TeamRanker needs temporary dense
attack arrays during ranking; stored slot roles remain unchanged. Artifact-only
rollback to 1.3.2 cannot read new record schemas; tested forward recovery retains
all data. The isolated Minior calculation concern remains upstream behavior.

## Exit criteria

All functional and local release criteria pass. Require fresh artifact and both
CodeQL checks, immutable staging verification, protected staging-to-master
release, and immutable/canonical production verification before completion.

## Next phase dependencies

Limited cups require separate eligibility, catalog, ranking, and UI work.
Data refreshes must preserve extra-pool metadata, regenerate the roster report,
and rerun provenance-aware engine tests. Remove minimatch overrides when parent
packages adopt the patched major with compatible APIs.

## Relevant commits

Maintenance: `c0db6c9807a3`, merged to staging as `0b4469e5d98f` through PR #104.
Feature implementation is tracked on `1.4.0/super-mega`; Git history and its PR
provide the final commit identity.
