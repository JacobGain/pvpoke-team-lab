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
- dedicated local-data maintenance repository
- clear-saved-teams while preserving inventory
- guarded inventory clearing that cannot orphan saved teams
- atomic reset-all across inventory and saved teams
- exact removal-count results
- explicit inline confirmation for destructive replace and clear operations
- typed `RESET` confirmation for complete application reset
- inventory and saved-team query invalidation after every maintenance action
- deterministic 120-record and 30-team representative fixture
- reproducible `npm run test:scale` characterization command
- explicit backup, restore, repository, inventory-view, and recommendation
  discovery regression budgets
- map-backed inventory filtering and sorting
- verified 40-partner, 250-team, and finalist work bounds at representative
  scale
- documented worker and virtualization decision for characterized paths

## Out of scope

- settings backup until a persisted settings domain exists
- saved analysis or recommendation-run caches
- worker execution for synchronous TeamRanker work
- browser-level workflow tests
- completed cross-feature responsive audit
- local user documentation

## Implementation records

- [Full-data backup and atomic restore](full-data-backup-and-atomic-restore.md)
- [Destructive local-data controls](destructive-local-data-controls.md)
- [Representative-scale characterization](representative-scale-characterization.md)

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
- Inventory-only clearing fails while any saved team exists, preventing bulk
  operations from manufacturing missing-member state.
- Reset-all is the only operation that intentionally removes both collections
  without preserving references.
- Destructive confirmation is visible application state rather than a browser
  dialog; reset-all additionally requires the exact text `RESET`.
- Static discovery, persistence, and inventory-view measurements do not justify
  worker or virtualization complexity at the MVP target.
- Real browser TeamRanker responsiveness must be verified separately; a fake
  Node adapter would not provide an honest engine measurement.

## Validation

```bash
npm test
npm run test:scale
npm run typecheck
npm run lint
npm run build
```

Focused characterization verifies version-two round trips, legacy inspection,
complete saved-team issue reporting, refusal to export unrestorable state,
cross-table merge and replace counts, final-state validation, restore
rollback, clear-saved-team isolation, guarded inventory clear, atomic
reset-all, legacy replace semantics, and the complete representative-scale
workflow.

Observed after the third slice:

```text
npm test          26 files, 76 tests passed
npm run test:scale passed; representative workflow approximately 307 ms
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
- No settings table or persisted simulation cache exists to include.
- Individual inventory-record deletion can still create a saved-team recovery
  state by design; the bulk inventory-clear operation is stricter.
- Exact browser TeamRanker execution is not represented by the Node scale
  fixture.

## Exit criteria

- [x] Inventory and saved teams can be exported together.
- [x] Versioned imports are completely validated before persistence.
- [x] Merge and replace are atomic across persisted MVP collections.
- [x] Legacy inventory-only backups remain recoverable.
- [x] All planned destructive reset controls are available for persisted MVP
      data.
- [x] Domain, persistence, backup, inventory-view, and static recommendation
      workflows are characterized with 120 records and 30 saved teams.
- [ ] Long work remains responsive or is moved to a worker where needed.
- [ ] The responsive audit is complete.
- [ ] Critical browser-level workflow coverage is complete.
- [ ] Local user documentation is complete.
- [x] No TeamLab feature requires edits to inherited upstream source.

## Next phase dependencies

The next Phase 8 slice should complete the cross-feature responsive audit,
repair any layout or interaction failures at supported widths, and record the
remaining real-browser TeamRanker responsiveness requirement for browser-level
coverage.

## Relevant commits

Not yet committed.
