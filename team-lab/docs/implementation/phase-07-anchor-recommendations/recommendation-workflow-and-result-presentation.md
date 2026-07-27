# Recommendation Workflow and Result Presentation

> **Phase:** Phase 7 — Anchor Recommendations  
> **Status:** Complete for MVP  
> **Route:** `/recommend`  
> **Last reviewed:** 2026-07-26

## Summary

TeamLab now exposes the complete anchor-recommendation pipeline as a user
workflow. A user can select one or two owned anchors, constrain their
positions, choose discovery and exact-simulation scope, monitor the bounded
finalist run, inspect evidence-rich ordered results, and explicitly save a
fully owned result as an ordinary saved team. An opt-in setting can also
simulate highly ranked teammates the user does not yet own.

The page distinguishes:

- owned-build discovery and exclusion counts;
- published static evidence used to shortlist finalists;
- exact TeamRanker scorecards used for final selection;
- TeamLab-authored selection formulas and explanation prose.

## Problem being solved

The first three Phase 7 slices produced a complete domain pipeline but no way
for a user to operate it. The UI needed to make expensive work and evidence
boundaries visible without introducing a second set of recommendation rules.

The workflow therefore had to:

- construct only the existing validated request contract;
- expose fixed and flexible anchor roles;
- make target and shield scope explicit;
- report synchronous finalist progress honestly;
- preserve usable partial results after cancellation or individual failures;
- explain strengths and tradeoffs from retained evidence;
- save only after an explicit user action.

## Workflow

```text
/recommend
    ↓
load current inventory and normalized catalog
    ↓
choose 1–2 anchors and role constraints
    +
choose result, build-status, target, and shield scope
    ↓
validated RecommendationRequest
    ↓
candidate pool → static generation
    ↓
display discovery and evidence-exclusion counts
    ↓
sequential exact finalist simulation
    ↕
progress events / cancel-before-next-finalist signal
    ↓
ordered selected results
    ↓
inspect evidence or explicitly save as SavedTeam
```

The route is linked from the home page. Inputs are disabled during a run so
the displayed request scope cannot drift from the in-flight service call.

## Controls

The page provides:

- one required owned anchor;
- an optional second distinct owned anchor;
- `flex`, Lead, Safe Switch, or Closer position per anchor;
- one through five requested results;
- combined, ready-now-only, or planned-only inventory scope;
- owned-only teammates or owned plus ranked PvPoke-default teammates;
- Top 5, 10, 20, or 48 current meta targets;
- zero, one, or two team shields;
- zero, one, or two target shields.

Large target scopes display a blocking-work warning. Invalid anchor,
build-scope, exact-build, and team-generation conditions use the existing
domain error messages.

## Progress and cancellation

The page supplies an `AbortController`, consumes
`RecommendationFinalistProgress`, and yields to the browser event loop between
finalists.

The progress panel shows:

- completed or attempted finalists;
- total bounded finalists;
- current status;
- a native progress bar.

“Cancel after current finalist” reflects the actual engine boundary. The
upstream TeamRanker call is synchronous and cannot be interrupted safely once
started. Cancellation prevents the next finalist from starting; completed
results remain available.

## Result presentation

Every selected result displays:

- exact Lead, Safe Switch, and Closer order;
- CP, level, IVs, moves, readiness, and owned/ranked-default provenance;
- qualitative build requirements;
- final TeamLab selection score;
- Coverage, Bulk, Safety, and Consistency grades and scores;
- evidence-derived reasons and tradeoffs;
- highest-priority exact-matrix threats;
- threat-grouped owned and unowned alternatives;
- formula and assumption details;
- exact PvPoke Team Builder link.

The run summary also reports completed and failed finalists, selected-result
shortfall, cancellation, diversity relaxation, and catalog data version.
Individual failed finalist messages remain available in an expandable panel.

## Explanation policy

`explainRecommendation` is deterministic presentation logic over a completed
finalist. It does not call a language model and does not create new battle
claims.

Its reasons currently disclose:

- exact selected-target coverage;
- published role suitability;
- ready-now member count.

Its tradeoffs disclose available evidence such as:

- the highest-priority exact threat;
- low safety;
- planned-member build requirements;
- exact-moveset consistency limitations.

Every explanation includes selected target count, shield scenario, and data
version. The headline labels the score as the current TeamLab formula rather
than an upstream PvPoke rating.

## Saving a result

Recommendations are ephemeral. Clicking “Save this team” creates a normal
`SavedTeam` with:

