# Coverage, Threats, and Core Breakers

> **Status:** Implemented
> **Last reviewed:** 2026-07-25

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

## Provisional coverage grade

The initial grade uses covered-target percentage:

| Covered targets | Grade |
| --- | --- |
| 90–100% | S |
| 80–<90% | A |
| 70–<80% | B |
| 60–<70% | C |
| <60% | D |

This is a TeamLab heuristic, not a direct PvPoke Team Builder grade. The UI and
assumptions identify it as scoped and unweighted.

The grade is provisional because:

- Top 5 and Top 48 scopes are not comparable samples;
- all selected targets currently have equal weight;
- one narrow positive matchup counts as an answer;
- battle rating margin is not part of the grade yet.

Future weighting may change the formula, but it must be versioned and retain
this initial definition for old reports.

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
2. initial scorecard:
   - coverage grade;
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

Tests prove:

- two of three targets are covered;
- coverage grade is C;
- three of nine individual matchups favor the team;
- correct `team-wall`, `core-breaker`, and `covered` classifications;
- correct answer/no-answer state;
- member order and records;
- shield scenario, data version, and generated timestamp.

## Known limitations

- Target weights are equal.
- Rating margins do not influence coverage grade.
- A 499 rating and a 100 rating both count as one favorable answer.
- A 501 rating and a 900 rating both count as one target win for threat class.
- Ties are neither wins nor losses.
- The selected top-N scope can materially change the grade.
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
