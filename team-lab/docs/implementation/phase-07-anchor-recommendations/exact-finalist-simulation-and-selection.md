# Exact Finalist Simulation and Selection

> **Phase:** Phase 7 — Anchor Recommendations  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab can now simulate every bounded static finalist against one explicit
Open Great League meta and shield scope, derive the existing Phase 6
scorecard, and select the requested one-to-five final domain results.

Each result retains:

- its exact ordered inventory builds;
- static policy and pre-score provenance;
- the complete TeamRanker run;
- Coverage, Bulk, Safety, and Consistency evidence;
- threats and core breakers;
- owned and unowned alternatives;
- build requirements through its candidate members;
- a versioned final selection score.

The workflow remains domain/application logic. A recommendation UI and
user-facing explanations are separate work.

## Problem being solved

Static PvPoke rankings are useful for reducing the search space but cannot
prove how the user's exact IVs and entered moves perform.

The finalist layer must:

- reuse the same target builds and assumptions as saved-team analysis;
- reject stale static candidates after upstream data changes;
- run exact builds without creating fake persisted saved teams;
- preserve individual failures;
- compare complete scorecards transparently;
- return the requested number of materially distinct results when possible.

## Reusable TeamRanker boundary

Phase 5 preparation previously combined two responsibilities:

- resolving a persisted saved team;
- preparing any ordered exact team against explicit meta targets.

The shared behavior now lives in:

```text
prepareTeamRankerRequest
```

Its input is:

```text
three ordered ExactSimulationBuild records
current PokemonCatalog
context
  kind: saved-team | recommendation
  id
  name
target limit
team shields
target shields
```

It produces the existing TeamRanker request, scope, exact-stat evidence, target
evidence, and data-version provenance.

`prepareSavedTeamRankerRequest` remains the saved-team adapter. It resolves
inventory references and then delegates to the generic boundary. Existing
saved-team UI and Phase 6 analysis continue using compatibility exports.

Recommendation finalists use context kind `recommendation` and their stable
exact team key. No temporary saved record or synthetic UUID is persisted.

## Finalist flow

```text
StaticRecommendationGeneration.finalists
        ↓
verify static/catalog data version equality
        ↓
prepare one exact ordered TeamRanker request per finalist
        ↓
run finalists sequentially through the singleton-safe adapter
        ↓
analyzeTeamRankerMatrix
        ↓
derive Phase 6 alternatives
        ↓
versioned final selection score
        ↓
exact-score ordering and final-result diversity
        ↓
requested one-to-five selected results
```

All finalists use the same target limit and team/target shield counts supplied
to the service. Each completed run retains the exact request and scope.

## Data-version safety

`RecommendationFinalistSimulationService` compares:

```text
staticGeneration.dataVersion
catalog.dataVersion
```

A mismatch throws `RecommendationFinalistDataVersionError` before TeamRanker
is invoked. TeamLab never evaluates a shortlist discovered from one ranking
version against a silently different catalog.

## Phase 6 analysis reuse

`analyzeTeamRankerMatrix` is the generic name for the Phase 6 analysis
function. `analyzeSavedTeamMatrix` remains an alias for existing consumers.

Every successful recommendation finalist therefore receives the same:

- target coverage and positive matchup evidence;
- exact-stat bulk heuristic;
- answer-redundancy and safe-switch safety heuristic;
- published consistency score;
- major threats, core breakers, and team walls;
- shield, target, engine, and data-version assumptions.

`deriveTeamAlternatives` then attaches the existing threat-grouped owned exact
records and unowned PvPoke-default alternatives.

## Final selection score

Score version:

```text
recommendation-final-score-v1
```

Formula:

```text
25% Phase 6 Coverage
15% Phase 6 Bulk
20% Phase 6 Safety
10% Phase 6 Consistency
30% versioned static pre-score
```

Coverage and Safety come from exact TeamRanker matchup distributions. Bulk
uses exact effective Defense and HP. Consistency remains published PvPoke
default-build evidence. The static component retains role, published
strength, complementarity, and readiness evidence.

The final score is TeamLab selection policy, not an upstream PvPoke grade.
Inputs, weights, method, and score version remain on every result.

## Result ordering

Successful finalists are ordered by:

1. final selection score;
2. exact Coverage score;
3. exact Safety score;
4. static pre-score;
5. stable exact team identity.

Only successful exact runs can be selected.

## Final-result diversity

Static generation has already removed duplicate Pokédex-species trios.

Final selection initially allows each optional two-Pokémon core once. When two
anchors are required, their unavoidable anchor-anchor core is exempt.

If strict core diversity cannot fill the requested result count, selection
adds the next highest-scoring species-distinct teams and marks
`selectionDiversityRelaxed: true`. Diversity is relaxed only enough to fill
the request.

