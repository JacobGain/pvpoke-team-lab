# Matchup-Backed Build Planning

> **Status:** Implemented as a temporary experiment
> **Route:** `/inventory/:inventoryId/analysis`
> **Last reviewed:** 2026-09-30

## Outcome

The analysis page can simulate an exact baseline build and up to three
alternate builds against up to three selected ranked threats in the active
league. Each run compares the baseline and candidates under one chosen pair of
shield counts.

The maximum run contains twelve one-on-one simulations:

```text
(1 baseline + 3 candidates) × 3 selected threats = 12 simulations
```

This cap keeps the interaction bounded. Progress is reported after each
simulation, cancellation takes effect between matchups, and an individual
simulation error does not discard other results.

## Build semantics

- The baseline is the selected inventory record's current or planned build.
- When its CP and IVs map to multiple levels, the user selects the exact level
  before simulation.
- A candidate can retain the source IVs, use the stat-product rank-one,
  highest-Attack, or highest-Defense spread, or use custom 0–15 IVs.
- Retaining source IVs preserves the source build's CP and selected level.
  Every alternate IV option is fitted to the highest legal level under the
  active league's CP cap, up to level 50.
- Alternate IVs represent a different specimen. The original inventory record
  is immutable and no candidate or result is saved.
- Candidate moves can retain the source moves, use PvPoke's published
  recommended moves, or use one or two legal charged moves and a legal fast
  move from the selected species' catalog movepool.

## Threat and simulation semantics

Threats come from the active league's ranked meta group and use the published
default league IVs and recommended moves. The result cards display each exact
threat build, including CP, level, IVs, and moves.

The one-on-one adapter receives the precise build, format, and independent
shield count for both combatants. Results show win/loss/tie, battle rating,
remaining HP, energy, and shields. Candidate battle ratings are compared with
the baseline for the same threat and shield scenario. The data version and
engine assumptions are shown with the results.

## Important limitations

- Results describe only the displayed one-on-one build and shield scenario.
  They are not averaged into a team score or general quality grade.
- The simulation does not model starting energy, switching, or a full
  three-Pokémon battle.
- Threat IVs and moves are fixed to published defaults; custom threats are not
  supported.
- Alternate builds and comparisons are temporary. Persisting plans would
  require a separate storage model and clear semantics for owned IVs versus a
  hypothetical specimen.
- This is matchup evidence for build choices, not an exact estimate of
  Stardust, Candy, Elite TM, or other resource costs.

## Files

- `src/domain/analysis/matchupBuildPlanning.ts` — candidate construction,
  threat selection, run bounds, and sequential simulation orchestration
- `src/domain/analysis/matchupBuildPlanning.test.ts` — candidate, threat,
  request, progress, cancellation, and partial-error coverage
- `src/domain/analysis/buildAnalysis.ts` — preserves published move order for
  recommended candidate builds
- `src/domain/simulation/teamRanker.ts` — shared default-build construction
  preserves the recommended charged-move order from PvPoke
- `src/features/analysis/MatchupBuildPlanner.tsx` — temporary comparison UI
- `src/features/analysis/InventoryAnalysisPage.tsx` — analysis route
  integration and stale-input invalidation
- `src/styles/modules/matchup-build-planning.css` — responsive layout

## Validation

Validated on 2026-09-30:

```text
npm test             41 files, 173 tests passed
npm run typecheck    passed
npm run lint         passed
npm run build        passed, including data and Cloudflare artifact checks
```

The production browser workflow could not start in the restricted environment:
Node received an EPERM listen error while binding its local server to
127.0.0.1. The production build and automated domain suite passed.
