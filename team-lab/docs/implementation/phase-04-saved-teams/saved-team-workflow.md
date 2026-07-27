# Saved-Team Query and Editor Workflow

> **Status:** Implemented
> **Routes:** `/teams`, `/teams/new`, `/teams/:teamId`
> **Last reviewed:** 2026-07-25

## Outcome

The Phase 4 domain can now be used through a complete local saved-team
workflow. A user can create, reopen, edit, reorder, duplicate, repair, and
delete an ordered Great League team.

## Query integration

`savedTeamQueries.ts` owns the TanStack Query key family:

```text
["saved-teams"]
["saved-teams", "list"]
["saved-teams", "detail", teamId]
```

It exposes list/detail queries and create/update/delete mutations. Successful
mutations invalidate the saved-team family. Update also refreshes its detail
entry, and delete removes the deleted detail entry.

React code depends on the repository contract through the composed
`savedTeamRepository`; it does not import Dexie.

## Live team resolution

`resolveSavedTeam` joins a persisted team with current inventory and catalog
snapshots every time the team list is rendered.

For every ordered member it returns one of:

- `resolved`
- `missing-inventory`
- `missing-species`

The resolver never removes or silently substitutes a member. A deleted
inventory reference remains in its original lead/switch/closer position and
the team becomes incomplete. The card presents “Needs attention” and links to
the same editor as a repair workflow.

Planned records resolve to their desired target species. Current records
resolve to their current species.

## Saved-team list

`/teams` displays:

- team name and Great League format;
- ready/needs-attention status;
- ordered lead, safe switch, and closer;
- planned status when applicable;
- notes;
- update time;
- last-analysis data version or “not yet analyzed”;
- edit/repair, duplicate, and delete actions.

Deletion requires browser confirmation. It deletes only the saved team and
never its referenced inventory records.

The home page and inventory dashboard link to saved teams.

## Ordered editor

The create and edit workflow uses three semantically named selectors:

1. Lead
2. Safe switch
3. Closer

Inventory choices show:

- resolved species/form;
- effective current or planned CP;
- current/planned status;
- exact IV spread.

Position buttons swap members without changing inventory records. Selectors
remain available for direct replacement.

The editor supplies early feedback when the same inventory ID occupies more
than one position. The domain factory remains authoritative on submit and also
enforces species clause across distinct records.

If fewer than three inventory records exist, the editor links to manual
inventory entry instead of presenting an unsavable form.

## Create, edit, and duplicate behavior

Create:

- chooses the first three recently ordered inventory records as editable
  defaults;
- generates a new saved-team UUID;
- validates structure and legality;
- persists only after validation succeeds.

Edit:

- preserves team identity and creation timestamp;
- resets stale analysis-version metadata;
- persists changed order, members, name, and notes.

Duplicate:

- loads an existing team through its detail query;
- pre-fills the same ordered members and notes;
- suffixes the name with `copy`;
- generates a new UUID on save.

A duplicated incomplete team must be repaired before it can be saved.

## Recovery behavior

An existing team can contain a now-missing inventory UUID because inventory
deletion does not cascade. The editor retains that UUID as a visible “missing
inventory record” option until the user selects a replacement.

This protects team intent and makes data loss explicit.

## Files

| File | Responsibility |
| --- | --- |
| `src/domain/teams/resolution.ts` | Live saved-team read model |
| `src/domain/teams/resolution.test.ts` | Ordered and missing-member behavior |
| `src/features/teams/savedTeamQueries.ts` | TanStack Query integration |
| `src/features/teams/SavedTeamsPage.tsx` | Saved-team list and actions |
| `src/features/teams/SavedTeamFormPage.tsx` | Create/edit/duplicate/repair workflow |
| `src/app/router.tsx` | Saved-team routes |
| `src/app/routes/HomePage.tsx` | Home navigation |
| `src/features/inventory/InventoryPage.tsx` | Inventory-to-teams navigation |
| `src/styles/global.css` | Team cards, order editor, and responsive layout |

## Validation

Observed on 2026-07-25:

```text
npm test          11 files, 33 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed with the existing >500 kB chunk warning
```

The new resolver coverage proves:

- stored lead/switch/closer order survives resolution;
- inventory and catalog records are resolved live;
- deleting an inventory record produces an incomplete recovery state;
- the missing reference and its position remain available.

## Known limitations

- There are no component/browser interaction tests yet.
- Inventory options use a native select; richer search is deferred.
- Reordering uses explicit swap controls rather than drag and drop.
- The list has no search, sorting, pagination, or format filters yet.
- Species-clause conflicts across different inventory IDs are explained after
  domain validation on submit rather than disabled preemptively.
- Team backup/restore is not yet integrated with inventory backup.
- Deleting inventory does not proactively invalidate saved-team queries, but
  the team page also consumes the invalidated inventory query and resolves
  current state on render.
- Full scorecards and simulation actions belong to Phase 5.

## Next phase

Proceed to the Phase 5 simulation adapter. Saved-team backup/restore and
inventory usage visibility remain useful enhancements, but the Phase 4 project
plan exit criterion is satisfied by the current create/edit/order/save/reopen
workflow.
