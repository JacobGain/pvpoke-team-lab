# TeamLab CSV Inventory Import

> **Status:** Implemented in TeamLab 1.2.3
> **Route:** `/inventory/import`
> **Last reviewed:** 2026-09-30

## Scope

The inventory page links to a browser-local CSV import for exact current
builds. The importer uses the TeamLab template rather than adapting third-party
export formats. Users can download a header-only template, fill it in a
spreadsheet, then upload it for validation and review.

The required columns are `species_id`, `cp`, `attack_iv`, `defense_iv`,
`hp_iv`, `fast_move_id`, and `charged_move_1_id`. The optional columns are
`charged_move_2_id`, `mega_species_id`, `favorite`, and `notes`. Column order
can vary. Unrecognized columns are called out and ignored.

Only current builds are imported. CP, IVs, and moves are required; the importer
does not fill missing values with PvPoke defaults. Species and moves are
resolved against the active bundled catalog and validated through the same
inventory factory used by manual entry. Invalid rows stay out of the batch and
are shown with their row-level reason.

## Duplicate semantics

The preview checks the incoming build against local inventory and earlier
rows in the file. Its fingerprint uses the exact species/form ID, CP, IV
values, fast move, and charged moves. It does not compare notes or record IDs.
Potential duplicates are skipped by default, with an explicit option to import
all of them. The app cannot infer whether two identical builds represent one
Pokémon listed twice or two distinct specimens; it never merges or overwrites
existing records.

## Parsing and persistence

- Files are read through the browser `File` API and are not sent to a server.
- UTF-8 BOM, quoted CSV values, escaped quotes, CRLF/LF line endings, commas,
  semicolons, and tab separators are supported.
- Files are limited to 5 MiB and 500 data rows per batch.
- Valid, non-skipped records use the existing `createMany` inventory mutation.
  That mutation inserts records; it does not update existing IDs.
- TeamLab JSON backup and restore remains the transfer path for planned builds,
  saved teams, and recommendation history.

## Owning files

- `src/domain/inventory/csvImport.ts` — parser, template headers, catalog
  validation, preview, and duplicate detection
- `src/features/inventory/InventoryCsvImportPage.tsx` — file selection,
  preview, duplicate choice, and batch insert
- `src/features/inventory/InventoryPage.tsx` — inventory entry point
- `src/app/router.tsx` and `src/app/LazyRoutePages.tsx` — import route
- `src/styles/modules/inventory-csv-import.css` — responsive presentation
