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

## Out of scope

- ranking or role thresholds
- complementarity formulas
- static team pre-scores
- ordered team generation
- pairwise species-clause validation between partner candidates
- finalist simulation
- recommendation diversity
- explanations and result presentation
- recommendation persistence or caching
- `/recommend` UI

## Implementation records

- [Anchor request and owned candidate pool](anchor-request-and-candidate-pool.md)

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
- The pool does not exclude unranked builds. Ranking and role thresholds belong
  to the next explicit recommendation-policy slice.
- Partner candidates are species-clause-safe against all anchors. The future
  team generator must still enforce species clause between selected partners.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Focused characterization verifies request bounds, duplicate anchor and
position rejection, exact build/evidence preparation, ready-now ordering,
build-status filtering, missing-anchor rejection, and species clause.

Observed after the first slice:

```text
npm test          20 files, 53 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- The pool is not yet a recommendation and assigns no quality score.
- A large inventory is analyzed synchronously.
- Ambiguous CP-to-level records cannot become exact candidates until an
  explicit level-selection workflow exists.
- Exclusions are returned to the application boundary but have no UI yet.
- Build requirements remain the qualitative Phase 3 requirements.
- Candidate order is discovery priority, not predicted team performance.

## Exit criteria

- [x] One or two owned anchors are structurally represented.
- [x] Fixed and flexible anchor positions are represented.
- [x] One-to-five requested results are validated.
- [x] Ready-now/current builds are prioritized.
- [x] Planned-only and ready-now-only scopes are supported.
- [x] Exact, anchor-safe owned candidates can feed static pre-scoring.
- [ ] Ranking, role, and complementarity policies produce plausible teams.
- [ ] Candidate teams receive static pre-scores.
- [ ] Finalists are evaluated through exact TeamRanker simulations.
- [ ] One-to-five ordered, materially distinct results are returned.
- [ ] Recommendations include explanations, scorecards, threats, alternatives,
      and build requirements.
- [ ] The anchor recommendation workflow is available in the UI.

## Next phase dependencies

The next Phase 7 slice can consume `RecommendationCandidatePool` to define
explicit ranking/role eligibility thresholds, complementary matchup evidence,
plausible ordered team generation, and a versioned static pre-score. It should
not invoke TeamRanker until the static pipeline has reduced the candidate set.

## Relevant commits

Not yet committed.
