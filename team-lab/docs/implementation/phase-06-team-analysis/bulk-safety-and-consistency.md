# PvPoke-Compatible Team Scorecard

> **Status:** Implemented
> **Last reviewed:** 2026-07-26

## Outcome

Saved-team simulations and recommendation finalists display Coverage, Bulk,
Safety, and Consistency with PvPoke's Open Great League formulas, goals, and
A–F grade thresholds.

TeamLab retains its richer exact matchup evidence, threat classifications, and
member coverage counts. Those supporting metrics no longer define the four
headline letter grades.

## Grade thresholds

PvPoke converts each raw dimension to a letter by comparing it with that
dimension's goal:

| Percentage of goal | Grade |
| --- | --- |
| 90% or higher | A |
| 80–<90% | B |
| 70–<80% | C |
| 60–<70% | D |
| Below 60% | F |

TeamLab normalizes the values to 0–100 only for recommendation weighting and
compact display. It does not introduce an S grade.

## Dimension formulas

### Coverage

The six most difficult results in the selected simulation scope are ordered by
PvPoke's TeamRanker score. TeamLab averages their target-side battle ratings,
then applies PvPoke's threat-score formula:

```text
coverage value = 1200 - average threat rating
Great League goal = 680
```

The supporting “answered targets” count remains an exact TeamLab matrix
metric. Choosing the Greater Meta scope produces the closest comparison with
PvPoke Team Builder. A smaller explicit target scope can still differ because
PvPoke Team Builder searches a broader counter pool and removes similar
counters.

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

Recommendation final score version `recommendation-final-score-v2` retains the
existing weights:

```text
25% PvPoke-formula Coverage
15% PvPoke Bulk
20% PvPoke Safety
10% exact-moveset PvPoke Consistency
30% versioned static pre-score
```

The overall recommendation score is still TeamLab selection policy. Its four
team-analysis inputs now share PvPoke's definitions.

## Files

| File | Responsibility |
| --- | --- |
| `src/pvpoke/simulation/PvpokeTeamRankerAdapter.ts` | Captures upstream bulk and exact-moveset consistency |
| `src/domain/simulation/contracts.ts` | Carries upstream grade evidence |
| `src/domain/teamAnalysis/teamAnalysis.ts` | PvPoke formulas, goals, and A–F grades |
| `src/domain/teamAnalysis/teamAnalysis.test.ts` | Formula characterization |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Grade and evidence display |

## Known scope difference

Exact Bulk, Safety, and Consistency inputs match the checked-in upstream
implementation. Coverage uses the same formula over TeamLab's explicitly
selected targets. It can differ from the public Team Builder when the selected
scope is smaller or its six threats differ after PvPoke's similarity filtering.
