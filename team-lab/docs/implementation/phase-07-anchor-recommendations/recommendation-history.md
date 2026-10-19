# Recommendation History and Current-Data Comparison

## Summary

Completed recommendation runs are archived locally at `/recommend/history`.
Users can revisit their evidence or rerun a saved request against current data
and compare the selected teams.

## Problem being solved

Transient results disappear on navigation and cannot explain why a preferred
team changed after an upstream or recommendation-policy update.

## Implemented behavior

History preserves the request, anchor snapshots, data/format identity, formula
versions, selected exact-build results, score summaries, requirements, threats,
and alternatives. The page permits per-run deletion and confirmed clearing.

Re-run and compare uses the saved run’s league, anchors, and settings with the
current catalog and inventory. The active league must match. The refreshed run
is saved separately; it does not replace the archived evidence. Team membership
comparison uses species composition, so a changed exact specimen/build or team
ordering is not automatically a distinct species team. Formula changes are
called out because score movement may reflect policy as well as data.

## Architecture and data flow

Completed generation/simulation → validated history snapshot → repository-backed
IndexedDB → archived UI. Rerun → current candidate pool and exact simulation →
new snapshot → composition/score comparison against the earlier run.

## File ownership

| File under `team-lab/` | Responsibility |
| --- | --- |
| `src/domain/recommendations/history.ts` | Versioned snapshots and consistency validation |
| `src/domain/recommendations/historyRepository.ts` | Storage contract |
| `src/infrastructure/recommendations/DexieRecommendationHistoryRepository.ts` | IndexedDB persistence |
| `src/features/recommendations/recommendationHistoryQueries.ts` | Queries/mutations |
| `src/features/recommendations/RecommendationHistoryPage.tsx` | Archive and rerun comparison |
| `src/domain/backup/teamLabBackup.ts` | Portable history backup/restore |

## Public interfaces and schemas

History records use schema version one. The database is version four; full-data
backups use envelope version three and include inventory, saved teams, and
history. Version-one inventory-only and version-two inventory/team backups
remain importable with the documented merge/replace semantics.

Backup validation limits exported/restored history to 5,000 records. Individual
record validation checks request/anchor/result and formula-version consistency.
The history repository does not automatically evict older runs; users can
delete or clear runs before exporting an oversized collection.

## Important decisions

Archived evidence remains historical, even if a species or anchor is later
edited or removed. A rerun must resolve current anchors and legality again.
Archiving a result does not turn it into a reusable full-matrix cache.

## Rejected or deferred alternatives

Overwriting earlier runs, silently rerunning history on every data refresh,
and persisting every battle matrix were not adopted.

## Error handling

Unavailable anchors, mismatched active format, invalid current builds, or
simulation failures can block comparison without deleting the archived run.
History save failures remain separate from presenting a computed result.
Backup inspection validates archived records before any restore write.

## Performance considerations

Only the archived selected-result evidence is retained, not full exact battle
matrices. Reruns retain the bounded/sequential finalist pipeline and cancellation
rules of the recommendation service.

## Validation

Run `npm test` and the complete Chrome workflow. Browser coverage verifies
history persistence, rerun comparison, deletion/clearing, and backup/restore.
The version-three backup path validates and restores all three collections
atomically.

## Known limitations

History is local to one browser profile and origin. Current inventory changes
can alter or block the rerun. Historical scores are not interchangeable when
formula versions differ. Reminder-dismissal preferences and transient team
matrices are not stored in history or backups.

## Safe extension points

Version archive contracts and backup handling together. Add matrix caching only
with explicit request/data/formula identity and invalidation rules.

## Follow-up work

Broader exact-team comparison and retained upstream snapshot histories are
separate extensions, not existing archive guarantees.

## Relevant commits

The 1.2.1 recommendation-history release records the user workflow; use the
owning files above for current persistence and comparison history.
