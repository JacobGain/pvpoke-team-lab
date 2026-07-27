# IV Ranking and Effective Stats

> **Phase:** Phase 3 — IV and Build Analysis
> **Status:** Complete for the initial Open Great League ruleset
> **Last reviewed:** 2026-07-25

## Summary

TeamLab derives exact battle stats and ranks an IV spread by maximum legal stat
product under a documented Open Great League ruleset.

## Effective stats

For a supported half-level and CP multiplier:

```text
Attack  = (baseAttack  + attackIV)  × CPM
Defense = (baseDefense + defenseIV) × CPM
HP      = floor((baseHP + hpIV) × CPM), minimum 10
Product = Attack × Defense × HP
```

These calculations use the same CPM table characterized from
`src/js/pokemon/Pokemon.js` during Phase 2.

## Ranking ruleset

```text
CP cap:       1500
Level cap:    50
IV floor:     0
IV ceiling:   15
Combinations: up to 4096
Level step:   0.5
Species floor: normalized upstream levelFloor
```

For every IV triplet, TeamLab finds the highest supported level at or below
1500 CP, calculates effective stats, and sorts descending by stat product.
Iteration/tie order matches PvPoke's HP/Defense/Attack descending generation.

Combinations that cannot enter the CP cap at the species floor are omitted.
For ordinary Great League species, all 4,096 combinations are valid.

## Rank and percentile

Rank is an ordinal array position after sorting:

```text
rank = sorted index + 1
```

Percentile is:

```text
(count - rank) / (count - 1) × 100
```

Therefore:

- rank one is 100%;
- the final rank is 0%;
- percentile is not the percentage of matchups won.

`statProductPercentage` compares the selected IV combination's optimized stat
product with rank one's product.

## Actual build versus optimized combination

The analysis deliberately exposes two related values:

- actual effective stats at the inventory record's entered CP/level;
- the same IV triplet's highest-legal-CP ranking combination.

This prevents an underpowered specimen from receiving incorrect current stats
while retaining the conventional IV-rank meaning.

## Attack/CMP context

The ranking summary also contains:

- the legal combination with highest effective Attack;
- the selected IV triplet's Attack percentile.

This helps explain Attack weighting and future CMP analysis. It is not a CMP
win claim because CMP depends on the opposing exact build.

## Caching

Ranking tables are cached by:

- species ID;
- base stats;
- species level floor;
- CP cap;
- ranking level cap.

Multiple inventory records for the same species reuse the immutable table.
Analysis queries are additionally keyed by inventory ID, record update time,
and upstream data version.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/domain/analysis/ivRankings.ts` | Stats, legal level search, exhaustive ranking, percentile, and cache |
| `team-lab/src/domain/pokemon/combatPower.ts` | Shared CP multiplier and CP calculation foundation |
| `team-lab/src/domain/analysis/ivRankings.test.ts` | Ranking and effective-stat characterization |

## Safe extension points

- Add explicit alternate level caps as named rulesets.
- Add acquisition-floor variants without changing the general rank.
- Move table generation into a Web Worker if batch profiling demonstrates
  main-thread pressure.
- Persist no ranking cache until invalidation and size policy are designed.

## Relevant commits

Not yet committed.
