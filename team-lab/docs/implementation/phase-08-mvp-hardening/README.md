# Phase 8 — Backup and MVP Hardening

> **Status:** In progress
> **Project-plan phase:** Phase 8: backup and MVP hardening  
> **Last reviewed:** 2026-07-25

## Objective

Make the complete local-first MVP recoverable, stable with representative
inventory sizes, responsive at supported widths, and understandable without
implementation documentation.

Phase 8 audits existing work before adding new behavior. Inventory-only
backup/restore, clear-inventory controls, recommendation progress/cancellation,
and responsive feature layouts were delivered in earlier phases. Hardening
extends or verifies those capabilities rather than recreating them.

## Implemented scope

- version-two TeamLab backup envelope
- inventory and saved teams in one portable JSON export
- structural validation for both persisted record types
- current-catalog inventory validation during export and import
- saved-team reference and species-clause validation
- complete issue collection across both backup collections
- legacy version-one inventory backup import
- explicit merge and replace semantics across inventory and saved teams
- final merged-state validation
- one Dexie transaction spanning both persisted tables
- rollback when any final-state validation or database operation fails
- inventory and saved-team query invalidation after restore
- application-wide counts and results in the backup UI

## Out of scope

- settings backup until a persisted settings domain exists
- saved analysis or recommendation-run caches
- clear-saved-teams and reset-all controls
- accessible application confirmation dialogs
- representative 100-record profiling
- worker execution for synchronous TeamRanker work
- browser-level workflow tests
- completed cross-feature responsive audit
- local user documentation

## Implementation records

- [Full-data backup and atomic restore](full-data-backup-and-atomic-restore.md)

## Important decisions

- Backup schema version two contains both inventory and saved teams.
- Version one remains accepted as a legacy inventory-only source.
- A full-data export must be restorable when created; TeamLab refuses to
  download an internally illegal snapshot.
- Saved teams in an imported version-two backup must resolve entirely within
  that backup.
- Merge lets incoming IDs win, then validates every final local team against
  the final inventory before writing.
- Replace makes the backup authoritative for both collections.
- Replacing from a legacy version-one file produces an inventory-only final
  state and removes saved teams; the UI discloses this before confirmation.
- Inventory and team writes share one transaction so restore cannot partially
  apply across tables.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Focused characterization verifies version-two round trips, legacy inspection,
complete saved-team issue reporting, refusal to export unrestorable state,
cross-table merge and replace counts, final-state validation, rollback, and
legacy replace semantics.

Observed after the first slice:

```text
npm test          24 files, 71 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- The `/inventory/backup` route name reflects its Phase 2 origin even though
  the workflow now protects all persisted MVP user data.
- A legacy version-one file contains no saved teams.
- Merge intentionally fails if incoming inventory would invalidate an
  unrelated existing saved team.
- An existing broken saved-team reference prevents full-data export until the
  team is repaired or removed.
- Confirmation still uses `window.confirm`.
- No settings table or persisted simulation cache exists to include.

## Exit criteria

- [x] Inventory and saved teams can be exported together.
- [x] Versioned imports are completely validated before persistence.
- [x] Merge and replace are atomic across persisted MVP collections.
- [x] Legacy inventory-only backups remain recoverable.
- [ ] All planned destructive reset controls are available.
- [ ] Core workflows are characterized with 100+ records.
- [ ] Long work remains responsive or is moved to a worker where needed.
- [ ] The responsive audit is complete.
- [ ] Critical browser-level workflow coverage is complete.
- [ ] Local user documentation is complete.
- [x] No TeamLab feature requires edits to inherited upstream source.

## Next phase dependencies

The next Phase 8 slice should consolidate destructive local-data controls:
clear saved teams, clear inventory with reference-aware messaging, and reset
all TeamLab data with explicit confirmation and cache invalidation.

## Relevant commits

Not yet committed.
