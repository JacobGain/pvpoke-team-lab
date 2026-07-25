# Full-Data Backup and Atomic Restore

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Route:** `/inventory/backup`  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab backups now protect the complete persisted MVP relationship:
inventory records and the saved teams that reference them.

Schema version two is a self-contained, human-readable artifact. TeamLab
validates every record, current-catalog reference, saved-team member, and
species-clause constraint before export or restore. Merge and replace operate
on both Dexie tables in one transaction.

Legacy schema-version-one inventory backups remain importable.

## Problem being solved

The Phase 2 backup format predated saved teams. Restoring inventory alone
could not recover the user's complete workspace and could leave saved teams
missing their referenced records.

A full-data restore must answer several cross-collection questions:

- Does every team member exist in the incoming inventory?
- Are all incoming inventory records still valid in the current catalog?
- Would a merge overwrite an inventory ID in a way that breaks an unrelated
  local team?
- If one table write fails, can the other table remain unchanged?
- What does replace mean for an older backup that never contained teams?

## Version-two envelope

```text
TeamLabBackup
├── format: "teamlab-backup"
├── schemaVersion: 2
├── exportedAt: ISO datetime
├── inventory: InventoryPokemon[]
└── savedTeams: SavedTeam[]
```

Record schema versions remain independent from backup schema version and the
Dexie database version.

`createTeamLabBackup` structurally parses both collections, validates
inventory against the current catalog, and validates every team against the
complete exported inventory. It throws rather than downloading a snapshot
that TeamLab itself could not restore.

## Import inspection

`inspectTeamLabBackup` accepts:

- version two full-data backups;
- version one inventory-only backups.

Version-one input becomes restore data with `savedTeams: []` and retains
`sourceSchemaVersion: 1` for UI disclosure and result reporting.

Inspection:

1. parses JSON and the supported envelope;
2. validates every inventory schema;
3. finds duplicate inventory IDs;
4. validates every accepted inventory record against the current catalog;
5. validates every saved-team schema;
6. finds duplicate team IDs;
7. resolves each team entirely against the backup inventory;
8. enforces Pokédex-identity species clause;
9. returns all blocking issues without writing.

Issues identify the collection, record index, known record ID, stable category,
and readable message.

## Merge semantics

Merge retains unrelated local inventory and saved teams. Incoming records win
matching `inventoryId` and `teamId` conflicts.

Before writing, the repository constructs the complete final inventory and
team collections in memory. It validates every final inventory record and
every final saved team against that state.

This final-state check matters when an incoming inventory record replaces an
existing ID used by a local team. If its selected species would introduce a
species-clause conflict or invalid reference, the complete merge is rejected.

## Replace semantics

Replace makes the selected backup authoritative:

- inventory absent from the backup is removed;
- saved teams absent from the backup are removed;
- incoming records replace matching identities.

For a legacy version-one backup, the authoritative saved-team collection is
empty. Replace therefore removes existing teams. The UI labels legacy files
as inventory-only and the replace confirmation states that both collections
will be replaced.

## Atomic persistence

`DexieTeamLabBackupRepository` opens one read-write transaction over:

```text
inventory
savedTeams
```

Structural parsing happens before or inside the transaction. Final-state
catalog and team validation happens before the first mutation.

Replace clears and adds both collections inside the transaction. Merge bulk
puts both incoming collections inside the same transaction. Dexie rolls back
both tables if validation throws or a database operation fails.

The result reports incoming, inserted, updated, removed, and final counts for
each collection.

## UI behavior

The existing backup page now:

- loads inventory and saved teams;
- exports `teamlab-backup-YYYY-MM-DD.json`;
- displays both collection counts;
- identifies legacy version-one files;
- reports issues by inventory or saved-team collection;
- explains cross-collection merge and replace behavior;
- confirms destructive replace through the shared in-page confirmation panel;
- displays per-collection restore results;
- invalidates both TanStack Query namespaces after success.

