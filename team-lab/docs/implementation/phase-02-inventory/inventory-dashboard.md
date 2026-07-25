# Inventory Dashboard

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for the initial MVP list  
> **Route:** `/inventory`  
> **Last reviewed:** 2026-07-24

## Summary

The inventory route joins local records to the current catalog and exposes the
information needed to maintain current and planned builds.

## Behavior

- shows local record count;
- searches species identity, display name, and notes;
- filters all, current, or planned builds;
- displays favorite/status, CP, IVs, provenance, inferred level, and moves;
- summarizes desired species, CP, and moves for plans;
- exposes source-data version and update time;
- links to full editing;
- confirms before deletion;
- distinguishes empty inventory from empty filter results.

Cards derive display and inference data from the current catalog and never
write those derived values into IndexedDB.

## Performance

In-memory search and joins are appropriate for the expected 100-record Great
League inventory. Database indexes remain available for future larger queries.

## Known limitations

- Move IDs are displayed instead of polished labels.
- Sprites and final type presentation are deferred.
- Sort options and favorite-only filtering are not implemented.
- Deletion uses the browser confirmation dialog.

## Relevant commits

Not yet committed.