- the exact selected Lead, Switch, and Closer inventory IDs;
- a generated, schema-bounded team name;
- provenance notes containing data version, selection score, and explanation
  headline.

The existing saved-team factory revalidates inventory references and species
clause against the current catalog. The existing repository mutation persists
the result to IndexedDB and invalidates saved-team queries.

No recommendation result is persisted automatically. Once saved, the team
uses the normal edit, list, and exact-analysis workflows.

A result containing a ranked-default teammate remains fully simulatable and
can open in PvPoke, but its save action is disabled. The result names how many
ranked picks must first be added to inventory; TeamLab does not fabricate
saved inventory UUIDs or silently create records.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/features/recommendations/RecommendationPage.tsx` | Request controls, orchestration, progress, results, errors, links, and explicit save action |
| `src/domain/recommendations/explanations.ts` | Deterministic evidence-derived headline, reasons, tradeoffs, and scope |
| `src/domain/recommendations/finalistSimulation.ts` | Progress/cancellation contract and partial-result behavior |
| `src/app/router.tsx` | `/recommend` route |
| `src/app/routes/HomePage.tsx` | Home-page entry point |
| `src/styles/global.css` | Desktop and responsive workflow/result presentation |
| `src/domain/teams/factory.ts` | Saved-team validation during explicit conversion |
| `src/features/teams/savedTeamQueries.ts` | IndexedDB persistence mutation and query invalidation |

## Important decisions

- The page composes existing domain functions rather than duplicating request,
  shortlist, simulation, score, or diversity policy.
- Static and exact stages remain visibly separate.
- Exclusions are summarized by discovery and published-evidence stage.
- Explanation statements are derived from stored evidence and scope.
- Cancellation language matches the synchronous engine boundary.
- Saving is an explicit conversion into the established saved-team model.
- Results are responsive cards rather than a dense matrix-first interface.

## Rejected or deferred alternatives

- Automatically persisting every run was rejected because recommendation
  cache identity and invalidation are not designed.
- Treating static finalists as final results was rejected because exact owned
  build analysis is the point of the finalist stage.
- Claiming immediate cancellation was rejected because TeamRanker is
  synchronous.
- Creating a recommendation-specific team store was rejected because selected
  results become ordinary saved teams.
- Rendering every exclusion message inline was deferred to avoid overwhelming
  the first workflow; stage counts and fatal errors are visible.

## Error handling

- Inventory or catalog loading errors stop the workflow.
- An empty inventory directs the user to add the first owned anchor.
- Request, anchor, and candidate errors appear as workflow errors.
- Zero static finalists produces an explicit no-eligible-team message.
- One exact finalist failure does not hide successful results.
- Save errors remain separate from recommendation-run errors.
- Saved buttons disable after success to prevent duplicate clicks within the
  current result view.
- Ranked-default results disable saving until every member exists in inventory.

## Performance considerations

Static generation and TeamRanker execution remain synchronous. The page:

- defaults to Top 5 targets;
- keeps the existing six-to-fifteen finalist bound;
- warns at Top 20 and Top 48;
- runs finalists sequentially;
- yields between finalists for progress painting and cancellation.

This improves operability but does not make a single expensive finalist
non-blocking. Phase 8 should profile representative 100-record inventories and
move engine work behind a worker or chunked boundary if needed.

## Validation

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Characterization covers progress events, cancellation before the next
finalist, partial-result behavior, and evidence-derived explanation output.
Type checking and production build validate the complete route and saved-team
integration.

Observed after this slice:

```text
npm test          22 files, 63 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- An in-flight synchronous TeamRanker finalist cannot be interrupted.
- Individual nonfatal exclusion messages are counted but not expanded.
- Results and request settings are not retained across navigation or refresh.
- Recommendation runs are not cached or historically browsable.
- Score and explanation policy remain English-only and version-one
  heuristics.
- Browser-level interaction tests are not yet configured.

## Safe extension points

- Add expandable exclusion details from the existing stable diagnostic codes.
- Store request controls in URL search parameters without changing the domain
  request.
- Add worker execution while preserving progress and cancellation contracts.
- Add browser-level tests around run, cancel, and save behavior.
- Cache results only with data, policy, score, request, and exact-build
  identities in the key.

## Follow-up work

Phase 8 should profile the workflow with representative inventory sizes,
decide whether worker execution is required, add critical browser-level
coverage, and complete the MVP hardening pass.

## Relevant commits

Not yet committed.
