# Inventory Validation

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for structural and catalog validation  
> **Last reviewed:** 2026-07-24

## Summary

Inventory validation uses two layers so stable record rules do not become
entangled with whichever PvPoke dataset is currently loaded.

## Layer one: structural validation

Zod validates facts intrinsic to the persisted record:

- schema version is exactly supported version one;
- inventory identity is a UUID;
- CP is an integer from 10 through 1500;
- each IV is an integer from 0 through 15;
- IV provenance is explicit;
- a moveset has one fast move and one or two unique charged moves;
- current/planned variants contain the correct fields;
- notes and IDs have bounded lengths;
- timestamps are ISO datetimes;
- update time is not earlier than creation time.

This layer runs without a loaded catalog and protects persistence reads and
writes.

## Layer two: catalog-aware validation

Semantic validation checks:

- current `speciesId` exists;
- current fast and charged moves belong to that exact catalog entry;
- assumed rank-one records have a published default Great League spread;
- planned target species exists;
- desired moves belong to the planned target;
- current CP is possible at an upstream-supported half-level;
- planned target is the same species or a direct evolution;
- optional target CP is possible with the specimen's IVs.

Issues contain a stable code, field path, and readable message.
`InventoryCatalogValidationError` preserves the full issue list.

## Why the layers are separate

The same version-one record may be structurally valid while its upstream
reference needs repair after a data update. Treating these conditions
separately allows TeamLab to:

- load and export the user’s data;
- report catalog drift precisely;
- avoid rewriting records when rankings change;
- migrate persisted shape independently of upstream changes.

Creation currently requires both layers to pass.

## Derived exact-build validation

Exact inference is documented in
[Combat power and level inference](combat-power-and-level-inference.md).
Inferred level is recalculated and not stored.

Evolution currently supports a same-species moveset plan or one direct
upstream evolution edge. Multi-stage evolution planning is deferred.

### Great League eligibility

Released/ranked status is not canonical eligibility. Inventory creation does
not convert missing ranking into an invalid record.

## Error handling

Validation failures reject creation before persistence. Unsupported data
already in IndexedDB raises `InvalidStoredInventoryRecordError` and remains
untouched for later recovery.

## Safe extension points

- Add acquisition-source-specific warnings if authoritative data supports
  them.
- Add multi-stage evolution traversal if the workflow needs it.
- Add warnings separately from blocking issues.
- Keep user-facing form mapping outside the core validators.

## Relevant commits

Not yet committed.
