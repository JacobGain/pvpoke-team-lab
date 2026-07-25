# Phase 7 — Anchor Recommendations

> **Status:** In progress  
> **Project-plan phase:** Phase 7: anchor recommendations  
> **Last reviewed:** 2026-07-25

## Objective

Generate useful, distinct, inventory-constrained Open Great League teams around
one or two owned anchors without exhaustively simulating every possible team.

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
- current/planned selected-build resolution
- current-catalog inventory validation
- exact simulation-ready build serialization
- anchor legality and Pokédex-identity species-clause validation
- individually anchor-safe owned partner pool
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

## Out of scope

- finalist simulation
- exact scorecard comparison
- final-result diversity
- explanations and result presentation
- recommendation persistence or caching
- `/recommend` UI

## Implementation records

- [Anchor request and owned candidate pool](anchor-request-and-candidate-pool.md)
- [Static candidate generation and pre-score](static-candidate-generation-and-pre-score.md)

## Important decisions

- Recommendation requests are ephemeral runtime contracts, not persisted
  records.
- `flex` explicitly represents an anchor with no fixed team position.
- Ready now means a current inventory build; planned records remain available
  unless the request narrows the build-status scope.
- Every candidate is validated against the current catalog and serialized into
  an exact Phase 5 build before entering the pool.
- Invalid anchors fail the complete request. Invalid non-anchor records are
  excluded with stable diagnostic codes.
- The pool retains unranked builds, while the static partner policy requires
  published evidence. Required anchors bypass that partner threshold.
- Team generation enforces partner-to-partner species clause and retains one
  highest-ranked exact trio per Pokédex-species membership.
- Static policy and score formulas have independent version identifiers.
- Static pre-scores select exact-simulation finalists and are not final
  recommendation scorecards.

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
ordering, pre-score formulas, deduplication, and finalist diversity.

Observed after the second slice:

```text
npm test          21 files, 58 tests passed
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
- Exclusions are returned to the application boundary but have no UI yet.
- Build requirements remain the qualitative Phase 3 requirements.
- Candidate-pool order is discovery priority; static team order is only a
  pre-simulation heuristic.
- Static thresholds and score weights are initial TeamLab heuristics.
- Published matchup evidence represents default builds and selected key
  matchups rather than exact complete matrices.
- Exact finalist simulation has not run.

## Exit criteria

- [x] One or two owned anchors are structurally represented.
- [x] Fixed and flexible anchor positions are represented.
- [x] One-to-five requested results are validated.
- [x] Ready-now/current builds are prioritized.
- [x] Planned-only and ready-now-only scopes are supported.
- [x] Exact, anchor-safe owned candidates can feed static pre-scoring.
- [x] Ranking, role, and complementarity policies produce plausible teams.
- [x] Candidate teams receive static pre-scores.
- [ ] Finalists are evaluated through exact TeamRanker simulations.
- [ ] One-to-five ordered, materially distinct results are returned.
- [ ] Recommendations include explanations, scorecards, threats, alternatives,
      and build requirements.
- [ ] The anchor recommendation workflow is available in the UI.

## Next phase dependencies

The next Phase 7 slice can consume the bounded
`StaticRecommendationGeneration.finalists`, prepare exact TeamRanker requests,
derive Phase 6 scorecards, and select the requested one-to-five results without
discarding static-score or policy provenance.

## Relevant commits

Not yet committed.
