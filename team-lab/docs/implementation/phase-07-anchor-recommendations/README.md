# Phase 7 — Anchor Recommendations

> **Status:** Complete for MVP
> **Project-plan phase:** Phase 7: anchor recommendations  
> **Last reviewed:** 2026-07-26

## Objective

Generate useful, distinct Open Great League teams around one or two owned
anchors without exhaustively simulating every possible team. Teammates may be
restricted to inventory or optionally include ranked PvPoke-default builds.

The phase must preserve the distinction between:

- inexpensive static PvPoke evidence used for discovery and pre-scoring;
- exact owned-build simulations used for finalists;
- TeamLab recommendation policy and explanations.

## Implemented scope

- runtime-validated recommendation request contract
- one-or-two distinct owned anchor requirement
- flexible or fixed lead/switch/closer anchor positions
- configurable one-to-five result count
- all, ready-now-only, and planned-only build scopes
- owned-only or owned-plus-ranked teammate scope
- current/planned selected-build resolution
- current-catalog inventory validation
- exact simulation-ready build serialization
- anchor legality and Pokédex-identity species-clause validation
- individually anchor-safe owned partner pool
- exact, explicitly theoretical ranked-default partner builds
- deterministic ready-now, favorite, and overall-rank prioritization
- static overall, role, matchup, and counter evidence boundary
- explicit non-anchor exclusion diagnostics
- versioned partner ranking and role eligibility policy
- bounded partner and generated-team work limits
- partner-to-partner Pokédex species clause
- fixed-anchor and best-fit flexible role ordering
- versioned static complementarity, role, strength, and readiness pre-score
- species-trio deduplication
- bounded optional-core-diverse finalist selection
- reusable saved-team/recommendation TeamRanker preparation boundary
- static/catalog data-version gate
- sequential exact finalist TeamRanker orchestration
- generic Phase 6 scorecard analysis
- threat-grouped owned and unowned alternatives per finalist
- versioned exact/static final selection score
- isolated finalist failure reporting
- requested-result selection, diversity relaxation, and shortfall reporting
- per-finalist progress events and cooperative cancellation between finalists
- deterministic user-facing reasons, tradeoffs, and scope explanations
- `/recommend` anchor, role, result, build-scope, meta, and shield controls
- discovery, evidence-exclusion, progress, failure, shortfall, and diversity UI
- ordered exact-build results with scorecards, threats, alternatives,
  requirements, provenance, and PvPoke Team Builder links
- explicit conversion of a selected recommendation into a persisted saved team
- save guard for teams containing ranked teammates not yet in inventory
- responsive recommendation result presentation

## Out of scope

- recommendation persistence or caching
- interruption of a synchronous TeamRanker call already in progress
- Web Worker execution or exact-battle chunking
- saved recommendation histories

## Implementation records

- [Anchor request and candidate pool](anchor-request-and-candidate-pool.md)
- [Static candidate generation and pre-score](static-candidate-generation-and-pre-score.md)
- [Exact finalist simulation and selection](exact-finalist-simulation-and-selection.md)
- [Recommendation workflow and result presentation](recommendation-workflow-and-result-presentation.md)

## Important decisions

- Recommendation requests are ephemeral runtime contracts, not persisted
  records.
- `flex` explicitly represents an anchor with no fixed team position.
- Ready now means a current inventory build; planned records remain available
  unless the request narrows the build-status scope.
- Every candidate is validated against the current catalog and serialized into
  an exact Phase 5 build before entering the pool.
- Opt-in ranked partners use a complete `meta-default` build and rank-first
  discovery order, while owned-only discovery retains ready-now prioritization.
- Invalid anchors fail the complete request. Invalid non-anchor records are
  excluded with stable diagnostic codes.
- The pool retains unranked builds, while the static partner policy requires
  published evidence. Required anchors bypass that partner threshold.
- Team generation enforces partner-to-partner species clause and retains one
  highest-ranked exact trio per Pokédex-species membership.
- Static policy and score formulas have independent version identifiers.
- Static pre-scores select exact-simulation finalists and are not final
  recommendation scorecards.
- Saved teams and recommendations share one generic ordered-build TeamRanker
  preparation boundary.
- Final selection combines the complete Phase 6 scorecard with static
  provenance under a separate versioned formula.
- Exact result diversity is strict first and relaxes optional-core repetition
  only when necessary to fill the requested count.
- Recommendation prose is derived only from retained evidence and explicitly
  states the selected target, shield, and data-version scope.
- Cancellation is cooperative: it prevents the next finalist from starting
  but cannot interrupt the upstream synchronous engine mid-finalist.
- Recommendation results remain ephemeral until the user explicitly saves one
  through the existing saved-team factory and repository.
- A theoretical result can be simulated in TeamLab, but cannot be saved until
  every ranked-default member has an inventory record.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Focused characterization verifies request bounds, duplicate anchor and
position rejection, exact build/evidence preparation, ready-now ordering,
build-status filtering, missing-anchor rejection, species clause, eligibility,
ordering, pre-score formulas, deduplication, finalist diversity, exact
TeamRanker preparation, Phase 6 reuse, failure isolation, final scoring,
result selection, progress events, cancellation, and explanation output.

Observed after the fourth slice:

```text
npm test          22 files, 63 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- Static finalist candidates are not final recommendations or exact
  scorecards.
- A large inventory is analyzed synchronously.
- Ambiguous CP-to-level records cannot become exact candidates until an
  explicit level-selection workflow exists.
- Build requirements remain the qualitative Phase 3 requirements.
- Candidate-pool order is discovery priority; static team order is only a
  pre-simulation heuristic.
- Static thresholds and score weights are initial TeamLab heuristics.
- Published matchup evidence represents default builds and selected key
  matchups rather than exact complete matrices.
- Exact finalist work is sequential. Cancellation takes effect only before
  the next finalist.
- Large finalist/meta scopes can block the browser runtime.
- Final selection weights are initial TeamLab heuristics.
- Exclusion counts are visible, but individual exclusion messages are not yet
  expanded in the page.
- Recommendation runs and unsaved results remain in memory.

## Exit criteria

- [x] One or two owned anchors are structurally represented.
- [x] Fixed and flexible anchor positions are represented.
- [x] One-to-five requested results are validated.
- [x] Ready-now/current builds are prioritized.
- [x] Planned-only and ready-now-only scopes are supported.
- [x] Exact, anchor-safe owned candidates can feed static pre-scoring.
- [x] Ranking, role, and complementarity policies produce plausible teams.
- [x] Candidate teams receive static pre-scores.
- [x] Finalists are evaluated through exact TeamRanker simulations.
- [x] One-to-five ordered, materially distinct domain results are returned
      when enough finalists succeed.
- [x] Recommendations include explanations, scorecards, threats, alternatives,
      and build requirements.
- [x] The anchor recommendation workflow is available in the UI.

## Next phase dependencies

Phase 8 can harden the completed MVP workflow with representative 100-record
profiling, worker or chunked engine execution where needed, broader responsive
verification, and critical browser-level workflow tests. Recommendation
caching remains deferred until its invalidation and formula-version policy is
designed.

## Relevant commits

Not yet committed.