Export errors are visible when current local references are not restorable.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/backup/teamLabBackup.ts` | Version-two envelope, legacy inspection, cross-reference validation contracts, restore result types |
| `src/domain/backup/teamLabBackup.test.ts` | Envelope, legacy, issue, and export-safety characterization |
| `src/infrastructure/backup/DexieTeamLabBackupRepository.ts` | Final-state validation and atomic two-table merge/replace |
| `src/infrastructure/backup/DexieTeamLabBackupRepository.test.ts` | Transaction, result-count, rollback, and legacy-replace characterization |
| `src/infrastructure/backup/index.ts` | Application repository instance |
| `src/features/backup/backupQueries.ts` | Restore mutation and both query-namespace invalidations |
| `src/features/inventory/InventoryBackupPage.tsx` | Full-data export, inspection, restore choices, confirmation, and results |

## Important decisions

- Version two extends the domain artifact instead of dumping Dexie tables.
- Full-data backups are self-contained; saved teams cannot rely on inventory
  that exists only in the destination browser.
- Final merge validity is stricter than incoming-file validity.
- Atomicity belongs in a repository spanning both tables, not in sequential
  feature mutations.
- The Phase 2 inventory-only functions remain unchanged for compatibility and
  their focused characterization.
- Legacy replace is authoritative and removes teams rather than retaining
  potentially orphaned state.

## Rejected or deferred alternatives

- Sequential inventory then team restores were rejected because the first
  operation could commit before the second failed.
- Silently dropping invalid saved teams was rejected because import is
  all-or-nothing.
- Letting version-two teams reference destination-only records was rejected
  because the backup would not be portable.
- Preserving teams during legacy replace was rejected because changed or
  removed inventory could invalidate them.
- Settings were deferred because TeamLab has no persisted settings domain.

## Error handling

- Malformed JSON and unsupported versions fail at the envelope boundary.
- Record schema, duplicate ID, catalog, reference, and species-clause failures
  are collected during inspection.
- Existing invalid state or merge-created invalid state throws
  `TeamLabRestoreValidationError`.
- No invalid inspection can invoke the UI restore mutation.
- A failed repository restore leaves both database tables unchanged.

## Performance considerations

Inspection and final-state validation are linear in inventory records plus
saved-team members, aside from small per-record catalog validations. Restore
uses bulk IndexedDB operations inside one transaction.

The Phase 8 representative-size slice should characterize a 100+ record and
realistic saved-team backup. No worker is expected to be necessary for these
small JSON/domain operations, but measurements should decide.

## Validation

```bash
npm test -- --run src/domain/backup/teamLabBackup.test.ts
npm test -- --run src/infrastructure/backup/DexieTeamLabBackupRepository.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

The eight focused tests cover:

- version-two inventory/team round trip;
- legacy inventory-only inspection;
- complete team schema, duplicate, and legality issue reporting;
- refusal to export a non-restorable snapshot;
- incoming-ID merge precedence across both collections;
- authoritative replace and removal counts;
- transaction rollback when a merge would invalidate an existing team;
- legacy replace clearing saved teams.

## Known limitations

- The route and component names retain their inventory-only Phase 2 origin.
- Existing broken team references block export rather than entering a repair
  workflow.
- Individual issue downloads are not available for very large invalid files.
- Restore has no dry-run comparison beyond inspection and result semantics.
- The shared confirmation panel is inline rather than a focus-trapped modal.

## Safe extension points

- Add a schema-version-three `settings` member when persisted settings exist.
- Add explicit migrations before record inspection.
- Add a pre-restore diff view using the existing collection result model.
- Add a downloadable validation report.
- Move the route to `/backup` with a compatibility redirect if navigation is
  reorganized.

## Follow-up work

Add application-wide destructive controls, then characterize full workflows
with representative inventory sizes.

## Relevant commits

Not yet committed.
