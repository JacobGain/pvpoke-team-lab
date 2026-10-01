# Phase 3 — IV and Build Analysis

> **Status:** Complete for the current inventory analysis workflow
> **Project-plan phase:** Phase 3: IV/build analysis
> **Last reviewed:** 2026-09-30

## Objective

Translate a persisted current or planned inventory build into an understandable
competitive profile without mutating the inventory record or presenting
stat-product rank as matchup proof.

## Implemented scope

- exact effective Attack, Defense, HP, and stat-product calculation
- exhaustive general 0–15 IV search under Open Great League rules
- ordinal stat-product rank and percentile
- rank-one spread and stat-product comparison
- highest-Attack spread and Attack percentile for CMP context
- immutable current/planned build-analysis read models
- current and derived-maximum planned CP handling
- PvPoke overall rank, score, rating, and meta membership
- all six PvPoke role scores and relative role ranks
- strongest-role selection
- current/recommended moveset comparison
- qualitative evolution, power-up, move, second-move, Frustration, and Elite
  move requirements
- cached ranking tables and TanStack Query analysis results
- per-record `/inventory/:inventoryId/analysis` route
- named Open Great League meta-opponent selection
- explicit opponent default-IV and recommended-fast-move assumptions
- exact CMP comparison for every inferred level
- outgoing fast-move breakpoint and incoming fast-move bulkpoint
- general-IV-space attainability checks
- temporary exact matchup comparisons for current, planned, and alternate
  IV/move builds against selected ranked threats in the active league
- independent shield counts, exact baseline comparison, progress, and
  cancellation for bounded matchup runs

## Out of scope

- charged-move thresholds
- custom opponent builds or non-meta threat selection
- exact Stardust, Candy, XL Candy, or TM inventory costs
- persistent alternate-build planning or saving a comparison
- IV acquisition-floor-specific alternate ranks
- batch analysis fields directly on every dashboard card
- sprites and final visual design

## Implementation records

- [IV ranking and effective stats](iv-ranking-and-effective-stats.md)
- [Build profile, roles, moves, and UI](build-profile-and-ui.md)
- [Named-opponent CMP, breakpoints, and bulkpoints](named-opponent-thresholds.md)
- [Matchup-backed build planning](matchup-backed-build-planning.md)

## Important decisions

- IV rank uses stat product and is never labeled overall competitive quality.
- The initial denominator is the general 0–15 IV search space requested in the
  project plan.
- Ranking uses the standard PvPoke Open Great League level-50 cap. Actual
  level-51 Best Buddy builds can be analyzed, but do not silently change the
  ranking ruleset.
- Percentile is defined explicitly: rank one is 100%, and the last valid
  ordinal rank is 0%.
- Effective stats for an ambiguous CP retain all possible levels; the UI
  identifies which option supplies its displayed stat row.
- Role ranks are derived from the six score positions already present in the
  validated overall ranking artifact.
- Analysis is derived and cached, never persisted into inventory.
- Breakpoint/bulkpoint claims always name and display the assumed opponent.
- Threshold evidence remains separate from exact matchup results.
- An alternate IV spread represents another specimen. Its simulation build is
  fitted to the highest legal level up to level 50 and is not written to the
  owned record.
- Matchup runs use the threat's published default league IVs and recommended
  moves, plus one explicit shield scenario. Results are exact one-on-one
  evidence, not a team score or a prediction of a full battle.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Current automated coverage verifies:

- 4,096-combination generation and cache reuse;
- PvPoke CPM/effective-stat behavior;
- known rank-one Azumarill;
- rank, percentile, rank-one percentage, and Attack context;
- current profile composition;
- current/planned separation;
- recommended-move requirements;
- upstream overall and role metadata;
- dual-type effectiveness and immunity-level resistance;
- named opponent and recommended-fast-move resolution;
- offensive and defensive fast-move threshold behavior;
- candidate move legality and alternate-IV league-cap fitting;
- ranked default-threat selection, exact shield/build request forwarding,
  bounded progress and cancellation, and partial results after a matchup error.

Latest validation on 2026-09-30:

```text
npm test             41 files, 173 tests passed
npm run typecheck    passed
npm run lint         passed
npm run build        passed, including data and Cloudflare artifact checks
```

## Known limitations

- An ordinal ranking assigns positions after PvPoke-compatible stable sorting;
  equal stat products are not collapsed into competition ranks.
- The general IV denominator does not produce separate purified, raid, trade,
  mythical, or research-floor ranks.
- General Attack percentile remains broad context; the named-opponent panel
  supplies an exact Attack comparison.
- Role ranks describe PvPoke's published default build, not a resimulation of
  the user's exact moves and IVs.
- Build costs are qualitative.
- A matchup result applies only to the displayed builds and shield scenario.
  Starting energy, switching, alignment, team play, and battle sequencing
  outside the one-on-one PvPoke simulation are not represented.
- Threat builds use published defaults; custom opponent IVs and moves are not
  supported in this first version.
- Alternate builds and their results are temporary. They are not saved to
  inventory or a build-planning history.

## Exit criteria

- [x] Exact effective stats are calculated.
- [x] IV rank, percentile, and rank-one comparison are visible.
- [x] Current and planned profiles are distinguishable.
- [x] PvPoke overall and role context is visible.
- [x] Moveset comparison and initial build requirements exist.
- [x] Opponent-specific initial breakpoint and CMP insights exist.
- [x] Exact shield-scenario matchup evidence is available for temporary build
  comparisons.
- [x] The phase's final limitations and handoff are documented.

## Next phase dependencies

Saved teams can use these read models for display. Future work can add custom
opponent builds or preserve alternate-build plans after their storage and
inventory semantics are designed.

## Relevant commits

Not yet committed.
