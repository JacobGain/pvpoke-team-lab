# Phase 8 — Backup and MVP Hardening

> **Status:** Complete for MVP
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
- complete routed-feature responsive source audit
- verified 320 px no-overflow browser matrix across directly reachable routes
- repaired native backup file-input overflow
- compact mobile cards, forms, actions, progress, and diagnostics presentation
- route-level feature code splitting with an accessible loading boundary
- production entry chunk reduced below Vite's 500 kB warning threshold
- real-browser TeamRanker diagnostic passed with bounded timing
- self-contained `npm run test:browser` Chrome workflow suite
- isolated local servers, temporary browser profile, bounded commands, and
  guaranteed process cleanup
- real-UI creation of 12 catalog-backed inventory records
- populated inventory analysis/edit and saved-team create/edit coverage
- Top-20 saved-team TeamRanker measurement
- Top-48 recommendation cancellation coverage
- default nine-finalist recommendation measurement and selected-team save
- downloaded backup, typed reset, native file inspection, and complete restore
- populated 320 px analysis, simulation, recommendation, and reset checks
- asynchronous saved-team member-default hydration repair
- measured no-worker decision for current MVP browser workflows
- complete local setup and operation guide
- user-facing inventory, analysis, team, simulation, and recommendation
  instructions
- browser-origin, backup/recovery, destructive-control, and troubleshooting
  guidance

## Out of scope

- settings backup until a persisted settings domain exists
- saved analysis or recommendation-run caches
- public hosting and deployment documentation
- screenshots, video walkthroughs, and translated guides

## Implementation records

- [Full-data backup and atomic restore](full-data-backup-and-atomic-restore.md)
- [Destructive local-data controls](destructive-local-data-controls.md)
- [Representative-scale characterization](representative-scale-characterization.md)
- [Responsive and browser hardening](responsive-and-browser-hardening.md)
- [Critical browser workflow coverage](critical-browser-workflow-coverage.md)
- [Local user documentation](local-user-documentation.md)

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
- Real browser TeamRanker performance is measured in the actual upstream
  runtime; a fake Node adapter would not provide honest engine evidence.
- A 320 CSS-pixel viewport is the responsive MVP lower bound.
- Feature pages load at route boundaries; home and not-found remain eager.
- Current Top-20 saved-team, Top-48 cancellation, and default finalist
  measurements do not justify a worker boundary. A future event-loop-gap
  regression must reopen that decision.
- User operation belongs in `docs/USER-GUIDE.md`; implementation records remain
  contributor-facing.
- The supported local startup includes both inherited PvPoke Docker and the
  TeamLab Vite server.

## Validation

```bash
npm test
npm run test:scale
npm run test:browser
npm run typecheck
npm run lint
npm run build
npm run validate:data
```

Focused characterization verifies version-two round trips, legacy inspection,
complete saved-team issue reporting, refusal to export unrestorable state,
cross-table merge and replace counts, final-state validation, restore
rollback, clear-saved-team isolation, guarded inventory clear, atomic
reset-all, legacy replace semantics, and the complete representative-scale
workflow.

Observed after the sixth slice:

```text
npm test          26 files, 76 tests passed
npm run test:scale passed
npm run test:browser passed; complete isolated UI recovery workflow
npm run typecheck passed
npm run lint      passed
npm run build     passed; largest entry chunk approximately 406 kB
npm run validate:data passed against checked-in upstream data
Top-20 TeamRanker 122 ms end-to-end / 27 ms maximum pulse gap
Top-48 cancel     152 ms end-to-end / 38 ms maximum pulse gap
default recommend 70 ms end-to-end / 21 ms maximum pulse gap
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
- Browser automation currently targets Chrome rather than a multi-browser
  compatibility matrix.
- The 12-record browser fixture complements the 120-record Node scale fixture.
- Local documentation does not define a supported production deployment.

## Exit criteria

- [x] Inventory and saved teams can be exported together.
- [x] Versioned imports are completely validated before persistence.
- [x] Merge and replace are atomic across persisted MVP collections.
- [x] Legacy inventory-only backups remain recoverable.
- [x] All planned destructive reset controls are available for persisted MVP
      data.
- [x] Domain, persistence, backup, inventory-view, and static recommendation
      workflows are characterized with 120 records and 30 saved teams.
- [x] Long work remains responsive or is moved to a worker where needed.
- [x] The responsive audit is complete.
- [x] Critical browser-level workflow coverage is complete.
- [x] Local user documentation is complete.
- [x] No TeamLab feature requires edits to inherited upstream source.

## Next phase dependencies

Phase 8 is complete for the MVP. Post-MVP work should follow
`docs/PROJECT-PLAN.md` and preserve the backup, responsive, browser, and user
documentation contracts established here.

## Relevant commits

Not yet committed.
