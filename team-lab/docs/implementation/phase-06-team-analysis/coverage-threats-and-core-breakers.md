# Coverage, Threats, and Core Breakers

> **Status:** Implemented
> **Last reviewed:** 2026-09-30

## Outcome

The saved-team simulation screen now derives the first Phase 6 competitive
analysis from exact TeamRanker output.

It answers:

- How many selected meta targets have at least one team answer?
- What percentage of all individual matchups favor the team?
- Which member covers the largest share of this scope?
- Which targets beat one, two, or all three team members?
- Which threats still have one answer?
- Which targets are complete team walls?

## Rating direction

Upstream TeamRanker matrix rankings are target-oriented:

```text
target rating > 500  → target favored
target rating = 500  → tie/neutral
target rating < 500  → team member favored
```

TeamLab uses explicit integer boundaries:

```text
TARGET_FAVORED_RATING = 501
TEAM_MEMBER_FAVORED_RATING = 499
```

A rating of exactly 500 is counted as a tie. Team-member display ratings are
the inverse `1000 - targetRating`.

These rules are domain constants with automated characterization, not
component-local display assumptions.

## Coverage definitions

### Covered target

A selected meta target is covered when at least one team member has a
team-favored rating of 501 or higher, equivalently a target-side rating of 499
or lower.

```text
covered target percentage =
  targets with at least one favorable member / selected targets
```

This measures whether the team has an answer. It does not require all three
members to beat the target.

### Positive matchup percentage

```text
positive matchup percentage =
  team-favored individual battles / all target × member battles
```

This is intentionally separate from target coverage. A team can cover nearly
every target through one specialist while still have a poor overall individual
matchup distribution.

## Rank-weighted Coverage score

The Coverage grade uses continuous TeamRanker target-side ratings from every
selected target. Each target is weighted by its global catalog rank:

```text
weight(rank) = 1 / √rank
weighted target rating = Σ(target average rating × weight) / Σ(weight)
coverage value = 1200 - weighted target rating
TeamLab reference goal = 680
```

The global rank is fixed across Top-N scopes. A higher-ranked target has more
influence, but lower-ranked targets still contribute. The A–F grade compares
the value with the TeamLab reference goal using the scorecard's standard
90/80/70/60 percent thresholds. This is a TeamLab score, not a PvPoke Team
Builder grade.

The supporting counts remain unweighted:

- “answered targets” counts each target with at least one favorable team
  member once;
- “positive matchups” counts each favorable target/member battle once.

The score uses rating margins continuously; the raw answer and win/loss/tie
counts continue using the exact 499/500/501 boundaries described above.

## Threat definitions

For each target:

| Classification | Meaning |
| --- | --- |
| `covered` | Favored against zero members |
| `threat` | Favored against one member |
| `core-breaker` | Favored against at least two members |
| `team-wall` | Favored against every evaluated member |

A core breaker can still be covered if the remaining member beats it.

`hasTeamAnswer` is therefore stored separately from `threatLevel`.

Major threats include:

- every target favored against two or more members; or
- a target whose average target-side rating exceeds 500.

They are ordered by:

1. number of team members beaten;
2. average target-side rating.

This preserves both broad structural danger and rating strength.

## Member evidence

Every ordered member receives:

- lead/switch/closer position;
- resolved species ID;
- favorable matchups;
- unfavorable matchups;
- ties;
- positive matchup percentage;
- average member-side rating.

Member summaries use matchup array position from the exact ordered request.
They do not attempt to reassign roles based on performance.

## Analysis provenance

`SavedTeamAnalysis` retains:

- complete `SavedTeamRankerScope`;
- selected and available target counts;
- exact target species IDs;
- team/target shield counts;
- source data version;
- generated timestamp;
- engine assumptions;
- TeamLab rating and coverage assumptions.

Changing target count or shields requires a new simulation and produces a new
analysis. No old scorecard is silently reused.

## UI

The saved-team simulation route now presents, in order:

1. measured engine scope and performance;
2. scorecard:
   - rank-weighted Coverage grade and raw coverage counts;
   - covered-target percentage;
   - positive matchup percentage;
   - core-breaker/team-wall counts;
3. major-threat evidence;
4. individual member records;
5. raw target matrix;
6. complete assumptions.

The raw matrix remains visible so an advanced player can verify how a summary
was derived.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/teamAnalysis/teamAnalysis.ts` | Thresholds, coverage, threats, and provenance |
| `src/domain/teamAnalysis/teamAnalysis.test.ts` | Synthetic matrix characterization |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Evidence presentation |
| `src/styles/global.css` | Scorecard and threat layouts |

## Characterization fixture

The synthetic fixture contains:

- one target favored against all three members;
- one target favored against two members but answered by the third;
- one target favored against none, with one exact tie.

The characterization fixture demonstrates:

- two of three targets are covered;
- target ratings contribute according to their global rank;
- three of nine individual matchups favor the team;
- correct `team-wall`, `core-breaker`, and `covered` classifications;
- correct answer/no-answer state;
- member order and records;
- shield scenario, data version, and generated timestamp.

## Interpretation and limitations

- Raw answer counts remain unweighted: a 499 rating and a 100 rating both
  count as one favorable answer.
- A 501 rating and a 900 rating both count as one target win for threat class.
- Ties are neither wins nor losses.
- Rating margin changes the continuous score; exact 499/500/501 boundaries
  still determine raw win/loss/tie counts.
- The selected Top-N scope can change the weighted score, though lower-ranked
  targets have less influence.
- Species IDs are displayed in some detailed rows; richer catalog presentation
  is deferred.
- Bulk, safety, and consistency are not inferred from coverage.
- No alternative suggestions are generated yet.
- Analysis is derived in memory after each run and not cached.

## Next dependency

The next scorecard slice should combine:

- exact effective-stat evidence from Phase 3 for bulk;
- matchup rating distribution and answer redundancy for safety;
- upstream role/consistency metadata for consistency.

Each score must identify whether it is simulated, static upstream metadata, or
a TeamLab heuristic.
