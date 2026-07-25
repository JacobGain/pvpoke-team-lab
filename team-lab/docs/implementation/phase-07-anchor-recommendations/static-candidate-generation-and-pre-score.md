# Static Candidate Generation and Pre-Score

> **Phase:** Phase 7 — Anchor Recommendations  
> **Status:** Implemented  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab can now turn an exact anchor candidate pool into plausible ordered
teams and a bounded, diverse finalist set for later exact simulation.

The pipeline uses versioned TeamLab policy over published PvPoke ranking,
role, matchup, and counter evidence. Its score is a pre-score used only to
choose simulation finalists. It is not a final recommendation scorecard.

## Problem being solved

Even after anchor and exact-build validation, a 100-record inventory can
produce thousands of possible partner combinations and role orders. Sending
every combination through synchronous TeamRanker would block the browser and
ignore the project plan's shortlist-first requirement.

The static layer must:

- remove partners without useful ranking/role evidence;
- enforce species clause between selected partners;
- honor fixed anchor positions;
- choose plausible roles for flexible members;
- rank teams with transparent static evidence;
- remove repeated species trios;
- bound and diversify the teams sent to exact simulation.

## Static pipeline

```text
RecommendationCandidatePool
        ↓
partner ranking and role eligibility
        ↓
bounded ready-now-prioritized partner set
        ↓
one- or two-partner combinations
        ↓
Pokédex species clause
        ↓
anchor-aware lead/switch/closer assignment
        ↓
versioned static pre-score
        ↓
species-trio deduplication
        ↓
optional-core diversity
        ↓
bounded exact-simulation finalists
```

## Initial policy

Policy version:

```text
recommendation-static-policy-v1
```

Default partner eligibility:

- published overall and role evidence is required;
- overall rank must be 250 or better;
- at least one Lead, Switch, or Closer score must be 50 or higher.

Required anchors bypass partner thresholds because they are user constraints.
An unranked favorite can therefore remain an anchor while its suggested
partners still come from a competitive static shortlist.

Work limits:

```text
eligible partners considered: 40
unique static teams retained: 250
finalist target: requested results × 3
minimum finalist target: 6
maximum finalist target: 15
optional core repeats: 2
```

For one anchor, at most 780 partner pairs are considered after the 40-partner
cap. Two anchors require only one partner at a time.

Policy values and score weights are runtime checked. Limits must be positive,
the role threshold must be within zero through 100, and score weights must be
non-negative and total one.

## Role assignment

For every legal three-member set, TeamLab evaluates the six possible orders.

Fixed anchors must remain in their requested Lead, Switch, or Closer position.
Flexible anchors and partners are assigned to maximize the sum of published
PvPoke scores for:

- Lead in the first position;
- Switch in the second position;
- Closer in the third position.

Missing role evidence contributes no assignment value. Ties use stable
inventory-identity ordering.

The selected order is a static role hypothesis. Exact TeamRanker evidence and
three-on-three switching behavior have not been evaluated yet.

## Static pre-score

Score version:

```text
recommendation-static-score-v1
```

The total score is:

```text
40% complementarity
30% assigned-role suitability
20% published overall strength
10% readiness
```

### Complementarity

Known threats are the union of published counters whose subject-side rating is
below 500.

A threat is answered when any member has that species in its published
matchups with a subject-side rating above 500.

```text
threat coverage =
  answered published counter species / known counter species

shared-weakness avoidance =
  known counter species threatening fewer than two members / known counters

complementarity =
  70% threat coverage + 30% shared-weakness avoidance
```

When no counter evidence exists, complementarity is zero rather than silently
claiming perfect coverage.

### Role suitability

Role suitability is the average available published score for each assigned
Lead, Switch, or Closer position. Evidence count remains explicit when an
anchor lacks ranking data.

### Meta strength

Meta strength is the average available PvPoke overall score. Missing anchor
evidence is omitted and disclosed through evidence count.

### Readiness

Readiness is the percentage of members using current builds. Planned exact
builds remain eligible under combined or planned scopes but receive no
ready-now credit.

## Redundancy and finalist diversity

Teams are first ranked by:

1. total pre-score;
2. complementarity;
3. role suitability;
4. favorite-record count;
5. stable exact team identity.

Only the highest-ranked exact inventory trio is retained for a given set of
three Pokédex numbers. Multiple specimens or forms therefore do not masquerade
as materially different species teams.

Finalists are selected in score order. An optional two-member core may appear
at most twice. When two anchors are required, their unavoidable anchor-anchor
core is exempt from this limit.

