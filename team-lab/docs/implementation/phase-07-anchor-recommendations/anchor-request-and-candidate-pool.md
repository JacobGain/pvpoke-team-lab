# Anchor Request and Owned Candidate Pool

> **Phase:** Phase 7 — Anchor Recommendations  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab now has a stable input and discovery boundary for anchor-based
recommendations. A validated request resolves one or two owned anchors and
produces exact, current-catalog-valid partner candidates for a later static
pre-scorer.

This slice does not generate or score teams.

## Problem being solved

The recommender cannot safely begin with raw inventory records. A record may:

- be current or planned;
- resolve to a different target species;
- conflict with an anchor under species clause;
- be invalid against the latest catalog;
- map to an ambiguous exact level;
- lack published ranking evidence.

The first recommendation boundary must resolve those conditions before static
scoring or expensive simulations begin.

## Request contract

```text
RecommendationRequest
├── formatId: "great-league"
├── anchors: 1–2
│   ├── inventoryId
│   └── position: lead | switch | closer | flex
├── resultCount: 1–5
└── buildStatusScope
    ├── all
    ├── ready-now-only
    └── planned-only
```

The Zod contract rejects:

- zero or more than two anchors;
- duplicate inventory identities;
- two anchors locked to the same fixed position;
- result counts outside one through five;
- unsupported formats and build-status scopes.

`flex` is explicit rather than an absent position. Downstream ordering logic
can therefore distinguish “not fixed” from malformed input.

## Candidate-pool flow

```text
validated RecommendationRequest
        +
current inventory and catalog
        ↓
resolve and validate required anchors
        ↓
resolve selected current/planned species
        ↓
run current catalog-aware inventory validation
        ↓
derive Phase 3 build analysis
        ↓
serialize exact Phase 5 simulation build
        ↓
apply anchor species clause and build-status scope
        ↓
RecommendationCandidatePool
```

## Candidate contract

Every accepted anchor or partner carries:

- inventory and selected catalog identity;
- Pokédex number;
- current/planned and ready-now status;
- favorite status;
- exact level, CP, IVs, moves, and Shadow state;
- qualitative build requirements;
- optional overall rank, score, and rating;
- optional six-role scores;
- published matchup and counter evidence.

This is the input boundary for static pre-scoring. Static evidence remains
separate from the exact build so the next slice can explain which values came
from PvPoke defaults and which describe the owned specimen.

The pool also states whether one or two partners are required to complete a
team from the supplied anchors.

## Anchor behavior

Anchors are required constraints, so an invalid anchor rejects the complete
pool with `RecommendationAnchorError`.

Stable issue codes are:

- `anchor-not-found`
- `anchor-outside-build-status-scope`
- `anchor-catalog-validation`
- `anchor-exact-build-unavailable`
- `anchor-species-clause`

Two anchors are compared by catalog Pokédex number. Separate owned records,
normal/Shadow variants, or alternate forms cannot bypass species clause.

## Partner behavior

Non-anchor inventory records are filtered independently. Excluded records do
not prevent valid candidates from being used.

Stable exclusion codes are:

- `build-status-scope`
- `species-clause-with-anchor`
- `catalog-validation`
- `exact-build-unavailable`

Every returned partner is individually species-clause-safe against all
anchors. Partner-to-partner species clause is intentionally deferred to team
generation because the pool does not yet choose partner pairs.

## Prioritization

The deterministic discovery order is:

1. ready-now/current before planned;
2. favorite before non-favorite within the same readiness;
3. published overall rank, lowest rank number first;
4. species name;
5. inventory identity.

This order is not a team-quality score. It satisfies the product requirement
to favor ready-now builds while providing stable input to the next slice.

Unranked exact builds remain in the pool after ranked builds. The project plan
calls for ranking/role thresholds as a separate candidate-pipeline step, so
this slice does not silently turn ranking absence into ineligibility.

## Error handling

Current catalog validation catches removed species, invalid moves, impossible
CP, unavailable assumed IVs, and invalid planned evolutions.

Phase 3 analysis and Phase 5 exact serialization catch builds that cannot
produce a usable exact simulation request. In particular, an ambiguous
CP-to-level build is rejected rather than silently choosing the first level.

Required-anchor failures are aggregated and thrown. Non-anchor failures are
returned as exclusions so a later UI can explain why an owned record was not
considered.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/recommendations/contracts.ts` | Runtime request schema, anchor positions, result bounds, and build-status scope |
| `src/domain/recommendations/candidatePool.ts` | Anchor resolution, exact candidate preparation, species clause, exclusions, and ordering |
| `src/domain/recommendations/candidatePool.test.ts` | Request and pool characterization |

## Important decisions

- The request is not persisted or versioned in this slice.
- The pool reuses Phase 3 analysis and Phase 5 exact serialization instead of
  recreating build semantics.
- The current catalog is authoritative even when an inventory record carries
  an older source version.
- Planned inventory uses its target species and desired build.
- Static evidence may be absent; exact eligibility does not require a ranking.
- No score or “recommended” label exists before the scoring pipeline does.

## Rejected or deferred alternatives

- Generating every inventory combination was rejected by the project plan’s
  performance constraints.
- Species-only candidates were rejected because simulations require exact
  inventory builds.
- Silently choosing one ambiguous level was rejected by the Phase 5 exact-build
  contract.
- Applying an undocumented overall-rank cutoff in discovery was deferred to an
  explicit policy slice.
- Returning the same structure for anchors and partners without position
  metadata was rejected because fixed role constraints must survive.

## Performance considerations

The pool scans inventory once after building inventory and catalog maps.
Analysis ranking tables are cached by the existing Phase 3 implementation.

Exact build analysis is currently synchronous. Before inventories materially
exceed the MVP target, profiling should determine whether discovery or the
later pre-scorer needs worker execution.

## Validation

```bash
npm test -- --run src/domain/recommendations/candidatePool.test.ts
npm run typecheck
npm run lint
npm run build
```

Characterization covers:

- one and two anchors;
- flexible and fixed positions;
- one-to-five results;
- duplicate anchor and position rejection;
- exact current and planned build serialization;
- static evidence retention;
- ready-now ordering;
- ready-now-only filtering;
- missing anchors;
- species clause between anchors and between an anchor and partner.

Observed after the first slice:

```text
npm test          20 files, 53 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- The candidate-pool boundary itself does not generate teams or scores; its
  downstream static generator owns that policy.
- Pairwise species clause between partner candidates is evaluated during
  downstream team generation, not while records are pooled.
- Exact simulations and scorecard comparisons are not invoked by this
  subsystem.
- Exclusion diagnostics have no feature UI.
- The pool retains all valid records; downstream static policy owns work
  limits.

## Safe extension points

- Extend eligibility without changing exact candidate preparation.
- Add new static evidence fields without mixing them into exact builds.
- Preserve fixed/flexible position metadata for future ordering policies.
- Keep partner-to-partner species clause in team construction.
- Serialize only shortlisted finalists into existing TeamRanker requests.
- Include existing formula and policy versions before caching recommendation
  results.

## Follow-up work

The immediate follow-up was completed in
[Static candidate generation and pre-score](static-candidate-generation-and-pre-score.md).
The candidate pool now feeds a versioned policy, ordered team generator,
static pre-score, species-level deduplication, and diverse finalist selector.

Exact finalist simulation and the `/recommend` workflow now consume this
candidate boundary.

## Relevant commits

Not yet committed.
