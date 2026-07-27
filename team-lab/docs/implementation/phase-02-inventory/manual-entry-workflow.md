# Manual Inventory Entry and Editing

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for the initial MVP workflow  
> **Routes:** `/inventory/new`, `/inventory/:inventoryId`  
> **Last reviewed:** 2026-07-25

## Summary

The manual workflow creates and edits complete current or planned Great League
records using the catalog for species, moves, assumptions, and evolutions.

## Create flow

1. Select an exact species/form/Shadow variant.
2. Enter current CP.
3. Enter actual IVs or accept the visibly labeled upstream default assumption.
4. Review live exact level inference.
5. Select one fast move and one or two charged moves.
6. Mark the record current or planned.
7. For a plan, select the same species or a direct evolution, optional target
   CP, and desired moves.
8. Optionally favorite the record and add notes.
9. Save after structural, catalog, evolution, movepool, and CP validation.

New records default to the upstream Great League spread when available and
calculate its exact CP at the published level.

## Editing

Editing preserves `inventoryId` and `createdAt`, refreshes `updatedAt` and
`sourceDataVersion`, permits current/planned transitions, and validates the
complete replacement before the repository update.

## High-volume entry

The same form now supports repetitive inventory entry:

- a species search field narrows the native species/form selector by display
  name or stable ID;
- native controls retain keyboard navigation;
- `Save and add another` saves without returning to the dashboard;
- the just-saved build seeds the next form as useful defaults;
- the next save still receives a new `inventoryId` and timestamps;
- a compact success message reports the current local inventory count;
- every dashboard card has a Duplicate action that seeds a new record;
- duplication never reuses persistence identity or creation metadata.

The carried record is loaded through the repository and passed only as initial
form state. The normal creation factory remains the sole owner of new
identity.

## Exact identity and moves

The species selector uses exact form and Shadow catalog variants. The catalog
also exposes Return for Shadow-eligible normal variants and Frustration for
Shadow variants, supporting purified moves without a first-class purified
state.

## Planned builds

Targets may be the current species for a moveset-only plan or one direct
upstream evolution. Desired moves come from the target. Optional target CP
must be possible with the specimen’s IVs.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/features/inventory/InventoryFormPage.tsx` | Create/edit UI and live inference |
| `team-lab/src/domain/inventory/factory.ts` | Creation and identity-preserving replacement |
| `team-lab/src/domain/inventory/validation.ts` | Blocking semantic validation |
| `team-lab/src/app/router.tsx` | Create and edit routes |

## Known limitations

- The species filter plus native select is functional; a richer ARIA
  autocomplete combobox may improve very large-list navigation later.
- Only direct evolution steps are selectable.
- IV rank, breakpoints, and costs belong to later analysis.
- Batch import from third-party scanners remains future work.

## Relevant commits

Not yet committed.