The finalist target is three times the requested result count, bounded from
six through fifteen. Fewer finalists may be returned when the inventory or
diversity rule cannot supply the target.

## Contracts

`StaticRecommendationTeam` retains:

- exact and species-level team keys;
- ordered Lead, Switch, and Closer candidates;
- required anchor inventory IDs;
- score version and total pre-score;
- all four score dimensions;
- formulas, evidence counts, and assumptions.

`StaticRecommendationGeneration` retains:

- complete policy and data version;
- eligible, considered, and omitted partner counts;
- stable eligibility exclusions;
- generated, unique, and retained team counts;
- ranked static teams;
- finalist target and diverse finalists;
- explicit “not simulated” assumptions.

## Eligibility errors

Non-anchor eligibility exclusions use stable codes:

- `ranking-unavailable`
- `overall-rank-threshold`
- `role-score-threshold`

An exclusion does not abort generation. It remains inspectable for a future
recommendation UI.

Invalid custom policy throws `RangeError` before candidate processing.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/recommendations/staticTeamGeneration.ts` | Policy, eligibility, ordering, formulas, deduplication, and finalist diversity |
| `src/domain/recommendations/staticTeamGeneration.test.ts` | Static pipeline characterization |
| `src/domain/recommendations/candidatePool.ts` | Exact owned-build and static-evidence input boundary |

## Important decisions

- Anchors are constraints and bypass partner competitiveness thresholds.
- Unranked partners are excluded because the initial pre-score cannot compare
  them transparently.
- Eligibility checks maximum Lead/Switch/Closer suitability before ordering;
  the assigned role score then affects the pre-score.
- Matchup and counter evidence is treated as published default-build evidence,
  not exact inventory simulation.
- Rating 500 is neutral; only values strictly above or below count.
- Species-trio deduplication uses Pokédex number, matching species clause.
- Policy and score versions are separate so thresholds and formulas can evolve
  independently.

## Rejected or deferred alternatives

- Exhaustive exact simulation was rejected for browser responsiveness.
- Overall rank alone was rejected because it does not establish role fit.
- Selecting only the highest pre-score without diversity was rejected because
  repeated cores would consume finalist capacity.
- Treating static pre-score as the Phase 6 scorecard was rejected because its
  evidence and purpose are different.
- Applying meta weights was deferred because current catalog counter/matchup
  evidence has no TeamLab-owned weighting contract.

## Performance considerations

With one anchor and 40 eligible partners, the largest initial combination set
is `C(40, 2) = 780`. Each team evaluates at most six orders. Species-level
deduplication and the 250-team retention cap occur before finalist selection.

This is synchronous domain work. It should be profiled with representative
100-record inventories before increasing the partner cap or adding richer
static evidence.

## Validation

```bash
npm test -- --run src/domain/recommendations/staticTeamGeneration.test.ts
npm run typecheck
npm run lint
npm run build
```

Characterization verifies:

- flexible role assignment;
- two fixed anchors;
- published ranking and role exclusions;
- invalid policy rejection;
- exact pre-score dimensions and version;
- counter coverage and shared-weakness evidence;
- partner-to-partner species clause;
- species-trio deduplication across multiple inventory specimens;
- optional-core finalist limits.

Observed after this slice:

```text
npm test          21 files, 58 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- Published matchups and counters are selected PvPoke evidence, not a complete
  target matrix.
- Static ratings describe default PvPoke builds rather than exact IVs/moves.
- Initial rank, role, work-limit, diversity, and score weights are TeamLab
  heuristics requiring representative-team characterization.
- Threats and members are unweighted.
- Flexible ordering does not model switching, energy, alignment, or three-on-
  three battle play.
- Exact TeamRanker simulations and Phase 6 scorecards have not run.
- Strict core diversity can return fewer finalists than the target.
- Work remains synchronous.

## Safe extension points

- Convert each finalist's ordered exact builds directly into a TeamRanker
  request against the existing explicit meta targets.
- Reuse Phase 6 `analyzeSavedTeamMatrix` by extracting a team-independent
  ordered-build preparation boundary.
- Add policy-versioned meta weights without changing exact build contracts.
- Compare exact scorecards while retaining the static pre-score as discovery
  provenance.
- Apply final-result diversity after simulation using species and threat
  profiles.

## Follow-up work

The immediate follow-up was completed in
[Exact finalist simulation and selection](exact-finalist-simulation-and-selection.md).
Static finalists now feed the shared exact TeamRanker boundary, Phase 6
scorecards, alternatives, final selection score, and requested-result
diversity.

The remaining consumer is the recommendation UI and explanation workflow.

## Relevant commits

Not yet committed.
