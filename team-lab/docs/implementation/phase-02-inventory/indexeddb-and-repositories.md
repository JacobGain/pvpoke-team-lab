# IndexedDB and Inventory Repositories

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for basic CRUD  
> **Last reviewed:** 2026-07-24

## Summary

Inventory is stored locally in IndexedDB through Dexie. Feature code depends
on an `InventoryRepository` contract rather than Dexie APIs, preserving a
future path to Firestore or another implementation.

## Data flow

```text
React feature
    ↓ TanStack Query mutation/query
InventoryRepository
    ↓
DexieInventoryRepository
    ↓ validate write/read
TeamLab IndexedDB v1
```

## Database version one

Database name: `team-lab`

```text
inventory:
  &inventoryId,
  buildStatus,
  speciesId,
  favorite,
  createdAt,
  updatedAt
```

`inventoryId` is the unique primary key. The remaining indexes support likely
inventory filters and deterministic recent-update ordering. Compound and
analysis-specific indexes are intentionally deferred until queries require
them.

The Dexie database version and each record’s `schemaVersion` solve different
problems:

- Dexie version controls storage/index migrations.
- Record version controls persisted JSON/domain migrations.

## Repository contract

```text
list()
get(inventoryId)
create(record)
update(record)
delete(inventoryId)
count()
clear()
```

`create` rejects duplicate identity. `update` and `delete` reject missing
identity. There is no generic `save`/upsert operation because accidentally
creating during an edit can hide workflow bugs.

`clear` exists for future backup/reset operations but is not exposed by the
verification UI.

## Validation and errors

All writes pass through `inventoryPokemonSchema`. All reads are parsed again,
which protects the domain from manual IndexedDB edits, partial old releases,
or failed future migrations.

Stable errors are:

- `InventoryRecordAlreadyExistsError`
- `InventoryRecordNotFoundError`
- `InvalidStoredInventoryRecordError`

Invalid stored data remains in IndexedDB. The repository surfaces the record
ID and validation cause so a future repair/export flow can recover it.

## Query integration

`inventoryQueries.ts` centralizes keys and exposes list/create/update/delete
hooks. Successful mutations invalidate the inventory key family. Detail cache
entries are updated or removed where appropriate.

No Dexie-specific live-query hook reaches React. This keeps the feature
compatible with asynchronous remote repositories later, although cross-tab
live synchronization is not implemented.

## File ownership

| File | Responsibility |
| --- | --- |
| `team-lab/src/infrastructure/database/TeamLabDatabase.ts` | Dexie instance, version, table, and indexes |
| `team-lab/src/infrastructure/inventory/DexieInventoryRepository.ts` | Contract implementation and boundary validation |
| `team-lab/src/infrastructure/inventory/index.ts` | Application repository composition |
| `team-lab/src/features/inventory/inventoryQueries.ts` | React Query keys and hooks |

## Performance considerations

The initial target is 100+ Great League records. Indexed queries and compact
records are comfortably sufficient. `list()` currently loads and validates
the complete inventory, which is desirable at this scale because corruption
is detected immediately. Pagination and virtualization can be introduced if
multi-league inventories become materially larger.

## Validation

Repository tests use `fake-indexeddb`, not mocks of repository methods. They
exercise the real Dexie schema and prove:

- complete CRUD and count behavior;
- update ordering metadata;
- duplicate and missing-record errors;
- invalid data is reported and retained.

## Known limitations

- No version-two migration exists yet.
- No cross-tab change notification exists.
- No import/export transaction exists.
- There is no retry/recovery UI for browser quota or IndexedDB availability
  failures.

## Relevant commits

Not yet committed.
