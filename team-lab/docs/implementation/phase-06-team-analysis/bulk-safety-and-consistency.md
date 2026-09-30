# Team Scorecard Formulas

> **Status:** Implemented
> **Last reviewed:** 2026-09-30

## Outcome

Saved-team simulations and recommendation finalists display Coverage, Bulk,
Safety, and Consistency with A–F grades. Coverage uses TeamLab's continuous,
meta-rank-weighted rating formula. Bulk, Safety, and Consistency use PvPoke
formulas and goals.

TeamLab retains its richer exact matchup evidence, threat classifications, and
member coverage counts. Those supporting metrics no longer define the four
headline letter grades.

## Grade thresholds

The scorecard converts each dimension to a letter by comparing it with that
dimension's goal:

| Percentage of goal | Grade |
| --- | --- |
| 90% or higher | A |
| 80–<90% | B |
| 70–<80% | C |
| 60–<70% | D |
| Below 60% | F |

TeamLab normalizes the values to 0–100 for recommendation weighting and
compact display. It does not introduce an S grade. Coverage uses a TeamLab
680-point reference goal; the other dimensions use their PvPoke goals.

## Dimension formulas

### Coverage

Every target in the selected simulation scope contributes. Its weight is based
on its overall catalog rank, which stays the same when the selected Top-N
scope changes:

```text
weight(rank) = 1 / √rank
weighted target rating = Σ(target average rating × weight) / Σ(weight)
coverage value = 1200 - weighted target rating
TeamLab reference goal = 680
```

This is a continuous TeamLab score, not PvPoke's six-threat score. Higher
ranked targets have greater influence, and lower-ranked targets still
contribute. The supporting “answered targets” and “positive matchups” metrics
remain exact, raw, and unweighted counts. A larger selected scope can change
the weighted average, but the added lower-ranked targets have less influence.

### Bulk

The upstream runtime supplies each configured team member's effective Defense,
including Shadow modifiers. TeamLab uses PvPoke's formula and Great League
goal:

```text
member bulk = effective Defense × HP
team bulk = average member bulk
Great League goal = 22,000
```

### Safety

PvPoke Team Builder uses the published overall-ranking Switch score
(`scores[2]`) for each species, with a fallback of 60 when the species is not
ranked:

```text
team safety = average member Switch score
Great League goal = 98
```

### Consistency

The loaded upstream Pokémon objects calculate consistency from the exact
entered fast and charged moves after the matrix run:

```text
team consistency = average exact-moveset consistency
Great League goal = 98
```

This preserves PvPoke's bait-dependence, move-energy, type-overlap, chance-buff,
and special-move penalties. It replaces the previous static ranking-score
approximation.

## Recommendation impact

Recommendation final score version `recommendation-final-score-v3` retains the
existing weights:

```text
25% rank-weighted TeamLab Coverage
15% PvPoke Bulk
20% PvPoke Safety
10% exact-moveset PvPoke Consistency
30% versioned static pre-score
```

The overall recommendation score is still TeamLab selection policy. Bulk,
Safety, and Consistency use PvPoke definitions; Coverage uses TeamLab's
rank-weighted formula.

## Files

| File | Responsibility |
| --- | --- |
| `src/pvpoke/simulation/PvpokeTeamRankerAdapter.ts` | Captures upstream bulk and exact-moveset consistency |
| `src/domain/simulation/contracts.ts` | Carries upstream grade evidence |
| `src/domain/teamAnalysis/teamAnalysis.ts` | Coverage weighting, scorecard goals, and A–F grades |
| `src/domain/teamAnalysis/teamAnalysis.test.ts` | Formula characterization |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Grade and evidence display |

## Known scope difference

Exact Bulk, Safety, and Consistency inputs match the checked-in upstream
implementation. Coverage is a TeamLab-specific rank-weighted aggregate over
its explicitly selected target set, so its grade is not directly comparable
to the public Team Builder's six-threat score.
