# Destructive Local-Data Controls

> **Phase:** Phase 8 — Backup and MVP Hardening  
> **Status:** Implemented  
> **Route:** `/inventory/backup`  
> **Last reviewed:** 2026-07-25

## Summary

TeamLab now exposes every destructive operation required for its persisted MVP
data:

- clear all saved teams while preserving inventory;
- clear inventory only when no saved team can be orphaned;
- reset inventory and saved teams together.

The controls share a repository boundary, exact removal-count results, query
invalidation, and an explicit in-page confirmation workflow. Reset-all
requires the user to type `RESET`.

## Problem being solved

The original inventory-only clear action predated saved teams. Once teams
reference inventory IDs, clearing the inventory table alone would turn every
team into a missing-member recovery state.

The hardening layer must distinguish intentional actions:

```text
clear saved teams
    preserve inventory

clear inventory
    require zero saved teams

reset all TeamLab data
    atomically clear both collections
```

It must also prevent a stale UI count or direct repository call from bypassing
the referential guard.

## Maintenance contract

`LocalDataMaintenanceRepository` exposes:

```text
clearSavedTeams()
clearInventory()
resetAll()
```

Every operation returns:

```text
removedInventoryCount
removedSavedTeamCount
```

The result describes committed removals, not the count displayed before
confirmation.

## Clear saved teams

`clearSavedTeams` counts and clears only `savedTeams` in a read-write
transaction.

Inventory remains unchanged. The UI disables the action when no saved teams
exist and confirms the exact currently visible count.

## Guarded inventory clear

`clearInventory` opens one transaction over both tables:

1. count saved teams;
2. throw `InventoryClearBlockedBySavedTeamsError` when the count is nonzero;
3. count inventory;
4. clear inventory;
5. return the committed count.

The transaction-level check is authoritative. The UI also disables the button
and explains how many teams block the operation, but correctness does not
depend on that presentation check.

Users can clear saved teams first or choose reset-all.

## Reset all

`resetAll` counts and clears inventory and saved teams in one Dexie
transaction. A failure rolls back the complete action.

No persisted settings or analysis cache currently exists, so these two tables
are the complete local MVP data boundary. Future persisted domains must be
added to both this transaction and the backup format.

## Confirmation workflow

Destructive intent is represented by explicit React state:

```text
restore-replace
clear-saved-teams
clear-inventory
reset-all
```

Selecting an action opens a visible `alertdialog`-labeled confirmation panel
that states exact collection counts and recommends downloading a backup.

The panel provides separate Cancel and destructive confirmation buttons.
Reset-all keeps its confirmation disabled until the user types the exact,
case-sensitive text `RESET`.

Backup replace uses the same workflow and identifies both current and incoming
collection counts. Changing the selected file or restore mode closes a stale
confirmation.

## Query consistency

Every maintenance mutation invalidates both TanStack Query namespaces:

```text
inventory
saved-teams
```

Invalidating both is deliberate even for a single-collection clear. Feature
screens therefore refresh from the committed database state, and the
inventory-clear guard state updates immediately after saved teams are cleared.

## File ownership

| File | Responsibility |
| --- | --- |
| `src/domain/maintenance/localDataMaintenance.ts` | Maintenance contract, result, and guarded-clear error |
| `src/infrastructure/maintenance/DexieLocalDataMaintenanceRepository.ts` | Transactional clear and reset operations |
| `src/infrastructure/maintenance/DexieLocalDataMaintenanceRepository.test.ts` | Preservation, guard, and reset characterization |
| `src/infrastructure/maintenance/index.ts` | Application repository instance |
| `src/features/backup/maintenanceQueries.ts` | Mutations and cross-namespace invalidation |
| `src/features/inventory/InventoryBackupPage.tsx` | Counts, blocked states, confirmation flow, and results |
| `src/styles/global.css` | Responsive danger-zone cards and confirmation panel |

## Important decisions

- Bulk inventory clearing is stricter than deleting one inventory record.
- Teams are never silently cascade-deleted by the inventory-only operation.
- Reset-all is explicit rather than an implicit cascade.
- The repository rechecks saved-team count inside the transaction.
- Destructive results report committed counts from IndexedDB.
- Confirmation state lives in the app instead of `window.confirm`.
- Every destructive action reminds the user that JSON backup is the recovery
  path.

## Rejected or deferred alternatives

- Leaving all teams as broken references after bulk inventory clear was
  rejected as avoidable invalid state.
- Automatically deleting teams during “clear inventory” was rejected because
  its label would hide a second destructive effect.
- Relying only on the disabled UI button was rejected because persistence
  invariants belong below React.
- Separate nontransactional reset calls were rejected because one collection
  could clear before the other failed.
- Clearing browser caches is deferred because TeamLab currently has no
  persisted analysis cache; TanStack Query data is in memory.

## Error handling

- `InventoryClearBlockedBySavedTeamsError` includes the authoritative blocking
  team count.
- Mutation errors appear independently from restore errors.
- Buttons are disabled while any local-data mutation or restore is pending.
- Confirmation closes only after success or explicit cancellation.
- Dexie rolls back a failed transactional operation.

## Performance considerations

The operations use table counts and bulk clear operations rather than deleting
records individually. Reset-all touches both small MVP tables in one
transaction.

These actions do not require a worker. The completed
[representative-scale characterization](representative-scale-characterization.md)
measures the adjacent backup and persistence paths with 120 inventory records
and 30 teams.

## Validation

```bash
npm test -- --run src/infrastructure/maintenance/DexieLocalDataMaintenanceRepository.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Characterization verifies:

- saved-team clearing preserves inventory;
- inventory clearing succeeds with no saved teams;
- inventory clearing is rejected without changing either table when a team
  exists;
- reset-all clears both tables and reports both committed counts.

Observed after this slice:

```text
npm test          25 files, 75 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

## Known limitations

- The confirmation panel is inline rather than a focus-trapped modal.
- Individual inventory deletion still permits saved-team recovery states.
- No persisted settings or analysis-cache tables exist to clear.
- The route retains its inventory-oriented Phase 2 name.

## Safe extension points

- Add future persisted settings and caches to `resetAll`.
- Add focus management or a native `<dialog>` without changing maintenance
  semantics.
- Add a pre-reset automatic backup option.
- Expose the maintenance controls from a future application settings route.

## Follow-up work

Representative-scale characterization is complete. The cross-feature
The responsive audit is recorded in
[Responsive and Browser Hardening](responsive-and-browser-hardening.md);
the populated reset/recovery workflow is covered by
[Critical Browser Workflow Coverage](critical-browser-workflow-coverage.md).

## Relevant commits

Not yet committed.
