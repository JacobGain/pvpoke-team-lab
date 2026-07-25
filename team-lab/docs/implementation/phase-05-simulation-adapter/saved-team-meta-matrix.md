# Saved-Team Meta Matrix Service

> **Status:** Implemented
> **Route:** `/teams/:teamId/simulation`
> **Last reviewed:** 2026-07-25

## Outcome

Phase 4 saved teams can now be transformed into exact Phase 5 TeamRanker
requests and evaluated against an explicit subset of the current validated
Open Great League meta.

This completes the Phase 5 application boundary:

```text
SavedTeam + inventory + catalog
        ↓
exact ordered build preparation
        ↓
explicit current-meta targets
        ↓
SavedTeamRankingService
        ↓
PvpokeTeamRankerAdapter
        ↓
measured translated matrix
```

The screen intentionally presents raw engine evidence. Coverage grades,
threat aggregation, core breakers, alternatives, and PvPoke-style scorecards
belong to Phase 6.

## Ordered team preparation

`prepareSavedTeamRankerRequest` resolves all three persisted positions in
order:

1. Lead
2. Safe switch
3. Closer

Every member must resolve to a live inventory and catalog record. Missing
members fail preparation instead of being dropped.

Current inventory records use their current analysis. Planned records use
their desired target analysis. The Phase 3 serializer then supplies:

- exact species/form and Shadow state;
- exact or explicitly selected level;
- CP and IVs;
- entered current or desired moves;
- current/planned provenance.

Ambiguous CP-to-level records continue to fail exact serialization rather than
silently choosing a level.

## Meta-target derivation

Targets are derived only from catalog entries that:

- belong to the current PvPoke Great League meta group;
- have default Great League IVs;
- have ranking metadata;
- resolve a recommended fast move;
- resolve at least one recommended charged move.

For every target, TeamLab calculates CP from the published level and IVs and
creates an exact `meta-default` simulation build.

Catalog order already follows upstream overall ranking. Taking the first N
targets therefore produces a deterministic top-meta subset for the current
data version.

The supported scopes are:

```text
Top 5
Top 10
Top 20
Top 48
```

If fewer entries are simulation-ready, the actual selected and available
counts remain explicit in the result.

## Measured application service

`SavedTeamRankingService` receives a prepared request and a TeamRanker adapter.
It measures the complete adapter execution and labels it:

| Duration | Label |
| --- | --- |
| ≤ 2 seconds | `within-interactive-budget` |
| > 2 and ≤ 10 seconds | `slow` |
| > 10 seconds | `very-slow` |

These are initial product budgets, not hidden engine timeouts. Results still
return at any duration.

Measurement includes engine readiness if the runtime has not yet bootstrapped.
Subsequent runs reuse loaded scripts and can therefore be faster.

## Application screen

Each complete saved-team card links to **Simulate**.

The matrix screen allows:

- target count selection;
- team shield selection;
- target shield selection;
- explicit execution;
- duration and performance display;
- selected/available target count;
- data version;
- target average rating;
- per-team-member matchup rating;
- outgoing/incoming fast-move damage;
- Attack differential;
- engine assumptions.

Scopes of 20 or 48 show a warning because upstream TeamRanker runs
synchronously and can temporarily block the browser tab.

Incomplete saved teams do not expose the simulation link and also fail safely
if reached directly.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/savedTeamRanking.ts` | Preparation, meta targets, scope, measurement |
| `src/domain/simulation/savedTeamRanking.test.ts` | Exact ordering, targets, and performance labels |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Matrix controls and raw results |
| `src/features/teams/SavedTeamsPage.tsx` | Complete-team simulation entry point |
| `src/app/router.tsx` | Saved-team simulation route |
| `src/styles/global.css` | Matrix controls and responsive behavior |

## Characterization coverage

The tests use three independently valid exact inventory records and prove:

- saved lead/switch/closer order becomes TeamRanker order;
- inventory builds retain `inventory-current` provenance;
- ranked meta targets are explicit and deterministic;
- target builds use published level, IVs, CP, and recommended moves;
- selected and available target counts are separate;
- shield settings survive preparation;
- service timing includes adapter execution;
- a six-second synchronous run is labeled `slow`;
- battle count equals team size × target size.

## Known limitations

- The screen shows raw matrix evidence, not a team-quality conclusion.
- Target weights are not yet applied.
- Every target currently contributes equally.
- Target count is rank-based rather than usage-weighted.
- The full 48-target scope means 144 synchronous battles for a team of three.
- There is no cancellation, progress callback, worker, or chunked scheduling.
- Results are not cached or persisted.
- The route does not yet translate species IDs to richer matchup cards.
- No upstream deep links are generated.
- Planned builds with no unique exact inferred level need a future explicit
  level-choice UI before they can simulate.

## Phase 6 handoff

Phase 6 can consume `SavedTeamRankerRun` to derive:

- coverage summaries;
- shared threats and core breakers;
- target-weighted scores;
- bulk, safety, and consistency evidence;
- alternatives.

That layer must retain the target scope, shield scenario, duration, assumptions,
and data version instead of presenting the matrix as universal truth.
