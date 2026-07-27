# Inventory Dashboard

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for the initial MVP list  
> **Route:** `/inventory`  
> **Last reviewed:** 2026-07-25

## Summary

The inventory route joins local records to the current catalog and exposes the
information needed to maintain current and planned builds.

## Behavior

- shows local record count;
- searches species identity, display name, and notes;
- filters all, current, or planned builds;
- filters favorites;
- sorts by recent update, species name, or highest CP;
- displays favorite/status, CP, IVs, provenance, inferred level, and moves;
- summarizes desired species, CP, and moves for plans;
- exposes source-data version and update time;
- links to full editing;
- duplicates a record into a new-specimen form;
- links to backup and restore;
- confirms before deletion;
- distinguishes empty inventory from empty filter results.

Cards derive display and inference data from the current catalog and never
write those derived values into IndexedDB.

## Performance

`filterAndSortInventory` builds one catalog identity map per memoized
transformation instead of repeatedly scanning the catalog during filtering and
sort comparisons.

Phase 8 characterization measures a favorite-only species search and sort
over 120 records at approximately 4.3 ms in the recorded Node environment.
Virtualization is not required for the MVP target. Browser rendering remains
part of the responsive audit.

## Known limitations

- Move IDs are displayed instead of polished labels.
- Sprites and final type presentation are deferred.
- Deletion uses the browser confirmation dialog.

## Relevant commits

Not yet committed.
