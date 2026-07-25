# Bulk, Safety, and Consistency Scorecard

> **Status:** Implemented for the initial MVP heuristic
> **Last reviewed:** 2026-07-25

## Outcome

The saved-team analysis now displays all four planned scorecard dimensions:

```text
Coverage
Bulk
Safety
Consistency
```

Each dimension includes:

- numeric score from 0–100;
- S–D grade;
- evidence source;
- documented method;
- evidence count and denominator where applicable.

The methods intentionally combine different evidence classes rather than
presenting every grade as simulation output.

## Evidence taxonomy

| Dimension | Evidence source |
| --- | --- |
| Coverage | Exact TeamRanker matchups |
| Bulk | Exact effective Defense and HP |
| Safety | Exact TeamRanker matchup distribution |
| Consistency | Static published PvPoke role score |

The UI displays these sources beneath the grade and in a dedicated “How these
grades were calculated” section.

## Shared grade bands

All four scores use the same initial grade bands:

| Score | Grade |
| --- | --- |
| 90–100 | S |
| 80–<90 | A |
| 70–<80 | B |
| 60–<70 | C |
| <60 | D |

Shared bands make the first scorecard readable. They do not imply that the
dimensions are statistically interchangeable.

## Bulk

### Formula

For each exact team member:

```text
member bulk = effective Defense × effective HP
```

The member receives a percentile within the selected exact meta targets:

```text
member bulk percentile =
  selected targets with bulk <= member bulk / selected targets
```

Team bulk score:

```text
average of the three member bulk percentiles
```

### Why Defense × HP

Attack is intentionally excluded because this dimension describes durability,
not total stat product or offensive pressure.

Effective Defense and HP come from:

- exact species base stats;
- exact IVs;
- exact level;
- PvPoke-compatible CP multiplier behavior.

The target comparison uses the same default IV/level builds that were supplied
to TeamRanker.

### Interpretation

Bulk is relative to the selected meta scope. A member can be highly bulky
against Top 5 targets and less exceptional against Top 48. The score does not
measure typing, shields, moveset resistance, or actual time-to-faint.

## Safety

Safety combines two simulated distribution signals.

### Answer redundancy

A target has a redundant answer when at least two team members are favored
against it.

```text
redundancy percentage =
  targets with at least two favorable members / selected targets
```

This measures whether losing one alignment still leaves another answer.

### Designated safe-switch coverage

The saved team’s persisted second position is the safe switch.

```text
switch coverage =
  safe-switch favorable matchups / selected targets
```

TeamLab does not silently choose a different safe switch based on the matrix.
Changing order changes this score on the next run.

### Formula

```text
safety score =
  60% answer redundancy
  + 40% designated safe-switch coverage
```

The weighting emphasizes structural overlap while retaining the user’s
intended safe-switch role.

### Interpretation

Safety is a TeamLab heuristic over exact simulations. It is not equivalent to
PvPoke’s published individual Safety role score and does not model switching
timers or three-on-three alignment.

## Consistency

Every ranked catalog entry can carry the sixth score from PvPoke’s overall
ranking artifact, normalized as `roleScores.consistency`.

Team consistency score:

```text
average published consistency score across ranked team members
```

The result records:

- ranked-member count;
- total team-member count.

An unranked member is omitted rather than assigned zero. The UI displays the
coverage, for example `2/3 ranked members`.

### Interpretation

Consistency is static upstream metadata for PvPoke’s published default build.
It is not recalculated for the user’s exact IVs and entered moves. This
distinction remains visible in the evidence source.

## Prepared evidence extension

Phase 5 request preparation now retains a TeamLab-owned score evidence bundle:

```text
members[]
  position
  speciesId
  exact effective stats
  optional PvPoke role scores

targets[]
  speciesId
  exact effective stats
```

The evidence bundle travels with `SavedTeamRankerRun`. Analysis therefore uses
the exact subjects and target scope that produced the matrix rather than
reloading potentially changed catalog state afterward.

No raw upstream `Pokemon` object is retained.

## UI

The first scorecard row now shows:

- Coverage grade and covered-target percentage;
- Bulk grade, score, and exact-stat source;
- Safety grade, score, and simulated-distribution source;
- Consistency grade, score, and ranked-member coverage.

The following evidence panel states each formula in plain language.

Threat, member, and raw matrix sections remain below the scorecard for
inspection.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/simulation/teamRanker.ts` | Captures exact member/target score evidence for saved teams and recommendations |
| `src/domain/teamAnalysis/teamAnalysis.ts` | Score contracts, formulas, grades |
| `src/domain/teamAnalysis/teamAnalysis.test.ts` | Formula characterization |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Scorecard and method display |

## Characterization coverage

The synthetic test uses:

- target bulk values at 100, 200, and 300;
- member bulk values at 300, 200, and 100;
- one target with two team answers;
- safe switch favored in one of three matchups;
- consistency scores 90, 80, and 70.

It proves:

- bulk score 66.67, grade C;
- safety score 33.33, grade D;
- consistency score 80, grade A;
- correct evidence sources and counts;
- existing coverage/threat classifications remain unchanged.

The Phase 5 preparation tests also continue to prove that evidence is derived
from independently valid exact builds.

## Known limitations

- Grade bands and safety weights are initial TeamLab heuristics.
- Bulk is unweighted and relative to selected targets.
- Bulk does not incorporate typing or damage taken.
- Safety does not simulate switching or team battle sequencing.
- Safe switch is the persisted second slot, even if another member has a
  better matrix.
- Consistency describes published default builds, not exact inventory builds.
- Missing consistency scores reduce evidence coverage and are omitted.
- A team with no ranked consistency evidence currently receives score zero.
- Scores are not version-tagged with a separate formula version yet.
- Target weights remain equal.

## Required future hardening

Before scorecards are cached or compared historically:

1. add a TeamLab analysis formula version;
2. include it in cache/export keys;
3. decide whether target meta weights should alter all dimensions;
4. characterize grades against representative competitive teams;
5. preserve prior formula interpretation during migrations.
