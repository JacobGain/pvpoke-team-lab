# Inventory Backup and Restore

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Superseded by the Phase 8 full-data workflow
> **Route:** `/inventory/backup`  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab can export its local inventory as a portable, human-readable JSON
backup and restore a validated backup using an atomic merge or replace
transaction. Invalid input never partially changes IndexedDB.

These version-one inventory-only contracts remain supported and characterized.
The user-facing route now creates version-two backups containing inventory and
saved teams through
[Phase 8 full-data backup and atomic restore](../phase-08-mvp-hardening/full-data-backup-and-atomic-restore.md).

## Backup envelope

The export is a TeamLab domain artifact, not a dump of Dexie internals:

```text
InventoryBackup
├── format: "teamlab-backup"
├── schemaVersion: 1
├── exportedAt: ISO datetime
└── inventory: InventoryPokemon[]
```

The backup schema version is independent of:

- the Dexie database version;
- each inventory record's schema version;
- the upstream PvPoke data timestamp.

This separation allows the export container, database layout, persisted record
shape, and external catalog to evolve deliberately.

## Export behavior

`createInventoryBackup` structurally parses every stored record before
producing the envelope. `serializeInventoryBackup` emits indented JSON. The UI
downloads a date-stamped `teamlab-inventory-YYYY-MM-DD.json` file.

Export remains available when inventory is empty, which permits an intentional
empty recovery snapshot.

## Import inspection

Inspection completes before the repository is called:

1. Parse JSON.
2. Validate the envelope format and supported version.
3. Inspect every inventory array element individually.
4. Validate each record's runtime schema.
5. Detect duplicate inventory IDs inside the backup.
6. Validate species, moves, evolution, and CP against the current catalog.
7. Return either a complete valid backup or all blocking record issues.

Issues include record index, known inventory ID, category, and readable
details. The UI reports the full file rather than stopping at the first bad
record.

There is intentionally no partial-import option. A user can retain and repair
the source JSON without wondering which subset entered the database.

## Restore modes

### Merge

- Keep local records whose IDs are absent from the backup.
- Insert new backup IDs.
- Replace matching local IDs with backup records.

The backup wins identity conflicts because the user explicitly selected it as
the incoming recovery source.

### Replace

- Delete local IDs absent from the backup.
- Store exactly the backup inventory.
- Require an additional destructive confirmation.

An empty valid backup therefore clears inventory in replace mode.

## Atomic persistence

`InventoryRepository.restore` accepts already inspected records and a mode.
`DexieInventoryRepository`:

- structurally reparses every record before opening a transaction;
- rejects duplicate IDs;
- calculates inserted, updated, and removed counts;
- performs clear/add or bulk upsert within one read-write transaction;
- returns the final count.

Dexie rolls back the transaction if any database operation fails. Tests also
prove structurally invalid restore input leaves the existing inventory intact.

## Historical clear-inventory behavior

The Phase 2 backup page originally included a separate inventory-only danger
zone. That behavior required browser confirmation and did not know about saved
teams.

Phase 8 supersedes it with
[reference-aware destructive local-data controls](../phase-08-mvp-hardening/destructive-local-data-controls.md).
Bulk inventory clear is now blocked while saved teams exist, clear-saved-team
and reset-all actions are available, and confirmation is explicit application
state.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/domain/inventory/backup.ts` | Envelope, serialization, complete inspection, and issue reporting |
| `team-lab/src/domain/inventory/repository.ts` | Restore mode/result and repository operation |
| `team-lab/src/infrastructure/inventory/DexieInventoryRepository.ts` | Atomic merge/replace implementation |
| `team-lab/src/features/inventory/InventoryBackupPage.tsx` | Download, file inspection, mode selection, confirmation, results, and clearing |
| `team-lab/src/features/inventory/inventoryQueries.ts` | Restore/clear mutations and cache invalidation |

## Validation

`backup.test.ts` covers:

- successful JSON round-trip;
- malformed JSON;
- unsupported envelope/version;
- per-record schema errors;
- duplicate IDs;
- catalog-reference errors;
- complete issue collection.

Repository tests cover merge counts/precedence, replacement/removal, and
unchanged storage after invalid restore input.

## Known limitations

- Version one contains inventory only. Phase 8 version two adds saved teams,
  while settings remain absent because no persisted settings domain exists.
- Only backup schema version one is supported; no export migration is needed
  yet.
- Catalog-invalid historical records block restore rather than entering a
  repair state.
- The version-one subsystem has no saved-team semantics; Phase 8 owns current
  destructive controls.

## Safe extension points

- Add optional `teams` and `settings` members in a new backup schema version.
- Add explicit older-backup migrations before inspection.
- Add a downloadable validation report for very large issue sets.
- Add a repair workflow without weakening atomic restore.

## Relevant commits

Not yet committed.
