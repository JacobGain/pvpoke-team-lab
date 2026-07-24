# Inventory CRUD Verification

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete as an engineering verification surface  
> **Route:** `/inventory`  
> **Last reviewed:** 2026-07-24

## Summary

The temporary inventory route proves that the browser application can create,
read, update, and delete validated records through the complete production
stack.

## Implemented behavior

- loads the current catalog and IndexedDB inventory;
- offers released catalog entries with a default IV spread and usable moves;
- creates a current build with an explicit rank-one assumption;
- selects recommended moves when available, otherwise valid movepool entries;
- lists persisted records;
- toggles favorite to verify update behavior;
- deletes records;
- reports errors;
- invites a page reload to verify browser persistence.

## Purpose and boundary

This screen is intentionally not the final manual-entry workflow. It avoids
making visual/form decisions before level inference, exact IV input,
current/planned editing, and evolution validation are ready.

Its purpose is to verify this path:

```text
catalog selection
  → domain factory
  → structural/catalog validation
  → React Query mutation
  → repository
  → IndexedDB
  → validated query read
  → rendered card
```

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/features/inventory/InventoryPersistencePage.tsx` | Verification form, list, favorite toggle, deletion, and states |
| `team-lab/src/features/inventory/inventoryQueries.ts` | Persistence query/mutation integration |
| `team-lab/src/app/router.tsx` | Registers `/inventory` |
| `team-lab/src/app/routes/HomePage.tsx` | Links to the verification route |
| `team-lab/src/styles/global.css` | Temporary responsive presentation |

## Known limitations

- Creates current records only.
- Uses assumed IVs only.
- Moves are selected automatically.
- Edit is limited to favorite state.
- Delete has no confirmation because records are currently test data.
- It is not optimized for rapid entry or a 100-record dashboard.

These are intentional boundaries, not the finished inventory UX.

## Follow-up work

Replace or evolve this route into the project-plan manual-entry and inventory
dashboard workflows after exact build validation is available. Preserve the
domain factory, repository, and query boundaries.

## Relevant commits

Not yet committed.
