# IndexedDB and Inventory Repositories

> **Phase:** Phase 2 — Inventory Domain and Persistence  
> **Status:** Complete for basic CRUD  
> **Last reviewed:** 2026-07-25

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
TeamLab IndexedDB
```

## Inventory table

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

The database is now at version two because Phase 4 adds a `savedTeams` table.
The inventory table and its indexes are unchanged from version one.

The Dexie database version and each record’s `schemaVersion` solve different
problems:

- Dexie version controls storage/index migrations.
- Record version controls persisted JSON/domain migrations.

### Later database versions

Phase 4 advanced the database to version 3 for saved teams. TeamLab v1.2.1
advances it to version 4 and adds the indexed `recommendationHistory` table;
existing inventory and saved-team records require no data transformation.

## Repository contract

```text
list()
get(inventoryId)
create(record)
update(record)
delete(inventoryId)
count()
clear()
restore(records, mode)
```

`create` rejects duplicate identity. `update` and `delete` reject missing
identity. There is no generic `save`/upsert operation because accidentally
creating during an edit can hide workflow bugs.

`clear` exists for future backup/reset operations but is not exposed by the
inventory repository's ordinary record screens. It is exposed in the
confirmed backup/reset workflow.

`restore` performs either merge or replace semantics in one Dexie transaction.
The incoming backup wins matching IDs during merge. Replace removes records
absent from the backup.

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

- The original version-two migration was additive. Later version 3 added saved
  teams and version 4 added recommendation history without transforming
  inventory records.
- No cross-tab change notification exists.
- Import/export is implemented for inventory; teams/settings do not yet exist.
- There is no retry/recovery UI for browser quota or IndexedDB availability
  failures.

## Relevant commits

Not yet committed.
