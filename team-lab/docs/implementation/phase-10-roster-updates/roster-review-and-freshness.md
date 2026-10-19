# Roster Comparison, Review, and Analysis Freshness

## Summary

`/updates` joins a public upstream snapshot comparison to local inventory and
saved teams. It provides review and repair actions without modifying recorded
IVs, moves, species, or planned targets.

## Problem being solved

Inventory retains `sourceDataVersion`, but not its original complete Game
Master or rankings. A saved timestamp alone cannot prove which moves or ranks
changed. Teams also need fresh analysis when opponents change, even if all
three owned members are unchanged.

## Implemented behavior

The default source pair is `UPSTREAM_COMPARISON_COMMIT` and
`ACTIVE_SEASON.upstreamCommit`. Sync compares Game Masters and all six overall
ranking collections and generates `data/update-review.json`. The manifest
covers its size/hash. The runtime query uses that hash in its cache key/URL and
rejects mismatched pinned provenance; the domain rejects a different target
data version.

The selected league determines the roster scope: preferred builds, every
member of a team in that format, and missing species saved for its base league.
The review considers owned identity, planned target, and projected Mega
identity. Separate specimens remain separate rows. Ranking changes apply to
the selected effective identity and format.

Changes include species additions/removals, release flags, base stats, types,
level bounds, default IVs, move/Elite TM availability, combat move properties,
rank entries/exits, rank position, and recommended moves. Shifts under ten
places are hidden by default unless another significant change or validation
issue exists. The filter reveals those smaller movements.

Inventory is also validated against the current catalog. A repair issue is
shown even when no historical change record exists. Team checks include
missing members, species clause, league eligibility, and member validation.
Links open inventory/team editors or the existing simulation page; the user
chooses targets/shields and starts the matrix explicitly.

## Architecture and data flow

```text
Outgoing Git pin + active Git pin
  → sync-time validated snapshot comparison
  → manifest-tracked update-review.json
  → runtime Zod validation and hash-keyed query
  → selected catalog + local inventory/teams
  → reviewRoster
  → changed builds, repair issues, and team status
```

## File ownership

| File under `team-lab/` | Responsibility |
| --- | --- |
| `scripts/pvpoke-update-review.ts` | Pure snapshot comparison |
| `scripts/sync-pvpoke-assets.ts` | Source lookup, comparison generation, manifest |
| `src/pvpoke/types/updateReview.ts` | External comparison schema |
| `src/domain/updates/rosterReview.ts` | Owned-build impact and team status |
| `src/features/updates/updateReviewQueries.ts` | Runtime loading, cache, provenance checks |
| `src/features/updates/RosterUpdatePage.tsx` | Review, filtering, repair/analysis links |
| `src/features/updates/RosterUpdateNotice.tsx` | Dashboard reminder eligibility |
| `src/features/updates/reviewReminderStore.ts` | Browser-local dismissal state |
| `src/infrastructure/teams/DexieSavedTeamRepository.ts` | Atomic analysis provenance write |
| `src/features/simulation/SavedTeamSimulationPage.tsx` | Record completed matrix analysis |

## Public interfaces and schemas

The version-one comparison contains `fromVersion`, `toVersion`, `fromCommit`,
`toCommit`, and a species-ID map of descriptions and per-format ranking/move
changes. A source-directory override records a null destination commit.

Saved-team schema version one accepts the optional
`lastAnalyzedUpstreamCommit` alongside `lastAnalyzedDataVersion`. No new table
or database migration is needed. Older backups lacking these optional fields
remain readable. A team without sufficient provenance needs a fresh run.

`recordAnalysis(team, inventory, dataVersion, upstreamCommit)` returns false if
the persisted team or any referenced inventory record differs from the run’s
snapshot. It reads both tables and writes the stamp in one Dexie transaction.
Success updates both provenance fields and the team’s `updatedAt`; edits through
the team factory clear both provenance fields.

Status precedence is `repair`, `not-analyzed`, `outdated`, then `current`.
A different Game Master date, different upstream commit, or member record newer
than the team stamp requires refresh. This timestamp check includes member
metadata edits, so it can conservatively recommend a rerun.

## Important decisions

Both commit and timestamp matter: rankings can change with the same Game Master
date. Completing a run does not mark concurrently changed builds as fresh.
Failure to save freshness does not silently claim the result is current.

The dashboard reminder looks for older source-version records in the selected
base league or analyzed teams with older provenance. It is not a count of every
changed species, and never-analyzed teams alone do not trigger it. The review
remains reachable even when the reminder is absent.

Dismissal uses `team-lab-reviewed-updates` in localStorage and a key containing
the outgoing revision, destination revision (or override version), and format.
At most 24 keys are retained. Storage failure still permits session dismissal.
It does not modify inventory, validate a team, or suppress repair rows.

## Rejected or deferred alternatives

The feature does not infer arbitrary historical data from a saved build, add
old catalogs to every inventory record, persist full matrices, or automatically
migrate removed species to a guessed replacement.

## Error handling

Fetch/schema failures appear on the review with Retry. Provenance/date
mismatches require current assets rather than a misleading empty comparison.
The dashboard omits a reminder when its required data is unavailable. A failed
or concurrently invalidated analysis stamp leaves refresh status outstanding.

## Performance considerations

The public comparison is generated once during sync. Runtime review is memoized
against catalog/inventory/team/query results. The dashboard fetch is disabled
for an empty roster and team library. It does not run simulations.

## Validation

```bash
npm test
npm run validate:data
npm run test:browser -- --roster-updates
npm run build
npm run test:production:artifact -- --roster-updates
npm run test:visual -- --roster-updates
```

`rosterReview.test.ts`, `pvpoke-update-review.test.ts`, and
`DexieSavedTeamRepository.test.ts` cover domain, generation, and persistence
boundaries. Chrome tests seed an outgoing version only in a temporary browser
profile; they verify changed moves, stale/fresh teams, removed-species repair,
dismissal persistence, unchanged owned moves, and 320 px layout.

The scorecard can render before the analysis provenance transaction completes.
Browser workflows must wait for the matrix button to become enabled again
(the run's persistence step has settled), then inspect the saved provenance
before performing a full page navigation. Waiting only for `.team-scorecard`
can interrupt the write and leave the team outdated on slower release runners.
The regression reports the stored stamp and any analysis warning if saving fails;
the subsequent `/updates` assertion still verifies freshness after a reload.

## Known limitations

The comparison describes two published snapshots, not every change since an
older record was created. Ranking movements do not establish exact matchup
changes. Reminder preferences are not included in JSON backups. Matrix results
remain transient; an analysis stamp does not recreate a report after reload.

## Safe extension points

Add change categories in the generator/schema and tests together. Add retained
snapshot history only with explicit storage/provenance rules. Preserve the
atomic snapshot check if freshness persistence moves to another repository.

## Follow-up work

A complete analysis cache, automatic identity migration, or multi-scenario team
comparison requires separate design and validation.

## Relevant commits

`f8fcb68e1`, `cdeef5032`, and `ea1a17f06` introduced this subsystem.
