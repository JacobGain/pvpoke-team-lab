# Exact What-if Substitutions

> **Phase:** Phase 6 — Team Analysis
>
> **Status:** Implemented
>
> **Route:** `/teams/:teamId/simulate`

## Summary

After the baseline exact team report completes, the user can select one team
position and replace it with another eligible owned build. TeamLab reruns the
three-member team against the same ordered targets, data version, and shield
settings. The preview compares coverage, all four scorecard dimensions, and
changed threat evidence without changing the saved team.

The user can confirm an update to the original team or save the lineup as a
separately named team.

## Candidate rules

- A candidate must project into the active league catalog.
- The candidate cannot already occupy another position in the team.
- The projected species must satisfy the existing team species clause, which
  compares Pokédex numbers.
- Exact inventory identity is retained for simulation and persistence; the
  projected build is used for active-league display and eligibility.

## Comparison contract

The experiment request copies the baseline target limit and shield counts. The
domain comparison also checks the data version and ordered target species IDs
before presenting a delta. A mismatch fails with an explicit comparison error
instead of mixing unrelated reports.

Results show:

- answered-target count and newly answered / no-longer-answered targets;
- before-and-after grade, normalized score, raw PvPoke value, and delta for
  Coverage, Bulk, Safety, and Consistency;
- changed target wins and average rating, plus the replaced position's member
  rating where available;
- the exact before-and-after CP, build status, and IVs.

## Persistence

Saving a copy validates a new saved team using the tested member IDs, original
notes, and user-entered name. Updating the existing team requires an explicit
confirmation and changes only its members. A successful overwrite reruns the
baseline matrix for the updated team and current report scope.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/teamAnalysis/whatIf.ts` | Validates comparable analyses and derives score, coverage, and threat deltas |
| `src/features/simulation/TeamWhatIfPanel.tsx` | Candidate selection, exact rerun, comparison, and save actions |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Places the feature after the baseline scorecard and refreshes after overwrite |
| `src/styles/modules/teams-simulation.css` | Responsive what-if presentation |

## Limits

The feature tests one replacement at a time. It does not search all owned
combinations or resimulate unowned published-counter suggestions. The inherited
engine runs synchronously, so large target scopes can temporarily occupy the
browser tab.