If too few finalists simulate successfully, the service returns:

```text
selectionShortfall =
  requestedResultCount - selected result count
```

It does not fabricate or repeat a result.

## Failure behavior

Each finalist is prepared and run inside an isolated failure boundary.

Failures retain:

- exact team key;
- species team key;
- error message.

Successful finalists remain usable when another finalist fails. If every
finalist fails, the service returns no selected results and an explicit
shortfall.

Runs are sequential because the upstream TeamRanker adapter wraps a mutable
global singleton. Sequential orchestration also provides a clean future
progress/cancellation boundary.

## Contracts

`SimulatedRecommendationFinalist` contains:

- `staticTeam`
- `run`
- `analysis`
- `alternatives`
- `finalScore`

`RecommendationFinalistSimulation` contains:

- complete static generation provenance;
- exact target/shield options;
- score-ordered successful finalists;
- failures;
- selected results;
- requested count and shortfall;
- diversity-relaxation state;
- data version and assumptions.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/teamRanker.ts` | Generic exact ordered-team preparation, meta targets, evidence, scope, and timed service |
| `src/domain/simulation/savedTeamRanking.ts` | Saved-team resolution and compatibility exports |
| `src/domain/teamAnalysis/teamAnalysis.ts` | Generic TeamRanker matrix analysis and saved-team alias |
| `src/domain/recommendations/finalistSimulation.ts` | Finalist orchestration, scoring, failures, alternatives, and final diversity |
| `src/domain/recommendations/finalistSimulation.test.ts` | Exact recommendation characterization |

## Important decisions

- Recommendations reuse the existing TeamRanker and Phase 6 boundaries.
- No fake saved team is created or persisted.
- All finalists share one explicit target and shield scope.
- Static/catalog version mismatch is fatal before engine work.
- Final score retains both exact and static evidence instead of discarding the
  discovery rationale.
- Individual finalist failures are data, not a reason to hide successful
  results.
- Final diversity can relax repeated optional cores but never duplicate a
  species trio.

## Rejected or deferred alternatives

- Reimplementing meta target derivation in recommendations was rejected because
  it could drift from saved-team analysis.
- Rebuilding temporary `SavedTeam` records was rejected because recommendations
  are not persisted teams.
- Using only static pre-score for final selection was rejected because exact
  inventory simulation is an MVP requirement.
- Using only Coverage was rejected because the default objective balances the
  full Phase 6 scorecard and static role/meta context.
- Parallel orchestration was rejected because the upstream adapter is
  singleton-backed and serializes work anyway.
- Persisting recommendation results was deferred until invalidation, formula
  versions, and schema behavior are designed.

## Performance considerations

The static slice supplies at most fifteen finalists. With Top 48 scope, this
can still require:

```text
15 finalists × 3 members × 48 targets = 2,160 battles
```

The service is intentionally sequential and currently exposes no progress,
cancellation, batching, or worker execution. The future UI should begin with a
smaller explicit target scope and must add progress/cancellation before
presenting large runs as routine.

## Validation

```bash
npm test -- --run src/domain/recommendations/finalistSimulation.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Characterization verifies:

- exact static ordering reaches TeamRanker unchanged;
- recommendation context and explicit shield scope;
- generic Phase 5 target preparation;
- Phase 6 analysis and alternatives;
- final score version and evidence;
- stale-data rejection before adapter calls;
- isolated engine failure reporting;
- requested-result shortfalls;
- exact-score ordering;
- minimal diversity relaxation to fill a requested count.

Observed after this slice:

```text
npm test          22 files, 62 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- No progress callback or cancellation signal exists.
- TeamRanker runs synchronously inside the upstream browser runtime.
- Large finalist/meta combinations can block the tab.
- The target scope remains unweighted.
- Final score weights are initial TeamLab policy requiring representative-team
  characterization.
- A systemic engine failure is recorded once per attempted finalist.
- Results are derived in memory and not cached or persisted.
- No recommendation explanations or UI exist yet.
- Exact unowned substitutions are not part of inventory-constrained finalist
  generation.

## Safe extension points

- Add progress events around each sequential finalist.
- Accept an abort signal before starting each next finalist.
- Add formula version to future cache keys.
- Present static and exact evidence separately in the UI.
- Generate explanation statements from stored score dimensions and threats.
- Persist a selected result only by explicitly converting it into a saved
  team.

## Follow-up work

The next slice should build the `/recommend` workflow:

1. select one or two anchors and fixed/flexible positions;
2. choose result count, build scope, target count, and shields;
3. display discovery exclusions and static finalists;
4. run exact finalists with progress and cancellation;
5. present ordered results, scorecards, threats, alternatives, requirements,
   assumptions, and diversity/shortfall states;
6. allow a selected result to become a saved team explicitly.

## Relevant commits

Not yet committed.

