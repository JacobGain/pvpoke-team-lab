# Phase 4 — Saved Teams

> **Status:** In progress — domain and persistence foundation complete
> **Project-plan phase:** Phase 4: saved teams
> **Last reviewed:** 2026-07-25

## Objective

Allow a user to persist an ordered, legal Great League team made from exactly
three inventory records:

1. Lead
2. Safe switch
3. Closer

Saved teams reference inventory identities rather than copying Pokémon builds.
Inventory therefore remains the source of truth for later analysis and
simulation.

## Implemented scope

- version-one saved-team Zod schema
- explicit Open Great League format identity
- persisted lead, switch, and closer order
- three distinct inventory-reference requirement
- names, notes, timestamps, and optional analysis-version metadata
- inventory-reference resolution
- current/planned target-species resolution
- Pokédex-identity species clause
- stable legality issues and typed aggregate error
- create/update factories
- analysis freshness invalidation on update
- storage-independent repository contract
- Dexie CRUD implementation with read/write validation
- additive TeamLab IndexedDB version-two schema
- characterized version-one inventory preservation during upgrade
- real IndexedDB tests through `fake-indexeddb`

## Deferred scope

- TanStack Query hooks
- saved-team list and editor routes
- member selection UI
- drag/drop or button-based reordering
- duplicate-team workflow
- deleted-member recovery UI
- team backup and restore
- scorecards and simulation results

## Implementation records

- [Saved-team domain and persistence](saved-team-domain-and-persistence.md)

## Exit criteria

- [x] Saved-team record shape is versioned and runtime validated.
- [x] Lead, switch, and closer order is persisted.
- [x] Exactly three distinct inventory references are required.
- [x] Missing references and species-clause conflicts are rejected.
- [x] CRUD persistence is implemented behind a repository contract.
- [ ] User can create and edit a team in the UI.
- [ ] User can reopen, reorder, duplicate, and delete saved teams.
- [ ] Missing/deleted members have a visible recovery state.

## Next slice

Add query integration and an ordered saved-team editor. The editor should
resolve inventory references live, explain legality issues before saving, and
retain explicit lead/switch/closer semantics on desktop and responsive layouts.

## Relevant commits

Not yet committed.
